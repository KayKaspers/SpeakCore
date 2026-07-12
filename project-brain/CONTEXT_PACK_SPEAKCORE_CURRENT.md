# CONTEXT_PACK_SPEAKCORE_CURRENT.md – SpeakCore Suite

> NDF Project Brain · Stand: 2026-07-11 · **Verbindliches, aktuelles Context Pack** (SSOT) für
> token-arme Übergabe. **Keine Secrets/privaten Zugangsdaten.** Pflege via Skill
> `ndf-context-pack-maintainer`. Erfahrungen:
> [NDF_LESSONS_LEARNED.md](NDF_LESSONS_LEARNED.md) · Arbeitspakete:
> [../project-system/WORK_PACKAGE_QUEUE.md](../project-system/WORK_PACKAGE_QUEUE.md).

## Projektziel

**SpeakCore Suite** – selbsthostbare Plattform zur Installation, Verwaltung und Überwachung von
Voice-/Community-Servern (TeamSpeak 3 zuerst). Leitsatz: **„Erst Vertrauen aufbauen, dann Funktionen
erweitern."** Ausführlich: [PROJECT.md](PROJECT.md), [MVP.md](MVP.md).

## Aktueller Entwicklungsstand

- **Phase:** 0.1 – interne Alpha. Nicht für öffentliche/exponierte Produktion.
- **Letzter Produkt-Step:** **041** – read-only Rotation-Dry-Run-Vorschau in der Backup-Karte.
- **Backup-Lebenszyklus (Steps 032–041) vollständig bis auf Restore:** Erstellen (032), Sichtbarkeit
  (033), SHA-256-Prüfsummen (034) + Backfill (038), read-only Verify (035), Web-proxied Download
  (037), gezieltes Einzel-Delete (040), Rotation-Dry-Run-Vorschau (041). **Restore/Import fehlen
  bewusst.**
- **Abgeschlossene Governance-/Blueprint-Steps:** **042** NDF-Adoption · **042a** SSOT-Alignment ·
  **043** **Restore-Blueprint** (`executable: false`) · **044** **Restore-Foundation-ADR-Paket** ·
  **044a** **Accept Restore Foundation ADRs** — ADR-0039–0041 **Accepted** (Kay / Human Maintainer,
  **2026-07-12**), bleiben `executable: false`
  ([docs/backup/RESTORE_FOUNDATION_DECISION_SUMMARY.md](../docs/backup/RESTORE_FOUNDATION_DECISION_SUMMARY.md)).
  **Acceptance ≠ Ausführung: Restore weiterhin NICHT implementiert.**
- **NDF-Standard:** **v1.0.0 aktiv**; **38** lokale docs-only Skills unter `.claude/skills/`.
- **045 – Read-only Backup-Inspection:** Agent `POST /docker/provision/inspect-backup` prüft **ein**
  Backup (Name/Boundary/Dateityp/gestreamte SHA-256/Metadaten/Legacy), Legacy nicht restorefähig.
- **046 – Restore Manifest Format/Placement/Binding (Decision Package, `executable: false`):**
  **Proposed ADR-0042** + [Manifest-v1-Schema](../docs/backup/RESTORE_MANIFEST_V1_SCHEMA.md)
  (Datei `speakcore-backup-manifest.json` im Archiv-Root + identischer Sidecar; deterministische
  Serialisierung; Per-Datei-SHA-256; Bindung Archiv/Manifest/Metadata). **Befund:** aktuelle
  Backup-Erzeugung liefert **weder Staging/Snapshot noch atomare Veröffentlichung** ⇒
  **Manifest-Integration blockiert** bis Staging-WP (OPEN-13/14). **Restore weiterhin NICHT
  implementiert; keine Backup-Erzeugung geändert.**
- **Nächster Schritt:** **047 – Manifest v1 Types & Pure Validation** (geplant, **blockiert bis
  ADR-0042-Acceptance**). Vertagte Folge-ADRs OPEN-6…OPEN-14 offen.

## Architektur in Kurzform

- Monorepo (pnpm workspaces). **`apps/web`:** Next.js 15 App Router + TypeScript + TailwindCSS +
  next-intl (DE/EN) + Prisma/SQLite. **`apps/agent`:** `node:http`-Agent mit Docker-Zugriff.
  **`packages/`:** `types`, `shared` (reine Guard-/Planungslogik), `config`.
