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

## ADR-0014 – Rate-Limiting: DB-gestützt (SQLite), Sliding-Window, Single-Node

- **Status:** accepted (Step 004)
- **Kontext:** Login/Setup brauchen Brute-Force-Grundschutz im Self-Hosting-MVP ohne externe
  Infrastruktur.
- **Entscheidung:** **DB-gestütztes** Rate-Limiting über ein `RateLimitHit`-Modell (SQLite),
  Sliding-Window je Schlüssel (`login:ip:*`, `login:id:*`, `setup:ip:*`). Reine Bewertungslogik
  (`evaluateRateLimit`) getrennt und unit-testbar.
- **Begründung:** Persistent über Neustarts, kein Redis nötig, passend für Single-Node.
  In-Memory wäre nach Neustart wirkungslos.
- **Konsequenzen:** Bei **mehreren Instanzen** ist der Zähler nicht global → Distributed
  Rate-Limiting (z. B. Redis) wird erst dann nötig. Gelegenheits-Cleanup (`cleanupRateLimits`)
  hält die Tabelle klein. IP stammt aus Proxy-Headern → nur hinter vertrauenswürdigem Reverse Proxy belastbar.

## ADR-0015 – Security-Header & Baseline-CSP via Middleware

- **Status:** accepted (Step 004)
- **Entscheidung:** Zentrale Security-Header (inkl. Baseline-CSP) werden in der Next.js-Middleware
  gesetzt; die Header-/CSP-Erzeugung liegt in einer reinen, Edge-sicheren Funktion
  (`lib/security-headers.ts`).
- **Begründung:** Eine Quelle der Wahrheit, testbar, gilt für alle Seiten-Routen.
- **Konsequenzen:** CSP nutzt vorerst `'unsafe-inline'` (Next.js-Hydration/Streaming) ohne Nonces
  – bewusst klein gehalten; Upgrade auf nonce-basierte CSP ist ein späterer Härtungsschritt
  (RISKS R-11). HSTS nur in Produktion.

## ADR-0016 – Preflight-Kernlogik: rein, in `packages/shared`, i18n über Keys

- **Status:** accepted (Step 005)
- **Kontext:** Der Preflight & Capacity Advisor ist ein Core-Modul; die Bewertung muss später
  von WebUI **und** Agent nutzbar und gut testbar sein.
- **Entscheidung:** Typen in `packages/types`, **reine Bewertungsfunktionen** in
  `packages/shared/preflight/` – ohne Next.js-/DB-/Agent-/Host-Abhängigkeit. Findings tragen
  **i18n-Schlüssel/Detail-Keys** (kein fest verdrahteter Text); die UI löst sie unter dem
  `systemcheck`-Namespace auf.
- **Begründung:** Wiederverwendbar (WebUI + Agent), framework-unabhängig testbar, sprachneutral.
- **Konsequenzen:** MVP-Richtwerte (Profile/Schwellen) sind **konservative Empfehlungen, keine
  Garantie**, und werden später kalibriert. Grundregel: **unbekannte Werte ⇒ nie grün**. Echte
  Messwerte liefern spätere Agent-Sonden; die Logik bleibt davon unberührt.

## ADR-0017 – Eigener minimaler TS3-ServerQuery-Client (keine externe Bibliothek)

- **Status:** accepted (Step 008)
- **Kontext:** Für „bestehenden TS3-Server read-only verbinden" wird ein ServerQuery-Client
  benötigt. Verfügbare npm-Bibliotheken bringen größere Abhängigkeits-/Feature-Flächen mit.
- **Entscheidung:** **Eigene, kleine Implementierung** (Protokoll rein/testbar, Transport via
  `node:net`), beschränkt auf read-only Kommandos (`login`/`use`/`serverinfo`). Läuft im
  **Web-Backend**, nicht im Agent (keine Agent-Erweiterung in diesem Step).
- **Begründung:** Minimale, geprüfte Angriffsfläche; kein Supply-Chain-Risiko; der read-only Umfang
  ist klein genug. Passt zur „minimale Abhängigkeiten"-Linie (vgl. Agent, [ADR-0010](DECISIONS.md)).
- **Konsequenzen:** Protokoll-Edge-Cases selbst zu pflegen. Bei wachsendem Funktionsumfang (Steuerung)
  Re-Evaluierung; Adapter bleibt hinter dem generischen Vertrag ([ADR-0008](DECISIONS.md)).

