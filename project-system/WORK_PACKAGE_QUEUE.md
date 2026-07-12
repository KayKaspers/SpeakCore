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
- **Zuletzt abgeschlossen:** Blueprint **043**; ADR-Paket **044**; **044a ADRs Accepted (2026-07-12)**.
- **Aktueller Schritt:** **044a** – Accept Restore Foundation ADRs (docs-only; ADR-0039–0041
  **Accepted**, weiterhin `executable: false` — **keine Restore-Ausführung freigegeben**).
- **Push-Status:** `7f29b2a` (043) · `2ce4e6c` (044) **gepusht** (`origin/main`); **044a-Commit
  lokal, noch nicht gepusht**.

## Queue

| Step | Titel | Status |
|------|-------|--------|
| 041 | Letzter Produktstand vor NDF-v1-Adoption (Rotation-Dry-Run-Vorschau) | abgeschlossen |
| 042 | NDF v1.0 Adoption & Claude Skills Enablement | abgeschlossen |
| 042a | Context & Work-Package SSOT Alignment | abgeschlossen |
| 043 | Managed Backup Restore Blueprint | abgeschlossen |
| 044 | Restore Foundation ADR Decision Package | abgeschlossen |
| 044a | Accept Restore Foundation ADRs | abgeschlossen, lokal |
| 045 | Read-only Restore Inspection | geplant, freigegeben für Planung nach Nova-Review |
| später | Plan-Endpunkt → sichere Archivvalidierung → Staging → Pre-Restore-Backup → Lock → Apply/Rollback → UI → Audit → Security-Tests → E2E (Blueprint §5.21) | Backlog |
| später | Editable Rotation Policy / Bulk Rotation | Backlog |

## Abhängigkeiten

- **043** (abgeschlossen) ist reiner Blueprint auf Basis des Backup-Lebenszyklus 032–041; kein
  Restore-Code. Siehe [Restore-Blueprint](../docs/backup/MANAGED_BACKUP_RESTORE_BLUEPRINT.md).
- **044/044a** legen die Restore-Grundlagen als ADRs 0039–0041 fest — seit 044a **Accepted**
  (2026-07-12), weiterhin `executable: false`; siehe
  [Decision Summary](../docs/backup/RESTORE_FOUNDATION_DECISION_SUMMARY.md).
- **045** (read-only Restore Inspection) setzt 043+044/044a voraus; die ADR-Freigabe ist mit 044a
  erfolgt → **für Planung freigegeben (nach Nova-Review)**. Strikt read-only, keine Write/Apply.
  Vertagte Folge-ADRs: OPEN-6…OPEN-12 in DECISIONS.md.
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
