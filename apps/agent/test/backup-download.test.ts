import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp as mkdtempP, writeFile as writeFileP, mkdir as mkdirP } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import {
  resolveBackupDownload,
  type ResolveBackupDownloadOptions,
} from '../src/backup-download';
import { buildServer } from '../src/server';

const INSTANCE = 'clabc123def456';
const OTHER_INSTANCE = 'clzzz999yyy888';
const TS = '2026-07-02T10-00-00-000Z';
const TAR = `speakcore-backup-ts3-${INSTANCE}-${TS}.tar.gz`;
const META = `speakcore-backup-ts3-${INSTANCE}-${TS}.metadata.json`;

function makeOpts(config: { dirAvailable?: boolean; exists?: boolean } = {}) {
  const statCalls: string[] = [];
  const opts: ResolveBackupDownloadOptions = {
    dirAvailable: async () => config.dirAvailable ?? true,
    statFile: async (name) => {
      statCalls.push(name);
      return (config.exists ?? true) ? { sizeBytes: 42 } : null;
    },
  };
  return { opts, statCalls };
}

test('invalid instanceId / fileName / traversal / metadata.json ⇒ invalid, no file access', async () => {
  const badRequests = [
    { instanceId: 'bad id!', fileName: TAR },
    { instanceId: INSTANCE, fileName: 'random.txt' },
    { instanceId: INSTANCE, fileName: META }, // .metadata.json ist NIE streambar
    { instanceId: INSTANCE, fileName: `../${TAR}` },
    { instanceId: INSTANCE, fileName: `sub/${TAR}` },
    { instanceId: INSTANCE, fileName: `sub\\${TAR}` },
    { instanceId: INSTANCE, fileName: `speakcore-backup-ts3-${OTHER_INSTANCE}-${TS}.tar.gz` },
    { instanceId: INSTANCE, fileName: `${TAR}.txt` },
    { instanceId: INSTANCE, fileName: '' },
  ];
  for (const request of badRequests) {
    const { opts, statCalls } = makeOpts();
    const result = await resolveBackupDownload(request, opts);
    assert.equal(result.status, 'invalid', JSON.stringify(request));
    assert.equal(statCalls.length, 0, 'no file access for invalid requests');
  }
});

test('backup dir unavailable ⇒ backupDirUnavailable', async () => {
  const { opts } = makeOpts({ dirAvailable: false });
  const result = await resolveBackupDownload({ instanceId: INSTANCE, fileName: TAR }, opts);
  assert.equal(result.status, 'backupDirUnavailable');
});

test('file missing ⇒ backupNotFound', async () => {
  const { opts } = makeOpts({ exists: false });
  const result = await resolveBackupDownload({ instanceId: INSTANCE, fileName: TAR }, opts);
  assert.equal(result.status, 'backupNotFound');
});

test('valid ⇒ ok with size + gzip content type, stat only for the requested file', async () => {
  const { opts, statCalls } = makeOpts();
  const result = await resolveBackupDownload({ instanceId: INSTANCE, fileName: TAR }, opts);
  assert.equal(result.status, 'ok');
  assert.equal(result.fileName, TAR);
  assert.equal(result.sizeBytes, 42);
  assert.equal(result.contentType, 'application/gzip');
  assert.deepEqual(statCalls, [TAR], 'no directory listing, exactly one stat');
  // Kein Pfad im Ergebnis: fileName ist ein reiner Name, kein Host-Pfad (contentType enthält legitim '/').
  assert.ok(!result.fileName?.includes('/') && !result.fileName?.includes('\\'));
  assert.ok(!JSON.stringify(result).includes('/var/lib') && !/[A-Za-z]:\\\\/.test(JSON.stringify(result)));
});

test('GET /docker/provision/download-backup: token gate + streams exact bytes with headers', async () => {
  const dir = await mkdtempP(join(tmpdir(), 'speakcore-backup-download-'));
  const content = 'raw-tar-gz-bytes-streamed-not-unpacked-' + 'x'.repeat(1000);
  await writeFileP(join(dir, TAR), content);
  await writeFileP(join(dir, META), '{"never":"streamed"}');
  await mkdirP(join(dir, 'subdir'));

  const prevDir = process.env.AGENT_BACKUP_DIR;
  process.env.AGENT_BACKUP_DIR = dir;
  const server = buildServer({ port: 0, bootstrapToken: 'secret-token', dockerWriteEnabled: false });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  const base = `http://localhost:${port}/docker/provision/download-backup`;
  const auth = { authorization: 'Bearer secret-token' };
  try {
    // Ohne Token ⇒ 401:
    const denied = await fetch(`${base}?instanceId=${INSTANCE}&fileName=${TAR}`);
    assert.equal(denied.status, 401);

    // Gültig ⇒ exakte Bytes + Download-Header (Write-Flag ist false – read-only Streaming geht trotzdem):
    const ok = await fetch(`${base}?instanceId=${INSTANCE}&fileName=${TAR}`, { headers: auth });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'application/gzip');
    assert.equal(ok.headers.get('content-length'), String(content.length));
    assert.equal(ok.headers.get('content-disposition'), `attachment; filename="${TAR}"`);
    assert.equal(await ok.text(), content, 'streamed bytes must match the file exactly');

    // metadata.json ⇒ 400 (nie streambar):
    const meta = await fetch(`${base}?instanceId=${INSTANCE}&fileName=${META}`, { headers: auth });
    assert.equal(meta.status, 400);

    // Traversal ⇒ 400:
    const trav = await fetch(
      `${base}?instanceId=${INSTANCE}&fileName=${encodeURIComponent('../' + TAR)}`,
      { headers: auth },
    );
    assert.equal(trav.status, 400);

    // Fremde instanceId ⇒ 400:
    const foreign = await fetch(
      `${base}?instanceId=${INSTANCE}&fileName=speakcore-backup-ts3-${OTHER_INSTANCE}-${TS}.tar.gz`,
      { headers: auth },
    );
    assert.equal(foreign.status, 400);

    // Nicht vorhandene Datei ⇒ 404 (kein Host-Pfad im Fehler):
    const missing = await fetch(
      `${base}?instanceId=${INSTANCE}&fileName=speakcore-backup-ts3-${INSTANCE}-2026-01-01T00-00-00-000Z.tar.gz`,
      { headers: auth },
    );
    assert.equal(missing.status, 404);
    assert.ok(!(await missing.text()).includes(dir.replace(/\\/g, '\\\\')), 'no host path in error');
  } finally {
    if (prevDir === undefined) delete process.env.AGENT_BACKUP_DIR;
    else process.env.AGENT_BACKUP_DIR = prevDir;
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('backup-download source: no docker/exec/shell/socket, no write ops, no unpack, no listing', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, '..', 'src', 'backup-download.ts'), 'utf8');
  const forbidden = [
    'execFile',
    'child_process',
    'spawn(',
    'exec(',
    "'docker'",
    'docker run',
    'docker rm',
    'volume rm',
    'network rm',
    'docker inspect',
    'docker logs',
    'docker.sock',
    'shell',
    'writeFile',
    'mkdir',
    'unlink',
    'rmdir',
    'rename',
    'readdir',
    'readFile',
    'createReadStream',
    'tar -',
    'gunzip',
    'unzip',
  ];
  for (const token of forbidden) {
    assert.ok(!src.includes(token), `forbidden token present: ${token}`);
  }
});