## ADR-0018 – Secret-Verschlüsselung: AES-256-GCM aus `SECRET_ENCRYPTION_KEY`

- **Status:** accepted (Step 008)
- **Entscheidung:** Gespeicherte Secrets (TS3-Query-Zugänge) werden mit **AES-256-GCM**
  verschlüsselt; der 32-Byte-Schlüssel wird per SHA-256 aus `SECRET_ENCRYPTION_KEY` abgeleitet.
  Format `v1:iv:tag:ciphertext`. Ohne gesetzten Schlüssel werden **keine** Secrets gespeichert.
- **Begründung:** Authentifizierte Verschlüsselung (Integrität), keine zusätzliche Abhängigkeit
  (`node:crypto`), einfacher Betrieb (ein Env-Wert). Erfüllt Safe-Defaults ([SECURITY.md](SECURITY.md)).
- **Konsequenzen:** **Key-Rotation** als Re-Encrypt-Grundlage in Step 016 ergänzt
  ([ADR-0022](DECISIONS.md), Operator/CLI, `v1` beibehalten). Verlust des Schlüssels ⇒ gespeicherte
  Secrets unlesbar (dokumentiert). Schlüssel gehört in einen sicheren Store, nie ins Repo.

## ADR-0019 – Docker-Zugriffsstrategie: CLI über Agent mit Allowlist & statischen Argumenten

- **Status:** accepted (Step 010, für spätere Umsetzung)
- **Kontext:** Für die spätere TS3-Installation muss der Agent Docker-Ressourcen erzeugen. Die Art
  der Docker-Anbindung bestimmt maßgeblich die Angriffsfläche.
- **Optionen & Bewertung:**
  1. **Docker-CLI über Agent, nur mit intern erzeugten statischen Argumenten, Allowlist, Labels,
     Managed-Only** – **gewählt.** Kleine, klar prüfbare Oberfläche; keine freien Nutzerparameter.
  2. Docker-API direkt über Socket – **verworfen:** entspricht faktisch Root auf dem Host, große
     Angriffsfläche.
  3. Docker-API über **eingeschränkten Socket-Proxy** (z. B. tecnativa/docker-socket-proxy) – als
     spätere Härtung möglich/empfohlen, aber MVP-Overhead.
  4. Externer Container-Manager – **verworfen:** Overkill für 0.1.
- **Entscheidung:** Option 1 für MVP. **Docker-Socket direkt in WebUI/Web-Container ist verboten.**
  Wenn ein Socket später im **Agent** nötig wird, ist das separat zu begründen und abzusichern
  (Proxy/Allowlist/mTLS).
- **Konsequenzen:** Alle Docker-Argumente werden aus dem **validierten Plan** intern gebaut (nie aus
  Nutzereingaben). Re-Evaluierung Richtung Socket-Proxy bei wachsendem Funktionsumfang.

## ADR-0020 – Managed-Only-Provisioning-Safety (Labels, Allowlists, Validierung, Rollback)

- **Status:** accepted (Step 010)
- **Entscheidung:** **SpeakCore verwaltet nur Ressourcen, die es selbst erzeugt hat.** Alle späteren
  Container/Volumes/Netzwerke tragen `speakcore.managed=true` + Projekt-/Instanz-/Service-Labels und
  feste Namenspräfixe. Es gibt ein **Aktions-Allowlist** (`AgentActionType`); Eingaben werden streng
  **validiert** (Image-/Restart-Allowlist, Port-Regeln, keine Host-Mounts/Pfade, kein privileged/
  Socket, keine freien Docker-Args). Planung, Rollback und Audit sind als deklarative Struktur
  vorbereitet (`createTs3ProvisioningPlan`).
- **Begründung:** Verhindert, dass der Agent ein allgemeines Docker-Admin-Interface wird; minimiert
  Fehl-/Missbrauch (Managed-Only-Guard über Labels).
- **Konsequenzen:** Löschen/Steuern später nur für Ressourcen mit gültigen Managed-Labels. Secrets
  werden generiert + verschlüsselt gespeichert ([ADR-0018](DECISIONS.md)), nie geloggt (RISKS R-14).

## ADR-0021 – Schreibende Docker-Aktionen nur mit Opt-in-Flag, Start Network/Volume

