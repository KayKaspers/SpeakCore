# SpeakCore Agent

> Privilegierter Dienst. Maßgeblich: [ARCHITECTURE.md](../../project-brain/ARCHITECTURE.md) §3.3,
> [SECURITY.md](../../project-brain/SECURITY.md), [ADR-0004/0005](../../project-brain/DECISIONS.md).

## Zweck

Der Agent ist die **einzige** Komponente mit Docker-/Host-Rechten. Er führt alle privilegierten
Operationen aus, die WebUI und API selbst nicht ausführen dürfen.

## Verantwortlichkeiten (0.1)

- TS3-Server als Docker-Container provisionieren, starten, stoppen, neustarten.
- Logs einsammeln und an die API liefern.
- **Volume-Backups** in ein serverseitiges Verzeichnis (seit Step 032; **kein** Restore/Import in 0.1).
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
| POST | `/docker/provision/remove-container` | **write** (Flag-gated): managed **Container entfernen** (`docker rm`, kein -f/-v, nur gestoppt) |
| POST | `/docker/provision/remove-volume` | **write** (Flag-gated): managed **Datenvolume entfernen** (`docker volume rm`, kein -f, nur ohne Container) |
| POST | `/docker/provision/remove-network` | **write** (Flag-gated): managed **Voice-Network entfernen** (`docker network rm`, kein -f, nur wenn kein managed Container) |
| POST | `/docker/provision/backup-volume` | **write** (Flag-gated): managed **Volume-Backup** (read-only Quelle → serverseitiges `AGENT_BACKUP_DIR`, festes Image, nur ohne Container) |
| POST | `/docker/provision/list-backups` | **read-only** (Token-gated, ohne Write-Flag): **Backup-Liste** aus `AGENT_BACKUP_DIR` (kein Docker, kein execFile, kein Download/Restore/Delete) |
| POST | `/docker/provision/verify-backup` | **read-only** (Token-gated, ohne Write-Flag): **Backup-Verify** – SHA-256 neu berechnen + mit metadata.json vergleichen (keine Schreibaktion) |
| GET | `/docker/provision/download-backup` | **read-only** (Token-gated, ohne Write-Flag): **Backup-Stream** – genau eine strikt validierte tar.gz aus `AGENT_BACKUP_DIR` (nie metadata.json, kein Listing/Entpacken) |
| POST | `/docker/provision/backfill-backup-checksum` | **metadata-write** (Token-gated, ohne Docker-Write-Flag): **SHA-256 nachtragen** – nur metadata.json wird normalisiert ergänzt, tar.gz bleibt unverändert |
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

## `/docker/provision/remove-container` – Container entfernen (Step 022)

Kontrolliertes **Entfernen** eines **gestoppten** managed Containers ([ADR-0026](../../project-brain/DECISIONS.md)):

- **Nur `docker rm speakcore-ts3-<instanceId>`** (nie `-f`/`-v`, nie `volume`/`network` rm, nie
  `run/create/start/stop/restart`); Name aus `instanceId` abgeleitet, **managed-/instanceId-Label** geprüft.
  Vorprüfung nur über managed-gefilterte Listen (`container ls [--all] --filter label=…`).
- **Token + `AGENT_DOCKER_WRITE_ENABLED`** (`false` ⇒ `writeDisabled`). `execFile`, statische Argumente,
  keine Shell, kein Socket. **Keine** Secrets im Request/Ergebnis.
- **Nur gestoppte** Container: läuft er noch ⇒ `stillRunning` (kein Remove). Fremder gleichnamiger
  Container ⇒ `conflict`. Fehlt er ⇒ `alreadyRemoved` (idempotent). Docker nicht verfügbar ⇒ `unavailable`.
- **Keine Löschung von Volume/Network/Credentials/ServerInstance** – nur der Container wird entfernt.
  **Kein** `inspect/exec/cp/logs`, **kein** compose, **kein Log-Lesen**. Quell-Scan-Tests erzwingen die
  verbotenen Kommandos.

