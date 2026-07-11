/**
 * Rotation-Dry-Run-Anzeige (NDF Step 041) – **rein, read-only, keine Ausführung**.
 *
 * Nutzt die Step-039-Planungslogik (`buildBackupRotationPlan`) mit der **Default-Policy**, um in
 * der Backup-Karte anzuzeigen, welche Backups eine spätere Rotation löschen WÜRDE. **Es wird
 * nichts gelöscht**: keine Datei-/DB-/Agent-Operation, kein neuer Endpunkt, keine Scheduler.
 * Input ist ausschließlich die bereits geladene Step-033-Backup-Liste. `dryRun` bleibt immer
 * `true`, `executable` immer `false`.
 *
 * Verify ist nicht persistent (Step 035/037): alle Einträge gelten für die Vorschau **konservativ
 * als nicht verifiziert** (`verified: false`) – der Schutz `protectLastVerifiedBackup` greift in
 * der Vorschau daher nie; das entspricht dem realen Kenntnisstand einer späteren Rotation.
 * Die Rotations-Bestätigungen gehören zu einer späteren ECHTEN Rotation – die Vorschau übergibt
 * bewusst keine (das `decision`-Feld wird in der Anzeige nicht verwendet).
 */
import {
  DEFAULT_BACKUP_ROTATION_POLICY,
  buildBackupRotationPlan,
} from '@speakcore/shared';
import type {
  BackupListEntry,
  BackupRotationEntry,
  BackupRotationEvaluation,
} from '@speakcore/types';

export { DEFAULT_BACKUP_ROTATION_POLICY };

/**
 * Reiner Mapper Step-033-Listeneintrag → Rotations-Input. `createdAt` bevorzugt aus den
 * sanitisierten Metadaten (echter Backup-Zeitpunkt), sonst Datei-Zeitstempel. Kein Hashing,
 * kein Verify, kein Download – nur Feld-Mapping.
 */
export function mapBackupListEntryToRotationEntry(entry: BackupListEntry): BackupRotationEntry {
  return {
    fileName: entry.fileName,
    createdAt: entry.metadata?.createdAt || entry.createdAt,
    // Konservativ: ohne persistenten Verify-State gilt kein Backup als verifiziert.
    verified: false,
  };
}

/** Baut die read-only Rotations-Vorschau über die Default-Policy. Löscht nie etwas. */
export function buildRotationPreview(
  backups: BackupListEntry[],
  now: Date = new Date(),
): BackupRotationEvaluation {
  return buildBackupRotationPlan(
    backups.map(mapBackupListEntryToRotationEntry),
    DEFAULT_BACKUP_ROTATION_POLICY,
    // Bewusst KEINE Bestätigungen: die gehören zur späteren echten Rotation, nicht zur Vorschau.
    {},
    now,
  );
}
