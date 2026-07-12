# Feedback-to-NDF-Loop (SpeakCore)

> **Zweck:** SpeakCore-Erfahrungen mit dem NDF-v1.0-Workflow und den Skills strukturiert sammeln,
> damit sie später als **mögliches** Feedback für das NDF-Repository dienen können.
>
> **Grenzen:** Dies ist reine Sammlung/Dokumentation. **Keine** direkten Änderungen am
> NDF-Repository, **keine** automatische Upstream-Übernahme. Eine tatsächliche NDF-Rückführung ist
> ein eigener, von Kay/Nova freigegebener Schritt. **Keine Secrets/privaten Daten** in Einträgen.
>
> **Abgrenzung:** Diese Datei = **Kandidaten** für eine mögliche NDF-Rückführung.
> [../../project-brain/NDF_LESSONS_LEARNED.md](../../project-brain/NDF_LESSONS_LEARNED.md) =
> **interne, bestätigte** SpeakCore-Erfahrungen (kompakte SSOT). Ausführliche Kandidaten-Felder hier,
> nicht dort doppeln.

## Erfassungsschema

Jeder Eintrag verwendet folgende Felder:

- **Verwendeter Skill:**
- **Work Package / Step:**
- **Was gut funktioniert hat:**
- **Unklarheiten:**
- **Fehlende Guardrails:**
- **Unnötiger Kontextverbrauch:**
- **Wiederkehrende manuelle Arbeit:**
- **Möglicher neuer Skill:**
- **Mögliche Verbesserung eines bestehenden Skills:**
- **Sicherheits-/Governance-Erkenntnis:**
- **Vorgeschlagene NDF-Rückführung:**
- **Status:** Beobachtung / Kandidat / akzeptiert / verworfen
- **Maintainer-Entscheidung:**

## Bereits bekannte SpeakCore-NDF-Learnings

Dokumentierte Erkenntnisse aus den bisherigen SpeakCore-Steps (Beobachtungen, keine
NDF-Änderungen):

| # | Learning | Status | Maintainer-Entscheidung |
|---|----------|--------|-------------------------|
| L1 | **Kleine NDF-Schritte** – ein begrenztes WP pro Ausführung hält Reviews und Rückmeldungen überschaubar. | Beobachtung | offen |
| L2 | **Blueprint vor gefährlichen Funktionen** (`executable: false` zuerst; Steps 024/030/036/039), dann minimale Ausführung. | Beobachtung | offen |
| L3 | **Security-, ADR- und Risiko-Dokumentation** zu jeder relevanten Änderung (SECURITY/RISKS/DECISIONS). | Beobachtung | offen |
| L4 | **Guard- und Planungslogik vor Write-Aktionen** (rein/testbar, dann Ausführung). | Beobachtung | offen |
| L5 | **Owner-, Bestätigungs- und Audit-Patterns** bei sensiblen/destruktiven Aktionen (OWNER-only, getippte Bestätigung, Audit ohne Secrets/Host-Pfade/Dateiinhalte). | Beobachtung | offen |
| L6 | **read-only vor destructive** – erst sichtbar/verifizierbar machen, dann verändern (Backup-Lebenszyklus 032–041). | Beobachtung | offen |
| L7 | **Push-Freigabe durch Nova bzw. Human Maintainer** – Claude committet höchstens lokal, pusht nie autonom. | Beobachtung | offen |
| L8 | **Strukturierte Claude-Rückmeldung** am Ende jedes Steps erleichtert Review und nächste Planung. | Beobachtung | offen |
| L9 | **Context Packs und Compact Context Summary** senken Token-Aufwand und Übergabereibung. | Beobachtung | offen |

## Neue Einträge

### K1 – Wiederverwendbarer Restore-/Recovery-Blueprint (Step 043)
- **Work Package / Step:** 043 (Managed Backup Restore Blueprint)
- **Möglicher neuer Skill:** ein NDF-Skill für **destructive/zustandsersetzende Recovery-Aktionen**
  (Restore/Migrate/Rollback), der Trust-Boundary-, Preflight-Gate-, Staging- und State-Machine-
  Struktur standardisiert.
- **Sicherheits-/Governance-Erkenntnis:** Restore-artige Aktionen folgen einem generischen
  Sicherheitsmuster (read-only Plan → gebundene Bestätigung → Preflight-Gates → Staging →
  Pflicht-Sicherungspunkt → Apply → Rollback → Audit), das über SpeakCore hinaus nützlich ist.
- **Status:** Kandidat · **Maintainer-Entscheidung:** offen

### K2 – Archive-/Import-Trust-Boundary-Checkliste
- **Work Package / Step:** 043
- **Mögliche Verbesserung eines bestehenden Skills:** die vorhandenen Review-Skills (z. B.
  `ndf-privacy-data-minimization-reviewer`, `ndf-validation-evidence-reviewer`) um eine
  **Archive-/Untrusted-Input-Checkliste** ergänzen (Traversal, Symlink/Hardlink, Special Files,
  Archive-Bomb, absolute/Windows-Pfade).
- **Status:** Kandidat · **Maintainer-Entscheidung:** offen

### K3 – State Machine + Rollback-Gates für destructive Aktionen
- **Work Package / Step:** 043
- **Vorgeschlagene NDF-Rückführung:** ein dokumentiertes Muster „State Machine mit sicheren
  Übergängen + Pflicht-Rollback-Quelle + kritischem `ROLLBACK_FAILED`/`CLEANUP_REQUIRED`-Zustand"
  für alle irreversiblen Operationen (nicht nur Backups).
- **Status:** Kandidat · **Maintainer-Entscheidung:** offen

### K4 – „ADR Decision Package" als Freigabe-Gate vor riskanter Umsetzung (Step 044)
- **Work Package / Step:** 044 (Restore Foundation ADR Decision Package)
- **Möglicher neuer Skill / Verbesserung:** ein NDF-Muster/Skill für ein **Bündel Proposed ADRs**,
  das eine riskante Fähigkeit gated: strikte Trennung Empfehlung ↔ Human-Maintainer-Entscheidung
  (`Proposed ≠ Accepted`), explizite Vertagung von Folge-ADRs (OPEN-Liste) und Blockade des
  nächsten Steps bis zur Freigabe. Ergänzt `ndf-adr-governance-review`.
- **Sicherheits-/Governance-Erkenntnis:** verhindert, dass Implementierung an ungeklärten
  Sicherheitsentscheidungen vorbeiläuft; hält die Autorität beim Human Maintainer.
- **Status:** Kandidat · **Maintainer-Entscheidung:** offen

> **Keine** Rückführung ins NDF-Repository in diesem Step. Weitere Beobachtungen im obigen
> Erfassungsschema ergänzen.
