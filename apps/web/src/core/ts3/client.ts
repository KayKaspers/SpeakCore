import net from 'node:net';
import {
  buildCommand,
  extractCompletedResponse,
  mapServerInfoToStatus,
  parseKeyValueLine,
  type Ts3ServerStatus,
} from './protocol';

export interface Ts3Credentials {
  username: string;
  password: string;
}

export interface Ts3ConnectOptions {
  host: string;
  queryPort: number;
  timeoutMs?: number;
}

/**
 * Minimale Transport-Abstraktion: sendet ein Kommando und liefert die Datenzeilen zurück
 * (Fehler-id ≠ 0 ⇒ throw). Über diese Schnittstelle ist die Abfragelogik ohne echtes TS3
 * (mit Mock) testbar.
 */
export interface Ts3Transport {
  send(command: string): Promise<string[]>;
  close(): Promise<void>;
}

/**
 * Read-only Statusabfrage: `login` → `use` → `serverinfo`.
 * Es werden AUSSCHLIESSLICH read-only/Sitzungs-Kommandos verwendet – keine schreibenden oder
 * steuernden Kommandos (siehe `ALLOWED_TS3_COMMANDS`). Credentials werden nie geloggt.
 */
export async function connectAndFetchStatus(
  transport: Ts3Transport,
  credentials: Ts3Credentials,
  virtualServerId = 1,
): Promise<Ts3ServerStatus> {
  try {
    await transport.send(
      buildCommand('login', {
        client_login_name: credentials.username,
        client_login_password: credentials.password,
      }),
    );
    await transport.send(buildCommand('use', { sid: virtualServerId }));
    const infoLines = await transport.send('serverinfo');
    const info = infoLines.length > 0 ? parseKeyValueLine(infoLines[0]) : {};
    return mapServerInfoToStatus(info);
  } finally {
    await transport.close().catch(() => undefined);
  }
}

/**
 * Echter Socket-Transport (node:net) mit Timeouts. Best-effort read-only Client.
 * Verwendet keine Shell, keine externen Abhängigkeiten.
 */
export function createSocketTransport(options: Ts3ConnectOptions): Promise<Ts3Transport> {
  const timeoutMs = options.timeoutMs ?? 5000;

  return new Promise<Ts3Transport>((resolve, reject) => {
    const socket = net.createConnection({ host: options.host, port: options.queryPort });
    socket.setEncoding('utf8');

    let buffer = '';
    let bannerSeen = false;
    let pending: { resolve: (lines: string[]) => void; reject: (err: Error) => void } | null = null;

    const connectTimer = setTimeout(() => {
      socket.destroy();
      reject(new Error('connect timeout'));
    }, timeoutMs);

    const failPending = (err: Error) => {
      if (pending) {
        const p = pending;
        pending = null;
        p.reject(err);
      }
    };

    socket.on('error', (err) => {
      clearTimeout(connectTimer);
      failPending(err);
      reject(err);
    });
    socket.on('close', () => failPending(new Error('connection closed')));

    socket.on('data', (chunk: string) => {
      buffer += chunk;

      if (!bannerSeen) {
        // ServerQuery-Begrüßung konsumieren, bevor Kommandos verarbeitet werden.
        if (/welcome|serverquery/i.test(buffer)) {
          bannerSeen = true;
          buffer = '';
          clearTimeout(connectTimer);
          resolve(makeTransport());
        }
        return;
      }

      if (pending) {
        const done = extractCompletedResponse(buffer);
        if (done) {
          buffer = done.rest;
          const p = pending;
          pending = null;
          if (done.error.id === 0) p.resolve(done.dataLines);
          else p.reject(new Error(`ts3 error ${done.error.id}`));
        }
      }
    });

    function makeTransport(): Ts3Transport {
      return {
        send(command: string): Promise<string[]> {
          return new Promise<string[]>((res, rej) => {
            if (pending) {
              rej(new Error('transport busy'));
              return;
            }
            const cmdTimer = setTimeout(() => failPending(new Error('command timeout')), timeoutMs);
            pending = {
              resolve: (lines) => {
                clearTimeout(cmdTimer);
                res(lines);
              },
              reject: (err) => {
                clearTimeout(cmdTimer);
                rej(err);
              },
            };
            socket.write(`${command}\n`);
          });
        },
        close(): Promise<void> {
          return new Promise<void>((res) => {
            try {
              socket.write('quit\n');
            } catch {
              // ignorieren
            }
            socket.end();
            socket.destroy();
            res();
          });
        },
      };
    }
  });
}
