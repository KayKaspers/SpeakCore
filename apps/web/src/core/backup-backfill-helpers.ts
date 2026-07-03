/**
 * Reine Helfer für den Checksum-Backfill (NDF Step 038) – unit-testbar, ohne DB/Agent.
 *
 * Nur die `.metadata.json` wird (agent-seitig) ergänzt; die tar.gz bleibt unverändert. Audit
 * bewusst **ohne Dateinamen** (bisherige Linie: keine Dateilisten im Audit), ohne Prüfsumme,
 * ohne Metadaten, ohne Host-Pfade.
 */
import type { BackupChecksumBackfillStatus } from '@speakcore/types';
import type { AuditInput } from './audit';

export type BackupBackfillServiceStatus =
  | BackupChecksumBackfillStatus
  | 'notFound'
  | 'notManaged'
  | 'unreachable';

export interface BackupBackfillServiceResult {
  status: BackupBackfillServiceStatus;
  serverId?: string;
  fileName?: string;
}

export type BackupBackfillAuditOutcome = 'completed' | 'alreadyPresent' | 'failed';

/** Audit-Events (Target = ServerInstance-ID); `alreadyPresent` ist ein eigenes, ehrliches Ergebnis. */
export function buildChecksumBackfillAuditEntries(
  outcome: BackupBackfillAuditOutcome,
  actor: string,
  serverId: string,
): AuditInput[] {
  const t = serverId;
  const entries: AuditInput[] = [
    { action: 'backup.managedVolume.checksumBackfill.requested', actor, target: t },
  ];
  if (outcome === 'completed') {
    entries.push({ action: 'backup.managedVolume.checksumBackfill.completed', actor, target: t });
  } else if (outcome === 'alreadyPresent') {
    entries.push({
      action: 'backup.managedVolume.checksumBackfill.alreadyPresent',
      actor,
      target: t,
    });
  } else {
    entries.push({
      action: 'backup.managedVolume.checksumBackfill.failed',
      actor,
      target: t,
      result: 'failure',
    });
  }
  return entries;
}