- **Status:** accepted (Step 012)
- **Kontext:** Die erste schreibende Docker-Funktion soll maximal risikoarm eingeführt werden.
- **Entscheidung:** Schreibende Agent-Aktionen sind hinter einem **Feature-Flag**
  `AGENT_DOCKER_WRITE_ENABLED` (Default **false**) UND dem **Token-Gate** gekapselt. Der erste
  erlaubte Write-Umfang ist **nur** managed **Network** + **Volume** (kein Container/Start). Aktionen
  laufen ausschließlich gegen einen server-seitig **re-validierten** Provisioning-Plan
  ([ADR-0020](DECISIONS.md)); Docker-CLI via `execFile` mit intern erzeugten, statischen Argumenten.
- **Begründung:** Sicheres, testbares Inkrement; kein Container-Risiko; Fehlkonfiguration bleibt
  ohne Wirkung (Flag aus). Managed-Only + Idempotenz + Konfliktschutz (`conflict` bei fremder
  gleichnamiger Ressource, kein Anfassen).
- **Konsequenzen:** **Kein** automatisches `rm` in diesem Step (nur deklarativer Rollback-Plan).
  Container-Erstellung/-Start und automatisches Remove sind eigene, spätere ADRs/Steps. Ergebnis
  enthält nie Secrets.

## ADR-0022 – Secret-Key-Rotation: Einzelschlüssel-Modell, Re-Encrypt statt Key-ID

- **Status:** accepted (Step 016)
- **Kontext:** Vor der echten Container-Erstellung soll ein Wechsel von `SECRET_ENCRYPTION_KEY`
  möglich sein, ohne bestehende (external + managed) `ServerCredential` zu beschädigen.
- **Entscheidung:** Das Verschlüsselungsformat bleibt bei **`v1:<iv>:<tag>:<ciphertext>`**
  ([ADR-0018](DECISIONS.md)); ein Key-Identifier im Format wird **bewusst aufgeschoben**. Rotation
  erfolgt als **Re-Encrypt in place**: alle Werte werden mit dem **alten** Schlüssel entschlüsselt und
  mit dem **neuen** wieder verschlüsselt (weiterhin AES-256-GCM). Umgesetzt als rein serverseitiger
  **Operator-/CLI-Vorgang** (`rotateServerCredentialEncryptionKeys`, `pnpm … rotate-secrets`) mit
  **Dry-Run**, **Transaktion** (all-or-nothing) und **Idempotenz** (bereits rotierte Werte werden
  übersprungen). **Keine** Web-UI, **keine** Route, **kein** API-Endpunkt.
- **Begründung:** Einzelschlüssel-Modell (genau ein aktiver Schlüssel) ist für 0.1 ausreichend und
  minimiert Komplexität/Angriffsfläche; ein Multi-Key-/Key-ID-Format lohnt erst bei parallel gültigen
  Schlüsseln. Re-Encrypt hält bestehende `v1`-Werte jederzeit entschlüsselbar. Rückgabe nur Zählwerte,
  nie Secrets/Schlüssel.
- **Konsequenzen:** Fehlt der alte **oder** neue Schlüssel, bricht die Rotation vor jedem DB-Zugriff
  ab. Identische Schlüssel ⇒ kontrolliert `sameKey` (kein Schreiben). Ein späterer Wechsel auf ein
  `v2`-Format mit Key-ID (mehrere gleichzeitig gültige Schlüssel, unterbrechungsfreie Rotation) bleibt
  als eigener Step möglich. Der neue Schlüssel wird über `SECRET_ENCRYPTION_KEY_NEW` nur temporär
  bereitgestellt; **Backup vor Rotation empfohlen**.

## ADR-0023 – Managed Container-Erstellung ohne Start, Secret per ENV

- **Status:** accepted (Step 017)
- **Kontext:** Der erste echte Docker-`create` für einen managed TS3-Container soll maximal risikoarm
  erfolgen – ohne Start, ohne Log-Lesen, ohne Secret-Exposition.
- **Entscheidung:** Neue Agent-Aktion **`CREATE_TS3_CONTAINER`** (`POST /docker/provision/create-container`)
  führt **ausschließlich `docker create`** aus (kein `run`/`start`), hinter **Token + `AGENT_DOCKER_WRITE_ENABLED`**
  ([ADR-0021](DECISIONS.md)). Argumente stammen aus einem server-seitig **revalidierten** Plan
  ([ADR-0020](DECISIONS.md)): fester Name/Netzwerk/Volume (named, **kein** Host-Mount), Ports und
  Restart-Policy aus Allowlist, Managed-Labels. Das ServerQuery-Admin-Passwort ([ADR-0018](DECISIONS.md))
  wird **web-seitig entschlüsselt**, an den Agent übergeben und als Container-**ENV**
  `TS3SERVERQUERY_ADMIN_PASSWORD` gesetzt – so entsteht **kein** Zufallspasswort in den Logs
  (**R-14 geschlossen**). Idempotenz (managed `exists`) und Konfliktschutz (fremder Name ⇒ `conflict`,
  keine Übernahme). Persistenz: `CONTAINER_PENDING → CONTAINER_CREATED`.
