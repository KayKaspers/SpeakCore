import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ALLOWED_TS3_COMMANDS,
  buildCommand,
  escapeArg,
  extractCompletedResponse,
  mapServerInfoToStatus,
  parseKeyValueLine,
  unescapeValue,
} from '../src/core/ts3/protocol';
import { connectAndFetchStatus, type Ts3Transport } from '../src/core/ts3/client';

test('escape/unescape roundtrip', () => {
  const raw = 'My Server | name /test\twith spaces';
  assert.equal(unescapeValue(escapeArg(raw)), raw);
});

test('parseKeyValueLine unescapes values', () => {
  const kv = parseKeyValueLine('virtualserver_name=My\\sServer virtualserver_clientsonline=3');
  assert.equal(kv.virtualserver_name, 'My Server');
  assert.equal(kv.virtualserver_clientsonline, '3');
});

test('buildCommand escapes params', () => {
  assert.equal(
    buildCommand('login', { client_login_name: 'admin user' }),
    'login client_login_name=admin\\suser',
  );
});

test('extractCompletedResponse splits data and error line', () => {
  const done = extractCompletedResponse('virtualserver_name=Test\nerror id=0 msg=ok\n');
  assert.ok(done);
  assert.equal(done?.error.id, 0);
  assert.deepEqual(done?.dataLines, ['virtualserver_name=Test']);
});

test('extractCompletedResponse returns null while incomplete', () => {
  assert.equal(extractCompletedResponse('virtualserver_name=Test\n'), null);
});

test('mapServerInfoToStatus maps fields', () => {
  const status = mapServerInfoToStatus({
    virtualserver_name: 'Test Server',
    virtualserver_version: '3.13.7',
    virtualserver_platform: 'Linux',
    virtualserver_clientsonline: '5',
    virtualserver_maxclients: '32',
    virtualserver_uptime: '3600',
  });
  assert.equal(status.reachable, true);
  assert.equal(status.name, 'Test Server');
  assert.equal(status.clientsOnline, 5);
  assert.equal(status.maxClients, 32);
  assert.equal(status.uptimeSeconds, 3600);
});

test('connectAndFetchStatus (mock) uses only allowed commands and parses status', async () => {
  const sent: string[] = [];
  const transport: Ts3Transport = {
    async send(command: string) {
      sent.push(command);
      if (command.startsWith('serverinfo')) {
        return [
          'virtualserver_name=Test\\sServer virtualserver_version=3.13.7 virtualserver_platform=Linux virtualserver_clientsonline=5 virtualserver_maxclients=32 virtualserver_uptime=3600',
        ];
      }
      return [];
    },
    async close() {},
  };

  const status = await connectAndFetchStatus(transport, { username: 'admin', password: 'pw' }, 1);
  assert.equal(status.reachable, true);
  assert.equal(status.name, 'Test Server');
  assert.equal(status.clientsOnline, 5);

  // Es dürfen ausschließlich erlaubte Kommandos gesendet worden sein.
  for (const cmd of sent) {
    const verb = cmd.split(' ')[0];
    assert.ok(
      (ALLOWED_TS3_COMMANDS as readonly string[]).includes(verb),
      `unexpected command: ${verb}`,
    );
  }
  assert.deepEqual(sent.map((c) => c.split(' ')[0]).sort(), ['login', 'serverinfo', 'use']);
});

test('ts3 sources contain no dangerous/write commands', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const coreDir = join(here, '..', 'src', 'core');
  const sources = [
    join(coreDir, 'ts3', 'client.ts'),
    join(coreDir, 'ts3', 'protocol.ts'),
    join(coreDir, 'servers.ts'),
  ].map((f) => readFileSync(f, 'utf8'));

  const forbidden = [
    'serverstop',
    'serveredit',
    'serverdelete',
    'servercreate',
    'clientkick',
    'clientmove',
    'banadd',
    'channelcreate',
    'channeldelete',
    'servergroupaddclient',
    'clientdbdelete',
  ];
  for (const src of sources) {
    for (const token of forbidden) {
      assert.ok(!src.includes(token), `forbidden command present: ${token}`);
    }
  }
});
