import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  EXPORT_VERSION,
  assertExportContainsNoSecrets,
  buildManagedServerExport,
  redactAuditEventForExport,
  type ManagedServerExportInput,
} from '../src/core/server-export-helpers';

function baseInput(overrides: Partial<ManagedServerExportInput> = {}): ManagedServerExportInput {
  return {
    id: 'srv-1',
    name: 'My Managed TS3',
    mode: 'managed',
    instanceId: 'clabc123def456',
    provisioningStatus: 'RESOURCES_PREPARED',
    runState: 'unknown',
    host: '127.0.0.1',
    queryPort: 10011,
    voicePort: 9987,
    fileTransferPort: 30033,
    managedContainerName: 'speakcore-ts3-clabc123def456',
    managedVolumeName: 'speakcore-volume-ts3-clabc123def456',
    managedVolumeState: 'removed',
    managedNetworkName: 'speakcore-network-voice',
    createdAt: new Date('2026-07-01T10:00:00Z'),
    updatedAt: new Date('2026-07-02T10:00:00Z'),
    resourcesPreparedAt: new Date('2026-07-01T10:05:00Z'),
    lastProvisioningStep: 'REMOVE_VOLUME',
    lastProvisioningErrorKey: null,
    lastConnectedAt: null,
    lastHealthCheckedAt: null,
    lastSuccessfulHealthCheckAt: null,
    lastHealthErrorKey: null,
    containerRuntimeStatus: null,
    ts3ReachabilityStatus: 'notConfigured',
    statusName: null,
    statusVersion: null,
    statusPlatform: null,
    statusClientsOnline: null,
    statusMaxClients: null,
    statusUptimeSeconds: null,
    archivedAt: null,
    archiveReasonKey: null,
    credentialsRemovedAt: new Date('2026-07-02T09:00:00Z'),
    ...overrides,
  };
}

test('export is versioned with product/kind and mapped metadata', () => {
  const exp = buildManagedServerExport({ server: baseInput(), credentialStatus: 'removed', auditEvents: [] });
  assert.equal(exp.exportVersion, EXPORT_VERSION);
  assert.equal(exp.product, 'SpeakCore');
  assert.equal(exp.kind, 'managed-server-export');
  assert.equal(exp.server.serverId, 'srv-1');
  assert.equal(exp.server.displayName, 'My Managed TS3');
  assert.equal(exp.server.instanceId, 'clabc123def456');
  assert.equal(exp.server.credentialStatus, 'removed');
  assert.equal(exp.server.createdAt, '2026-07-01T10:00:00.000Z'); // Dates → ISO
});

test('export contains none of the secret/credential keys', () => {
  const exp = buildManagedServerExport({ server: baseInput(), credentialStatus: 'kept', auditEvents: [] });
  const s = JSON.stringify(exp);
  for (const forbidden of ['encryptedPassword', 'encryptedUsername', '"password"', '"token"', 'SECRET_ENCRYPTION', 'SESSION_SECRET', 'AGENT_TOKEN']) {
    assert.ok(!s.includes(forbidden), `export must not contain ${forbidden}`);
  }
  // Kein Schlüssel „credential" außer credentialStatus/credentialsRemovedAt.
  const keys = Object.keys(exp.server);
  for (const k of keys) {
    if (/password|secret|token|session/i.test(k)) assert.fail(`forbidden key: ${k}`);
  }
});

test('redactAuditEventForExport only keeps action/actor/target/result/createdAt', () => {
  const ev = redactAuditEventForExport({
    action: 'deprovision.server.archived',
    actor: 'owner@example.com',
    target: 'srv-1',
    result: 'success',
    createdAt: new Date('2026-07-02T09:30:00Z'),
  });
  assert.deepEqual(Object.keys(ev).sort(), ['action', 'actor', 'createdAt', 'result', 'target']);
  assert.equal(ev.createdAt, '2026-07-02T09:30:00.000Z');
});

test('assertExportContainsNoSecrets passes for a clean export', () => {
  const exp = buildManagedServerExport({
    server: baseInput(),
    credentialStatus: 'kept',
    // audit action containing the word "secret" must NOT trip the guard (it is a value, not a key/secret)
    auditEvents: [
      redactAuditEventForExport({
        action: 'ts3.containerPrepare.secretCreated',
        actor: 'owner@example.com',
        target: 'srv-1',
        result: 'success',
        createdAt: new Date('2026-07-01T10:04:00Z'),
      }),
    ],
  });
  assert.doesNotThrow(() => assertExportContainsNoSecrets(exp));
});

test('assertExportContainsNoSecrets throws on forbidden key or encrypted value', () => {
  assert.throws(() => assertExportContainsNoSecrets({ nested: { encryptedPassword: 'x' } }));
  assert.throws(() => assertExportContainsNoSecrets({ token: 'abc' }));
  assert.throws(() => assertExportContainsNoSecrets({ value: 'v1:iv:tag:cipher' }));
});

test('export is stably JSON-serializable (round-trips)', () => {
  const exp = buildManagedServerExport({ server: baseInput(), credentialStatus: 'none', auditEvents: [] });
  const json = JSON.stringify(exp);
  const parsed = JSON.parse(json);
  assert.deepEqual(parsed, exp);
});

test('server-export code makes no Docker/agent calls and writes no DB except the export audit', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const service = readFileSync(join(coreDir, 'server-export.ts'), 'utf8');
  const helpers = readFileSync(join(coreDir, 'server-export-helpers.ts'), 'utf8');

  for (const forbidden of ['agent-client', 'AGENT_URL', 'execFile', 'docker']) {
    assert.ok(!service.includes(forbidden), `service must not contain ${forbidden}`);
    assert.ok(!helpers.includes(forbidden), `helpers must not contain ${forbidden}`);
  }
  // Keine DB-Schreiboperation im Service außer Audit (logAudit): kein direktes update/delete/create.
  for (const forbidden of ['.update(', '.delete(', '.deleteMany(', '.create(', '.upsert(']) {
    assert.ok(!service.includes(forbidden), `service must not write DB directly: ${forbidden}`);
  }
});
