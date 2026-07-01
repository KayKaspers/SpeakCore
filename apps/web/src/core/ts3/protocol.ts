/**
 * TeamSpeak-3 ServerQuery – reines Protokoll-Handling (NDF Step 008).
 *
 * Nur die Bausteine für **read-only** Abfragen. Keine Netzwerk-I/O hier (siehe client.ts).
 * Eine eigene, minimale Implementierung statt großer Abhängigkeit (ADR-0017): kleine, geprüfte
 * Angriffsfläche, keine unnötige Supply-Chain.
 */

/** In diesem Step ausschließlich erlaubte (read-only bzw. Sitzungs-)Kommandos. */
export const ALLOWED_TS3_COMMANDS = [
  'login',
  'logout',
  'use',
  'serverinfo',
  'version',
  'whoami',
  'quit',
] as const;

export type Ts3ServerStatus = {
  reachable: boolean;
  name?: string;
  version?: string;
  platform?: string;
  clientsOnline?: number;
  maxClients?: number;
  uptimeSeconds?: number;
};

/** Escaping gemäß TS3-ServerQuery-Spezifikation. */
export function escapeArg(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\//g, '\\/')
    .replace(/ /g, '\\s')
    .replace(/\|/g, '\\p')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/** Einzeldurchlauf-Unescaping (korrekt gegenüber sequentiellem replace). */
export function unescapeValue(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '\\' && i + 1 < value.length) {
      const next = value[++i];
      switch (next) {
        case 's':
          out += ' ';
          break;
        case 'p':
          out += '|';
          break;
        case '/':
          out += '/';
          break;
        case 'n':
          out += '\n';
          break;
        case 'r':
          out += '\r';
          break;
        case 't':
          out += '\t';
          break;
        case '\\':
          out += '\\';
          break;
        default:
          out += next;
      }
    } else {
      out += c;
    }
  }
  return out;
}

/** Baut eine Kommandozeile mit escapten Parametern. */
export function buildCommand(command: string, params: Record<string, string | number> = {}): string {
  const parts = [command];
  for (const [key, value] of Object.entries(params)) {
    parts.push(`${key}=${escapeArg(String(value))}`);
  }
  return parts.join(' ');
}

/** Parst eine Key-Value-Zeile (space-getrennt, `key=value`). */
export function parseKeyValueLine(line: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const token of line.trim().split(' ')) {
    if (!token) continue;
    const eq = token.indexOf('=');
    if (eq === -1) {
      result[token] = '';
    } else {
      result[token.slice(0, eq)] = unescapeValue(token.slice(eq + 1));
    }
  }
  return result;
}

export interface Ts3Error {
  id: number;
  msg: string;
}

/** Erkennt/parst die abschließende `error id=… msg=…`-Zeile. */
export function parseError(line: string): Ts3Error | null {
  if (!line.startsWith('error ')) return null;
  const kv = parseKeyValueLine(line);
  return { id: Number(kv.id ?? -1), msg: kv.msg ?? '' };
}

/**
 * Extrahiert eine vollständige Antwort aus einem Puffer (bis zur `error`-Zeile).
 * Rein/testbar; ohne Socket. Gibt `null`, solange die Antwort unvollständig ist.
 */
export function extractCompletedResponse(
  buffer: string,
): { dataLines: string[]; error: Ts3Error; rest: string } | null {
  const lines = buffer.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const clean = lines[i].replace(/\r$/, '');
    const error = parseError(clean.trim());
    if (error) {
      const dataLines = lines
        .slice(0, i)
        .map((l) => l.replace(/\r$/, ''))
        .filter((l) => l.length > 0);
      return { dataLines, error, rest: lines.slice(i + 1).join('\n') };
    }
  }
  return null;
}

function num(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Bildet die `serverinfo`-Antwort auf den read-only Basisstatus ab. */
export function mapServerInfoToStatus(info: Record<string, string>): Ts3ServerStatus {
  return {
    reachable: true,
    name: info.virtualserver_name || undefined,
    version: info.virtualserver_version || undefined,
    platform: info.virtualserver_platform || undefined,
    clientsOnline: num(info.virtualserver_clientsonline),
    maxClients: num(info.virtualserver_maxclients),
    uptimeSeconds: num(info.virtualserver_uptime),
  };
}
