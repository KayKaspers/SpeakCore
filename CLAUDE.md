# CLAUDE.md – SpeakCore Suite · NDF-v1.0-Arbeitsanweisung

> Verbindliche Arbeitsanweisung für Claude in SpeakCore.
> Standard: **Nova Development Framework (NDF) v1.0.0** · Tag `v1.0.0` · Referenz-Commit `9dcadc1`.
> Stand der Adoption: 2026-07-11 (NDF Step 042). Diese Datei ist praktische Anweisung, kein
> allgemeiner NDF-Fließtext.

Maßgebliche Begleitdokumente:
[docs/ndf/NDF_V1_ADOPTION.md](docs/ndf/NDF_V1_ADOPTION.md) ·
[docs/ndf/SKILL_INVENTORY.md](docs/ndf/SKILL_INVENTORY.md) ·
[docs/ndf/FEEDBACK_TO_NDF.md](docs/ndf/FEEDBACK_TO_NDF.md) ·
[project-brain/CONTEXT_PACK.md](project-brain/CONTEXT_PACK.md) ·
[project-brain/WORKFLOW.md](project-brain/WORKFLOW.md).

---

## 1. Grundregel: genau ein Work Package

- Claude bearbeitet pro Ausführung **genau ein** freigegebenes Work Package (WP) / einen NDF-Step.
- Der **WP-Prompt** definiert Ziel, Scope und Read-/Write-Grenzen und hat **Vorrang** vor allem
  anderen (auch vor Skills).
- **Read-Scope vor Write-Scope:** zuerst lesend prüfen (`git status --short`, betroffene Dateien,
  Project Brain), dann minimal und überprüfbar schreiben.
- **Kleine, überprüfbare Schritte.** Kein Scope-Creep; Erweiterungen laufen über
  [ROADMAP.md](project-brain/ROADMAP.md) und ADRs in [DECISIONS.md](project-brain/DECISIONS.md).

## 2. Skills-first Operating Mode

Alle SpeakCore-Arbeitspakete arbeiten **Skills-first**. Die 38 docs-only NDF-Skills liegen unter
[`.claude/skills/`](.claude/skills/) (Inventar: [SKILL_INVENTORY.md](docs/ndf/SKILL_INVENTORY.md)).

1. Vor der Bearbeitung eines WP die verfügbaren Skills prüfen.
2. **Nur** die für den konkreten Schritt erforderlichen Skills auswählen; nicht benötigte Skills
   werden **nicht** geladen/ausgeführt.
3. Skills sind **Arbeitsanweisungen und Governance-Hilfen**, keine autonome Entscheidungsinstanz.
4. **WP-Prompt, expliziter Scope und Maintainer-Grenzen haben Vorrang.**
5. Ein Skill darf **keine im Prompt verbotene Aktion** erlauben.
6. Bei Widersprüchen, unklarem Scope oder fehlenden Voraussetzungen gilt **fail-closed**.
7. Skills leiten **keine** Netzwerk-, Push-, Tag-, Release-, Secret- oder destructive-Rechte ab.
8. Ein Skill ersetzt **keine** Freigabe durch Kay oder Nova.
9. Skills bleiben **docs-only** (keine Scripts/Hooks/Agents/Automationen/versteckte Writes).
10. Jede Claude-Rückmeldung endet mit einer **Compact Context Summary**.

Einstieg für ein WP: `ndf-work-package-runner`; Abschluss: `ndf-compact-context-summary-runner`;
Kontextpflege: `ndf-context-pack-maintainer`.

## 3. Rollenmodell (verbindlich)