- **Begründung:** Trennung von *Erstellen* und *Starten* hält jeden Schritt klein und prüfbar; ENV-Vorgabe
  des Query-Passworts vermeidet das Auslesen von Docker-Logs vollständig. Kein Secret im Client/Audit/
  Agent-Response.
- **Konsequenzen:** **Container-Start** (Lizenzzustimmung `TS3SERVER_LICENSE`, Healthcheck, TS3-Connect)
  ist ein **eigener, späterer Step/ADR**. Automatisches Rollback-`rm` bleibt deklarativ (kein `rm` in
  diesem Step). Ergebnis/Audit enthalten nie Secrets/ENV-Werte/Roh-Docker-Ausgabe.

## ADR-0024 – Container-Start mit expliziter Lizenzzustimmung; Lizenz-ENV beim Create

- **Status:** accepted (Step 018)
- **Kontext:** Der erste **Start** eines managed TS3-Containers (`CONTAINER_CREATED → RUNNING`) soll nur
  nach expliziter TS3-Lizenzzustimmung erfolgen. **Befund:** Das offizielle `teamspeak`-Image erwartet
  `TS3SERVER_LICENSE=accept` als **ENV, die beim `docker create` vorhanden sein muss** – ein späterer
  Startbefehl kann keine ENV ergänzen (auch keine Logs/Exec, das ist verboten).
- **Entscheidung:** Neue Agent-Aktion **`START_MANAGED_CONTAINER`** (`POST /docker/provision/start-container`)
  führt **ausschließlich `docker start <managed-name>`** aus (nie `run`/`create`), hinter **Token +
  `AGENT_DOCKER_WRITE_ENABLED`**, nur für einen bereits vorhandenen, per Label geprüften **managed**
  Container. Idempotenz (`running`)/Konfliktschutz (`conflict`)/`notFound`. Die (nicht-geheime) Lizenz-ENV
  `TS3SERVER_LICENSE=accept` wird bereits in **Step 017** beim `docker create` gesetzt – dort **inert**
  (create startet nichts). Der **tatsächliche Serverlauf** wird durch eine **explizite Lizenz-Checkbox
  beim Start** freigegeben (`licenseAccepted === true`, sonst kein Start) und als Audit-Event
  `docker.containerStart.licenseConfirmed` festgehalten. Kein Vorab-Default, keine automatische Zustimmung.
- **Begründung:** So bleibt jede Docker-Aktion klein/prüfbar, es wird nicht getrickst (die technisch
  nötige ENV ist dokumentiert am Create), und die rechtlich relevante **Zustimmung** ist eine bewusste
  Nutzerhandlung vor dem tatsächlichen Lauf. SpeakCore stellt nur die Verwaltung bereit; die Einhaltung
  der TeamSpeak-Lizenz liegt beim Nutzer (RISKS R-05). **Kein Log-Lesen** (R-14 bleibt geschlossen).
- **Konsequenzen:** **Stop/Remove** sind eigene, spätere Steps (kein `stop`/`rm` hier). Read-only
  **Healthcheck** und **TS3-ServerQuery-Connect** zum managed Server folgen als eigene Steps (in 018
  bewusst nicht). Perspektivisch sinnvoll: Lizenzzustimmung bereits **vor** dem Create einholen.

## ADR-0025 – Container-Stop ohne neuen Lifecycle-Status (zurück auf CONTAINER_CREATED)

- **Status:** accepted (Step 021)
- **Kontext:** Ein laufender managed Container (`RUNNING`) soll kontrolliert **gestoppt** werden können,
  ohne ihn zu löschen. Frage: eigener `STOPPED`-Lifecycle-Status oder Rückfall auf `CONTAINER_CREATED`?
