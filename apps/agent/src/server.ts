import http from 'node:http';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getVersionInfo } from '@speakcore/shared';
import type { HealthStatus, VersionInfo } from '@speakcore/types';
import type { AgentConfig } from './config';
import type {
  Ts3ContainerCreateRequest,
  Ts3ContainerStartRequest,
  Ts3ContainerRemoveRequest,
  Ts3ContainerStatusRequest,
  Ts3ContainerStopRequest,
  Ts3BackupListRequest,
  Ts3BackupVerifyRequest,
  Ts3ProvisionInput,
  Ts3VolumeBackupRequest,
  Ts3VolumeRemoveRequest,
} from '@speakcore/types';
import { extractBearerToken, isValidToken } from './auth';
import { gatherSystemInfo } from './system-info';
import { gatherDockerInventory } from './docker-inventory';
import { prepareProvision } from './docker-write';
import { createTs3Container } from './docker-container';
import { startTs3Container } from './docker-start';
import { stopTs3Container } from './docker-stop';
import { removeTs3Container } from './docker-remove';
import { removeTs3Volume } from './docker-volume-remove';
import { removeTs3Network } from './docker-network-remove';
import { backupTs3Volume, DEFAULT_BACKUP_IMAGE } from './docker-backup';
import { listTs3VolumeBackups, METADATA_MAX_BYTES } from './backup-list';
import { verifyTs3VolumeBackup } from './backup-verify';
import { resolveBackupDownload } from './backup-download';
import { getManagedContainerStatus } from './docker-status';
import { dockerExec } from './docker-cli';

const MAX_BODY_BYTES = 64 * 1024;

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

const startedAt = Date.now();

/**
 * SHA-256 einer Datei im serverseitigen Backup-Verzeichnis – gestreamt, **kein Entpacken**,
 * Inhalt verlässt den Agent nie (Step 034/035). `null` bei Lesefehler.
 */
