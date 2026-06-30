import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { buildServer } from '../src/server';
import { loadConfig } from '../src/config';

async function withServer(fn: (port: number) => Promise<void>): Promise<void> {
  const server = buildServer(loadConfig());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('GET /health returns ok', async () => {
  await withServer(async (port) => {
    const res = await fetch(`http://localhost:${port}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; uptimeSeconds: number };
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.uptimeSeconds, 'number');
  });
});

test('GET /version returns version info', async () => {
  await withServer(async (port) => {
    const res = await fetch(`http://localhost:${port}/version`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { name: string; version: string };
    assert.equal(body.name, 'SpeakCore Suite');
    assert.equal(typeof body.version, 'string');
  });
});

test('unknown route returns 404', async () => {
  await withServer(async (port) => {
    const res = await fetch(`http://localhost:${port}/nope`);
    assert.equal(res.status, 404);
  });
});
