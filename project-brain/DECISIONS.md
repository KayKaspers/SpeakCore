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

## ADR-0027 – Restart als Stop→Start-Orchestrierung (kein `docker restart`)

- **Status:** accepted (Step 023)
- **Kontext:** Ein managed Container soll neu gestartet werden können, ohne ein neues Docker-Kommando
  (`docker restart`) oder eine neue Agent-Schreibaktion einzuführen.
- **Entscheidung:** **Kein `docker restart`.** Der Restart ist ein reiner **Web-Orchestrator**
  (`restartManagedContainerForServer`), der die bestehenden, geprüften Flows nacheinander nutzt:
  `RUNNING → Stop (Step 021) → Start (Step 018) → RUNNING`. Beide Teil-Flows erzwingen weiterhin Token +
  `AGENT_DOCKER_WRITE_ENABLED` und schreiben ihre eigenen `docker.container(Stop|Start).*`-Audits. Restart
  verlangt eine **erneute explizite Lizenz-Checkbox** (0.1: keine historische Audit-Auswertung). Kein
  Start, wenn Stop fehlschlägt; kein `RUNNING`, wenn Start fehlschlägt.
- **Begründung:** Wiederverwendung statt Duplizierung; keine neue Docker-Angriffsfläche; die
  Sicherheitsgrenzen der Teil-Flows gelten automatisch. Rechtlich sauber durch erneute Zustimmung.
- **Konsequenzen:** Fehlerzustände sind eindeutig: Stop-Fehler ⇒ Status bleibt `RUNNING`
  (`restartStopFailed`); Start-Fehler nach Stop ⇒ `CONTAINER_CREATED`/`runState='stopped'`
  (`restartStartFailed`). **Kein Reparaturverhalten** bei DB-/Ist-Inkonsistenz (nur `RUNNING` erlaubt;
  Healthcheck bleibt Quelle des Ist-Zustands). Restart-Audit: `docker.containerRestart.*`.

## ADR-0028 – Deprovisioning: Stufenmodell + Guard-Blueprint (keine Löschung in 0.1)

- **Status:** accepted (Step 024)
- **Kontext:** Das Entfernen von Volume/Network/ServerRecord ist deutlich gefährlicher als das
  Container-Remove (irreversibler **Datenverlust** beim Volume). Bevor echte Lösch-Steps gebaut werden,
  braucht es ein getestetes Sicherheits-/Ablaufkonzept.
- **Entscheidung:** Ein **reines, testbares Planungs-/Guard-Fundament** (`packages/shared/…/deprovision.ts`,
  `executable: false`) ohne jede Ausführung: **kein** `docker volume rm`/`network rm`, **kein** neues
  Docker-Write-Kommando, **kein** DB-Schreiben, **kein** Löschen von ServerInstance/Credentials.
  **Stufenmodell:** (1) Container entfernen (live, Step 022, kein Datenverlust) → (2) Volume entfernen
  (**Datenverlust!** nur ohne Container, `RESOURCES_PREPARED`, mit `confirmVolumeDataLoss` +
  `confirmBackupRecommended`, optional getippt `DELETE VOLUME`) → (3) Network entfernen (nur wenn kein
  managed Container mehr gebunden) → (4) ServerInstance archivieren (nur nach Container-Entfernung +
  getroffener Credential-Entscheidung). **Managed-Only-Guards:** fremde (nicht-managed) Ressourcen werden
  **nie** als löschbar geplant; spätere echte Aktionen dürfen nur bei passenden Labels
  (`speakcore.managed=true`/`project`/`instanceId`/`service`) und **ohne** `-f`/Wildcard/freie Namen laufen.
- **Begründung:** „Erst Vertrauen aufbauen": Bestätigungs-, Guard- und Audit-Modell werden getestet,
  bevor irreversible Löschungen möglich sind. Kein neuer persistierter Status/Migration in 0.1 (nur
  deklarative `nextSafeState`-Konzepte wie `RESOURCES_REMOVED`/`ARCHIVED`).
- **Konsequenzen:** Echte **Volume-Remove**, **Network-Remove** und **ServerRecord-Archive/Delete** sind
  je eigene, dedizierte Steps mit zusätzlicher Bestätigung/Backup-Konzept; Volume-Löschung besonders
  abzusichern (irreversibler Datenverlust). Audit-Events (`deprovision.*`) sind vordefiniert.

## ADR-0029 – Volume-Remove: `docker volume rm` (kein Force), streng bestätigt, nur ohne Container

- **Status:** accepted (Step 025)
- **Kontext:** Erste **echte, irreversible** Löschung eines managed Datenvolumes (Datenverlust).
- **Entscheidung:** Agent-Aktion **`REMOVE_MANAGED_VOLUME`** (`POST /docker/provision/remove-volume`) führt
  **ausschließlich `docker volume rm <managed-volume>`** aus – **kein `-f`/`--force`**, nie `network`/
  `container` rm, nie andere Docker-Kommandos. Hinter **Token + `AGENT_DOCKER_WRITE_ENABLED`**, nur für ein
  per Label geprüftes **managed** Volume und **nur wenn kein managed Container** dieser `instanceId` mehr
  existiert (`containerStillExists` sonst). Fehlt das Volume ⇒ `alreadyRemoved` (idempotent); fremdes
  gleichnamiges Volume ⇒ `conflict`. Web-seitig erzwingt die **Step-024-Guard-Logik**
  `canRemoveManagedVolume` **mehrfache Bestätigungen**: `confirmVolumeDataLoss` + `confirmBackupRecommended`
  + getippt **`DELETE VOLUME`** (kein Vorab-Default). `provisioningStatus` bleibt `RESOURCES_PREPARED`; nur
  `managedVolumeState='removed'` markiert den Ist-Zustand.
- **Begründung:** Datenverlust ist irreversibel → maximale Absicherung (Container-Guard, Managed-Only,
  Doppelbestätigung, Backup-Hinweis, getippte Bestätigung). Kein `-f`, damit „in use"/laufende Nutzung
  hart fehlschlägt statt Daten zu erzwingen. **Credentials, Network und ServerInstance bleiben erhalten**
  (per reinem `volumeRemoveSuccessUpdate` + Test).
- **Konsequenzen:** Minimaler Schema-Zusatz `managedVolumeState` (Migration `20260702100000`). **Network-Remove**
  und **ServerRecord-Archive** bleiben eigene, spätere Steps.

## ADR-0030 – Network-Remove: `docker network rm` (kein Force), nur wenn kein managed Container existiert

- **Status:** accepted (Step 026)
- **Kontext:** Das Voice-Network (`speakcore-network-voice`) ist eine **geteilte, globale** Ressource, die
  perspektivisch von mehreren managed Servern genutzt wird.
