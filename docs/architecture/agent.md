# SpeakCore Agent

> Privilegierter Dienst. Maßgeblich: [ARCHITECTURE.md](../../project-brain/ARCHITECTURE.md) §3.3,
> [SECURITY.md](../../project-brain/SECURITY.md), [ADR-0004/0005](../../project-brain/DECISIONS.md).

## Zweck

Der Agent ist die **einzige** Komponente mit Docker-/Host-Rechten. Er führt alle privilegierten
Operationen aus, die WebUI und API selbst nicht ausführen dürfen.

## Verantwortlichkeiten (0.1)

- TS3-Server als Docker-Container provisionieren, starten, stoppen, neustarten.
- Logs einsammeln und an die API liefern.
- Backup-/Restore-Operationen auf Dateisystemebene.
- Systemcheck-Sonden, die Hostzugriff erfordern (Docker-Status, Ports, Firewall, Speicher,
  Netzwerk/DNS, IPv4/IPv6) für den Preflight & Capacity Advisor.

## Schnittstelle

- Minimale, klar definierte HTTP-API; nur explizit modellierte Operationen.
- Authentifizierung über generiertes **Bootstrap-Token** ([ADR-0005](../../project-brain/DECISIONS.md)).
- Strikte Eingabevalidierung – keine ungeprüften Parameter in Docker-/Host-Aufrufe.

### Endpunkte (Stand Step 006)

| Methode | Pfad | Zweck |
|---------|------|-------|
| GET | `/health` | Status & Uptime (offen, Liveness) |
| GET | `/version` | Name/Version/NDF-Step (offen) |
| GET | `/system/snapshot` | **read-only** Systemdaten für Preflight (Token-gated, wenn gesetzt) |
| GET | `/docker/inventory` | **read-only** Inventar der SpeakCore-managed Docker-Ressourcen (Token-gated) |
| POST | `/docker/provision/prepare` | **write** (Flag-gated): managed **Network + Volume** anlegen (kein Container) |
| POST | `/docker/provision/create-container` | **write** (Flag-gated): managed **Container erstellen** (`docker create`, **kein Start**) |
| POST | `/docker/provision/start-container` | **write** (Flag-gated): managed **Container starten** (`docker start`, Lizenzzustimmung nötig) |
| POST | `/docker/provision/stop-container` | **write** (Flag-gated): managed **Container stoppen** (`docker stop`, kein rm/restart) |
| POST | `/docker/provision/container-status` | **read-only** (Token-gated): managed **Laufzeitstatus** (`docker container ls`, kein inspect/logs) |

## `/system/snapshot` – was gelesen wird (Step 006/007)

**Gelesen (lesend, ungefährlich):**
- **System (Step 006):** CPU-Kerne & Architektur, RAM gesamt/frei, freier Speicher am
  **Agent-Datenpfad**, OS/Plattform/Release, Node-/Agent-Version, Docker- & Compose-Verfügbarkeit
  (+ Version via `docker --version` / `docker compose version`).
- **Umgebung (Step 007):** `systemd-detect-virt` (Fallback `/proc/1/cgroup`) → VM / Container /
  Bare Metal / Unknown. Bei Unsicherheit `unknown` + `confident:false` (kein Raten).
- **Netzwerk (Step 007):** aus `os.networkInterfaces()` + `dns.getServers()` nur **Booleans/Anzahl**:
  IPv4/IPv6 vorhanden, externe Schnittstelle vorhanden, Interface-Anzahl, DNS konfiguriert (+Anzahl).
  **Keine IP-Adressen/Interface-Namen** – Screenshot-/Datenschutz-sicher.

**Ausdrücklich NICHT:** keine Container-Operationen (`ps`/`inspect`/`run`/Start/Stop), **kein
Docker-Socket** (`/var/run/docker.sock`), keine Portscans, keine Firewall-/Host-Änderungen, **keine
externen Requests/IP-Checks**, keine Router-/NAT-/UPnP-Aktionen, keine aktive Erreichbarkeitsprüfung,
keine TS3-Verbindung. CLI-Aufrufe nur mit **statischen Argumenten** über `execFile` (keine Shell →
keine Command-Injection) mit **Timeout**. Ist Docker/Umgebung nicht ermittelbar, lautet der Wert
`unknown` (nie fälschlich `absent`) – die WebUI mappt das zu „gelb", nie zu falschem „grün".

> **Öffentliche Erreichbarkeit** (offene Ports, NAT, Firewall von außen) wird **nicht** geprüft –
> das erfordert aktive/externe Tests und ist einem späteren, gesonderten Step mit eigenem
> Sicherheitskonzept vorbehalten.

