import http from 'node:http';
import { getVersionInfo } from '@speakcore/shared';
import type { HealthStatus, VersionInfo } from '@speakcore/types';
import type { AgentConfig } from './config';

const startedAt = Date.now();

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Baut den Agent-HTTP-Server (NDF Step 002).
 * Nur GET /health und GET /version – KEINE Host-/Docker-Aktionen.
 */
export function buildServer(config: AgentConfig): http.Server {
  return http.createServer((req, res) => {
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

    sendJson(res, 404, { error: 'not_found' });
  });
}