- **Entscheidung:** Agent-Aktion **`REMOVE_MANAGED_NETWORK`** (`POST /docker/provision/remove-network`) führt
  **ausschließlich `docker network rm speakcore-network-voice`** aus – **kein `-f`/`--force`**, nie `volume`/
  `container` rm. Hinter **Token + `AGENT_DOCKER_WRITE_ENABLED`**, **fester** Network-Name (keine freien Namen
  vom Client). **Shared-Guard:** blockiert (`inUseByManagedContainers`), solange **irgendein** SpeakCore-managed
  Container existiert (Prüfung über `container ls --filter label=speakcore.managed=true`, ungefiltert nach
  instanceId). Fehlt das Network ⇒ `alreadyRemoved`; fremdes/nicht-managed Network ⇒ `conflict`. Web-seitig
  erzwingt der Step-024-Guard `canRemoveManagedNetwork` die Bestätigung **`confirmNetworkUnused`**.
  **Option A (Statuslogik):** **kein** ServerInstance-Statusfeld für das Network – globale Ressource; Ist-Zustand
  via Inventory/Agent + Audit. **Audit-Target = auslösende ServerInstance-ID** (dokumentiert; das Network ist global).
- **Begründung:** Das geteilte Network darf nie entfernt werden, solange es genutzt werden könnte → harter
  „kein managed Container"-Guard statt per-Instanz-Betrachtung. Kein `-f`, damit „in use" hart fehlschlägt.
  Ein per-Server-Statusfeld wäre bei shared Ressourcen irreführend.
- **Konsequenzen:** **Container, Volumes, Credentials und ServerInstance bleiben unangetastet.** Das Network
  ist bei erneutem Provisioning wieder anlegbar. **ServerRecord-Archive/Delete** (inkl. Credential-Entscheidung)
  bleibt der letzte, eigene Deprovisioning-Step.

## ADR-0031 – ServerRecord archivieren statt hart löschen; bewusste Credential-Entscheidung

- **Status:** accepted (Step 027)
- **Kontext:** Abschließender Deprovisioning-Schritt für managed Server. Ein harter `ServerInstance`-Delete
  würde Audit-/Nachvollziehbarkeit zerstören; Credentials dürfen nicht unbemerkt verschwinden.
- **Entscheidung:** **Rein Web-/DB-seitig – keine Docker-/Agent-Aktion.** Standard ist **Archivieren statt
  Löschen**: `archivedAt`/`archiveReasonKey` werden gesetzt, die `ServerInstance` **bleibt** bestehen
  (kein Hard-Delete), die **Audit-Historie bleibt unangetastet**. Archivierung nur, wenn der Step-024-Guard
  `canArchiveManagedServer` erlaubt (managed, Container entfernt/RESOURCES_PREPARED) **und** der Nutzer
  bestätigt: `confirmServerRecordArchive` + **bewusste Credential-Entscheidung** (`keep`|`remove`) + getippt
  **`ARCHIVE SERVER`**. **Credentials werden nur bei `remove` gelöscht** (`ServerCredential` weg,
  `credentialsRemovedAt` gesetzt) – sonst verschlüsselt behalten. **External Server werden abgelehnt.**
  Archivierte Server werden in `/servers` ausgeblendet und zeigen **keine** Lifecycle-Aktionen mehr.
- **Begründung:** Nachvollziehbarkeit + Sicherheit gegen versehentlichen Datenverlust; Credential-Löschung
  ist irreversibel und daher an eine ausdrückliche Wahl gebunden. `RESOURCES_PREPARED` als erwarteter Zustand
  (RUNNING/CONTAINER_CREATED/CONTAINER_PENDING/DRAFT abgelehnt; external abgelehnt).
- **Konsequenzen:** Prisma-Zusatz `archivedAt`/`archiveReasonKey`/`credentialsRemovedAt` (Migration
  `20260702140000`). **Kein Hard-Delete/keine Audit-Löschung** in 0.1. **Offen:** Archiv-Filter/-Ansicht,
  finale Hard-Delete-Policy, Backup-/Export-Konzept – jeweils spätere Steps.

## ADR-0032 – Read-only Server-Export: nur nicht-geheime Metadaten, versioniert, ohne Restore

- **Status:** accepted (Step 029)
- **Kontext:** Vor einer späteren Hard-Delete-Policy soll ein überprüfbarer Export der Server-Metadaten
  möglich sein (Nachvollziehbarkeit/Portabilität) – **ohne** jemals Secrets zu exportieren.
- **Entscheidung:** **Rein Web-/DB-seitiger** Export (`core/server-export`, GET-Route
  `/servers/[id]/export`), **kein Docker/Agent**. **Explizites Feld-Mapping** (`buildManagedServerExport`)
  in ein **versioniertes** Format (`exportVersion`, `product`, `kind`, `server`, `auditEvents`) – **keine
  Roh-Prisma-Objekte**. **Credentials werden komplett ausgeschlossen**; nur ein `credentialStatus`
  (`kept`/`removed`/`none`/`unknown`) + `credentialsRemovedAt` werden exportiert. Optionale **Audit-Historie**
  wird redigiert (`redactAuditEventForExport`: nur `action/actor/target/result/createdAt`, keine Payloads).
  Eine reine Guard-Funktion `assertExportContainsNoSecrets` prüft rekursiv gegen verbotene Schlüssel und
  das Verschlüsselungsformat (Defense-in-Depth). OWNER-only, nur **managed** (external abgelehnt), aktive
  **und** archivierte Server. **Kein Import/Restore/Unarchive/Hard-Delete.**
- **Begründung:** Portabilität/Prüfbarkeit ohne Secret-Risiko; versioniert für zukünftige Kompatibilität.
  Der Export ist **kein** Backup der TS3-Daten (Volume-Inhalte) – das bleibt ein separates Konzept.
- **Konsequenzen:** Der Export wird auditiert (`export.managedServer.requested/completed/failed`) **ohne
  Exportinhalt**. Kein Schema-Change. **Offen:** echtes Volume-Backup-Konzept, erweiterter Audit-Export,
  Import/Restore (nur mit eigenem Sicherheitskonzept), Hard-Delete-Policy erst nach Export-/Backup-Konzept.

## ADR-0033 – Volume-Backup-Blueprint: reine Planung, read-only Quelle, nur bei gestopptem Container

- **Status:** accepted (Step 030)
- **Kontext:** Bevor echte Volume-Backups gebaut werden, braucht es ein getestetes Sicherheits-/Guard-Konzept.
  Ein TS3-Volume-Backup kann **sensible Daten** enthalten und ist deutlich riskanter als der Metadaten-Export.
