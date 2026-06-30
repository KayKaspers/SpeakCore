# CHANGELOG.md – SpeakCore Suite

> Format orientiert an [Keep a Changelog](https://keepachangelog.com/) ·
> Versionierung nach [SemVer](https://semver.org/).

## [Unreleased]

### NDF Step 003 – Setup-Wizard & Owner-Account (2026-06-30)

#### Added
- **Setup-Status-Erkennung**: Einstieg leitet je nach Zustand zu Setup, Login oder Dashboard.
- **Setup-Wizard** (Client-Komponente, DE/EN): Willkommen → Systemmodus (Simple/Expert) →
  Owner-Account → Zusammenfassung → Abschluss. Noch kein Preflight, keine TS3-Auswahl.
- **Lokaler OWNER-Account**: E-Mail, optionaler Anzeigename, starke Passwortregeln,
  Hashing mit **Argon2id** (`@node-rs/argon2`). Owner nur anlegbar, solange kein User existiert.
- **Session-Grundlage**: opaker Zufallstoken im **HttpOnly**-Cookie; in der DB nur dessen
  **HMAC-Hash** (Schlüssel = `SESSION_SECRET`). Login-, Logout- und geschützte Dashboard-Route.
- **Framework-unabhängige Service-Schicht** unter `apps/web/src/core/` (ADR-0001): `db`,
  `password`/`password-policy`, `session`, `setup`/`setup-state`, `users`, `audit`.
- **Audit-Log** für `owner.created`, `setup.completed`, `login.success/failure`, `logout`.
- **Generischer Adapter-Vertrag** in `packages/types` (`ServerAdapter` u. a.) – nur Typen,
  keine Implementierung, keine Netzwerk-/ServerQuery-Logik.
- Prisma erweitert (User.displayName, Session-Modell) + SQLite-Migration
  `20260630052414_setup_owner_session`.
- i18n-Messages für Setup/Login/Dashboard (DE/EN); `.env.example` um `SETUP_LOCK` und
  `NEXT_PUBLIC_APP_URL` ergänzt, `DATABASE_URL`-Pfad korrigiert.
- Unit-Tests: Passwort-Policy und Setup-Status-Logik (web, `node:test`).

#### Security
- Argon2id-Hashing, keine Default-Accounts/-Secrets, generische Fehlermeldungen (kein User-Enumeration-Leak).
- Server Actions sind autoritativ (Server-seitige Validierung); CSRF über Same-Origin-Prüfung
  der Next.js Server Actions + Cookie `SameSite=Lax`. Setup nicht wiederholbar; `SETUP_LOCK`-Guard.
- Neue ADRs: ADR-0012 (Session-Auth), ADR-0013 (Argon2id via `@node-rs/argon2`). SECURITY.md/
  ARCHITECTURE.md konkretisiert.

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (13/13) · `prisma validate` ✅.
- Runtime-Smoke (prod): `/de`→`/de/setup`, `/de/dashboard`→`/de/login`, `/de/setup`→200,
  `/en/login`→`/en/setup`. Auth-Routen sind dynamisch (force-dynamic, kein statisches Caching).

#### Notes
- **Weiterhin keine** TS3-Verbindung/-Installation, keine Docker-/Host-Steuerung, kein
  Plugin-/Community-Modul, kein Rollen-System über OWNER hinaus.
- Login-**Rate-Limiting** noch nicht umgesetzt (siehe RISKS R-08).

### NDF Step 002B – Toolchain-Verifikation (2026-06-30, abgeschlossen)

#### Added
- `.node-version` (Inhalt `20`), um die Node-Major-Version projektweit festzulegen
  (ergänzt das bestehende `engines`-Feld in der Root-`package.json`).
- `pnpm-lock.yaml` erzeugt und committet → reproduzierbare Installation.

#### Changed
- `apps/web/next-env.d.ts`: von Next.js automatisch regeneriert (Referenz auf
  `./.next/types/routes.d.ts` ergänzt) – geprüft und übernommen.

#### Fixed
- `apps/agent/src/index.ts`: überflüssige `eslint-disable-next-line no-console`-Zeile entfernt
  (`no-console` ist in der Agent-ESLint-Konfiguration nicht aktiv).

#### Verifiziert (Toolchain & Checks)
- Toolchain: **Node v24.18.0**, **pnpm 11.9.0** (beide erfüllen `engines`: node ≥ 20, pnpm ≥ 9).
- `pnpm install` ✅ · `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (3/3).
- `prisma validate` ✅ (Schema gültig; SQLite). Next.js 15.5.19 baut `/de` + `/en` statisch,
  Middleware gebündelt. Prisma Client 6.19.3 generiert. Agent via tsup gebündelt.

#### Notes
- **Weiterhin keine Fachfeatures**: keine TS3-Anbindung, keine Docker-/Host-Steuerung,
  kein Setup-Wizard, kein Admin-Login. Nur Fundament-Verifikation.
- `next lint` ist in Next 16 deprecated (nur Hinweis, nicht blockierend) – Migration auf die
  ESLint-CLI ist ein späterer, optionaler Schritt.

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