> Warum kein Docker-Socket? Ein gemounteter Docker-Socket entspricht faktisch Root auf dem Host.
> Für reine Systeminformationen ist er unnötig und würde die Angriffsfläche massiv erhöhen. Eine
> sichere Docker-**Verwaltung** (Steuerung) folgt erst in späteren Steps mit eigenem Sicherheitskonzept.

## Docker Safety Foundation (Step 010 – Konzept, keine Ausführung)

Der Agent ist **kein allgemeines Docker-Admin-Interface**. Für die spätere TS3-Installation gilt
([ADR-0019](../../project-brain/DECISIONS.md)/[ADR-0020](../../project-brain/DECISIONS.md)):

- **Managed-Only:** nur selbst erzeugte Ressourcen (Labels `speakcore.managed=true`,
  `speakcore.project`, `speakcore.instanceId`, `speakcore.service`; Namenspräfixe
  `speakcore-ts3-<id>`, `speakcore-volume-ts3-<id>`, `speakcore-network-voice`).
- **Aktions-Allowlist** (`AgentActionType`): PLAN/VALIDATE, CREATE/START/STOP/REMOVE (managed),
  ROLLBACK – nichts darüber hinaus.
- **Docker-CLI mit intern erzeugten, statischen Argumenten** aus einem **validierten Plan**;
  **keine freien Nutzerparameter**. **Kein Docker-Socket in WebUI/Web-Container.**
- **Immer verboten:** privileged, Docker-Socket-Mount, Host-Mounts/Pfade, freie Docker-Args,
  Images außerhalb der Allowlist, reservierte Ports im Simple Mode.
- **Blueprint/Validierung:** `createTs3ProvisioningPlan` / `validateTs3ProvisionInput`
  (`@speakcore/shared/provisioning`) – rein, getestet, **ohne** jede Docker-Aktion.
- **Rollback & Audit** als deklarative Planstruktur; Secrets werden nie geloggt (RISKS R-14).

> **Step 010 installiert nichts.** Echte Docker-Aktionen kommen erst nach diesem Sicherheitsfundament.

## `/docker/inventory` – read-only Managed-Only-Inventar (Step 011)

Erste echte Docker-Nähe, **ausschließlich lesend**. Der Agent listet **nur** SpeakCore-managed
Ressourcen (Filter `label=speakcore.managed=true`):

- Abfragen via `execFile` (statische Argumente, Timeout, keine Shell): `ps` / `volume ls` /
  `network ls` mit statischem `--format`. Ein reiner Parser trennt die Ausgabe und wendet einen
  **Managed-Only-Guard** an (nicht-verwaltete Ressourcen werden verworfen).
- Das DTO enthält je Ressource nur `id`/`name`, `kind`, `managed`, optional `instanceId`/`service`/
  `state` und die **gefilterten SpeakCore-Labels** – **keine** Rohobjekte, **keine** Details fremder
  Ressourcen. Fremde Ressourcen werden **nicht** enumeriert.
- **Verboten/nicht enthalten:** Erstellen/Starten/Stoppen/Entfernen, Container-Inspektion,
  Kommando-Ausführung im Container, Datei-Kopie, Compose, **Docker-Socket**. Nicht verfügbar ⇒
  `status: "unavailable"` (kein Crash).

> Read-only Inventar seit Step 011.

## `/docker/provision/prepare` – erste Write-Aktion: Network & Volume (Step 012)

Erste **schreibende** Docker-Funktion, extrem eng begrenzt ([ADR-0021](../../project-brain/DECISIONS.md)):

- **Nur** managed **Network** (`speakcore-network-voice`) + **Volume** (`speakcore-volume-ts3-<id>`)
  mit SpeakCore-Labels. **Kein Container, kein TS3-Start, kein Entfernen.**
- **Zwei Schutzschichten:** Token-Gate **und** Feature-Flag `AGENT_DOCKER_WRITE_ENABLED`
  (Default `false` ⇒ Antwort `writeDisabled`, keine Aktion).
- **Re-Validierung** des Inputs mit der Step-010-Logik; Ressourcen entstehen nur aus dem intern
  gebauten, validierten Plan – **keine** freien Docker-Parameter (Image/Args/Host-Mount/privileged/
  Socket). Docker-CLI via `execFile`, statische Argumente, Timeout, keine Shell.
- **Idempotenz:** managed vorhanden ⇒ `exists`; **Konflikt:** gleichnamige, nicht verwaltete
  Ressource ⇒ `conflict` (nicht anfassen/verändern/löschen). Nicht verfügbar ⇒ `unavailable`.
