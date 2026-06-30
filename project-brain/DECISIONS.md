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

---

## Offene Entscheidungen (proposed / TODO)

| ID | Thema | Status | Anmerkung |
|----|-------|--------|-----------|
| OPEN-1 | Open-Source-Lizenz (AGPL-3.0 vs. Apache-2.0 vs. MIT) | proposed | Empfehlung: AGPL-3.0 für Self-Hosting-Schutz; entscheidet Maintainer |
| OPEN-2 | Setup-Script-Sprache (Bash vs. portabler) | proposed | Bash für Linux-Hosts naheliegend |
| OPEN-3 | Monorepo-Struktur (pnpm workspaces) für Web + Agent | proposed | wahrscheinlich ja |
| OPEN-4 | UI-Komponentenbasis (shadcn/ui vs. eigenes Set auf Tokens) | proposed | später, in NDF Step 002 |