- **Entscheidung:** **Reines, testbares Planungs-/Guard-Fundament** (`packages/shared/…/backup.ts`,
  `executable: false`) ohne jede Ausführung: **kein** Docker-Kommando/Hilfscontainer, **kein** Agent-Endpunkt,
  **kein** Archivfile/Download, **kein** Restore/Import, **kein** DB-Schreiben, **keine** Pfad-/Shell-Verarbeitung.
  **Guard** (`canBackupManagedVolume`): nur **managed** + gültige `instanceId` + **managed Volume vorhanden**
  (nicht `removed`) + **Container nicht laufend** (konservativ) + Bestätigungen `confirmBackupMayContainSensitiveData`
  + `confirmBackupStorageResponsibility` + `confirmContainerShouldBeStopped` (optional getippt `CREATE BACKUP`).
  Fremde/entfernte Ressourcen werden **nie** als sicherbar geplant. **Backup-Format** (Vorlage):
  `speakcore-backup-ts3-<instanceId>-<timestamp>.tar.gz` + Metadaten-Blueprint (`containsSecrets: "unknown"` –
  **nie** „secret-free"). Der spätere echte Backup-Step würde die Volumequelle **read-only** mounten.
- **Begründung:** „Erst Vertrauen aufbauen": konservativ (nur gestoppter Container → konsistente Dateien,
  weniger Risiko), Managed-Only, mehrfache bewusste Bestätigung, klare Datenschutz-Einstufung (sensibel).
- **Konsequenzen:** Der echte Backup-Step, ein Backup-Download-/Storage-Konzept, **Restore/Import** (eigenes
  Security-Design) und die **Hard-Delete-Policy** (ganz zuletzt) sind je eigene, spätere Steps. Der
  **Metadaten-Export** (Step 029) bleibt strikt getrennt vom **Volume-Backup** (dieses kann sensible Inhalte haben).

## ADR-0034 – Echtes Volume-Backup: read-only Quelle, serverseitiges Ziel/Image, konservativ nur ohne Container

- **Status:** accepted (Step 032)
- **Kontext:** Nach dem Blueprint (ADR-0033) soll das erste **echte** Backup eines managed TS3-Volumes
  entstehen – ohne neue Angriffsfläche durch freie Pfade, Images oder Docker-Argumente.
- **Entscheidung:** Neue Agent-Aktion `BACKUP_MANAGED_VOLUME` (`POST /docker/provision/backup-volume`,
  Token + `AGENT_DOCKER_WRITE_ENABLED`). Ein kurzlebiger, gelabelter Hilfscontainer archiviert die Quelle
  **read-only** (`-v <volume>:/data:ro`) in ein **serverseitig** festgelegtes Verzeichnis
  (`AGENT_BACKUP_DIR`, Default `/var/lib/speakcore/backups`) mit **festem allowlisted Image**
  (`alpine:3.20`, ohne unkontrollierten Pull – Image-Existenz wird vorab geprüft). Ausschließlich
  **statische `execFile`-Argumente** (kein Shell-Aufruf, kein Socket); Dateiname wird **intern** erzeugt
  (`speakcore-backup-ts3-<instanceId>-<timestamp>.tar.gz` + separate `.metadata.json`, keine Secrets).
  **Konservativ:** blockiert (`containerStillExists`), wenn **irgendein** managed Container der
  `instanceId` existiert – der reale Pfad ist Stop → Container-Remove → Backup (`RESOURCES_PREPARED`).
  Web: OWNER-only, drei Checkboxen + getippt `CREATE BACKUP` (Step-030-Guard), Agent prüft erneut
  (Defense-in-Depth). Ergebnis enthält **nur den Dateinamen**, keinen Host-Pfad, keine Roh-Docker-Ausgabe.
- **Begründung:** Maximal konservativer erster echter Backup-Pfad: keine Client-Parameter, read-only
  Quelle (kein Schreiben ins Volume möglich), kein unklarer Zustand bei existierendem Container,
  Backup-Dateien konsequent als **sensibel** eingestuft.
- **Konsequenzen:** **Kein** Restore/Import/Download in 0.1 (je eigenes Security-Design, spätere Steps);
  Aufbewahrung/Rotation der serverseitigen Backup-Dateien liegt beim Betreiber. Erster legitimer Einsatz
  von `docker run` im Agent – Source-Scan-Tests erlauben ihn **nur** im Backup-Modul.

## ADR-0035 – Backup-Download-Blueprint: Verify-vor-Download, Web-proxied Streaming, `executable: false`

- **Status:** accepted (Step 036)
- **Kontext:** Backups existieren (032), sind sichtbar (033), tragen Prüfsummen (034) und sind
  verifizierbar (035). Bevor Backup-Bytes das System verlassen, braucht es ein getestetes
  Sicherheitskonzept – Downloads sind der erste Punkt, an dem sensible TS3-Daten die serverseitige
  Schutzumgebung verlassen würden.
- **Entscheidung:** **Reiner, testbarer Download-Blueprint** (`backup-download.ts` in
  `@speakcore/shared`, `executable: false`) ohne jede Ausführung: keine Download-Route, kein
  Streaming, keine Datei-/DB-/Agent-Operation. **Harte Guard-Regeln** für den späteren echten
  Download: managed + OWNER + striktes Instanz-Dateinamensmuster + Backup existiert + Metadaten
  gültig + Checksum vorhanden + **Verify `valid` zwingend** (mismatch/nicht verifiziert/ohne
  Prüfsumme ⇒ immer blockiert) + Rate-Limit + zwei Bestätigungen + getippt **`DOWNLOAD BACKUP`**.
  **Zielbild Option A – Web-proxied Streaming:** Browser → Web (OWNER-Prüfung) → serverseitiger
  Agent-Call (Token) → Streaming aus `AGENT_BACKUP_DIR` → Browser; **nie Browser→Agent**, kein
  Memory-Buffering, keine temporäre Kopie. Policies modelliert: 5 Downloads/h, 20/Tag je
  Owner+Server, Timeout 600 s, Warnung ab 1 GiB. Audit `backup.managedVolume.download.*` ohne
  Inhalt/Dateiname/Host-Pfad.
- **Begründung:** Bewährtes Muster „erst Blueprint, dann minimale Ausführung" (024→025/026,
  030→032). Option A hält Agent-Token/URLs vollständig serverseitig und bündelt die Owner-Prüfung
  im Web; die Verify-vor-Download-Regel stellt sicher, dass nur integritätsgeprüfte Dateien
  ausgeliefert würden.
- **Konsequenzen:** Der echte Streaming-Download ist ein eigener, abgesicherter Step (Backpressure/
  Timeout/Abbruch im Web-Proxy sind dort zu lösen und zu testen). **Restore/Import/Delete/Rotation**
  bleiben ausgeschlossen; keine Signatur ⇒ weiterhin keine Authentizitätsgarantie. Der Blueprint
  ändert am Laufzeitverhalten nichts.

## ADR-0036 – Backup-Download-Umsetzung: Verify-on-Download, POST-Form-Streaming, `started` als letzter Audit-Punkt

- **Status:** accepted (Step 037)
- **Kontext:** Umsetzung des Download-Blueprints (ADR-0035). Drei Detailfragen waren zu
  entscheiden: Wie wird „Verify `valid`" ohne persistierten Verify-State sichergestellt? Wie kommt
  der Stream mit Bestätigungen zum Browser? Was darf das Audit über den Streamausgang behaupten?
