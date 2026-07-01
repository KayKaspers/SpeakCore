# CHANGELOG.md – SpeakCore Suite

> Format orientiert an [Keep a Changelog](https://keepachangelog.com/) ·
> Versionierung nach [SemVer](https://semver.org/).

## [Unreleased]

### NDF Step 009 – TS3 read-only Feinschliff (2026-07-01)

#### Added
- **Status aktualisieren:** Button auf der Detailseite verbindet read-only (`serverinfo`), speichert
  einen **Status-Snapshot** und auditiert. Rate-limitiert (je Owner); bei Sperre generischer Hinweis.
- **Persistierter Status** (kein Live-Connect bei jedem Seitenaufruf): `lastStatus`,
  `lastStatusCheckedAt`, `lastConnectedAt`, generischer `statusMessageKey` sowie Snapshot
  (Name/Version/Plattform/Clients/Uptime). Liste zeigt Status-Badge + „Letzter Check".
- **Server entfernen** (OWNER, Bestätigung in der UI): löscht den Server; **Credentials werden per
  DB-Cascade mitgelöscht**. **Keine** Verbindung/Aktion zum TS3-Server. Auditiert.
- **Audit-Log:** `server.test`, `server.status_refresh` (success/failure), `server.removed`.
- **UI/UX (DE/EN):** Liste mit Status/letztem Check; Detailseite mit Refresh-Button, Entfernen mit
  Zwei-Stufen-Bestätigung, letztem Fehler (generisch), read-only-Hinweis; Hilfetexte im Formular
  (Query-/Voice-Port erklärt); Empty States.
- Prisma: `ServerInstance` um Status-Snapshot-Felder erweitert + Migration
  `20260701..._ts3_status_snapshot`.
- Tests: `statusToServerUpdate` (Snapshot/Fehler/keine Secret-artigen Keys). Cascade-Löschung der
  Credentials per DB verifiziert. 75/75 grün.

#### Security
- OWNER-only; keine Secrets/Roh-Antworten im Client; Fehlermeldungen generisch; kein Klartext-Fehler
  mit Secrets gespeichert. Nur bereits erlaubte read-only ServerQuery-Kommandos; keine neuen
  Netzwerkfunktionen. Host-Validierung/SSRF-Politik unverändert (RISKS R-13).

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (75/75) · `prisma validate` ✅.
- Cascade: Entfernen eines Servers löscht die zugehörigen Credentials (DB-geprüft).

#### Notes
- **Keine** Steuerung/Installation: kein Start/Stop/Restart, kein Channel-/User-/Rechte-Management,
  kein Backup, keine Docker-/Host-Aktion. Reiner read-only Feinschliff.

### NDF Step 008 – TS3-Adapter: bestehenden Server read-only verbinden (2026-07-01)

#### Added
- **Read-only TS3-ServerQuery-Client** (eigene, minimale Implementierung, ADR-0017): `login` →
  `use` → `serverinfo`; liefert Basisstatus (Name, Version, Plattform, Clients online/max, Uptime,
  erreichbar ja/nein). Protokoll-Handling (Escaping/Parsing) rein & testbar; Transport via `node:net`
  mit Timeouts. **Läuft im Web-Backend, nicht im Agent** (keine Agent-Erweiterung).
- **Verschlüsselte Secret-Speicherung** (ADR-0018): AES-256-GCM, Schlüssel aus `SECRET_ENCRYPTION_KEY`.
  Ohne Schlüssel werden **keine** Zugangsdaten gespeichert. Nie im Klartext/Log/Audit/Client.
- **Host-/Port-Validierung** (SSRF-bewusst): blockiert Cloud-Metadaten (`169.254.169.254`),
  Link-Local und `0.0.0.0`/`::`; private LAN/localhost bleiben erlaubt (Self-Hosting).
- **Prisma:** `ServerInstance` erweitert (mode/host/queryPort/voicePort/virtualServerId/…) + neues
  `ServerCredential`-Modell (verschlüsselt) + SQLite-Migration `20260701052610_ts3_external_server`.
- **UI (DE/EN):** `/servers` (Liste + leerer Zustand), `/servers/new` (Formular „Verbindung testen &
  speichern"), `/servers/[id]` (read-only Status). Dashboard-Nav „Server" verlinkt.
- **Audit-Log:** `server.test` (Erfolg/Fehler), `server.connected`. Rate-Limit für Verbindungstests
  (je Owner, 10/10 min).
- Tests: Secret-Crypto (Roundtrip/Manipulation/fehlender Key), Host-Validierung, TS3-Protokoll,
  TS3-Client mit Mock (nur erlaubte Kommandos), Quell-Scan gegen gefährliche Kommandos. 72/72 grün.

#### Security
- Nur eingeloggte **OWNER**; Server Actions (CSRF-Mitigation); Timeouts; Credentials nie im Client/
  Fehlertext; generische Fehlermeldungen. Nur read-only ServerQuery-Kommandos – **kein** serverstop/
  serveredit/clientkick/banadd/channel*/gruppen*/Dateiübertragung.
- ADR-0017/0018; SSRF-Restrisiko dokumentiert (RISKS R-13).

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (72/72) · `prisma validate` ✅.
- Runtime-Smoke: `/de/servers` & `/de/servers/new` sind geschützt (Redirect Login).

#### Notes
- **Keine** TS3-Installation, kein Start/Stop/Restart, kein Channel-/User-/Rechte-Management, kein
  Backup, keine Docker-Steuerung, keine TS6-Funktion. Steuerung/Installation folgen später.

### NDF Step 007 – Read-only Environment- & Netzwerk-Sonden (2026-06-30)

#### Added
- **Umgebungserkennung** (read-only) im Agent: `systemd-detect-virt` (execFile, statische Argumente,
  Timeout) mit Fallback auf `/proc/1/cgroup`; klassifiziert in VM / Container / Bare Metal /
  Unknown. Auf Nicht-Linux bzw. ohne klaren Hinweis ⇒ `unknown` (keine falsche Sicherheit).
  Reine Klassifikatoren `classifyVirtualization` / `classifyCgroup`.
- **Netzwerkdaten** (read-only) im Agent über `os.networkInterfaces()` + `dns.getServers()`:
  IPv4/IPv6 vorhanden, externe Schnittstelle vorhanden, Interface-Anzahl, DNS konfiguriert +
  Resolver-Anzahl. **Keine IP-Adressen/Interface-Namen** nach außen (nur Booleans/Anzahl).
- `SystemInfo` um `environment` und `network` erweitert (Typvertrag).
- Web: `mapDetectedEnvironment()` (rein) bildet Erkennung auf `InstallationEnvironment` ab; Mapping
  setzt jetzt `ipv4`/`ipv6`/`dns` → schärfere Preflight-Bewertung (Environment/IP/DNS).
- `/systemcheck`: neue Karte „Umgebung & Netzwerk" (erkannte Umgebung, IPv4/IPv6/DNS-Status) mit
  Hinweis, dass **keine externen Erreichbarkeitstests** laufen.
- Tests: Klassifikatoren, Interface-Zusammenfassung, DNS-unknown ⇒ nicht grün, Container ⇒ gelbe
  Warnung, „keine externen Requests/verbotenen Kommandos"-Quell-Scan. 55/55 grün.

#### Security / Datenschutz
- **Keine externen Requests/IP-Checks**, keine Portscans, keine Firewall-/Router-/UPnP-Aktionen,
  keine aktive Erreichbarkeitsprüfung. CLI nur `execFile` ohne Shell + Timeout.
- **Privatsphäre:** WebUI erhält nur Booleans/Anzahl – keine IP-Adressen (Screenshot-sicher,
  per Runtime-Smoke verifiziert: kein IPv4-Muster in der Antwort).

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (55/55).
- Runtime-Smoke (gebauter Agent): `/system/snapshot` liefert `environment`+`network` ohne IP-Leak.

#### Notes
- Umgebung wird nicht immer eindeutig erkannt (z. B. Proxmox vs. generische VM/LXC nicht sicher
  unterscheidbar) → bei Unsicherheit `unknown`/`confident:false`. Öffentliche Erreichbarkeit
  (Ports/NAT) bleibt einem späteren, gesonderten Step vorbehalten.

### NDF Step 006 – Read-only Agent-Sonden für Preflight (2026-06-30)

#### Added
- **Agent-Endpunkt `GET /system/snapshot`** (read-only): liefert CPU-Kerne/Arch, RAM (gesamt/frei),
  freien Speicher am Agent-Datenpfad, OS/Plattform/Release, Node-/Agent-Version sowie Docker- &
  Compose-**Verfügbarkeit + Version** – Letztere **nur** via `docker --version` / `docker compose
  version` (statische Argumente, `execFile` ohne Shell, Timeout). `/health` & `/version` unverändert.
- `SystemInfo`-Typvertrag in `packages/types`.
- Web: `mapSystemInfoToResourceSnapshot()` (reine Mapping-Funktion) + `fetchAgentSnapshot()`
  (**serverseitig**, Timeout, Token aus Env). `/systemcheck` nutzt jetzt **echte** Agent-Daten und
  fällt bei Nichterreichbarkeit auf Demo-/Unknown-Daten zurück (Statusanzeige: verbunden /
  unvollständig / nicht erreichbar) + Karte „Erhobene Systemdaten".
- **Optionale Token-Auth** auf `/system/snapshot`: ist `AGENT_BOOTSTRAP_TOKEN` gesetzt, wird ein
  Bearer-Token erzwungen (401 sonst); ohne Token nur im privaten Compose-Netz vorsehen.
- Tests: Agent-Snapshot (+ Token-Gate + **Quell-Scan auf verbotene Docker-Kommandos**),
  SystemInfo→ResourceSnapshot-Mapping, „unbekannt ⇒ nie grün", Fallback-Logik. Agent-Test-Runner
  auf Glob umgestellt.

#### Security
- Agent führt **keine** Host-/Docker-Steuerung aus, **kein** Docker-Socket, **keine** Container-
  Operationen, keine Portscans. CLI nur lesend mit statischen Argumenten + Timeout (keine Injection).
- Docker nicht ermittelbar ⇒ `unknown` (nie fälschlich `absent`/grün). Browser ruft den Agent nie
  direkt – nur serverseitig über die Web-App.

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (42/42).
- Runtime-Smoke (gebauter Agent): `/system/snapshot` liefert echte read-only Daten (cpuCores, RAM,
  Speicher, OS, Docker-Version) ohne Crash/Socket.

#### Notes
- **Keine** Umgebungs­erkennung (Proxmox/LXC) – `environment` bleibt bei echten Daten `unknown`.
  Netzwerk/Firewall/DNS/Backup werden nicht erhoben ⇒ Bewertung bleibt konservativ (oft „gelb").
- Sichere Docker-**Verwaltung** (Steuerung) ist ausdrücklich Sache späterer Steps, nicht Step 006.

### NDF Step 005B – Professional Branding Kit & Design System (2026-06-30)

#### Added
- **Brand Kit** unter `branding/`: Unterordner `social/`, `ui/`, `guidelines/` + READMEs je Ordner.
- **Logos (SVG):** Voll-Logo + Mark, je dark/light (Hexagon + „S" + Netzwerk-Knoten; Wortmarke
  zweifarbig). **Icons:** `favicon.svg`, `app-icon.svg`. **Social:** `github-social.svg`,
  `opengraph.svg`. Keine Binärdateien, keine eingebetteten Fonts.
- **Design-Tokens erweitert** (`v0.2.0-draft`, konsistent in json/css/tailwind): Border-Farben,
  `surface-raised`, `primary-hover`, `info`, `text-muted`, `ring`; Radius `xl`/`full`; **Shadow**,
  **Z-Index**, **Motion** (Dauer/Easing). In `tailwind.config.ts` verdrahtet.
- **UI-Richtlinien** (`branding/ui/`): components, layout, status-system, accessibility.
- **Guidelines** (`branding/guidelines/`): brand-guidelines, logo-usage, colors, typography,
  voice-and-tone.
- **Web-Integration (klein):** `BrandMark`-Komponente ersetzt die Platzhalter-Punkte in
  Setup/Login/Dashboard/Systemcheck; `app/icon.svg` als Favicon.

#### Changed
- `project-brain/BRANDING.md`, `branding/README.md`, `docs/branding/*` auf das Brand Kit aktualisiert.

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (32/32). Alle 10 SVGs
  als wohlgeformtes XML geprüft.

#### Notes
- **Kein neues Produktfeature.** Logo-/Icon-/Social-SVGs sind hochwertige **Platzhalter**
  (nicht final); verbindlich sind Stilrichtung, Tokens und Regeln.

### NDF Step 005 – Preflight & Capacity Advisor (Kernlogik) (2026-06-30)

#### Added
- **Preflight-Typen** in `packages/types` (`preflight.ts`): `PreflightInput/Result/Finding`,
  `ResourceSnapshot`, `InstallationEnvironment/Profile`, `PreflightSeverity`, `CapabilityStatus`,
  `ServiceSuitability`, `UpgradeRecommendation`, `CapacityRecommendation`.
- **Reine Bewertungslogik** in `packages/shared/preflight/` (keine Next.js-/DB-/Agent-/Host-
  Abhängigkeit): `evaluateCpu/Memory/Storage/Network/BackupStorage/Capability/IpStack/
  Environment`, `evaluateInstallProfile`, `evaluateServiceSuitability`, `combineFindings`,
  `calculateOverallPreflightStatus`, `runPreflight`.
- **Konservative MVP-Richtwerte** (`profiles.ts`): Profile Small/Medium/Large/Expert,
  Netzwerk-/Backup-Schwellen, Dienst-Anforderungen.
- **Ampellogik** GREEN/YELLOW/RED; unbekannte Werte führen nie zu „grün".
- **Service Suitability** für TS3/TS6/Mumble/Matrix/Jitsi vorbereitet – nur **TeamSpeak 3**
  ist in 0.1 produktiv (`available: true`), übrige als Roadmap markiert.
- **Demo-UI** `/systemcheck` (geschützt, DE/EN): rendert eine Beispielbewertung über die echte
  Logik (LXC, 4 GB RAM, unbekannter Upload → „Gelb"). KEINE echte Systemmessung.
- i18n-Namespace `systemcheck` (DE/EN); Dashboard-Nav „Systemcheck" verlinkt.
- Unit-Tests in `packages/shared` (CPU/RAM/Storage/Environment/IP/Gesamtstatus/TS3-Suitability/
  LXC-Warnung/Unknown-not-green/runPreflight).
- ADR-0016 (Preflight-Kernlogik, Richtwerte, i18n-Keys).

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (32/32).
- Runtime-Smoke: `/de/systemcheck` & `/en/systemcheck` laden und sind geschützt (Redirect Login).

#### Notes
- **Keine** echten Host-Messungen/Sonden, kein Docker-Socket, keine Portscans, keine TS3-/Docker-
  Aktionen. Richtwerte sind **konservative Empfehlungen, keine Garantie**.
- Echte Datenerhebung übernehmen spätere **Agent-Sonden** (zukünftiger Step).

### NDF Step 004 – Auth-Härtung, Rate-Limiting & Security Headers (2026-06-30)

#### Added
- **Login-Rate-Limiting** (server-seitig, DB-gestützt/SQLite): Sliding-Window je IP **und**
  Identifier; max. 10 Fehlversuche / 15 min. Erfolg setzt Zähler zurück; generische Fehler
  bleiben erhalten (keine User-Enumeration). Audit-Eintrag `login.rate_limited`.
- **Setup-Rate-Limiting**: max. 5 Versuche / 15 min je IP gegen wiederholte Setup-Submits
  (Audit `setup.rate_limited`).
- **Security-Header** zentral via Middleware: `Content-Security-Policy` (Baseline),
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, `Strict-Transport-Security` (nur Produktion).
- **Baseline-CSP**: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri`/`form-action 'self'`; `'unsafe-inline'` für Skripte/Styles (Next.js-Hydration),
  `'unsafe-eval'`/`ws:` nur im Dev.
- **Session-Härtung**: Gelegenheits-Cleanup abgelaufener Sessions beim Login
  (`cleanupExpiredSessions`); Cookie-/Ablaufprüfungen aus Step 003 verifiziert.
- Rate-Limit-Cleanup (`cleanupRateLimits`) als Wartungsfunktion.
- Prisma: Modell `RateLimitHit` + SQLite-Migration `20260630054322_rate_limit_hits`.
- Tests: Rate-Limit-Policy (Fenster/Sperre/RetryAfter) und Security-Header/CSP.
- ADR-0014 (DB-Rate-Limiting), ADR-0015 (Security-Header/CSP via Middleware).

#### Security
- Brute-Force-Grundschutz für Login (RISKS R-08 dadurch mitigiert).
- CSP-Limitierung dokumentiert (`'unsafe-inline'` ohne Nonces) als künftiger Härtungsschritt
  (neue RISKS R-11).

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (21/21) · `prisma validate` ✅.
- Runtime-Smoke (prod): `/de/setup` → 200, alle Security-Header inkl. CSP & HSTS gesetzt,
  Seite rendert unter CSP.

#### Notes
- **Keine** neuen Voice-Server-Funktionen, keine TS3-/Docker-/Host-Aktionen, kein Preflight,
  kein Plugin-/Community-Modul. Reine Härtung.
- Rate-Limiting ist Single-Node (SQLite); Distributed Rate-Limiting erst bei Mehr-Instanz-Betrieb nötig.

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