- **Managed-Only Docker:** Agent nutzt Docker-CLI via `execFile` (statische Args, keine Shell, kein
  Socket); nur SpeakCore-gelabelte Ressourcen. Agent-Write-Endpunkte hinter Token +
  `AGENT_DOCKER_WRITE_ENABLED`. Details: [ARCHITECTURE.md](ARCHITECTURE.md).

## Relevante Sicherheitsgrenzen

- **read-only vor destructive**; **Blueprint vor gefährlichen Funktionen**.
- OWNER-only + getippte Bestätigungen + Audit (ohne Secrets/Host-Pfade/Dateiinhalte) bei sensiblen/
  destruktiven Aktionen. Backup-Dateien sind **sensibel**; kein Restore in 0.1.
- Keine Netzwerkaktionen ohne Freigabe; Secrets nie in Repo/Prompts/Doku. Details:
  [SECURITY.md](SECURITY.md), [RISKS.md](RISKS.md), ADRs in [DECISIONS.md](DECISIONS.md).

## Aktueller NDF-Standard

- **NDF v1.0.0** (Tag `v1.0.0`, Commit `9dcadc1`) verbindlich; **Skills-first Operating Mode**.
- 38 docs-only Skills unter [`.claude/skills/`](../.claude/skills/) (Inventar:
  [docs/ndf/SKILL_INVENTORY.md](../docs/ndf/SKILL_INVENTORY.md)). Arbeitsanweisung:
  [CLAUDE.md](../CLAUDE.md); Adoptionsstatus: [docs/ndf/NDF_V1_ADOPTION.md](../docs/ndf/NDF_V1_ADOPTION.md).

## Rollenmodell

- **Kay** – Human Maintainer: alle Freigaben, Push/Merge/Tag/Release, Secrets, Deployments.
- **Nova** – Planung & Review: Architektur, WP-Planung, Scope, Risiko/Sicherheit, nächster Step.
- **Claude** – begrenzte Umsetzung: ein WP, nur relevante Skills, fail-closed, Rückmeldung an Nova;
  keine autonome Push-/Merge-/Tag-/Release-/Netzwerk-/Secret-Aktion.

## Abgeschlossene vorherige Schritte (kompakt)

015–016 Secret-Rotation · 017–023 Container-Lifecycle (create/start/stop/remove/restart/status) ·
024–028 Deprovisioning (Volume-/Network-Remove, Archiv) · 029 Export · 030 Backup-Blueprint ·
031 Release-Readiness · **032–041 Backup-Lebenszyklus** (siehe oben) · **042 NDF-v1.0-Adoption** ·
**042a SSOT-Alignment** · **043 Restore-Blueprint** · **044/044a Restore-Foundation-ADRs (Accepted
2026-07-12)** · **045 Read-only Backup-Inspection** · **046 Manifest-v1-Decision-Package (Proposed
ADR-0042)**. Vollständige Historie: [CHANGELOG.md](CHANGELOG.md); Arbeitspaket-Queue:
[../project-system/WORK_PACKAGE_QUEUE.md](../project-system/WORK_PACKAGE_QUEUE.md).

## Offene nächste Arbeit

- **Human-Maintainer-Freigabe von ADR-0042** einholen; danach **Step 047 – Manifest v1 Types & Pure
  Validation** (reine Typen/Validator/Serialisierung, keine Backup-Integration). Manifest-Integration
  bleibt **blockiert** bis Staging-/Atomic-Publish-WP (OPEN-13/14). Danach Restore-Plan/-Apply/
  -Rollback (Blueprint §5.6–§5.15). Alternativ (Backlog): editierbare Rotation-Policy + Bulk-Rotation.
  Priorisierung durch Nova. Step 047 **nicht** begonnen.

## Git-/Push-Status

- **Gepusht auf `origin/main`:** … `c86c0a8` (044a) · `7ec9f32` (045).
- **Lokal, noch nicht gepusht:** Step-046-Commit (`docs(backup): define restore manifest format and
  binding`) — Push-Freigabe durch Kay/Nova ausstehend.

## Verbotene Aktionen (Dauerregeln)

- Kein autonomer Push/Merge/Tag/Release; kein Netzwerkzugriff/Secret-Handling ohne Freigabe.
- Kein Restore/Import; keine destructive Aktion ohne Blueprint/Guards/Owner/Bestätigung/Audit.
- Skills erweitern keine Rechte und ersetzen keine Freigabe; Scope-Creep vermeiden.

## Relevante Validierungsbefehle

```bash
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd test
git status --short && git diff --check
```

## Hinweis

Skills: [`.claude/skills/`](../.claude/skills/) – **nur** die pro WP erforderlichen Skills laden.