**Web-Auslösung (Step 022):** OWNER-only Server Action (`/servers/[id]`, Entfernen-Button **mit deutlicher
Bestätigung**); Status `CONTAINER_CREATED → RESOURCES_PREPARED` + `runState='unknown'`. Bei laufendem
Container `stillRunning` (zuerst stoppen). **Volume-/Network-Remove** und vollständiges **Deprovisioning**
folgen als eigene, deutlich gefährlichere Steps.

## Restart (Step 023) – **kein** neuer Agent-Endpunkt

Der **Neustart** führt **kein** `docker restart` und **keinen** neuen Agent-Endpunkt ein. Er ist eine reine
**Web-Orchestrierung** (`core/container-restart`): `RUNNING → Stop → Start → RUNNING` über die bestehenden
Endpunkte `/docker/provision/stop-container` (Step 021) und `/docker/provision/start-container` (Step 018).
Damit gelten deren Sicherheitsgrenzen (Token + `AGENT_DOCKER_WRITE_ENABLED`, Managed-Only) automatisch.
Details: [ADR-0027](../../project-brain/DECISIONS.md).

## Deprovisioning (Step 024) – **kein** Agent-Endpunkt, keine Löschung

Der **Deprovisioning-Blueprint** ist **reine Guard-/Planungslogik** in `@speakcore/shared`
(`deprovision.ts`, `executable: false`) und führt **nichts** aus: **kein** neuer Agent-Endpunkt, keine echte
Löschung. Spätere echte Remove-Aktionen dürfen nur über **Managed-Only-Guards** laufen (Labels
`speakcore.managed=true`/`project`/`instanceId`/`service`, **kein** `-f`, kein Wildcard, keine freien Namen).
Details: [ADR-0028](../../project-brain/DECISIONS.md).

## `/docker/provision/remove-volume` – Datenvolume entfernen (Step 025)

Erste **echte, irreversible** Löschung ([ADR-0029](../../project-brain/DECISIONS.md)):

- **Nur `docker volume rm speakcore-volume-ts3-<instanceId>`** (**kein `-f`**, nie `network`/`container` rm);
  Name aus `instanceId`, **managed-/instanceId-Label** geprüft. Vorprüfung nur über managed-gefilterte Listen.
- **Token + `AGENT_DOCKER_WRITE_ENABLED`** (`false` ⇒ `writeDisabled`). **Nur wenn kein managed Container**
  dieser `instanceId` mehr existiert (`containerStillExists` sonst). Fehlt das Volume ⇒ `alreadyRemoved`;
  fremdes gleichnamiges Volume ⇒ `conflict`; Docker nicht verfügbar ⇒ `unavailable`.
- **Keine** Network-/Container-/Credential-/ServerInstance-Löschung, **kein** `inspect/exec/cp/logs`, **kein**
  Log-Lesen. Web erzwingt zusätzlich **Doppelbestätigung** (`confirmVolumeDataLoss` + `confirmBackupRecommended`
  + getippt `DELETE VOLUME`) über den Step-024-Guard. Quell-Scan-Tests erzwingen die verbotenen Kommandos.

**Web-Auslösung (Step 025):** OWNER-only Server Action (`/servers/[id]`, **Gefahrenzone** mit
Doppelbestätigung); `provisioningStatus` bleibt `RESOURCES_PREPARED`, `managedVolumeState='removed'`.

## `/docker/provision/remove-network` – Voice-Network entfernen (Step 026)

Entfernt das **geteilte** managed Voice-Network ([ADR-0030](../../project-brain/DECISIONS.md)):

- **Nur `docker network rm speakcore-network-voice`** (**kein `-f`**, nie `volume`/`container` rm); **fester**
  Name (keine freien Namen vom Client). Vorprüfung nur über managed-gefilterte Listen (`container ls`,
  `network ls --filter label=…service=voice-network`).
- **Token + `AGENT_DOCKER_WRITE_ENABLED`** (`false` ⇒ `writeDisabled`). **Nur wenn kein managed Container**
  (irgendeiner) mehr existiert (`inUseByManagedContainers` sonst). Fehlt das Network ⇒ `alreadyRemoved`;
  fremdes gleichnamiges Network ⇒ `conflict`; Docker nicht verfügbar ⇒ `unavailable`.
