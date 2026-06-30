# DECISIONS.md – Architecture Decision Records (ADR)

> NDF Project Brain · Stand: 2026-06-30
> Format: leichtgewichtige ADRs. Status: `accepted` | `proposed` | `superseded`.
> Diese Datei ist die einzige autoritative Quelle für Tech-Stack-Entscheidungen.

---

## ADR-0001 – Backend/API als Next.js Route Handler (gekapselte Service-Schicht)

- **Status:** accepted (0.1)
- **Kontext:** Der Tech-Stack-Vorschlag lässt offen, ob die API im Next.js-Layer liegt oder
  ein separates Backend bildet. Gleichzeitig fordert die Architektur eine strikte Trennung,
  wobei privilegierte Aktionen ohnehin im **separaten Agent** liegen.
- **Entscheidung:** Für 0.1 wird die SpeakCore API als **Next.js Route Handler** umgesetzt.
  Die Geschäftslogik wird in einer **framework-unabhängigen Service-Schicht** (`/core` o. ä.)
  gekapselt, sodass eine spätere Extraktion in ein eigenständiges Backend ohne Rewrite möglich ist.
- **Begründung:** Schlanker Core, ein Deployment-Artefakt weniger, schnellere 0.1. Die
  sicherheitskritische Privileg-Trennung wird **nicht** durch das Backend, sondern durch den
  Agent gewährleistet – daher ist ein Monolith aus UI+API für 0.1 vertretbar.
- **Konsequenzen:** Disziplin nötig, damit keine Framework-Abhängigkeiten in die Service-Schicht
  lecken. Re-Evaluierung, sobald Multi-Tenant/Skalierung relevant wird.

## ADR-0002 – ORM: Prisma

