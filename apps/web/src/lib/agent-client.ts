import 'server-only';
import type { SystemInfo } from '@speakcore/types';

export type AgentSnapshotResult =
  | { status: 'connected'; info: SystemInfo }
  | { status: 'unreachable' };

/**
 * Ruft den read-only System-Snapshot des Agents ab – **ausschließlich serverseitig**.
 * Der Browser spricht den Agent nie direkt an. Agent-URL/Token kommen aus der Umgebung
 * (kein Secret gelangt in den Client). Robust gegen Nichterreichbarkeit (Timeout → Fallback).
 */
export async function fetchAgentSnapshot(timeoutMs = 2000): Promise<AgentSnapshotResult> {
  const base = process.env.AGENT_URL;
  if (!base) return { status: 'unreachable' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {};
    const token = process.env.AGENT_BOOTSTRAP_TOKEN;
    if (token) headers.authorization = `Bearer ${token}`;

    const res = await fetch(`${base.replace(/\/+$/, '')}/system/snapshot`, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return { status: 'unreachable' };
    const info = (await res.json()) as SystemInfo;
    return { status: 'connected', info };
  } catch {
    return { status: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}