- **Keine** Volume-/Container-/Credential-/ServerInstance-Löschung, **kein** `inspect/exec/cp/logs`, **kein**
  Log-Lesen. Web erzwingt zusätzlich **`confirmNetworkUnused`** (Step-024-Guard). Quell-Scan-Tests erzwingen
  die verbotenen Kommandos.

**Web-Auslösung (Step 026):** OWNER-only Server Action (`/servers/[id]`, **Gefahrenzone** mit Shared-Ressource-
Warnung + Bestätigung); **Option A** – **kein** ServerInstance-Statusfeld, nur Audit (Target = auslösende
ServerInstance-ID). **ServerRecord-Archive** folgt als eigener Step.

## `/docker/provision/backup-volume` – echtes Volume-Backup (Step 032)

Erstes **echtes** Backup eines managed TS3-Datenvolumes ([ADR-0034](../../project-brain/DECISIONS.md)).
**Backup-Dateien sind potenziell sensibel.**

- **Erlaubtes Muster (einziges Write-Kommando dieses Endpunkts):** kurzlebiger, gelabelter Hilfscontainer
  `docker run --rm --name … --label speakcore.managed=true … -v <volume>:/data:ro -v <AGENT_BACKUP_DIR>:/backup
  alpine:3.20 tar -czf /backup/<datei> -C /data .` – ausschließlich **statische `execFile`-Argumente**,
  keine Shell, kein Socket. Quelle strikt **read-only** (`:ro`).
- **Serverseitig festgelegt:** Ziel (`AGENT_BACKUP_DIR`, Default `/var/lib/speakcore/backups`) und Image
  (`AGENT_BACKUP_IMAGE`, Default `alpine:3.20`, Existenz vorab per `image ls` geprüft – **kein**
  unkontrollierter Pull). Der Client liefert **nur** `instanceId` + Bestätigungen – **kein** Pfad, **kein**
  Image, **keine** Docker-Args (keine Pfad-Traversal-Möglichkeit; Dateiname wird intern generiert:
  `speakcore-backup-ts3-<instanceId>-<timestamp>.tar.gz` + `.metadata.json` ohne Secrets).
- **Token + `AGENT_DOCKER_WRITE_ENABLED`** (`false` ⇒ `writeDisabled`). **Konservativ:** blockiert
  (`containerStillExists`), wenn **irgendein** managed Container der `instanceId` existiert – realer Pfad:
  Stop → Container-Remove → Backup. Volume muss existieren **und** managed sein (`volumeNotFound`/
  `volumeNotManaged`), Verzeichnis verfügbar (`backupDirUnavailable`), Image vorhanden (`imageUnavailable`).
  Step-030-Guard `canBackupManagedVolume` wird agent-seitig erneut geprüft (`blocked`).
- **Kein** Restore/Import/Download, **keine** Remove-Kommandos, **kein** `inspect`/`exec`/`logs`.
  Ergebnis enthält **nur den Dateinamen** (kein Host-Pfad), keine Roh-Docker-Ausgabe, keine Secrets.
- **SHA-256-Prüfsumme (Step 034):** nach erfolgreichem Backup serverseitig gestreamt berechnet
  (`node:crypto`, kein execFile/Shell, kein Entpacken) und als `checksum`-Objekt in die
  `metadata.json` geschrieben; Response enthält `checksumSha256` (kein Secret). **Integrität,
  keine Verschlüsselung/Signatur.** Schlägt die Berechnung fehl, bleibt das Backup gültig
  (Metadaten dann ohne `checksum`). Audit nur als Event `checksumCreated`, ohne Wert.

**Web-Auslösung (Step 032):** OWNER-only Server Action (`/servers/[id]`, Gefahrenzone bei
`RESOURCES_PREPARED`, nicht archiviert, Volume nicht `removed`): 3 Checkboxen (sensible Daten /
Aufbewahrungsverantwortung / Container gestoppt) + getippt **`CREATE BACKUP`**. Audit:
`backup.managedVolume.requested/confirmed/blocked/started/completed/failed`.