- **Status:** accepted (0.1)
- **Kontext:** Wahl zwischen Prisma und Drizzle; SQLite für 0.1, später optional PostgreSQL.
- **Entscheidung:** **Prisma**.
- **Begründung:** Ausgereifte, sichere Migrations-Tooling-Kette (passt zum Leitsatz „Vertrauen
  zuerst"), klares deklaratives Schema, sehr guter SQLite→PostgreSQL-Pfad bei gleichem Schema,
  breite Contributor-Vertrautheit. Drizzle wäre leichtgewichtiger/TS-nativer, bietet für eine
  self-hosted Docker-App aber keinen entscheidenden Vorteil gegenüber Prismas Migrationsreife.
- **Konsequenzen:** Prisma-Client als zusätzliche Laufzeitabhängigkeit. Re-Evaluierung möglich,
  falls Bundle-/Edge-Anforderungen entstehen. Migrationsdateien werden versioniert.

## ADR-0003 – Datenbank: SQLite für 0.1

- **Status:** accepted (0.1)
- **Entscheidung:** SQLite als Datei-Volume; PostgreSQL nur architektonisch vorbereitet.
- **Begründung:** Self-Hosting-Einfachheit, keine zusätzliche DB-Komponente, ideal für Single-Node.
- **Konsequenzen:** Kein Multi-Writer/HA in 0.1; bewusst akzeptiert.

## ADR-0004 – SpeakCore Agent als separater Dienst

- **Status:** accepted (0.1)
- **Entscheidung:** Alle Docker-/Host-/Server-Aktionen laufen über einen **separaten Agent**;
  die WebUI/API erhält keine direkten Host-Rechte.
- **Begründung:** Privileg-Trennung, kleinere Angriffsfläche der exponierten WebUI, klare
  Vertrauensgrenze, Voraussetzung für spätere Remote-/Multi-Host-Szenarien.
- **Konsequenzen:** Definierte Agent-API + Authentifizierung nötig (siehe ADR-0005).

## ADR-0005 – Agent-Kommunikation: HTTP + Bootstrap-Token (0.1)

- **Status:** accepted (0.1)
- **Entscheidung:** API↔Agent kommunizieren über HTTP mit einem automatisch generierten
  **Bootstrap-Token**; Agent ist nicht öffentlich exponiert (privates Compose-Netz/Loopback).
- **Begründung:** Einfach, robust, ausreichend für Single-Host 0.1.
- **Konsequenzen:** mTLS / signierte Requests als Härtung für spätere Remote-Szenarien
  vorgemerkt (siehe [SECURITY.md](SECURITY.md), [ROADMAP.md](ROADMAP.md)).

## ADR-0006 – Auth: lokaler Admin-Account (Argon2id, Session-Cookies)

- **Status:** accepted (0.1)
- **Entscheidung:** Lokaler Admin-Account; Passwort-Hashing mit **Argon2id**; serverseitige
  Sessions via HttpOnly/Secure-Cookies. Kein externer IdP in 0.1.
- **Begründung:** MVP-Anforderung „lokaler Admin-Account"; Safe Defaults.
- **Konsequenzen:** Mehrbenutzer/Rollen/SSO → spätere Version.

## ADR-0007 – Internationalisierung: next-intl (DE/EN ab Tag 1)

- **Status:** accepted (0.1)
- **Entscheidung:** **next-intl** für i18n im Next.js App Router; DE und EN vollständig ab Start.
- **Begründung:** Native App-Router-Integration, typsichere Messages, gute DX.
- **Konsequenzen:** Übersetzungsdateien werden als Teil der Definition of Done gepflegt.

## ADR-0008 – Adapter-Abstraktion vorhanden, nur TS3 implementiert

- **Status:** accepted (0.1)
- **Entscheidung:** Generisches Server-Adapter-Interface ab 0.1; implementiert wird ausschließlich
  der **TS3-Adapter** (ServerQuery). TS6/Mumble nur als Interface vorbereitet.
- **Begründung:** Vermeidet späteren Rewrite, ohne 0.1-Scope zu sprengen.
- **Konsequenzen:** Interface muss bewusst generisch gehalten werden, ohne über TS3 hinaus zu spekulieren.

## ADR-0009 – Monorepo mit pnpm Workspaces

- **Status:** accepted (Step 002) · ersetzt OPEN-3
- **Kontext:** Web (Next.js) und Agent (Node) teilen Typen/Konstanten und sollen gemeinsam
  gebaut/getestet werden.
- **Entscheidung:** Ein **Monorepo** mit **pnpm Workspaces**: `apps/web`, `apps/agent`,
  `packages/{types,shared,config}`. Gemeinsame Root-Scripts laufen rekursiv (`pnpm -r`).
- **Begründung:** Geteilte Verträge ohne Publishing, atomare Änderungen über App-Grenzen,
  effiziente Installation/Caching durch pnpm.
- **Konsequenzen:** pnpm als verbindlicher Paketmanager (`packageManager`-Feld); Build-Reihenfolge
  topologisch. Workspace-Pakete werden als TS-Quelle konsumiert (web via `transpilePackages`,
  agent via tsup-Bundling).

## ADR-0010 – Agent-Runtime: eingebauter `node:http`, keine Frameworks

- **Status:** accepted (Step 002)
- **Kontext:** Der Agent ist die privilegierte, sicherheitskritische Komponente.
- **Entscheidung:** Der Agent nutzt **`node:http`** ohne Runtime-Framework/-Dependencies.
- **Begründung:** Kleinste Angriffsfläche und minimales Supply-Chain-Risiko (Risiko R-01).
  Health/Version brauchen kein Framework. Build via tsup zu einem self-contained Bundle.
- **Konsequenzen:** Routing manuell; bei wachsender API später Re-Evaluierung (z. B. schlankes
  Framework) möglich – dann als neuer ADR.

## ADR-0011 – next-intl mit `[locale]`-Routing

- **Status:** accepted (Step 002) · konkretisiert ADR-0007
- **Entscheidung:** App-Router-Struktur unter `app/[locale]/` mit next-intl-Middleware,
  `defineRouting` (Standard `de`) und Messages in `apps/web/messages/{de,en}.json`.
- **Begründung:** Saubere, URL-basierte Sprachtrennung; offizielle next-intl-Empfehlung.
- **Konsequenzen:** Middleware leitet `/` → `/de` um; neue Seiten liegen unter `[locale]`.

## ADR-0012 – Session-Auth: opaker Token + HMAC-Hash, HttpOnly-Cookie, Server Actions

- **Status:** accepted (Step 003) · konkretisiert ADR-0006
- **Kontext:** Für den Owner-Login wird eine serverseitige Sitzung benötigt; Self-Hosting,
  Single-Node, SQLite.
- **Entscheidung:** Server-seitige Sessions mit **opakem Zufallstoken** (32 Byte). Im Cookie
  liegt nur der Roh-Token (**HttpOnly**, `SameSite=Lax`, `Secure` in Produktion); in der DB nur
  dessen **HMAC-SHA256-Hash** (Schlüssel = `SESSION_SECRET`). Formulare laufen über **Next.js
  Server Actions**; die Geschäftslogik liegt in einer framework-unabhängigen `core/`-Schicht.
- **Begründung:** Keine JWT-Schlüsselverwaltung nötig; serverseitige Invalidierung möglich;
  DB-Leak gibt ohne `SESSION_SECRET` keine nutzbaren Tokens. Server Actions sind Same-Origin-
  geschützt (CSRF-Mitigation) und halten Sicherheitslogik serverseitig.
- **Konsequenzen:** `SESSION_SECRET` ist Pflicht (min. 16 Zeichen). Auth-Seiten sind
  `force-dynamic`. Login-Rate-Limiting offen (RISKS R-08). Session-Rotation/„remember me" später.

## ADR-0013 – Passwort-Hashing: Argon2id via `@node-rs/argon2`

- **Status:** accepted (Step 003) · setzt ADR-0006 um
- **Entscheidung:** **Argon2id** über **`@node-rs/argon2`** (napi-rs, vorgebaute Binaries).
- **Begründung:** Argon2id ist OWASP-empfohlen; `@node-rs/argon2` liefert vorkompilierte
  Binaries (kein `node-gyp`/Build-Toolchain nötig, reibungslos unter Windows).
- **Konsequenzen:** `Algorithm` ist ein `const enum` → unter `isolatedModules` nur als Typ
  importieren (numerischer Literal-Wert mit Cast). Parameter konservativ (memoryCost 19456, t=2, p=1).

---

## Offene Entscheidungen (proposed / TODO)

| ID | Thema | Status | Anmerkung |
|----|-------|--------|-----------|
| OPEN-1 | Open-Source-Lizenz (AGPL-3.0 vs. Apache-2.0 vs. MIT) | proposed | Empfehlung: AGPL-3.0 für Self-Hosting-Schutz; entscheidet Maintainer |
| OPEN-2 | Setup-Script-Sprache (Bash vs. portabler) | proposed | Bash für Linux-Hosts naheliegend |
| OPEN-3 | Monorepo-Struktur (pnpm workspaces) für Web + Agent | **entschieden → ADR-0009** | umgesetzt in Step 002 |
| OPEN-4 | UI-Komponentenbasis (shadcn/ui vs. eigenes Set auf Tokens) | proposed | später (Step 003+) |
| OPEN-5 | Tailwind v3 vs. v4 | proposed | Step 002 nutzt Tailwind v3 (stabile Config-Datei); v4-Migration später prüfen |
