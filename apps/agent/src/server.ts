import http from 'node:http';
import { getVersionInfo } from '@speakcore/shared';
import type { HealthStatus, VersionInfo } from '@speakcore/types';
import type { AgentConfig } from './config';
import { extractBearerToken, isValidToken } from './auth';
import { gatherSystemInfo } from './system-info';

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
