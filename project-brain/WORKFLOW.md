# WORKFLOW.md – Arbeitsweise SpeakCore Suite

> NDF Project Brain · Stand: 2026-06-30 · Nova Development Framework (NDF)

## 1. NDF-Arbeitsweise

Die Entwicklung erfolgt in klar abgegrenzten **NDF Steps**. Jeder Step:

1. hat ein definiertes Ziel und einen begrenzten Scope,
2. aktualisiert das **Project Brain** (`project-brain/`),
3. endet mit einer **Rückmeldung an Nova** (Umgesetzt / Dateien / Entscheidungen / Risiken / nächster Schritt),
4. vermeidet Scope-Creep – Erweiterungen laufen über [ROADMAP.md](ROADMAP.md) und ADRs.

| Step | Inhalt | Status |
|------|--------|--------|
| 001 | Projektinitialisierung ohne App-Code (Struktur, Doku, Branding-Tokens) | **abgeschlossen** |
| 002 | Tech-Grundgerüst (Scaffolding, noch eng gefasst) | offen |
| 003–041 | Produkt-Steps (siehe [CHANGELOG.md](CHANGELOG.md); zuletzt 041 Rotation-Dry-Run-Vorschau) | **abgeschlossen** |
| 042 | NDF-v1.0-Adoption & Skills-first Operating Mode (docs-only) | **abgeschlossen** |

## 2. Single Source of Truth

| Thema | Maßgebliche Datei |
|-------|-------------------|
| Scope 0.1 | [MVP.md](MVP.md) |
| Architektur | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Entscheidungen / Tech-Stack | [DECISIONS.md](DECISIONS.md) |
| Risiken | [RISKS.md](RISKS.md) |
| Sicherheit | [SECURITY.md](SECURITY.md) |
| Branding | [BRANDING.md](BRANDING.md) + `branding/design-tokens/` |
| Historie | [CHANGELOG.md](CHANGELOG.md) |
| NDF-Standard & Adoptionsstatus | [../docs/ndf/NDF_V1_ADOPTION.md](../docs/ndf/NDF_V1_ADOPTION.md) |
| Claude-Arbeitsanweisung (Skills-first) | [../CLAUDE.md](../CLAUDE.md) |
| Skill-Inventar (38 docs-only) | [../docs/ndf/SKILL_INVENTORY.md](../docs/ndf/SKILL_INVENTORY.md) |
| Context Pack (kompakt) | [CONTEXT_PACK.md](CONTEXT_PACK.md) |

Tech-Stack-Änderungen **nur** per neuem/aktualisiertem ADR in [DECISIONS.md](DECISIONS.md).

## 3. Repository-Konventionen

- **Sprache:** Project Brain & interne Doku auf Deutsch; Code, Bezeichner, Commit-Messages auf Englisch;
  Produkt-UI zweisprachig DE/EN.
- **Branching:** `main` stabil. Arbeit in `feature/*`, `fix/*`, `docs/*`, `chore/*`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- **Keine Secrets im Repo** (siehe `.gitignore`, [SECURITY.md](SECURITY.md)).

## 4. Definition of Done (allgemein)

- Funktioniert gemäß Akzeptanzkriterium ([MVP.md](MVP.md)).
- Tests vorhanden: Unit, API, einfache E2E-Smoke-Tests.
- DE/EN vollständig, falls UI betroffen.
- Doku/Hilfe aktualisiert, Audit-Log/Safe-Defaults berücksichtigt.
- Relevante Brain-Dateien aktualisiert; [CHANGELOG.md](CHANGELOG.md) ergänzt.

## 5. Teststrategie (für 0.1)

- **Unit Tests** für Core-Logik (Preflight-Bewertung, Adapter-Interface, Services).
- **API Tests** für Route Handler.
- **E2E-Smoke** für den kritischen Pfad (Wizard → Admin → TS3 verbinden/installieren → Status).

## 6. Rollen

Senior Software Architect · Lead Full-Stack Developer · DevOps Engineer · Security Engineer ·
UX/UI Designer · Technical Writer – in diesem Projekt durch den Assistenten gebündelt,
nach NDF-Vorgaben des Auftraggebers (Nova).