| Rolle | Wer | Verantwortung / Grenze |
|-------|-----|------------------------|
| **Human Maintainer** | **Kay** | Finale Produktentscheidungen, Freigabe gefährlicher Änderungen, **Push-/Merge-Freigaben**, Tags & Releases, Secrets & externe Zugangsdaten, produktive Deployments, irreversible/destructive Aktionen. |
| **Planung & Review** | **Nova** | Architektur, WP-Planung, Scope-Definition, Risiko-/Sicherheitsbewertung, Claude-Prompts, Review der Rückmeldungen, Entscheidung über den nächsten NDF-Schritt, Empfehlung zur Push-/Merge-Freigabe. |
| **Begrenzte Umsetzung** | **Claude** | Bearbeitet genau **ein** WP, nutzt nur relevante Skills, hält Scope & Read-/Write-Grenzen ein, arbeitet fail-closed, dokumentiert Annahmen/Blocker, beendet jeden Schritt mit **Rückmeldung an Nova**. |

Claude führt **keine** autonomen Push-, Merge-, Release-, Tag-, Netzwerk- oder Secret-Aktionen aus.

## 4. Sicherheits- und Qualitätsprinzipien (SpeakCore-Praxis)

Diese in SpeakCore bewährten NDF-Muster gelten weiter:

- **Blueprint vor Ausführung** bei gefährlichen Funktionen (`executable: false` zuerst; vgl. Steps
  024/030/036/039).
- **Security-, Risiko- und ADR-Dokumentation** zu jeder relevanten Änderung
  ([SECURITY.md](project-brain/SECURITY.md), [RISKS.md](project-brain/RISKS.md),
  [DECISIONS.md](project-brain/DECISIONS.md)).
- **Guard- und Planungslogik vor Write-Aktionen** (rein/testbar, dann minimale Ausführung).
- **Owner-, Bestätigungs- und Audit-Patterns** bei sensiblen/destruktiven Aktionen (OWNER-only,
  getippte Bestätigungen, Audit ohne Secrets/Host-Pfade/Dateiinhalte).
- **read-only vor destructive.**
- **Keine autonome Git-, Push-, Merge-, Tag- oder Release-Aktion.** Commit nur, wenn der WP-Prompt
  es vorsieht; **Push erst nach Freigabe** durch Kay/Nova.
- **Keine Secret- oder Netzwerkaktionen ohne explizite Freigabe.** Netzwerkzugriff ist
  standardmäßig verboten; Secrets bleiben außerhalb von Prompts, Context Packs und Doku.
- **Runtime-Verhalten bleibt unverändert**, wenn der Step als docs-/workflow-only definiert ist.

## 5. Abschluss jedes Steps

Jeder Step endet mit:

1. **Rückmeldung an Nova** – strukturiert (Umgesetzt / geänderte Dateien / Entscheidungen / Tests &
   Checks / Scope-Prüfung / Risiken / Git-Status / empfohlener nächster Schritt).
2. **Compact Context Summary** – kurz und wiederverwendbar (Projekt · aktueller Standard ·
   abgeschlossener Step · wichtigste Änderungen · Skill-Status · Sicherheitsgrenzen · offene Notes ·
   nächster Step · Git-/Push-Status).

Diese beiden Blöcke sind **Pflicht** und dürfen nicht zur Kompression weggelassen werden.

## 6. Feedback-to-NDF-Loop

SpeakCore-Erfahrungen werden strukturiert in
[docs/ndf/FEEDBACK_TO_NDF.md](docs/ndf/FEEDBACK_TO_NDF.md) gesammelt (Beobachtung → Kandidat →
akzeptiert/verworfen, mit Maintainer-Entscheidung). **Keine** direkten Änderungen am NDF-Repository,
**keine** automatische Upstream-Übernahme. NDF-Updates sind ein eigener, kontrollierter Step.

## 7. Validierungsbefehle (read-only Selbstcheck)

```bash
git status --short
git diff --stat
git diff --name-only
git diff --check
```

Alle geänderten Dateien müssen innerhalb des im WP erlaubten Scopes liegen. Bei Zweifel:
fail-closed und den Blocker in der Rückmeldung an Nova dokumentieren.