- **Rollback** nur **deklarativ** (was in diesem Lauf erzeugt wurde); **kein** automatisches
  `rm` in diesem Step. Ergebnis enthält **keine** Secrets.

**Web-Auslösung (Step 013):** nur **OWNER** über eine Server Action (`/servers/provision`); der
Browser ruft den Agent **nie** direkt auf, Agent-URL/Token bleiben serverseitig. Der Agent-Response
wird normalisiert und als **Audit-Events** (ohne Secrets) in der Web-DB persistiert.

## `/docker/provision/create-container` – Container erstellen ohne Start (Step 017)

Erste **echte Container-Erstellung** – bewusst getrennt vom Start ([ADR-0023](../../project-brain/DECISIONS.md)):

- **Nur `docker create`** (nie `run`/`start`) eines managed Containers (`speakcore-ts3-<id>`) aus dem
  revalidierten Plan: festes Netzwerk, **named Volume** (`-v name:/var/ts3server`, **kein Host-Pfad**),
  Ports (voice/udp, query/tcp, filetransfer/tcp), Restart-Policy aus Allowlist, Managed-Labels.
- **Zwei Schutzschichten** wie bei prepare: Token-Gate **und** `AGENT_DOCKER_WRITE_ENABLED`
  (`false` ⇒ `writeDisabled`). `execFile`, statische Argumente, keine Shell, kein Socket.
- **Secret per ENV:** das ServerQuery-Admin-Passwort wird **serverseitig** entschlüsselt, dem Agent
  übergeben und als `TS3SERVERQUERY_ADMIN_PASSWORD` gesetzt ⇒ **kein** Zufallspasswort in den Logs,
  **kein Log-Lesen** (R-14 geschlossen). Secret erscheint **nie** im Ergebnis/Audit/Log.
- **Idempotenz:** managed Container vorhanden ⇒ `exists` (kein Create). **Konflikt:** gleichnamiger,
  nicht verwalteter Container ⇒ `conflict` (nicht anfassen). Docker nicht verfügbar ⇒ `unavailable`.
- **Kein** `stop/rm/inspect/exec/cp/logs`, **kein** compose, **kein** Start, **keine** Healthchecks/
  Portprüfung. Quell-Scan-Tests erzwingen die verbotenen Kommandos.

