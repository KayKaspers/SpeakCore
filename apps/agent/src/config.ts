/**
 * Agent-Konfiguration aus der Umgebung (NDF Step 002).
 * KEINE hartkodierten Secrets.
 */
export interface AgentConfig {
  port: number;
  /** Bootstrap-Token (Konzept). Null, wenn nicht gesetzt. */
  bootstrapToken: string | null;
}

export function loadConfig(): AgentConfig {
  const port = Number.parseInt(process.env.AGENT_PORT ?? '4000', 10);
  return {
    port: Number.isFinite(port) ? port : 4000,
    bootstrapToken: process.env.AGENT_BOOTSTRAP_TOKEN ?? null,
  };
}
