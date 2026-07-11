# NDF v1.0 – Adoptionsstatus (SpeakCore)

> **Zweck:** Festhalten, wie SpeakCore den Nova Development Framework (NDF) v1.0 Standard adoptiert
> hat. Diese Datei beschreibt **Workflow und Governance**, nicht Produktverhalten.

## 1. Verwendete NDF-Version

- **Version:** NDF **v1.0.0** (Final Release)
- **Referenz-Tag:** `v1.0.0`
- **Referenz-Commit:** `9dcadc1` (`9dcadc12fb960914b9a5baeff2ab1aee75912b57`,
  Tag-Nachricht „docs(v1): prepare v1.0 final release")
- **Quelle:** `KayKaspers/Nova-Development-Framework`, lokal verifizierter getaggter Baum.
- **Ausdrücklich nicht verwendet:** ältere Foundation-Versionen, `v1.0.0-rc.1`, `main` ohne
  Tag-Prüfung, lokal veränderte Skill-Versionen.
- **Adoptionsdatum:** 2026-07-11 (NDF Step 042).

## 2. Umfang der Adoption

Diese Adoption ist ausschließlich eine **Workflow-, Skills- und Dokumentationsadoption**:

- 38 docs-only Skills nach [`.claude/skills/`](../../.claude/skills/) übernommen
  (Inventar: [SKILL_INVENTORY.md](SKILL_INVENTORY.md)).
- Skills-first Operating Mode verbindlich dokumentiert ([CLAUDE.md](../../CLAUDE.md)).
- Rollenmodell (Kay / Nova / Claude) festgelegt.
- Context-Pack- und Compact-Context-Summary-Regeln dokumentiert.
- Feedback-to-NDF-Loop eingerichtet ([FEEDBACK_TO_NDF.md](FEEDBACK_TO_NDF.md)).
- **Keine** Runtime-Auswirkung: kein Produktcode, keine Datenbank/Migration, kein Docker/Agent,
  keine Backup-/Restore-/Delete-Funktion, kein CI/Release wurde geändert.

## 3. Skills-first Operating Mode

Vor jedem Work Package werden die verfügbaren Skills geprüft und **nur** die erforderlichen genutzt.
Skills sind **Vorschläge/Governance-Hilfen**, keine Entscheidungsinstanz; WP-Prompt und
Maintainer-Grenzen haben Vorrang. Details und die zehn verbindlichen Regeln:
[CLAUDE.md](../../CLAUDE.md) §2.

## 4. Context-Pack-Prinzip

- Ein kompaktes SpeakCore **Context Pack** liegt unter
  [project-brain/CONTEXT_PACK_SPEAKCORE_CURRENT.md](../../project-brain/CONTEXT_PACK_SPEAKCORE_CURRENT.md)
  und trägt Projektziel,
  Stand, Architektur-Kurzform, Sicherheitsgrenzen, aktuellen NDF-Standard, Rollenmodell, aktuellen
  Step, offene Arbeit und verbotene Aktionen.
- Pflege gezielt und token-arm (Skill `ndf-context-pack-maintainer`); gültige Projektinfos werden
  nicht entfernt. **Keine Secrets** im Context Pack.

## 5. Compact Context Summary

Jede Claude-Rückmeldung endet mit einer **Compact Context Summary** (Skill
`ndf-compact-context-summary-runner`): Projekt · aktueller Standard · abgeschlossener Step ·
wichtigste Änderungen · Skill-Status · Sicherheitsgrenzen · offene Notes · nächster Step ·
Git-/Push-Status. Dieser Block ist Pflicht und wird nicht zur Kompression weggelassen.

## 6. Rollen und Freigabegrenzen

| Rolle | Wer | Grenze |
|-------|-----|--------|
| Human Maintainer | **Kay** | Alle Freigaben; Push/Merge/Tag/Release; Secrets; Deployments; destructive Aktionen. |
| Planung & Review | **Nova** | Architektur, WP-Planung, Scope, Risiko-/Sicherheitsbewertung, nächster Step, Push-/Merge-Empfehlung. |
| Begrenzte Umsetzung | **Claude** | Ein WP, nur relevante Skills, Scope-treu, fail-closed, Rückmeldung an Nova; **keine** autonome Push-/Merge-/Tag-/Release-/Netzwerk-/Secret-Aktion. |

## 7. Security- und Destructive-Action-Grenzen

- Skills **erweitern keine Berechtigungen** und ersetzen **keine Freigabe**.
- Skills dürfen den WP-Scope nicht erweitern und keine gefährliche Aktion automatisch bestätigen.
- Destructive Funktionen benötigen weiterhin **vorgelagerte Planung (Blueprint), Guards,
  Owner-Prüfung, Bestätigung und Audit** (SpeakCore-Praxis der Steps 024–041).
- **Netzwerkzugriff standardmäßig verboten**; **Secrets** bleiben außerhalb von Prompts, Context
  Packs und Doku.
- **fail-closed:** Bei Widerspruch/unklarem Scope/fehlenden Voraussetzungen wird ohne Änderung
  abgebrochen und der Blocker dokumentiert.

## 8. Lokale Skills-Struktur

```text
.claude/skills/
  README.md                     # kanonischer Pack-Index (unverändert)
  ndf-<skill-name>/SKILL.md      # je Skill genau ein docs-only Dokument (38×)
```

## 9. Update-Verfahren bei künftigen NDF-Versionen

- NDF-Updates werden als **eigener, kontrollierter Arbeitsschritt** behandelt (nicht nebenbei).
- Vorgehen: neue NDF-Version/Tag/Commit lokal verifizieren → Diff zur aktuellen lokalen
  Skills-Kopie erstellen → Änderungen dokumentieren → durch Nova/Kay freigeben → übernehmen.
- **Keine automatische Synchronisierung**, **keine automatische Upstream-Übernahme**, **keine
  automatische Kopplung** zwischen SpeakCore und dem NDF-Repository.

## 10. Drift-Prüfung

- Bei der Adoption (Step 042) wurde jede der 39 Dateien byte-identisch gegen den `v1.0.0`-Baum
  geprüft: **0 Drift**.
- Künftige Drift-Prüfung: kopierte Skills gegen die verifizierte NDF-v1.0.0-Quelle vergleichen;
  Abweichungen nur bei zwingender Notwendigkeit und ausdrücklicher Dokumentation.

## 11. Bekannte Grenzen

- Der kanonische Pack-`README.md` enthält relative Links (`../../docs/…`, `../../adr/…`), die in die
  **NDF-Repo-Struktur** zeigen. In SpeakCore sind sie **nicht auflösbar** – das ist beabsichtigt:
  die kanonischen Dateien bleiben **unverändert** (keine SpeakCore-spezifischen Edits an Skills).
- Die Skills sind **docs-only**: keine Ausführung, keine Automatisierung, kein Tool-Orchestrieren.
- Dieser Step hat **keine** Runtime-, Datenbank-, Build- oder CI-Auswirkung.
- Es besteht **keine** automatische Rückführung von SpeakCore-Erkenntnissen ins NDF (siehe
  [FEEDBACK_TO_NDF.md](FEEDBACK_TO_NDF.md)).