- **Entscheidung:** **(1) Verify-on-Download (Option A):** unmittelbar vor jedem Download führt der
  Web-Server das Step-035-Verify serverseitig erneut aus; nur `valid` streamt. Kein Schema-Change,
  kein veralteter Verify-State. **(2) POST-Form → Route Handler streamt:** die Bestätigungen
  (2 Checkboxen + getippt `DOWNLOAD BACKUP`, keine Defaults) kommen als Form-POST an
  `/[locale]/servers/[id]/backups/download`; die Route reicht den Agent-Stream (`GET
  /docker/provision/download-backup`, Token-Gate, striktes Instanz-Muster, nie `.metadata.json`)
  **ohne Komplett-Einlesen** durch (Web-Streams, Backpressure; Gesamttimeout 600 s). Blockierte
  Anfragen ⇒ 303-Redirect mit generischem Statuskey. Kein Ticket-Mechanismus (Option B aus dem
  Prompt) – einstufig reicht, solange die Route selbst streamen kann. **(3) Audit ehrlich:**
  `requested/blocked/confirmed/started/failed` ohne Dateiname/Prüfsumme/Inhalt; **`started` ist
  der letzte zuverlässige Audit-Punkt** – `completed` wird nicht geloggt, weil das Ende des
  durchgereichten Streams im Web-Prozess nicht sicher erfassbar ist. **Rate-Limit:** 5/h je
  Owner+Server durchgesetzt; das modellierte Tageslimit (20/Tag) bewusst noch nicht (MVP).
  Die UI zeigt die Download-Form nur direkt nach einem bestätigten Verify-`valid`-Ergebnis
  (Server prüft unabhängig davon erneut).
- **Begründung:** Option A ist die sicherste Verify-Garantie (keine Race mit veraltetem State);
  Web-proxied Streaming hält Agent-URL/Token vollständig serverseitig; das Audit lügt nicht über
  Zustellung, die der Proxy nicht garantieren kann.
- **Konsequenzen:** Downloads großer Dateien belasten den Web-Prozess als Durchleiter (dokumentiert;
  Timeout 600 s begrenzt Hänger). Doppeltes Lesen der Datei (Verify-Hash + Stream) ist der Preis der
  harten Verify-Regel. Tageslimit, Signatur/Verschlüsselung, Restore/Delete/Rotation bleiben offen
  (je eigene Steps).

## ADR-0037 – Backup-Delete/Rotation-Blueprint: Warnungen statt Verify-Pflicht, Rotation nur als Dry-Run

- **Status:** accepted (Step 039)
- **Kontext:** Der Backup-Lebenszyklus (erstellen 032, sehen 033, prüfen 034/035, laden 037,
  nachrüsten 038) hat keine Löschung – `AGENT_BACKUP_DIR` wächst unbegrenzt. Löschen ist die
  **irreversibelste** Aktion des Zyklus und braucht vor jeder Umsetzung ein getestetes Konzept.
- **Entscheidung:** **Reiner Blueprint** (`backup-delete.ts` in `@speakcore/shared`,
  `executable: false`) ohne jede Datei-/DB-/Agent-Operation. **Einzel-Delete-Guards:** managed +
  OWNER + striktes Instanz-Dateinamensmuster + Backup existiert + 3 Bestätigungen + getippt
  **`DELETE BACKUP`**; Löschziel wäre genau eine Datei + exakt abgeleitete metadata.json (nie
  Wildcards/Ordner). **Anders als beim Download ist Verify KEIN Blocker:** `verifyMismatch`/
  `neverVerified`/`metadataMissing`/`checksumMissing`/`onlyBackup`/`serverArchived`/`largeFile`
  sind **Warnungen** – auch defekte/alte Backups müssen löschbar bleiben. **Rotation nur als
  Dry-Run:** Policy-Modell (keepLastCount/keepMinAgeDays/deleteOlderThanDays/
  protectLastVerifiedBackup/protectOnlyBackup, `dryRun` immer true), eigener
  Bestätigungssatz + getippt **`DELETE BACKUPS`**, Warnung `wouldDeleteAllBackups`; kein
  automatisches Löschen, keine Scheduler/Background-Jobs. Audit `delete.*`/`rotation.*` bleibt
  **ohne Dateinamen** (bestehende Linie).
- **Begründung:** Bewährtes Muster „erst Blueprint, dann minimale Ausführung". Die Asymmetrie
  Download (Verify-Pflicht) vs. Delete (Verify-Warnung) folgt dem Zweck: Download gibt sensible
  Daten heraus (nur integritätsgeprüft), Delete räumt auf (muss auch Kaputtes entfernen können).
- **Konsequenzen:** Der echte Einzel-Delete ist ein eigener, abgesicherter Step (erste destruktive
  Dateioperation im Backup-Verzeichnis); danach Rotation-Dry-Run als Anzeige, Bulk-Ausführung und
  Restore-Konzept je separat. Der Blueprint ändert am Laufzeitverhalten nichts.

## ADR-0038 – Einzel-Backup-Delete: gezieltes unlink, idempotentes alreadyRemoved, kein Waisen-Aufräumen

- **Status:** accepted (Step 040)
- **Kontext:** Umsetzung des Delete-Blueprints (ADR-0037) – die **erste destruktive
  Dateioperation** im Backup-Verzeichnis. Drei Detailfragen: Braucht der Endpunkt das
  Docker-Write-Flag? Was passiert bei bereits fehlender Datei? Wird eine verwaiste metadata.json
  mit aufgeräumt?
- **Entscheidung:** **(1) Kein `AGENT_DOCKER_WRITE_ENABLED`** (keine Docker-Aktion) – stattdessen
  Token-Gate + agentseitige **Re-Validierung aller Guards** (striktes Instanz-Muster, 3
  Bestätigungen + getippt `DELETE BACKUP` ohne Defaults) + OWNER-only-Web-Flow mit Rate-Limit
  (5/h je Owner+Server) und Warnanzeige (Step-039-Warnungen). **(2) Fehlende tar.gz ⇒
  `alreadyRemoved`** (idempotent, wie `docker volume rm` in Step 025 – wiederholte Aufrufe sind
  gefahrlos). **(3) Eine verwaiste metadata.json wird bewusst NICHT automatisch mitgelöscht** –
  ohne primäres Ziel wird nichts aufgeräumt (kein implizites Löschen); schlägt nur die
  metadata-Löschung fehl ⇒ ehrlicher Teilstatus `metadataDeleteFailed`. Gelöscht wird
  ausschließlich per gezieltem unlink der exakt benannten tar.gz + intern abgeleiteter
  metadata.json – kein Listing, keine Rekursion, keine Wildcards; Audit `delete.*` ohne Dateinamen.
