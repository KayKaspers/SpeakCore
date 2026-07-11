# STEP-042 – NDF v1.0 Adoption & Claude Skills Enablement

> NDF Project Brain · Stand: 2026-07-11 · Typ: **Workflow-/Skills-/Dokumentationsadoption**
> (docs-only, keine Runtime-Auswirkung).

## Ziel

Den verbindlichen Projektstandard **NDF v1.0.0** in SpeakCore einführen und den **Skills-first
Operating Mode** für künftige Claude-Arbeitspakete aktivieren.

## Scope (erlaubter Write-Bereich)

- `.claude/skills/**` – 38 docs-only NDF-Skills + Pack-`README.md`.
- `CLAUDE.md` – Skills-first-Arbeitsanweisung.
- `docs/ndf/**` – Skill-Inventar, Adoptionsstatus, Feedback-Loop.
- `project-brain/**` – Context Pack, diese Step-Notiz, WORKFLOW-/CHANGELOG-Fortschreibung
  (Auffindbarkeit).

## Out-of-Scope

Runtime-Code, Backend/Frontend/API, Datenbank/Migrationen/Prisma, Docker/Compose/Proxy,
TS3-Agent, Backup-/Restore-/Delete-Funktionen, Auth, CI/CD, GitHub Actions, Produktcode-Tests,
Dependencies/Lockfiles, Build-Konfig, Releases/Tags/Versionen, Secrets, Deployment. **Kein**
Netzwerkzugriff, **kein** Push/Merge/Tag/Release/Branch-Neuanlage, **keine** Änderung am
NDF-Repository. `project-system/` bewusst **nicht** angelegt – bestehende SpeakCore-Konvention
(`project-brain/`, `docs/`) genügt.

## Ausgangslage

- Branch `main`, Working Tree sauber; letzter Commit `98af8a0` (Step 041).
- Kein bestehendes `CLAUDE.md`, kein `.claude/`, kein `docs/ndf/`, kein `project-system/` →
  **keine Skill-Konflikte**, kein Überschreiben unbekannter Inhalte.

## Durchgeführte Änderungen

- **Skills übernommen:** 38 docs-only Skills + `README.md` nach `.claude/skills/` (byte-identisch
  aus dem getaggten NDF-`v1.0.0`-Baum extrahiert).
- **`CLAUDE.md`** neu: ein-WP-Regel, Skills-first (10 Regeln), Rollenmodell, Security-/Blueprint-/
  Guard-/Owner-/Audit-Prinzipien, Rückmeldung + Compact Context Summary, Feedback-Loop,
  Validierungsbefehle.
- **`docs/ndf/`** neu: `SKILL_INVENTORY.md`, `NDF_V1_ADOPTION.md`, `FEEDBACK_TO_NDF.md`.
- **`project-brain/`**: `CONTEXT_PACK.md` neu (in **Step 042a** → `CONTEXT_PACK_SPEAKCORE_CURRENT.md`
  umbenannt), diese `STEP-042-NDF-ADOPTION.md` neu; `WORKFLOW.md` (Step-Tabelle + NDF-Verweise) und
  `CHANGELOG.md` (Step-042-Eintrag) fortgeschrieben.

## Skill-Quelle

`KayKaspers/Nova-Development-Framework` · Tag `v1.0.0` · Commit
`9dcadc12fb960914b9a5baeff2ab1aee75912b57` (`9dcadc1`) · lokal verifiziert, **ohne Netzwerkzugriff**.

## Prüfergebnisse

- Tag `v1.0.0` → Commit `9dcadc1` **verifiziert** (lokal); `v1.0.0-rc.1` nicht verwendet.
- **38** Skill-Verzeichnisse, je ein `SKILL.md`; 39 `.md`-Dateien gesamt, alle Git-Modus `100644`.
- **0 Drift**: jede Datei byte-identisch zur `v1.0.0`-Quelle.
- Keine Nicht-`.md`-Dateien, keine ausführbaren Dateien, keine Symlinks, keine leeren Dateien,
  keine Secrets.
- `git diff --check` sauber; alle Änderungen innerhalb des erlaubten Scopes.

## Risiken

- Gering. Reine Doku/Workflow-Adoption ohne Runtime-Auswirkung.
- Kanonischer Pack-`README.md` enthält NDF-repo-relative Links, die in SpeakCore nicht auflösen –
  bewusst unverändert gelassen (Nachvollziehbarkeit statt SpeakCore-Edits an Skills).

## Bekannte Grenzen

- Keine automatische NDF-Synchronisierung/Upstream-Übernahme; NDF-Updates sind ein eigener Step.
- Skills sind docs-only, keine Ausführung/Automatisierung; sie erweitern keine Rechte und ersetzen
  keine Freigabe.

## Git-Status

- Ein lokaler Commit vorgesehen: `docs(ndf): adopt ndf v1.0 skills-first workflow`.
- **Kein** Push/Merge/Tag/Release (liegt bei Kay/Nova).

## Empfohlener nächster Schritt

Restore-Konzept-Blueprint (`executable: false`) als letztes fehlendes Backup-Lebenszyklus-Stück,
oder editierbare Rotation-Policy + echter Bulk-Rotation-Step. Entscheidung durch Nova.
