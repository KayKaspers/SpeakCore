# WORK_PACKAGE_QUEUE.md – SpeakCore

> NDF Project System · Stand: 2026-07-11 · **Verbindliche Queue** für geplante, laufende und
> abgeschlossene SpeakCore-Arbeitspakete (Steps). SSOT für die Reihenfolge; Historie im Detail:
> [../project-brain/CHANGELOG.md](../project-brain/CHANGELOG.md).

## Statuslegende

| Status | Bedeutung |
|--------|-----------|
| **abgeschlossen** | Umgesetzt und (ggf. lokal) committet. |
| **abgeschlossen, lokal** | Lokal committet, **noch nicht gepusht** (Push-Freigabe durch Kay/Nova offen). |
| **in Arbeit** | Aktuell in Bearbeitung. |
| **geplant** | Als nächstes vorgesehen, Scope grob bekannt. |
| **Backlog** | Vorgemerkt, noch nicht eingeplant/entschieden. |

## Rahmen

- **NDF-Standard:** v1.0.0 (Tag `v1.0.0`, Commit `9dcadc1`), **Skills-first**.
- **Zuletzt abgeschlossen:** **045 Read-only Backup-Inspection**; **046 Manifest-v1-Decision-Package**;
  **046a ADR-0042 Accepted with Notes (2026-07-12)**.
- **Aktueller Schritt:** **046a** – Accept Restore Manifest ADR (docs-only; ADR-0042 **Accepted with
  Notes**, weiterhin `executable: false` — keine Manifest-/Backup-Integration freigegeben).
- **Push-Status:** `7ec9f32` (045) · `ebb9036` (046) **gepusht** (`origin/main`); **046a-Commit
  lokal, noch nicht gepusht**.

## Queue

| Step | Titel | Status |
|------|-------|--------|
| 044a | Accept Restore Foundation ADRs | abgeschlossen |
| 045 | Agent Read-only Managed Backup Inspection | abgeschlossen |
| 046 | Restore Manifest Format, Placement & Binding Decision Package | abgeschlossen |
| 046a | Accept Restore Manifest ADR | abgeschlossen, lokal |
| 047 | Manifest v1 Types & Pure Validation | geplant, freigegeben nach Nova-Review |
| 048 | Read-only Manifest Builder | geplant |
| später | Staging & Publication Protocol | blockiert / ADR erforderlich |
| später | Backup Creation Integration | blockiert |
| später | Editable Rotation Policy / Bulk Rotation | Backlog |

## Abhängigkeiten

- **043** (abgeschlossen) ist reiner Blueprint auf Basis des Backup-Lebenszyklus 032–041; kein
  Restore-Code. Siehe [Restore-Blueprint](../docs/backup/MANAGED_BACKUP_RESTORE_BLUEPRINT.md).
- **044/044a** legen die Restore-Grundlagen als ADRs 0039–0041 fest — seit 044a **Accepted**
  (2026-07-12), weiterhin `executable: false`; siehe
  [Decision Summary](../docs/backup/RESTORE_FOUNDATION_DECISION_SUMMARY.md).
- **045** (abgeschlossen) liefert die strikt read-only Agent-Backup-Inspection
  ([Doku](../docs/backup/READ_ONLY_BACKUP_INSPECTION.md)); Legacy-Backups nicht restorefähig.
- **046/046a** (abgeschlossen) entscheiden Manifest-v1-Format/Ablage/Bindung — **ADR-0042 Accepted
  with Notes (2026-07-12)** + [Schema](../docs/backup/RESTORE_MANIFEST_V1_SCHEMA.md); **kein Code**.
- **047** (Manifest v1 Types & Pure Validation) setzt ADR-0042 (Accepted) voraus → **freigegeben für
  Planung**; reine Typen/Validator/Serialisierung, keine Backup-Integration, keine FS-Änderung
  außerhalb Tests.
- **Backup-Integration** (Manifest im Archiv, Sidecar, Publication Commit Marker) bleibt **blockiert**
  bis zum **Staging & Publication Protocol**-WP (OPEN-13/14). Vertagte Restore-Folge-ADRs:
  OPEN-6…OPEN-12 in DECISIONS.md.
- **Editable Rotation Policy / Bulk Rotation** setzt die Rotation-Dry-Run-Vorschau (041) voraus.

## Offene Risiken

- `AGENT_BACKUP_DIR` wächst weiter, bis Rotation über Einzel-Delete (040) hinaus umgesetzt ist.
- Kein Restore in 0.1: gelöschte/defekte Backups sind endgültig verloren (Blueprint 043 adressiert
  zunächst nur das Konzept, keine Ausführung).
- Detaillierte Risiken: [../project-brain/RISKS.md](../project-brain/RISKS.md).

## Hinweise

- **Keine** noch nicht getroffenen Implementierungsentscheidungen als beschlossen darstellen:
  043 ist ein **Blueprint**; die eigentliche Restore-Ausführung ist noch **nicht** entschieden
  (mehrere ADR-Kandidaten offen, siehe Blueprint §5.22/§6). Rotation-Ausführung ist **Backlog**,
  nicht zugesagt.
- Genau **ein** Work Package pro Claude-Ausführung ([../CLAUDE.md](../CLAUDE.md)).