- **Begründung:** Minimale destruktive Oberfläche: jeder Lösch-Pfad ist explizit, deterministisch
  und testbar (HTTP-Test verifiziert, dass fremde Dateien/Subdirectories unberührt bleiben).
- **Konsequenzen:** Rotation bleibt Blueprint (Dry-Run-Anzeige als nächster Schritt, Bulk-Ausführung
  separat); verwaiste metadata.json-Dateien können sich ansammeln (bewusst; späterer Aufräum-Step
  denkbar). Restore bleibt nicht implementiert – gelöschte Backups sind endgültig verloren.

---

> **Restore-Foundation ADR-Paket (Step 044, akzeptiert in Step 044a am 2026-07-12).** Die drei
> ADRs (0039–0041) sind **`Accepted`** (Entscheider Kay / Human Maintainer), bleiben aber
> **`executable: false`**: **Acceptance erlaubt KEINE Restore-Ausführung** — es ist **kein Restore,
> keine Write-/Apply-Funktion** freigegeben. Step 045 darf **ausschließlich** eine **read-only
> Restore-Inspection** behandeln. Übersicht:
> [../docs/backup/RESTORE_FOUNDATION_DECISION_SUMMARY.md](../docs/backup/RESTORE_FOUNDATION_DECISION_SUMMARY.md);
> Basis: [../docs/backup/MANAGED_BACKUP_RESTORE_BLUEPRINT.md](../docs/backup/MANAGED_BACKUP_RESTORE_BLUEPRINT.md).

## ADR-0039 – Restore Authorization and Confirmation Model

- **Status:** **Accepted** (Step 044a, **2026-07-12**) — Entscheider: **Kay / Human Maintainer**;
  Grundlage: ausdrückliche Freigabe gemäß Nova-Empfehlung. **Acceptance erlaubt noch KEINE
  Restore-Ausführung** (Restore bleibt nicht implementiert).
- **executable:** false
- **Kontext:** Der Restore ist eine destructive, zustandsersetzende Operation (Blueprint §5.4/§5.7).
  Zu klären ist, **wer** ihn auslösen darf und **wie** die Bestätigung so gebunden wird, dass sie
  nicht wiederverwendet oder aus der UI vorgetäuscht werden kann.
- **Entscheidung (Empfehlung):** **(1)** Erste Restore-Version **ausschließlich `OWNER`** (RBAC wie
  alle sensiblen Backup-Aktionen; eine eigene Restore-Rolle bleibt spätere Option). **(2)** **Keine**
  Berechtigungsentscheidung allein im Browser — die UI-Eingabe ist nur **Bestätigungsfaktor, keine
  Autorität**. **(3)** **Serverseitige erneute Berechtigungsprüfung** sowohl bei der Planerstellung
  als auch bei der Ausführung. **(4)** Die Bestätigung wird **serverseitig gebunden** an: Benutzer +
  Instanz + Backup + **Backup-Fingerprint** (Größe+mtime+SHA-256) + **Plan-ID** + **Ablaufzeit**;
  sie ist **einmalig/nicht wiederverwendbar** (Replay-Schutz). **(5)** Ein seit Planerstellung
  **veränderter Backup- oder Instanzzustand macht den Plan ungültig** (neuer Plan nötig).
  **(6)** **Kein** Cross-Instance-Restore, **kein** Restore fremder/hochgeladener Archive, **keine**
  frei eingebbaren Hostpfade.
- **Alternativen (Bestätigungsform):** einfache Ja/Nein-Bestätigung *(zu schwach)* · Eingabe des
  Backup-Dateinamens · Eingabe des Instanznamens · feste Restore-Phrase (z. B. `RESTORE BACKUP`) ·
  serverseitiges Einmal-Token. **Empfohlen:** **sichtbare starke Eingabe** (Kombination aus exaktem
  Backup-Dateinamen und/oder Instanznamen **plus** fester Phrase, konsistent mit `CREATE BACKUP`/
  `DELETE BACKUP`) **plus** serverseitige **Plan-/Fingerprint-Bindung + Einmal-Token**.
- **Verbindliche Entscheidung (Accepted, Step 044a) für Restore v1:** Restore **nur `OWNER`**;
  **keine separate Restore-Rolle in v1**; Berechtigungsprüfung **serverseitig bei Planung UND
  Ausführung**; **keine Autorität im Browser**; **kurzlebiger, einmalig nutzbarer** Restore-Plan
  gebunden an Benutzer + Instanz + Backup + **Backup-Fingerprint** + **Plan-ID** + **Ablaufzeit**;
  jede relevante Änderung am Backup-/Instanzzustand **invalidiert den Plan**; **kein**
  Cross-Instance-Restore, **keine** fremden/hochgeladenen Archive, **keine** frei eingebbaren
  Hostpfade. **Gewählte Bestätigungsphrase (exakt):** `RESTORE <INSTANZNAME> FROM <BACKUP-DATEINAME>`
  — serverseitig aus dem gültigen Plan erzeugt, vollständig+exakt einzugeben, **nur
  Bestätigungsfaktor** (ersetzt keine serverseitige Autorisierung), **nicht wiederverwendbar**.
  **Nicht gewählt:** einfache Ja/Nein-Bestätigung, alleinige Dateinamen-Eingabe, alleinige
  Instanznamen-Eingabe, alleinige feste Phrase ohne Plan-Bindung (zur Nachvollziehbarkeit erhalten,
  aber verworfen).
- **Sicherheitsauswirkung:** verhindert UI-Autoritäts-Spoofing, Replay alter Anforderungen und
  TOCTOU-Backup-Austausch zwischen Plan und Apply; hält das Vertrauensmodell serverseitig.
- **Konsequenzen:** Der spätere Plan-Endpunkt erzeugt Plan-ID + Fingerprint + die exakte
  Bestätigungsphrase; der Execute-Endpunkt revalidiert Rolle/Instanz/Backup/Bestätigung. Umsetzung
  erst nach freigegebenem Restore-WP (Step 045 nur read-only Inspection).

---

## ADR-0040 – Restore Manifest and Legacy Backup Policy

- **Status:** **Accepted** (Step 044a, **2026-07-12**) — Entscheider: **Kay / Human Maintainer**;
  Grundlage: ausdrückliche Freigabe gemäß Nova-Empfehlung. **Acceptance erlaubt noch KEINE
  Restore-Ausführung/Manifest-Implementierung.**
- **executable:** false
- **Kontext:** Aktuelle Backups sind gzip-Tar des Volume-Inhalts **ohne eingebettetes Manifest**;
  der Sidecar `.metadata.json` (unsigniert) trägt Basisfelder + optionale SHA-256 über die gesamte
  tar.gz. Für sicheren Restore fehlen erwartete Struktur/Größen/Dateizahl/Per-Datei-Integrität und
  Kompatibilitätsinfo (Blueprint §5.10).
