# CHANGELOG.md – SpeakCore Suite

> Format orientiert an [Keep a Changelog](https://keepachangelog.com/) ·
> Versionierung nach [SemVer](https://semver.org/).

## [Unreleased]

### NDF Step 002B – Toolchain-Verifikation (2026-06-30, in Arbeit)

#### Added
- `.node-version` (Inhalt `20`), um die Node-Major-Version projektweit festzulegen
  (ergänzt das bestehende `engines`-Feld in der Root-`package.json`).

#### Notes
- **Verifikation noch nicht durchgeführt:** Node.js/pnpm/corepack sind auf der Arbeitsmaschine
  nicht installiert. `pnpm install` (und damit `pnpm-lock.yaml`), `pnpm lint`, `pnpm typecheck`,
  `pnpm build`, `pnpm test` sowie `prisma validate` **stehen weiterhin aus**.
- Nächster Schritt: Node.js LTS (≥ 20) + pnpm (≥ 9 via corepack) installieren, dann Step 002B
  erneut ausführen → Checks laufen lassen, Lockfile erzeugen und gemeinsam committen.

### NDF Step 002 – Tech-Grundgerüst (2026-06-30)

#### Added
- **Monorepo** mit pnpm Workspaces: Root `package.json`, `pnpm-workspace.yaml`, `.npmrc`,
  gemeinsame Scripts (`dev`/`build`/`lint`/`test`/`typecheck`), Prettier-Konfiguration.
- `apps/web/` – **Next.js (App Router) Skeleton**: TypeScript, TailwindCSS (bindet Branding-Tokens),
  ESLint, next-intl (DE/EN) mit `[locale]`-Routing, Platzhalter-Dashboard (Status „Setup pending",
  Navigations-Platzhalter Dashboard/Setup/Systemcheck/Servers/Backups/Help), Prisma-Stub-Schema (SQLite).
- `apps/agent/` – **Agent-Skeleton**: minimaler `node:http`-Dienst mit `GET /health` und `GET /version`,
  Token-Auth-Konzept als Platzhalter (nicht aktiviert), Tests via `node:test` (tsup-Build).
- `packages/types`, `packages/shared`, `packages/config` – geteilte Typen/Verträge, Konstanten/Metadaten,
  Base-tsconfig.
- **Docker-Compose-Skeleton** (`web` + `agent`, Volume, Netzwerk) + Dockerfiles; Agent **ohne**
  Docker-Socket/Host-Rechte (nur dokumentiert).
- Environment-Beispiele: Root `.env.example` sowie `apps/web/.env.example`, `apps/agent/.env.example`.
- `.gitattributes` (LF-Normalisierung), `.dockerignore`, erweiterte `.gitignore`.
- Neue ADRs: ADR-0009 (Monorepo/pnpm), ADR-0010 (Agent = `node:http`, minimal), ADR-0011
  (next-intl `[locale]`-Routing); OPEN-3 (Monorepo) entschieden.

#### Notes
- **Weiterhin keine fachlichen Features**: keine TS3-Verbindung/-Installation, keine echte
  Docker-Steuerung, keine produktiven Auth-Flows (nur Schema/Skeleton).
- `pnpm install/lint/typecheck/build` konnten in der Umgebung **nicht ausgeführt** werden
  (Node.js/pnpm nicht installiert) – siehe Rückmeldung; Verifikation steht aus.

### NDF Step 001 – Projektinitialisierung (2026-06-30)

#### Added
- Repository-Grundstruktur (`project-brain/`, `docs/`, `branding/`).
- NDF Project Brain: `PROJECT.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md`,
  `RISKS.md`, `SECURITY.md`, `BRANDING.md`, `MVP.md`, `WORKFLOW.md`, `CHANGELOG.md`.
- Benutzer-/Betriebsdoku unter `docs/` (Installationswege, Architektur, Branding, Hilfe DE/EN-Gerüst).
- Branding Design-Tokens: `tokens.json`, `tokens.css`, `tailwind.tokens.js` sowie `branding/README.md`.
- Root: `README.md`, `.gitignore`.
- Architekturentscheidungen ADR-0001 bis ADR-0008 dokumentiert.
- Verbindlicher MVP-Scope für 0.1 (TeamSpeak-3-fokussiert) fixiert.

#### Notes
- **Kein produktiver Anwendungscode** in diesem Schritt (NDF Step 001 ist reine Initialisierung).
- Offene Punkte: Open-Source-Lizenz, TS3-Lizenzklärung, Monorepo-Struktur (siehe `DECISIONS.md`).
