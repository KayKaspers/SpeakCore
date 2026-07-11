# NDF v1.0 Skill-Inventar (SpeakCore)

> **NDF-Version:** v1.0.0 (Final Release) · **Tag:** `v1.0.0` · **Referenz-Commit:** `9dcadc1`
> (`9dcadc12fb960914b9a5baeff2ab1aee75912b57`)
> **Herkunftspfad:** `KayKaspers/Nova-Development-Framework` → `.claude/skills/` (lokal verifiziert
> aus dem getaggten Baum `v1.0.0`).
> **Lokale Adoption:** 2026-07-11 (NDF Step 042) · **Zielpfad:** [`.claude/skills/`](../../.claude/skills/)
> **Anzahl übernommener Skills:** **38** (docs-only) + `README.md` (kanonischer Pack-Index).

## Status & Grundsätze

- **docs-only:** ausschließlich `SKILL.md`-Dokumente (+ Pack-`README.md`). Keine Scripts, keine
  ausführbaren Dateien, keine Binärdateien, keine Symlinks. Verifiziert: 39 `.md`-Dateien, alle
  Git-Modus `100644`, byte-identisch zur `v1.0.0`-Quelle (0 Drift).
- **fail-closed:** Was nicht ausdrücklich erlaubt ist, ist verboten. Jede Skill-Ausgabe ist ein
  **Vorschlag**; der Human Maintainer entscheidet und führt alle Commit-/Push-/Tag-/Release-Aktionen
  aus (Skill-Security-Policy / ADR-0032 in NDF).
- **Kein Laden bei jedem WP:** Pro Work Package werden **nur** die erforderlichen Skills genutzt;
  nicht benötigte Skills werden nicht geladen/ausgeführt (siehe [CLAUDE.md](../../CLAUDE.md) §2).
- **Kanonisch unverändert:** Die Skill-Dateien wurden inhaltlich **nicht** SpeakCore-spezifisch
  angepasst. Der Pack-`README.md` enthält relative Links (`../../docs/...`), die in die
  **NDF-Repo-Struktur** zeigen und in SpeakCore bewusst nicht aufgelöst werden – die kanonischen
  Dateien bleiben unverändert (siehe [NDF_V1_ADOPTION.md](NDF_V1_ADOPTION.md) → Bekannte Grenzen).

## Skills nach Kategorie

Zweckbeschreibungen stammen aus dem kanonischen Pack-`README.md` / den jeweiligen `SKILL.md`;
es werden **keine** darüber hinausgehenden Fähigkeiten behauptet.

### Core MVP (WP-129)
| Skill | Zweck |
|-------|-------|
| `ndf-work-package-runner` | Standardisierte NDF-Work-Package-Ausführung mit weniger Prompt-Overhead. |
| `ndf-compact-context-summary-runner` | Einheitliche, kurze Compact Context Summary + Report-to-Nova-Struktur für die Übergabe. |
| `ndf-public-neutrality-guard` | Public-Neutrality-Erinnerung/Guard für NDF-Artefakte (kein CI-Gate). |
| `ndf-context-pack-maintainer` | Hält Context Packs konsistent und kurz (token-arme Übergabe). |

### Extended Core (WP-137)
| Skill | Zweck |
|-------|-------|
| `ndf-skill-quality-reviewer` | Prüft NDF-Skill-Dokumente auf Qualität, Scope, ADR-0032-Konformität, Neutralität, Overlap, fail-closed (advisory). |
| `ndf-existing-project-analysis-runner` | Strukturiert eine neutrale, advisory Analyse eines bestehenden Projekts für NDF-Onboarding. |
| `ndf-docs-polish-runner` | Verbessert Doku-Klarheit/Struktur/Konsistenz (advisory, keine inhaltliche Änderung). |
| `ndf-changelog-writer` | Hilft bei konsistenten, neutralen, WP-referenzierten Changelog-Einträgen (löst nie ein Release aus). |

### Core / Governance / Release (WP-145)
| Skill | Zweck |
|-------|-------|
| `ndf-release-safety` | Prüft release-nahe WPs auf Sicherheitsgrenzen; führt nie Tag/Release-Aktionen aus. |
| `ndf-adr-governance-review` | Prüft ADR-relevante Änderungen auf Governance-Konsistenz; ändert/finalisiert nie still einen ADR. |
| `ndf-v1-readiness-review` | Unterstützt v1.0/RC/Final-Readiness-Reviews; aktiviert das v1.x-Versprechen nur bei Final. |
| `ndf-release-notes-runner` | Erstellt/prüft Release Notes; behauptet keine Veröffentlichung und löst kein Release aus. |

### Docs / Kommunikation (WP-145)
| Skill | Zweck |
|-------|-------|
| `ndf-readme-quality-reviewer` | Prüft ein README auf Einstieg, Klarheit, ehrlichen Status, Neutralität. |
| `ndf-project-brief-runner` | Erstellt neutrale Project Briefs; keine privaten Projektnamen im öffentlichen NDF. |