- **Entscheidung (Empfehlung):** **(1)** Restore-fähige Backups benötigen ein **versioniertes
  Manifest**. **(2)** Das Manifest wird **beim Erstellen** des Backups erzeugt und ist **Bestandteil
  der vertrauenswürdig validierten Backup-Struktur**. **(3)** **SHA-256 belegt nur Integrität** gegen
  zufällige Veränderung — **keine Herkunft/Authentizität** (keine Signatur; wird nicht als vorhanden
  dargestellt). **(4)** **Legacy-Backups ohne Manifest sind zunächst NICHT restorefähig.** **(5)**
  **Keine** automatische Vertrauensableitung allein aus Dateiname oder Sidecar. **(6)** Die
  Restore-Inspection (Step 045) **darf** Legacy-Backups **erkennen und als inkompatibel anzeigen**,
  aber **nicht freigeben**. **(7)** Eine spätere **Legacy-Migration/Backfill** ist ein **separates
  Work Package**.
- **Vorgeschlagene Pflichtfelder:** Manifest-Schema-Version · Backup-ID · Instanz-ID ·
  Erstellungszeitpunkt · Backup-Typ · SpeakCore-Version · Agent-Version · erwartete Archivstruktur ·
  komprimierte Größe · erwartete unkomprimierte Größe · Dateianzahl · Inhalts-/Dateiprüfsummen ·
  Kompatibilitätsinformationen. **Vier getrennte Eigenschaften nicht vermischen:** **Integrität**
  (SHA-256) · **Herkunft** (derzeit nicht kryptografisch belegbar) · **Instanzbindung** (instanceId
  in Name **und** Manifest) · **Versionskompatibilität** (Schema-/SpeakCore-/TS3-Version).
- **Alternativen:** (a) kein Manifest, Vertrauen aus Sidecar · (b) Manifest optional ·
  (c) **Manifest zwingend + Legacy fail-closed** — **(c) gewählt**; (a) und (b) **nicht gewählt**
  (kein Herkunftsnachweis bzw. uneinheitliche Restore-Sicherheit; zur Nachvollziehbarkeit erhalten).
- **Verbindliche Entscheidung (Accepted, Step 044a) für Restore v1:** Restore-fähige Backups
  benötigen ein **versioniertes Manifest**. **Zwingende Manifest-(inner)-Felder:**
  Manifest-Schema-Version · Backup-ID · Instanz-ID · Erstellungszeitpunkt · Backup-Typ ·
  SpeakCore-Version · Agent-Version · Archivformat · Layout-Version · erwartete unkomprimierte
  Gesamtgröße · erwartete Dateianzahl · normalisierte relative Pfade · Eintragstypen · Dateigrößen ·
  **SHA-256 je regulärer Datei**. **Zusätzliche äußere Backup-Metadaten:** Archivdateiname ·
  komprimierte Archivgröße · **SHA-256 des vollständigen Archivs**. **Optional:** TeamSpeak-Version/
  Build · Quellplattform · zusätzliche Kompatibilitätsmerkmale. **Sicherheitsgrenzen:** SHA-256 =
  Integrität gegen Veränderung, **keine Signatur**, **kein** alleiniger Herkunftsnachweis;
  **Integrität / Herkunft / Instanzbindung / Versionskompatibilität bleiben getrennte Prüfziele.**
  **Legacy-Backups ohne Manifest:** werden erkannt, dürfen **angezeigt**, sind **eindeutig als nicht
  restorefähig markiert**, erhalten in v1 **keinen automatischen Backfill**, dürfen **weder geplant
  noch ausgeführt** werden; Behandlung erst durch ein **separates späteres NDF-WP**.
- **Sicherheitsauswirkung:** verhindert Restore aus unvollständig verifizierbaren/manipulierten
  Backups; macht Bomb-/Größen-/Struktur-Gates (Blueprint §5.8) überhaupt belastbar; Per-Datei-SHA-256
  ermöglicht Post-Extraktions-Validierung.
- **Konsequenzen:** Manifest-Erzeugung (inkl. Per-Datei-SHA-256) berührt einen **späteren**
  Backup-Erstellungs-WP; Legacy-Backups bleiben ohne separates Backfill-WP nicht restorefähig. Die
  Restore-Inspection (Step 045) darf Legacy erkennen/anzeigen, **nicht** freigeben.

---

## ADR-0041 – Mandatory Pre-Restore Safety Backup

- **Status:** **Accepted** (Step 044a, **2026-07-12**) — Entscheider: **Kay / Human Maintainer**;
  Grundlage: ausdrückliche Freigabe gemäß Nova-Empfehlung. **Acceptance erlaubt noch KEINE
  Restore-Ausführung.**
- **executable:** false
- **Kontext:** Restore überschreibt den Live-Volume-Zustand. Ohne eine unmittelbar vorher erstellte,
  validierte Sicherung gibt es keine verlässliche Rollback-Quelle (Blueprint §5.11/§5.15).
- **Entscheidung (Empfehlung):** **(1)** Vor **jedem** Restore ist ein **neuer managed
  Sicherungspunkt verpflichtend**. **(2)** Der Restore **stoppt**, wenn dessen Erstellung **oder**
  Validierung (SHA-256) fehlschlägt — **kein stilles Überspringen**. **(3)** Für die **erste**
  Restore-Version **kein Owner-Override**. **(4)** Der Sicherungspunkt erhält eine **eindeutige
  Kennzeichnung** (Pre-Restore-Marker). **(5)** Er darf **nicht unmittelbar durch Rotation entfernt**
  werden. **(6)** Sein **Speicherbedarf** wird bereits in der **Planungsphase** berücksichtigt;
  **fehlender Speicherplatz ist ein harter Blocker**. **(7)** Der Sicherungspunkt ist die
  **bevorzugte Rollback-Quelle**. **(8)** Aufbewahrungs-/Rotationseinbindung wird **später separat**
  entschieden.
- **Alternativen:** (a) **verpflichtende Sicherung ohne Override** — **(a) gewählt für v1**;
  (b) Owner-Override mit Zusatzbestätigung — **nicht gewählt** (nur nach eigener späterer ADR);
  (c) Restore ohne Sicherung — **nicht gewählt/abgelehnt** (kein sicherer Rollback). Verworfene
  Alternativen zur Nachvollziehbarkeit erhalten.
- **Verbindliche Entscheidung (Accepted, Step 044a) für Restore v1:** vor **jedem** Apply ein
  **neuer managed Pre-Restore-Sicherungspunkt**; **kein Owner-Override in v1**; **Fehlschlag der
  Erstellung ODER Validierung blockiert** den Restore; **unzureichender Speicher = harter Blocker**;
  Sicherungspunkt ist **bevorzugte Rollback-Quelle**. **Retention/Schutz:** nach erfolgreichem
  Restore **mindestens 7 Tage** gegen Rotation geschützt; die **7-Tage-Frist beginnt erst nach
  erfolgreichem Start UND erfolgreichem Health-Check**; bei **fehlgeschlagenem Restore** bzw.
  **fehlgeschlagenem Rollback** bleibt der Sicherungspunkt **bis zur manuellen Klärung geschützt**;
  **keine automatische Löschung** bei `ROLLBACK_FAILED`, `CLEANUP_REQUIRED` oder vergleichbaren
  ungeklärten Fehlerzuständen. Die **technische Umsetzung der Rotation-Ausnahme** ist ein **separates
  Work Package**.