## `/docker/provision/list-backups` – read-only Backup-Liste (Step 033)

**Reine Sichtbarkeit** vorhandener Volume-Backups (Token-Gate, **kein** Write-Flag nötig):

- **Kein Docker, kein `execFile`, keine Shell, kein Socket** – gelesen werden ausschließlich
  Verzeichniseinträge + `.metadata.json` aus **`AGENT_BACKUP_DIR`** (kein Pfad/Muster vom Client,
  keine Pfad-Traversal; Dateinamen kommen nur aus dem eigenen, gefilterten Listing).
- **Strikter Filter:** nur reguläre Dateien mit exaktem Muster
  `speakcore-backup-ts3-<instanceId>-<timestamp>.tar.gz` (fester Zeitstempel-Regex). Keine
  Subdirectories, keine Symlinks (Dirent-`isFile`), keine fremden Instanzen, keine sonstigen Dateien.
- **`tar.gz`-Inhalte werden nie gelesen/entpackt.** Die zugehörige `.metadata.json` (max. 64 KB) wird
  nur für exakt passende Backups gelesen und **Feld-für-Feld sanitisiert** (nur bekannte Felder;
  `instanceId` + `backupFileName` müssen passen, sonst `metadataStatus: invalid`; kein Roh-Dump).
  Ein `checksum`-Feld (Step 034) wird strikt validiert (`sha256`, exakt 64 Hex-Zeichen, `createdAt`);
  vorhanden-aber-ungültig ⇒ `invalid`, fehlend bleibt erlaubt (ältere Step-032-Backups).
- Antwort: nur **Dateiname** (kein Host-Pfad), Größe, Zeitstempel, Metadatenstatus
  (`present/missing/invalid`). Status: `ok/backupDirUnavailable/invalid/unavailable/error`.
- **Kein** Download, **kein** Restore, **kein** Delete, **keine** Dateiverwaltung.

**Web-Auslösung (Step 033):** OWNER-only Karte „Backups (nur Ansicht)" auf `/servers/[id]` (auch für
**archivierte** managed Server; External zeigt keine Karte). Laden erst per Klick; Web verwirft
verdächtige Antworten (`assertBackupListContainsNoSecrets`). Audit:
`backup.managedVolume.list.requested/completed/failed` – ohne Dateiliste/Metadaten/Host-Pfade.

## `/docker/provision/verify-backup` – read-only Backup-Verify (Step 035)

Nachträgliche **Integritätsprüfung** eines vorhandenen Backups (Token-Gate, **kein** Write-Flag):

- **Ablauf:** Datei existiert? → Metadaten existieren? → Metadaten sanitisieren (Step-033-Logik) →
  `checksum` vorhanden? → SHA-256 **neu berechnen** (gestreamt, kein Entpacken) → Vergleich ⇒
  `valid` oder `mismatch`. Weitere Status: `metadataMissing/checksumMissing/backupNotFound/`
  `metadataInvalid/invalid/backupDirUnavailable/error`.