- **Entscheidung:** Neue Agent-Aktion **`STOP_MANAGED_CONTAINER`** (`POST /docker/provision/stop-container`)
  führt **ausschließlich `docker stop --time 3 <managed-name>`** aus (nie `rm`/`restart`/`start`), hinter
  **Token + `AGENT_DOCKER_WRITE_ENABLED`**, nur für einen per Label geprüften **managed** Container.
  Nach Erfolg **kein neuer Lifecycle-Status**, sondern zurück auf **`CONTAINER_CREATED`** mit
  **`runState = 'stopped'`**. Idempotenz (`alreadyStopped`)/Konfliktschutz (`conflict`)/`notFound`.
- **Begründung:** Der Container **existiert weiter** (nur gestoppt); ein späterer Start nutzt erneut
  `CONTAINER_CREATED → RUNNING` (Step 018). Weniger Status-Komplexität in 0.1; die feste Kulanzzeit
  `--time 3` hält den Stop innerhalb des Agent-CLI-Timeouts (SIGTERM, dann SIGKILL). Kein Löschen von
  Container/Volume/Network, **kein Log-Lesen**, keine Secrets im Ergebnis.
- **Konsequenzen:** Der Ist-Zustand „gestoppt" ist an `runState`/Healthcheck ablesbar, nicht am
  Lifecycle-Status. **Restart** und **Remove** sind eigene, spätere Steps; eine Log-Ansicht käme nur mit
  Redaction-Konzept.

## ADR-0026 – Container-Remove nur `docker rm` (kein -f/-v), ohne Volume/Network/Credentials

- **Status:** accepted (Step 022)
- **Kontext:** Ein **gestoppter** managed Container soll entfernt werden können, ohne Volume, Network,
  Credentials oder den `ServerInstance`-Record zu löschen.
- **Entscheidung:** Neue Agent-Aktion **`REMOVE_MANAGED_CONTAINER`** (`POST /docker/provision/remove-container`)
  führt **ausschließlich `docker rm <managed-name>`** aus – **kein `-f`/`-v`**, kein `volume rm`/`network rm`,
  nie `run`/`create`/`start`/`stop`/`restart`. Hinter **Token + `AGENT_DOCKER_WRITE_ENABLED`**, nur für einen
  per Label geprüften **managed**, **nicht laufenden** Container. Läuft er noch ⇒ `stillRunning` (kein Remove,
  „zuerst stoppen"). **Fehlender Container ⇒ `alreadyRemoved` (idempotent)** – bewusst kein Fehler, da das
  Ziel (Container weg) erreicht ist und Network/Volume weiterhin vorbereitet bleiben. Nach Erfolg:
  `CONTAINER_CREATED → RESOURCES_PREPARED`, `runState='unknown'`.
- **Begründung:** `docker rm` ohne `-v` lässt anonyme/named Volumes unberührt; kein `-f` verhindert das
  Entfernen laufender Container. Credentials (Step 015) und `managedVolumeName`/`managedNetworkName` bleiben
  erhalten, damit ein späteres erneutes `CREATE_TS3_CONTAINER` möglich ist. `managedContainerName` bleibt
  deterministisch (aus `instanceId` ableitbar) und dient **nicht** als Existenzbeweis – Healthcheck/Inventar
  bleibt Quelle des Ist-Zustands.
- **Konsequenzen:** **Volume-/Network-Remove** ist ein eigener, deutlich gefährlicherer Step (mit Backup-/
  Bestätigungskonzept); ebenso **Restart** und ein vollständiges **Deprovisioning** (inkl. ServerInstance/
  Credential-Löschung). Kein `rm` verwaister Ressourcen in diesem Step.

---

## Offene Entscheidungen (proposed / TODO)

| ID | Thema | Status | Anmerkung |
|----|-------|--------|-----------|
| OPEN-1 | Open-Source-Lizenz (AGPL-3.0 vs. Apache-2.0 vs. MIT) | proposed | Empfehlung: AGPL-3.0 für Self-Hosting-Schutz; entscheidet Maintainer |
| OPEN-2 | Setup-Script-Sprache (Bash vs. portabler) | proposed | Bash für Linux-Hosts naheliegend |
| OPEN-3 | Monorepo-Struktur (pnpm workspaces) für Web + Agent | **entschieden → ADR-0009** | umgesetzt in Step 002 |
| OPEN-4 | UI-Komponentenbasis (shadcn/ui vs. eigenes Set auf Tokens) | proposed | später (Step 003+) |
| OPEN-5 | Tailwind v3 vs. v4 | proposed | Step 002 nutzt Tailwind v3 (stabile Config-Datei); v4-Migration später prüfen |