- **Sicherheitsauswirkung:** garantiert eine Rollback-Grundlage; verwandelt einen fehlgeschlagenen
  Apply von „Datenverlust" in „rücksicherbar"; koppelt Speicher-Preflight an die Sicherheit; die
  7-Tage-/Fehlerschutz-Regel verhindert, dass die Rettungskopie vorschnell rotiert wird.
- **Konsequenzen:** zusätzlicher Speicherbedarf (Staging + Pre-Restore + Rollback) im Space-Gate;
  die Rotation (Einzel-Delete 040 / spätere Bulk-Rotation) muss den Pre-Restore-Marker + die
  Schutzfristen respektieren — als eigenes WP umzusetzen.

---

## ADR-0042 – Restore Manifest Format, Placement and Binding

- **Status:** **Accepted with Notes** (Step 046a, **2026-07-12**) — Entscheider: **Kay / Human
  Maintainer**; Grundlage: ausdrückliche Freigabe gemäß Nova-Empfehlung mit den verbindlichen Notes
  (siehe unten). **Acceptance erlaubt KEINE produktive Manifest-/Backup-Integration** (kein Code).
- **executable:** false
- **Kontext:** ADR-0040 (Accepted) verlangt für restorefähige Backups ein **versioniertes Manifest**.
  Zu klären sind Format, Dateiname, Ablage im Archiv, optionale externe Sidecar-Kopie, die Bindung
  zwischen Archiv/Manifest/bestehender `.metadata.json`, deterministische Serialisierung sowie
  Snapshot-Konsistenz und atomare Veröffentlichung. Volles Format:
  [../docs/backup/RESTORE_MANIFEST_V1_SCHEMA.md](../docs/backup/RESTORE_MANIFEST_V1_SCHEMA.md).
- **Befund (nur Repo, `apps/agent/src/docker-backup.ts`):** Das Backup wird per gelabeltem
  Hilfscontainer erzeugt, der das Volume **read-only** mountet und `tar -czf /backup/<finaler-Name>
  -C /data .` ausführt — **direkt unter dem finalen Namen in `AGENT_BACKUP_DIR`**, **ohne** temporären
  Namen, **ohne** Staging-Kopie, **ohne** atomaren Rename; die `.metadata.json` wird **danach**
  separat geschrieben; SHA-256 über die fertige tar.gz. ⇒ Die aktuelle Erzeugung liefert **weder** eine
  unveränderliche Staging-Struktur **noch** eine atomare Veröffentlichung.
- **Entscheidung (Empfehlung):**
  - **Schema-Version:** `schemaVersion` als **ganze Zahl**, strikt versioniert; unbekannte
    Major-Version ⇒ **fail-closed**; keine implizite Abwärtskompatibilität.
  - **Manifest-Datei im Archiv:** exakt **`speakcore-backup-manifest.json`**, **genau einmal**, im
    **Archiv-Root**; **kein** benutzerdefinierter Name, **kein** Pfad aus Request/Konfiguration, keine
    alternativen Fundstellen. Das Manifest beschreibt die **Nutzdaten**, nicht sich selbst.
  - **Externe Kopie (bewertet 1 nur Archiv · 2 nur Sidecar · 3 identisch in beiden):** **Option 3** —
    **identische Manifest-Bytes** im Archiv **und** als managed Sidecar `<backup-file-name>.manifest.json`.
    Der Sidecar dient der schnellen read-only Inspection; die spätere **Restore-Referenz** ist das
    Manifest **im Archiv**. Der Sidecar allein erzeugt **keine** Restore-Freigabe.
  - **Bindung:** die bestehende `.metadata.json` trägt künftig zusätzlich `manifestFileName`,
    `manifestSchemaVersion`, `manifestSha256` (neben `backupId`/`instanceId`/`archiveFileName`/
    `archiveSizeBytes`/`archiveSha256`). **Sicherheitsmodell:** Archiv-Hash bindet Metadata↔Archiv;
    Manifest-Hash bindet Metadata↔exakte Manifest-Bytes; der Sidecar muss denselben Manifest-Hash
    haben; **vor Restore-Apply** muss das Manifest **im Archiv** denselben Hash besitzen; Sidecar +
    Metadata ersetzen **keine** spätere Archivvalidierung; SHA-256 = Integrität, **keine** Signatur/
    Herkunftsgarantie.
  - **Deterministische Serialisierung:** UTF-8, **kein BOM**, **LF**, stabile Feldreihenfolge, nach
    `path` lexikalisch sortierte `entries`, ISO-8601-UTC-Zeiten, SHA-256 als **lowercase Hex**,
    **normalisierte POSIX-relative Pfade** (kein führendes `/`, kein `.`/`..`, keine Backslashes,
    keine doppelten Separatoren). **Empfehlung: projektspezifische, dokumentierte deterministische
    Serialisierung** (stabile Key-Reihenfolge + sortierte Einträge) — **kein** externer
    Canonical-JSON-Standard und **keine neue Dependency**.
  - **Pflichtfelder / Entry-Regeln / Kompatibilität:** siehe Schema-Dokument. Nur reguläre Dateien +
    Verzeichnisse; **Symlinks/Hardlinks/Device/Pipes/Special Files in v1 unzulässig**; `sha256` nur
    für reguläre Dateien; keine doppelten Pfade; Manifest-Datei und externe Sidecars **nicht** in
    `entries`.
  - **Snapshot-Konsistenz (Grundsatz):** Manifest und Archiv **müssen aus derselben
    agent-kontrollierten, unveränderlichen Staging-Struktur** erzeugt werden. Ein Manifest aus einem
    früheren/parallelen Live-Zustand ist **unzulässig**.
- **Alternativen (Serialisierung):** projektspezifisch-deterministisch *(empfohlen)* vs. formaler
  Canonical-JSON-Standard *(nicht gewählt: neue Dependency/Komplexität, für v1 unnötig)*.
- **Sicherheitsauswirkung:** ermöglicht belastbare Bomb-/Größen-/Struktur-/Per-Datei-Gates beim
  späteren Restore; trennt Integrität/Herkunft/Instanzbindung/Versionskompatibilität sauber.