- **Strikte Eingaben:** `instanceId` validiert; `fileName` muss **exakt** dem Step-032-Muster der
  Instanz entsprechen (kein `/`, kein `\`, kein `..`, keine Subdirectories, keine fremden
  Instanzen). Die Metadaten-Datei wird **intern** abgeleitet (`<backup>.metadata.json`) –
  kein Pfad vom Client, alle Zugriffe nur über `AGENT_BACKUP_DIR`.
- **Read-only per Konstruktion:** kein Docker, kein `execFile`, keine Shell, kein Socket,
  **keine Schreibaktion** (kein Nachrüsten fehlender Prüfsummen – Step-032-Backups ⇒
  `checksumMissing`), kein Download (Dateiinhalt verlässt den Agent nie).
- Response: nur Status, Dateiname, `sha256`, beide Prüfsummenwerte, `verifiedAt` –
  **keine** Host-Pfade, **keine** Roh-Metadaten, **keine** Secrets.

**Web-Auslösung (Step 035):** OWNER-only Button „Prüfsumme prüfen" pro Eintrag der Backup-Liste
(auch für **archivierte** managed Server; External abgelehnt), rate-limitiert; Ergebnis-Banner in
der Karte. Audit: `backup.managedVolume.verify.requested/completed/failed` + `verify.mismatch` –
bewusst **ohne Dateinamen/Prüfsummenwerte**.

## `/docker/provision/download-backup` – kontrollierter Backup-Stream (Step 037)

Umsetzung des Step-036-Blueprints ([ADR-0035/0036](../../project-brain/DECISIONS.md)):

- **GET mit `instanceId` + `fileName`** (Token-Gate, **kein** Write-Flag). Beide strikt validiert:
  exaktes Step-032-Muster der Instanz, **nur `.tar.gz`** (nie `.metadata.json`), kein `/`, kein
  `\`, kein `..`, keine Subdirectories/fremden Instanzen. **Kein Directory Listing** – genau eine
  konkret benannte Datei aus `AGENT_BACKUP_DIR`.
- **Streaming ohne Komplett-Einlesen:** ReadStream → Response (Backpressure via pipe) mit
  `application/gzip`, `content-length` und `content-disposition: attachment`. **Kein** Entpacken,
  **kein** Docker/Prozessaufruf, **keine** Schreibaktion, **kein** Loggen von Inhalten.
- Fehler nur als normalisierte Codes (400 `invalid` / 404 `backupNotFound` / 503
  `backupDirUnavailable`) – **keine Host-Pfade, keine Roh-Fehler**.

**Web-Auslösung (Step 037):** `POST /[locale]/servers/[id]/backups/download` (OWNER-only
Route Handler): Bestätigungen ohne Defaults (2 Checkboxen + getippt **`DOWNLOAD BACKUP`**) →
**Rate-Limit 5/h je Owner+Server** → **Verify direkt vor Download** (nur `valid` streamt) →
Agent-Stream wird **ohne Buffering** an den Browser durchgereicht. **Nie Browser→Agent**;
Agent-URL/Token bleiben serverseitig. Audit `backup.managedVolume.download.*` ohne Dateiname/
Prüfsumme; `started` ist der letzte zuverlässige Audit-Punkt (kein behauptetes `completed`).

## `/docker/provision/backfill-backup-checksum` – Prüfsumme nachtragen (Step 038)

Bewusste Owner-Aktion für **Step-032-Backups ohne Prüfsumme** (Token-Gate; **kein**
Docker-Write-Flag, weil keine Docker-Aktion – die Datei-Schreibaktion ist durch
`confirmChecksumBackfill` + OWNER-Flow im Web gedeckt):

- **Strikte Eingaben** wie beim Verify: `instanceId` + exaktes Dateinamensmuster (kein `/`/`\`/
  `..`, keine fremden Instanzen); die Metadaten-Datei wird intern abgeleitet.
- **Ablauf:** Backup existiert? → Metadaten existieren + gültig (Step-033-Sanitisierung)? →
  Prüfsumme vorhanden ⇒ **`alreadyPresent`, keine Schreibaktion** (idempotent, nie überschreiben)
  → sonst SHA-256 gestreamt berechnen → `.metadata.json` **normalisiert** neu schreiben
  (**kein Blind-Merge**: nur bekannte Felder + `checksum`; eingeschleuste unbekannte/Secret-artige
  Felder fallen weg) ⇒ `updated`.
- Die **tar.gz wird nur gelesen (Hash), nie verändert/entpackt**; keine Host-Pfade/Roh-Metadaten
  in Responses. Status: `updated/alreadyPresent/metadataMissing/metadataInvalid/backupNotFound/`
  `invalid/backupDirUnavailable/error`.

**Web-Auslösung (Step 038):** OWNER-only Button „Prüfsumme nachtragen" pro Backup-Eintrag – nur
sichtbar bei gültigen Metadaten **ohne** Prüfsumme (auch für archivierte managed Server; External
abgelehnt), rate-limitiert; Ergebnis-Banner in der Backup-Liste. Audit:
`backup.managedVolume.checksumBackfill.requested/completed/failed/alreadyPresent` – ohne
Dateiname/Prüfsumme.

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
