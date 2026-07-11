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
- **Zuletzt abgeschlossen:** Produkt-Step **041**; Governance-Steps **042** (lokal) und **042a** (lokal).
- **Aktueller Korrekturschritt:** **042a** – Context- & Work-Package-SSOT-Alignment (docs-only).
- **Push-Status:** **kein Push** erfolgt; letzte lokale Commits `997b3ec` (042) + 042a-Commit.

## Queue

| Step | Titel | Status |
|------|-------|--------|
| 041 | Letzter Produktstand vor NDF-v1-Adoption (Rotation-Dry-Run-Vorschau) | abgeschlossen |
| 042 | NDF v1.0 Adoption & Claude Skills Enablement | abgeschlossen, lokal |
| 042a | Context & Work-Package SSOT Alignment | abgeschlossen, lokal |
| 043 | Managed Backup Restore Blueprint (`executable: false`) | geplant |
| später | Editable Rotation Policy / Bulk Rotation | Backlog |

## Abhängigkeiten

- **043** setzt den bestehenden Backup-Lebenszyklus (032–041, insb. Verify 035) voraus und bleibt
  zunächst reiner Blueprint (`executable: false`), bevor Backup-Bytes zurück in ein Volume
  geschrieben werden.
- **Editable Rotation Policy / Bulk Rotation** setzt die Rotation-Dry-Run-Vorschau (041) voraus.

## Offene Risiken

- `AGENT_BACKUP_DIR` wächst weiter, bis Rotation über Einzel-Delete (040) hinaus umgesetzt ist.
- Kein Restore in 0.1: gelöschte/defekte Backups sind endgültig verloren (Blueprint 043 adressiert
  zunächst nur das Konzept, keine Ausführung).
- Detaillierte Risiken: [../project-brain/RISKS.md](../project-brain/RISKS.md).

## Hinweise

- **Keine** noch nicht getroffenen Implementierungsentscheidungen als beschlossen darstellen:
  043 ist als **Blueprint** geplant; die eigentliche Restore-Ausführung ist noch **nicht**
  entschieden. Rotation-Ausführung ist **Backlog**, nicht zugesagt.
- Genau **ein** Work Package pro Claude-Ausführung ([../CLAUDE.md](../CLAUDE.md)).