- **Konsequenzen / BLOCKER:** Die aktuelle Backup-Erzeugung bietet die geforderte
  **Staging-/Snapshot-Konsistenz** und **atomare Veröffentlichung nicht** ⇒ die Manifest-**Integration**
  in die Backup-Erstellung ist **blockiert**, bis ein **Staging-/Atomic-Publish-WP** (vorgeschlagen
  als Step 049 bzw. Backup-Erzeugungs-Umbau) umgesetzt ist. **Keine schwächere Konsistenzbehauptung**
  wird akzeptiert. Reihenfolge: 047 Typen/Validator → 048 read-only Builder (Test-/Staging) → 049
  Staging/Snapshot (nach ADR-Freigabe) → später Backup-Integration. **Restore bleibt nicht
  implementiert.** Legacy-Backups ohne Manifest bleiben nicht restorefähig (ADR-0040/Step 045).
- **Verbindliche Acceptance Notes (Step 046a):**
  - **Note 1 – Keine behauptete Mehrdatei-Atomarität:** Archiv, Manifest-Sidecar und Metadata sind
    getrennte Dateien; ein **einzelner** atomarer Datei-Rename kann sie nicht gemeinsam
    veröffentlichen. Spätere Reihenfolge: (1) alle Artefakte unter **nicht listbaren temporären
    Namen** erzeugen → (2) Archiv vollständig erzeugen+validieren → (3) Archiv-SHA-256 → (4)
    Manifest-Sidecar schreiben+validieren → (5) Metadata erzeugen → (6) Bindungen (Metadata↔Archiv↔
    Manifest) prüfen → (7) Archiv + Manifest in den managed Namensraum überführen → (8) **Metadata
    zuletzt** veröffentlichen. Die **Metadata ist der `Publication Commit Marker`**: ein Backup gilt
    nur als vollständig veröffentlicht, wenn Metadata gültig **und** Archiv **und** Manifest-Sidecar
    vorhanden sind, alle referenzierten Namen übereinstimmen, Archivgröße/-Hash + Manifest-Hash
    stimmen und die Schema-Version unterstützt ist. **Verwaiste/teilveröffentlichte Artefakte** dürfen
    **nicht** in der Liste erscheinen, **nicht** als reguläres managed Backup inspiziert werden,
    **keine** Restore-Freigabe erzeugen und werden durch einen späteren Cleanup-/Recovery-Prozess
    behandelt. Ein späteres **Backup-Bundle-Verzeichnis mit atomarem Directory-Rename** bleibt eine
    mögliche Alternative und ist durch ADR-0042 **nicht** ausgeschlossen.
  - **Note 2 – Snapshot-Konsistenz ist Integrationsblocker:** Manifest und Archiv müssen aus **exakt
    derselben unveränderlichen Staging-Struktur** stammen. **Unzulässig:** Manifest aus dem
    Live-Volume erzeugen und danach separat archivieren; paralleles Hashing/Archivieren eines
    veränderlichen Live-Zustands; Manifestdaten aus einem zeitlich anderen Dateizustand; schwächere
    Konsistenzbehauptungen ohne technische Garantie. **Produktive Integration bleibt blockiert**, bis
    eine agent-kontrollierte Staging-/Snapshot-Lösung entschieden **und** umgesetzt ist
    (OPEN-13/OPEN-14).
  - **Note 3 – Acceptance erlaubt noch keine Backup-Integration:** Akzeptiert sind **nur**
    Manifestformat, Dateiname, Ablage, Sidecar-Modell, deterministische Serialisierung, Hash-Bindung
    und das Publication-Grundmodell. **Nicht freigegeben:** Manifest-Erzeugung im produktiven
    Backup-Ablauf, Änderungen an der bestehenden Backup-Erstellung, Staging, atomare Veröffentlichung,
    Cleanup produktiver Teilzustände, Restore-Plan/-Ausführung.
  - **Note 4 – Restore-Freigabe bleibt getrennt:** Ein formal gültiges Manifest bedeutet **nicht**
    automatisch `restoreEligible: true`. Zusätzlich erforderlich bleiben mindestens: gültige
    Instanzbindung, unterstützte Schema-Version, Versions-/Layout-Kompatibilität, sichere Prüfung des
    Archiv-Inhalts, Prüfung des **archiv-internen** Manifests, vollständige Restore-Preflight-Gates,
    ein gültiger Owner-gebundener Restore-Plan und **Accepted Folge-ADRs**.

---

## Offene Entscheidungen (proposed / TODO)

| ID | Thema | Status | Anmerkung |
|----|-------|--------|-----------|
| OPEN-1 | Open-Source-Lizenz (AGPL-3.0 vs. Apache-2.0 vs. MIT) | proposed | Empfehlung: AGPL-3.0 für Self-Hosting-Schutz; entscheidet Maintainer |
| OPEN-2 | Setup-Script-Sprache (Bash vs. portabler) | proposed | Bash für Linux-Hosts naheliegend |
| OPEN-3 | Monorepo-Struktur (pnpm workspaces) für Web + Agent | **entschieden → ADR-0009** | umgesetzt in Step 002 |
| OPEN-4 | UI-Komponentenbasis (shadcn/ui vs. eigenes Set auf Tokens) | proposed | später (Step 003+) |
| OPEN-5 | Tailwind v3 vs. v4 | proposed | Step 002 nutzt Tailwind v3 (stabile Config-Datei); v4-Migration später prüfen |
| OPEN-6 | Restore Apply-/Rollback-Strategie & Verzeichnis-Swap | Folge-ADR (vertagt, Step 044) | Plattform-Atomarität offen; erst nach Repo-/Plattform-Klärung |
| OPEN-7 | Linux-/Windows-/Docker-Volume-Portabilität des Apply | Folge-ADR (vertagt) | mit OPEN-6 gekoppelt |
| OPEN-8 | Restore-State-Persistenz (DB vs. agent-lokal) | Folge-ADR (vertagt) | State-Modell Blueprint §5.14 |
| OPEN-9 | Restore-Lock-Persistenz & Lease-Modell | Folge-ADR (vertagt) | Blueprint §5.16 |
| OPEN-10 | Restore-Audit-Datenmodell (flaches AuditLog erweitern?) | Folge-ADR (vertagt) | Blueprint §5.17; ggf. Migration |
| OPEN-11 | Wiederanlauf nach Agent-Neustart während Restore | Folge-ADR (vertagt) | Blueprint §5.14/§5.19 |
| OPEN-12 | Diagnoseartefakt-Retention bei Fehler/Rollback | Folge-ADR (vertagt) | Blueprint §5.15 |
| OPEN-13 | Staging-/Snapshot-Konsistenz der Backup-Erzeugung (Manifest+Archiv aus einer Struktur) | Folge-ADR/WP (vertagt, Step 046) | aktuelle Erzeugung tart Live-Volume direkt; **Manifest-Integration blockiert** bis Staging (Step 049) |
| OPEN-14 | Atomare Veröffentlichung eines Backups (Temp-Namen + atomarer Rename) | Folge-ADR/WP (vertagt, Step 046) | aktuell direkter finaler Name, kein atomarer Publish; unvollständiges Backup könnte listbar sein |
