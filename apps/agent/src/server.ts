import http from 'node:http';
import { getVersionInfo } from '@speakcore/shared';
import type { HealthStatus, VersionInfo } from '@speakcore/types';
import type { AgentConfig } from './config';
import type {
  Ts3ContainerCreateRequest,
  Ts3ContainerStartRequest,
  Ts3ContainerRemoveRequest,
  Ts3ContainerStatusRequest,
  Ts3ContainerStopRequest,
  Ts3ProvisionInput,
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