### Engineering / Architektur (WP-145)
| Skill | Zweck |
|-------|-------|
| `ndf-architecture-blueprint-runner` | Architektur-Blueprints (design-only, keine Implementierung). |
| `ndf-feature-scope-runner` | Schärft Feature-Scope; Write-Aktionen erst nach menschlicher Freigabe. |
| `ndf-implementation-review-runner` | Dokumentarischer Implementation-Review; keine automatischen Codeänderungen. |
| `ndf-test-strategy-runner` | Plant eine Teststrategie; keine Pflicht, Tests auszuführen. |
| `ndf-debugging-root-cause-reviewer` | Strukturiert Debugging/Root-Cause-Analyse; keine riskanten Aktionen. |

### Produkt / UX / Adoption (WP-145)
| Skill | Zweck |
|-------|-------|
| `ndf-product-discovery-runner` | Produkt-/Projekt-Discovery; kein Manipulative-Growth-Fokus. |
| `ndf-ux-flow-reviewer` | Prüft User-Flows; keine Dark Patterns. |
| `ndf-onboarding-friction-reviewer` | Bewertet Onboarding-Friction; kein Pressure-Onboarding. |
| `ndf-behavioral-adoption-reviewer` | Ethischer Adoption-/Behavioral-Design-Review; keine Manipulation/Dark Patterns. |
| `ndf-ethical-growth-reviewer` | Ethischer Growth-/Support-/Donation-Review; nur freiwillige Unterstützung. |

### Creative / Branding / Content (WP-145)
| Skill | Zweck |
|-------|-------|
| `ndf-branding-kit-runner` | Branding-Kits; kopiert keine fremden Marken. |
| `ndf-creative-direction-runner` | Creative Direction; keine Imitation/IP-Probleme. |
| `ndf-naming-runner` | Projekt-/Feature-Naming; kein Markenanspruch ohne saubere Prüfung. |
| `ndf-ui-style-system-runner` | UI-Style-Prinzipien; erzwingt keine konkrete Implementierung. |
| `ndf-landing-page-concept-runner` | Landingpage-Konzepte; CTAs ohne Pressure-Mechaniken. |
| `ndf-content-tone-reviewer` | Sprach-/Ton-/Konsistenz-Review; keine irreführenden Claims. |

### Evidence / Quality / Privacy / Adapter (WP-146)
| Skill | Zweck |
|-------|-------|
| `ndf-validation-evidence-reviewer` | Prüft Validierungs-/Evidence-Artefakte (Quellenklasse, Stärke, Grenzen); erfindet keine Evidenz/Identitäten. |
| `ndf-skill-trigger-quality-reviewer` | Prüft Skill-Namen/Beschreibungen/When-to-use gegen Over-/Under-Triggering und Wildwuchs. |
| `ndf-skill-supply-chain-risk-reviewer` | Prüft Supply-Chain-Risiko externer Skills; kein Netzwerk/Install/Kopie von Fremdcode. |
| `ndf-public-release-body-reviewer` | Prüft Release-Bodies auf Status-/Claim-Korrektheit; führt keine GitHub-Aktion aus. |
| `ndf-feedback-triage-runner` | Triagiert Feedback neutral (Quelle/Severity/Action); erfindet kein Feedback/Identitäten. |
| `ndf-accessibility-reviewer` | Prüft Docs/UI/Flows auf Accessibility; behauptet keine Zertifizierung. |
| `ndf-privacy-data-minimization-reviewer` | Prüft Datensparsamkeit/private Daten; verbietet Secrets; keine bindende Rechtsberatung. |
| `ndf-project-adapter-quality-reviewer` | Prüft Projekt-Adapter auf Qualität/Neutralität; keine privaten Infos im öffentlichen NDF, keine Auto-Migration. |

## Alphabetische Gesamtliste (38)

`ndf-accessibility-reviewer`, `ndf-adr-governance-review`, `ndf-architecture-blueprint-runner`,
`ndf-behavioral-adoption-reviewer`, `ndf-branding-kit-runner`, `ndf-changelog-writer`,
`ndf-compact-context-summary-runner`, `ndf-content-tone-reviewer`, `ndf-context-pack-maintainer`,
`ndf-creative-direction-runner`, `ndf-debugging-root-cause-reviewer`, `ndf-docs-polish-runner`,
`ndf-ethical-growth-reviewer`, `ndf-existing-project-analysis-runner`, `ndf-feature-scope-runner`,
`ndf-feedback-triage-runner`, `ndf-implementation-review-runner`, `ndf-landing-page-concept-runner`,
`ndf-naming-runner`, `ndf-onboarding-friction-reviewer`, `ndf-privacy-data-minimization-reviewer`,
`ndf-product-discovery-runner`, `ndf-project-adapter-quality-reviewer`, `ndf-project-brief-runner`,
`ndf-public-neutrality-guard`, `ndf-public-release-body-reviewer`, `ndf-readme-quality-reviewer`,
`ndf-release-notes-runner`, `ndf-release-safety`, `ndf-skill-quality-reviewer`,
`ndf-skill-supply-chain-risk-reviewer`, `ndf-skill-trigger-quality-reviewer`,
`ndf-test-strategy-runner`, `ndf-ui-style-system-runner`, `ndf-ux-flow-reviewer`,
`ndf-v1-readiness-review`, `ndf-validation-evidence-reviewer`, `ndf-work-package-runner`.