**Web-Auslösung (Step 017):** OWNER-only Server Action (`/servers/[id]`, Button „Container erzeugen");
Status `CONTAINER_PENDING → CONTAINER_CREATED`. Bei Fehler bleibt der Status `CONTAINER_PENDING` mit
generischem Fehlerschlüssel (kein Roh-Agent-/Secret-Leak).

## `/docker/provision/start-container` – Container starten mit Lizenzzustimmung (Step 018)

Erster **Start** eines bereits erstellten managed Containers ([ADR-0024](../../project-brain/DECISIONS.md)):

- **Nur `docker start speakcore-ts3-<instanceId>`** (nie `run`/`create`); der Name wird aus der
  `instanceId` abgeleitet und der Container muss ein gültiges **Managed-Label** tragen (sonst
  `conflict`/`notFound`). Vorprüfung nur über managed-gefilterte Listen (`container ls [--all] --filter …`).
- **Zwei Schutzschichten:** Token-Gate **und** `AGENT_DOCKER_WRITE_ENABLED` (`false` ⇒ `writeDisabled`).
  `execFile`, statische Argumente, keine Shell, kein Socket. **Keine** Secrets im Request/Ergebnis.
- **Lizenzzustimmung:** Der Start-Request muss `licenseAccepted === true` enthalten (Defense-in-Depth
  zusätzlich zur Web-Checkbox), sonst wird nicht gestartet. **`TS3SERVER_LICENSE`** wird bereits beim
  Create gesetzt (ENV lässt sich beim Start nicht ergänzen) – der Serverlauf wird durch die Zustimmung
  freigegeben.
- **Idempotenz:** läuft bereits ⇒ `running` (kein Start). **Konflikt:** fremder gleichnamiger Container
  ⇒ `conflict`. Fehlt ⇒ `notFound` (kein falscher RUNNING). Docker nicht verfügbar ⇒ `unavailable`.
- **Kein** `run/create/stop/rm/inspect/exec/cp/logs`, **kein** compose, **kein** Log-Lesen, **keine**
  Portprüfung/Healthchecks/ServerQuery. Quell-Scan-Tests erzwingen die verbotenen Kommandos.

**Web-Auslösung (Step 018):** OWNER-only Server Action (`/servers/[id]`, **Lizenz-Checkbox** + Button
„Container starten"); Status `CONTAINER_CREATED → RUNNING`. Ohne Zustimmung `licenseRequired` (kein Start).
Bei Fehler bleibt der Status `CONTAINER_CREATED` mit generischem Fehlerschlüssel.

## `/docker/provision/stop-container` – Container stoppen (Step 021)

Kontrolliertes **Stoppen** eines laufenden managed Containers ([ADR-0025](../../project-brain/DECISIONS.md)):

- **Nur `docker stop --time 3 speakcore-ts3-<instanceId>`** (nie `rm`/`restart`/`start`); Name aus
  `instanceId` abgeleitet, **managed-/instanceId-Label** geprüft (sonst `conflict`/`notFound`). Feste,
  interne Kulanzzeit `--time 3` (SIGTERM, dann SIGKILL) hält den Stop im CLI-Timeout. Vorprüfung nur über
  managed-gefilterte Listen (`container ls [--all] --filter label=…`).
- **Token + `AGENT_DOCKER_WRITE_ENABLED`** (`false` ⇒ `writeDisabled`). `execFile`, statische Argumente,
  keine Shell, kein Socket. **Keine** Secrets im Request/Ergebnis.
- **Idempotenz:** läuft nicht mehr ⇒ `alreadyStopped` (kein Stop). **Konflikt:** fremder gleichnamiger
  Container ⇒ `conflict`. Fehlt ⇒ `notFound`. Docker nicht verfügbar ⇒ `unavailable`.
- **Keine Löschung** (Container/Volume/Network bleiben), **kein** `rm/restart/inspect/exec/cp/logs`, **kein**
  compose, **kein Log-Lesen**. Quell-Scan-Tests erzwingen die verbotenen Kommandos.

**Web-Auslösung (Step 021):** OWNER-only Server Action (`/servers/[id]`, Stop-Button **mit Bestätigung**);
Status `RUNNING → CONTAINER_CREATED` + `runState='stopped'`. Bei Fehler bleibt der Status `RUNNING` mit
generischem Fehlerschlüssel. **Restart/Remove** folgen als eigene Steps.

## `/docker/provision/container-status` – read-only Laufzeitstatus (Step 019)

**Read-only** Healthcheck-Baustein (nur Token-Gate, **kein** Write-Flag):

- Ermittelt via **`docker container ls`** mit **Label-Filtern** (`speakcore.managed=true` +
  `speakcore.instanceId=<id>`, plus `--all` für gestoppte) bzw. dem intern abgeleiteten Namen den
  normalisierten Zustand: `running | created | exited | notFound | conflict | unavailable | error`.
- **Kein** `inspect`/`logs`/`exec`/`start`/`stop`/`rm`/`run`/`create`, kein compose, kein Socket,
  **kein Log-Lesen**, keine Portscans. `execFile`, statische Argumente, keine Shell. **Keine** fremden
  Containerdetails/Roh-Ausgaben – nur der normalisierte Status.
- **Lifecycle vs. Ist-Zustand:** Der Web-Healthcheck (`core/managed-health`) speichert den Ist-Zustand
  in separaten Feldern (`containerRuntimeStatus`, `ts3ReachabilityStatus`, `lastHealthCheckedAt`,
  `lastSuccessfulHealthCheckAt`, `lastHealthErrorKey`); **`provisioningStatus` bleibt** `RUNNING`.
- **Optionaler TS3-Check** (read-only `login/use/serverinfo`) nur bei laufendem Container **und**
  konfigurierter Query-Adresse; sonst `ts3ReachabilityStatus = notConfigured` (kein Raten/Portscan).

**Web-Auslösung (Step 019):** OWNER-only Server Action (`/servers/[id]`, Button „Status prüfen") für
managed Server mit Status `RUNNING`. **Keine** automatische Reparatur, **keine** Stop-/Remove-Aktion.

> **TS3-ServerQuery-Connect** mit erreichbarer Query-Adresse für managed Server und **Stop** folgen
> als eigene, geprüfte Steps.

## Sicherheitsprinzipien

- **Nicht öffentlich exponiert** (privates Compose-Netz / Loopback).
- **Least Privilege** – nur die wirklich benötigten Rechte.
- Jede privilegierte Aktion erzeugt einen **Audit-Log**-Eintrag.
- Roadmap-Härtung: mTLS / signierte Requests (siehe [ROADMAP.md](../../project-brain/ROADMAP.md)).

## Warum getrennt?

Die exponierte WebUI ist das primäre Angriffsziel. Durch die Trennung bleibt selbst bei einer
kompromittierten UI die Host-Kontrolle hinter einer zusätzlichen Vertrauensgrenze
(siehe [RISKS.md](../../project-brain/RISKS.md) R-01).
