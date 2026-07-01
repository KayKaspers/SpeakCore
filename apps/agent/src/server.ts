import http from 'node:http';
import { getVersionInfo } from '@speakcore/shared';
import type { HealthStatus, VersionInfo } from '@speakcore/types';
import type { AgentConfig } from './config';
import type { Ts3ProvisionInput } from '@speakcore/types';
import { extractBearerToken, isValidToken } from './auth';
import { gatherSystemInfo } from './system-info';
import { gatherDockerInventory } from './docker-inventory';
import { prepareProvision } from './docker-write';
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