function sha256OfFile(dir: string, fileName: string): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    try {
      const hash = createHash('sha256');
      const stream = createReadStream(join(dir, fileName));
      stream.on('error', () => resolve(null));
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    } catch {
      resolve(null);
    }
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: AgentConfig,
): Promise<void> {
  const url = new URL(req.url ?? '/', `http://localhost:${config.port}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    const body: HealthStatus = {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
    sendJson(res, 200, body);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/version') {
    const body: VersionInfo = getVersionInfo();
    sendJson(res, 200, body);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/system/snapshot') {
    // Read-only Systemdaten. Wenn ein Bootstrap-Token gesetzt ist, wird es hier erzwungen
    // (health/version bleiben für Liveness offen). Ohne Token: nur im privaten Netz vorsehen.
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    const info = await gatherSystemInfo();
    sendJson(res, 200, info);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/docker/inventory') {
    // Read-only Inventar der SpeakCore-managed Docker-Ressourcen (Token-gated wie /system/snapshot).
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    const inventory = await gatherDockerInventory();
    sendJson(res, 200, inventory);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/docker/provision/download-backup') {
    // READ-ONLY Backup-Download (Step 037): streamt GENAU EINE strikt validierte tar.gz aus
    // AGENT_BACKUP_DIR. Token-Gate, KEIN Write-Flag (kein Docker, keine Schreibaktion, kein
    // Entpacken, kein Directory Listing). Fehler nur als normalisierte Codes – keine Host-Pfade.
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    const dlBackupDir = process.env.AGENT_BACKUP_DIR ?? '/var/lib/speakcore/backups';
    const resolved = await resolveBackupDownload(
      {
        instanceId: url.searchParams.get('instanceId') ?? '',
        fileName: url.searchParams.get('fileName') ?? '',
      },
      {
        dirAvailable: async () => {
          try {
            return (await stat(dlBackupDir)).isDirectory();
          } catch {
            return false;
          }
        },
        statFile: async (fileName) => {
          try {
            const s = await stat(join(dlBackupDir, fileName));
            return s.isFile() ? { sizeBytes: s.size } : null;
          } catch {
            return null;
          }
        },
      },
    );
    if (resolved.status === 'invalid') {
      sendJson(res, 400, { error: 'invalid' });
      return;
    }
    if (resolved.status === 'backupDirUnavailable') {
      sendJson(res, 503, { error: 'backupDirUnavailable' });
      return;
    }
    if (resolved.status !== 'ok' || !resolved.fileName) {
      sendJson(res, 404, { error: 'backupNotFound' });
      return;
    }
    // Streaming ohne Komplett-Einlesen: ReadStream → Response (Backpressure via pipe).
    const stream = createReadStream(join(dlBackupDir, resolved.fileName));
    stream.on('error', () => {
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'error' });
      } else {
        res.destroy();
      }
    });
    stream.once('open', () => {
      res.writeHead(200, {
        'content-type': resolved.contentType ?? 'application/gzip',
        'content-length': String(resolved.sizeBytes ?? 0),
        'content-disposition': `attachment; filename="${resolved.fileName}"`,
        'cache-control': 'no-store',
      });
      stream.pipe(res);
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/docker/provision/prepare') {
    // Erste schreibende Aktion: nur managed Network/Volume anlegen (kein Container/TS3).
    // Token-Pflicht + Write-Feature-Flag; Ergebnis enthält keine Secrets.
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_request' });
      return;
    }
    const result = await prepareProvision(body as Ts3ProvisionInput, {
      writeEnabled: config.dockerWriteEnabled === true,
      exec: dockerExec,
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/docker/provision/create-container') {
    // Managed Container ERSTELLEN (kein Start). Token-Pflicht + Write-Feature-Flag.
    // Der Request-Body enthält das ServerQuery-Admin-Secret (nur serverseitig, als ENV gesetzt).
    // Es wird NICHT geloggt; das Ergebnis enthält keine Secrets.
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_request' });
      return;
    }
    const result = await createTs3Container(body as Ts3ContainerCreateRequest, {
      writeEnabled: config.dockerWriteEnabled === true,
      exec: dockerExec,
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/docker/provision/start-container') {
    // Managed Container STARTEN (nur `docker start`). Token-Pflicht + Write-Feature-Flag.
    // Lizenzzustimmung muss im Body explizit true sein. Kein Log-Lesen, keine Secrets im Ergebnis.
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_request' });
      return;
    }
    const result = await startTs3Container(body as Ts3ContainerStartRequest, {
      writeEnabled: config.dockerWriteEnabled === true,
      exec: dockerExec,
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/docker/provision/backup-volume') {
    // Echtes Volume-Backup (read-only Quelle) in ein SERVERSEITIGES Verzeichnis. Token + Write-Flag.
    // Backup-Dir/Image serverseitig; kein freier Pfad/Image/Arg vom Client. Keine Secrets im Ergebnis.
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_request' });
      return;
    }
    const backupDir = process.env.AGENT_BACKUP_DIR ?? '/var/lib/speakcore/backups';
    const backupImage = process.env.AGENT_BACKUP_IMAGE ?? DEFAULT_BACKUP_IMAGE;
    const result = await backupTs3Volume(body as Ts3VolumeBackupRequest, {
      writeEnabled: config.dockerWriteEnabled === true,
      exec: dockerExec,
      backupDir,
      backupImage,
      ensureDir: async (d) => {
        try {
          await mkdir(d, { recursive: true });
          return true;
        } catch {
          return false;
        }
      },
      writeMetadata: async (p, c) => {
        try {
          await writeFile(p, c, 'utf8');
          return true;
        } catch {
          return false;
        }
      },
      // SHA-256 der erzeugten Datei (Step 034): gestreamt, kein Entpacken, kein Inhalt im Response.
      computeSha256: (fileName) => sha256OfFile(backupDir, fileName),
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/docker/provision/list-backups') {
    // READ-ONLY Backup-Liste (Step 033): nur Verzeichniseinträge + metadata.json aus AGENT_BACKUP_DIR.
    // Token-Gate, KEIN Write-Flag nötig (kein Docker, kein Prozessaufruf, kein Download/Restore/Delete).
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_request' });
      return;
    }
    const listBackupDir = process.env.AGENT_BACKUP_DIR ?? '/var/lib/speakcore/backups';
    const result = await listTs3VolumeBackups(body as Ts3BackupListRequest, {
      listDir: async () => {
        try {
          const entries = await readdir(listBackupDir, { withFileTypes: true });
          // Symlinks/Verzeichnisse ⇒ isFile false (werden im Modul verworfen, nie verfolgt).
          return entries.map((e) => ({ name: e.name, isFile: e.isFile() }));
        } catch {
          return null;
        }
      },
      statFile: async (fileName) => {
        try {
          const s = await stat(join(listBackupDir, fileName));
          if (!s.isFile()) return null;
          return {
            sizeBytes: s.size,
            createdAt: s.birthtime.toISOString(),
            modifiedAt: s.mtime.toISOString(),
          };
        } catch {
          return null;
        }
      },
      readMetadataFile: async (fileName) => {
        try {
          const s = await stat(join(listBackupDir, fileName));
          if (!s.isFile() || s.size > METADATA_MAX_BYTES) return null;
          return await readFile(join(listBackupDir, fileName), 'utf8');
        } catch {
          return null;
        }
      },
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/docker/provision/verify-backup') {
    // READ-ONLY Backup-Verify (Step 035): SHA-256 neu berechnen + mit metadata.json vergleichen.
    // Token-Gate, KEIN Write-Flag (kein Docker, kein Prozessaufruf, KEINE Schreibaktion, kein Entpacken).
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_request' });
      return;
    }
    const verifyBackupDir = process.env.AGENT_BACKUP_DIR ?? '/var/lib/speakcore/backups';
    const result = await verifyTs3VolumeBackup(body as Ts3BackupVerifyRequest, {
      dirAvailable: async () => {
        try {
          return (await stat(verifyBackupDir)).isDirectory();
        } catch {
          return false;
        }
      },
      fileExists: async (fileName) => {
        try {
          return (await stat(join(verifyBackupDir, fileName))).isFile();
        } catch {
          return false;
        }
      },
      readMetadataFile: async (fileName) => {
        try {
          const s = await stat(join(verifyBackupDir, fileName));
          if (!s.isFile() || s.size > METADATA_MAX_BYTES) return null;
          return await readFile(join(verifyBackupDir, fileName), 'utf8');
        } catch {
          return null;
        }
      },
      computeSha256: (fileName) => sha256OfFile(verifyBackupDir, fileName),
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/docker/provision/remove-network') {
    // Managed VOICE-NETWORK entfernen (nur `docker network rm`, kein Force). Token + Write-Feature-Flag.
    // Global/shared: nur wenn KEIN managed Container mehr existiert. Keine Volume-/Container-/Record-Löschung.
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    // Body wird nicht benötigt (fester Network-Name), aber sauber konsumieren.
    try {
      await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_request' });
      return;
    }
    const result = await removeTs3Network({
      writeEnabled: config.dockerWriteEnabled === true,
      exec: dockerExec,
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/docker/provision/remove-volume') {
    // Managed DATENVOLUME entfernen (nur `docker volume rm`, kein -f). Token-Pflicht + Write-Feature-Flag.
    // Datenverlust! Nur ohne Container, nur managed Volume. Keine Network-/Credential-/Record-Löschung.
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_request' });
      return;
    }
    const result = await removeTs3Volume(body as Ts3VolumeRemoveRequest, {
      writeEnabled: config.dockerWriteEnabled === true,
      exec: dockerExec,
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/docker/provision/remove-container') {
    // Managed Container ENTFERNEN (nur `docker rm`, kein -f/-v). Token-Pflicht + Write-Feature-Flag.
    // Keine Volume-/Network-/Credential-Löschung, kein Log-Lesen, keine Secrets im Ergebnis.
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_request' });
      return;
    }
    const result = await removeTs3Container(body as Ts3ContainerRemoveRequest, {
      writeEnabled: config.dockerWriteEnabled === true,
      exec: dockerExec,
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/docker/provision/stop-container') {
    // Managed Container STOPPEN (nur `docker stop`). Token-Pflicht + Write-Feature-Flag.
    // Kein rm/restart, kein Log-Lesen, keine Secrets im Ergebnis, keine Löschung.
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_request' });
      return;
    }
    const result = await stopTs3Container(body as Ts3ContainerStopRequest, {
      writeEnabled: config.dockerWriteEnabled === true,
      exec: dockerExec,
    });
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/docker/provision/container-status') {
    // Read-only Laufzeit-Status eines managed Containers. Nur Token-Gate (kein Write-Flag nötig).
    // Nur `container ls` mit Label-Filtern; kein inspect/logs/exec, keine Secrets, keine Roh-Ausgabe.
    if (config.bootstrapToken && !isValidToken(extractBearerToken(req), config.bootstrapToken)) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: 'bad_request' });
      return;
    }
    const result = await getManagedContainerStatus(body as Ts3ContainerStatusRequest, {
      exec: dockerExec,
    });
    sendJson(res, 200, result);
    return;
  }

  sendJson(res, 404, { error: 'not_found' });
}

/**
 * Baut den Agent-HTTP-Server (NDF Step 006).
 * Endpunkte: GET /health, GET /version, GET /system/snapshot (read-only).
 * KEINE Host-/Docker-Steuerung.
 */
export function buildServer(config: AgentConfig): http.Server {
  return http.createServer((req, res) => {
    handle(req, res, config).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { error: 'internal' });
    });
  });
}
