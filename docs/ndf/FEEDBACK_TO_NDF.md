# Feedback-to-NDF-Loop (SpeakCore)

> **Zweck:** SpeakCore-Erfahrungen mit dem NDF-v1.0-Workflow und den Skills strukturiert sammeln,
> damit sie später als **mögliches** Feedback für das NDF-Repository dienen können.
>
> **Grenzen:** Dies ist reine Sammlung/Dokumentation. **Keine** direkten Änderungen am
> NDF-Repository, **keine** automatische Upstream-Übernahme. Eine tatsächliche NDF-Rückführung ist
> ein eigener, von Kay/Nova freigegebener Schritt. **Keine Secrets/privaten Daten** in Einträgen.

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

> Neue Beobachtungen unterhalb dieser Zeile im obigen Erfassungsschema ergänzen.
