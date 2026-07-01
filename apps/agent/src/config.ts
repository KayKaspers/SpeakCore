/**
 * Agent-Konfiguration aus der Umgebung (NDF Step 002).
 * KEINE hartkodierten Secrets.
 */
export interface AgentConfig {
  port: number;
  /** Bootstrap-Token (Konzept). Null, wenn nicht gesetzt. */
  bootstrapToken: string | null;
  /** Schreibende Docker-Aktionen (Network/Volume) nur bei explizitem Opt-in. Default/fehlend: false. */
  dockerWriteEnabled?: boolean;
}

function isEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function loadConfig(): AgentConfig {
  const port = Number.parseInt(process.env.AGENT_PORT ?? '4000', 10);
  return {
    port: Number.isFinite(port) ? port : 4000,
    bootstrapToken: process.env.AGENT_BOOTSTRAP_TOKEN ?? null,
    dockerWriteEnabled: isEnabled(process.env.AGENT_DOCKER_WRITE_ENABLED),
  };
}
