# CHANGELOG.md – SpeakCore Suite

> Format orientiert an [Keep a Changelog](https://keepachangelog.com/) ·
> Versionierung nach [SemVer](https://semver.org/).

## [Unreleased]

### NDF Step 028 – Archiv-Ansicht & Serverlisten-Filter (2026-07-02)

> Kleine, **risikoarme** UI-Ergänzung: archivierte Server (Step 027) auffindbar machen. **Keine** neue
> Schreib-/Lifecycle-/Docker-/Agent-Aktion, **kein** Hard-Delete, **kein** Unarchive.

#### Added
- **`listServers({ view })`** (`view: 'active' | 'archived'`, Default `active`) + reine Helfer
  (`src/core/servers-list.ts`): `normalizeServerListView` (untrusted Query-Param → gültige Ansicht),
  `serverListWhere` (aktiv = `archivedAt: null`, archiviert = `archivedAt != null`). Aktive Liste bleibt
  frei von archivierten Servern.
- **UI (`/servers`):** **Tabs „Aktiv | Archiviert"** (via `?view=`). Archivierte Ansicht zeigt pro Server
  **Archiv-Badge**, **Archivierungsdatum** und **Credential-Status** (behalten/gelöscht), plus Hinweis
  „Archivierte Server sind nicht aktiv und bieten keine Lifecycle-Aktionen". Eigener **Empty-State**
  („Keine archivierten Server"). Aktive Ansicht unverändert.
- Die **archivierte Detailseite** (Step 027) zeigt weiterhin nur Status/Info – **keine** Lifecycle-/
  Deprovisioning-/Credential-/Unarchive-Aktion.
- Tests: `serverListWhere`/`normalizeServerListView` (aktiv/archiviert), Quell-Scan (kein Docker/Agent/
  `execFile`, **keine Lifecycle-Write-Aktion aus der Liste**, kein Secret). **313 Tests grün.**

#### Security
- **Rein lesend:** keine neue Schreibaktion, **keine Docker-/Agent-Imports**, keine Secrets im Client,
  **keine Lifecycle-Aktionen bei archivierten Servern**, **kein Hard-Delete/Unarchive/Credential-Änderung/
  Audit-Löschung**. Quell-Scan-Tests erzwingen dies.

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (313) · `prisma validate` n. z.
  (kein Schema-Change).

### NDF Step 027 – Archive Managed ServerRecord & Credential Decision (2026-07-02)

> Abschließender Deprovisioning-Schritt. **Rein Web-/DB-seitig – keine Docker-/Agent-Aktion.**
> **Archivieren statt hart löschen**; Credential-Löschung nur bei ausdrücklicher Entscheidung.

#### Added
- **Web-Service** `archiveManagedServer` (`src/core/server-archive.ts`) + reine Helfer
  (`server-archive-helpers.ts`) + **OWNER-only Server Action** `archiveServerAction` (rate-limitiert).
  **Kein Docker/Agent.** Nutzt den **Step-024-Guard** `canArchiveManagedServer`; nur `RESOURCES_PREPARED`,
  managed (external abgelehnt), mit `confirmServerRecordArchive` + Credential-Entscheidung + getippt
  **`ARCHIVE SERVER`**.
- **Archivieren statt löschen** ([ADR-0031](DECISIONS.md)): `archivedAt`/`archiveReasonKey='deprovisioned'`
  gesetzt, **`ServerInstance` bleibt** (kein Hard-Delete), **Audit-Historie unangetastet**. Idempotent
  (`alreadyArchived`).
- **Bewusste Credential-Entscheidung:** `keep` ⇒ Credential bleibt verschlüsselt; `remove` ⇒
  `ServerCredential` gelöscht + `credentialsRemovedAt` gesetzt. **Keine automatische Löschung** ohne Wahl.
- **Prisma:** `archivedAt`/`archiveReasonKey`/`credentialsRemovedAt` (Migration `20260702140000_add_server_archive`).
  `/servers` blendet archivierte Server aus (`listServers` filtert `archivedAt: null`).
- **UI (DE/EN):** Abschnitt „Deprovisioning abschließen" (Gefahrenzone, `RESOURCES_PREPARED`) mit Checkbox +
  **Credential-Radio (keep/remove, kein Default)** + getippter Bestätigung. Archivierte Detailseite zeigt
  Archiv-Status + Credential-Info und **keine** Lifecycle-Aktionen.
- **Audit:** `deprovision.serverArchive.requested/confirmed/blocked/completed/failed`,
  `deprovision.credentials.keepConfirmed/removeConfirmed/removed`, `deprovision.server.archived`
  (Target = ServerInstance-ID, **keine Secrets**).
- Tests: Guard (nur RESOURCES_PREPARED, fehlende Archiv-/Credential-Bestätigung, typedMismatch), Audit
  (keep/remove/blocked, keine Secrets), **Quell-Scan (kein Docker/Agent/`execFile`)**. **308 Tests grün.**
  DB-Smoke: keep behält Credential, remove löscht Credential + `credentialsRemovedAt`, **kein Hard-Delete**,
  RUNNING⇒invalidState, external⇒notManaged, Audit erhalten.

#### Security
- OWNER-only; **keine Docker-Aktion, kein Agent-Aufruf**, keine Secrets im Client/Audit/Ergebnis.
  **Keine Credential-Löschung ohne ausdrückliche Entscheidung**, **kein Hard-Delete** der ServerInstance,
  **keine Audit-Löschung**, **kein** versehentliches Archivieren von External-Servern. Archivierte Server
  bieten **keine** Lifecycle-Aktionen mehr. Quell-Scan-Test schützt vor Docker-/Agent-Import. **[ADR-0031](DECISIONS.md).**

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (308) · `prisma validate` ✅.

### NDF Step 026 – REMOVE_MANAGED_NETWORK mit Shared-Network-Schutz (2026-07-02)

> Kontrolliertes Entfernen des **geteilten** managed Voice-Networks. **Kein Force**; nur wenn **kein
> einziger** managed Container mehr existiert; mit bewusster Bestätigung.

#### Added
- **Agent-Aktion `removeTs3Network`** (`apps/agent/src/docker-network-remove.ts`) + Endpunkt
  **`POST /docker/provision/remove-network`** (Token-Gate + `AGENT_DOCKER_WRITE_ENABLED`): **`docker network
  rm speakcore-network-voice`** (nie `-f`, nie `volume`/`container` rm), **fester** Network-Name (keine freien
  Namen). **Shared-Guard:** solange **irgendein** managed Container existiert ⇒ `inUseByManagedContainers`.
  Fehlt das Network ⇒ `alreadyRemoved`; fremdes Network ⇒ `conflict`. Status `removed | alreadyRemoved |
  inUseByManagedContainers | conflict | error | writeDisabled | unavailable`.
- **Web-Service** `removeManagedNetworkForServer` (`src/core/network-remove.ts`) + reine Helfer
  (`network-remove-helpers.ts`) + **OWNER-only Server Action** `removeNetworkAction` (rate-limitiert).
  Bestätigungs-Vorprüfung über den **Step-024-Guard** `canRemoveManagedNetwork` (`confirmNetworkUnused`);
  der Agent re-verifiziert real „kein managed Container".
- **Option A ([ADR-0030](DECISIONS.md)):** **kein** ServerInstance-Statusfeld für das Network (globale
  Ressource) – nur Audit + UI-Hinweis; der Web-Service ändert **keinen** ServerInstance-Status (per Test).
  **Container, Volumes, Credentials und ServerInstance bleiben unangetastet.**
- **UI (DE/EN):** Abschnitt „Voice-Netzwerk entfernen" in der **Gefahrenzone** (`RESOURCES_PREPARED`) mit
  **Shared-Ressource-Warnung** + Bestätigungs-Checkbox; deutlicher Hinweis, dass Container/Volumes/
  Servereinträge/Zugangsdaten **nicht** gelöscht werden und das Netzwerk erneut erstellbar ist.
- **Audit:** `deprovision.networkRemove.requested/confirmed/blocked/completed/failed/conflict/inUse`,
  `deprovision.network.removed/alreadyRemoved` (Target = **auslösende** ServerInstance-ID, dokumentiert;
  Network ist global). **Keine Secrets/Roh-Ausgaben.**
- Tests: Agent (network rm **ohne `-f`**, kein volume/container rm, `inUseByManagedContainers`, alreadyRemoved,
  conflict, unavailable, error, Token/Flag-Gate, Quell-Scan) und Web (Bestätigungs-Guard, Audit, **Option-A-
  Nachweis: kein `serverInstance.update`**, Quell-Scan). **298 Tests grün.**

#### Security
- OWNER-only; Agent-Token/-URL nur serverseitig (kein Browser→Agent). **Kein Force**, **keine Löschung solange
  managed Container existieren**, **keine Volume-/Container-/Credential-/ServerInstance-Löschung**, kein
  `run/create/start/stop/restart/inspect/exec/cp/logs`, kein compose, kein Socket, keine fremde Ressource
  (fremdes Network ⇒ `conflict`). Kein Secret im Client/Audit/Response, **kein Log-Lesen**. Quell-Scan-Tests
  erzwingen die Verbote. **[ADR-0030](DECISIONS.md).**

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (298) · `prisma validate` n. z.
  (kein Schema-Change – Option A).

### NDF Step 025 – REMOVE_MANAGED_VOLUME mit Datenverlust-Schutz (2026-07-02)

> Erste **echte, irreversible** Löschung eines managed TS3-Datenvolumes. **Datenverlust!** Streng
> abgesichert; **kein Force**, nur ohne Container, mit mehrfacher Bestätigung.

#### Added
- **Agent-Aktion `removeTs3Volume`** (`apps/agent/src/docker-volume-remove.ts`) + Endpunkt
  **`POST /docker/provision/remove-volume`** (Token-Gate + `AGENT_DOCKER_WRITE_ENABLED`): **`docker volume
  rm <managed-volume>`** (nie `-f`, nie `network`/`container` rm) **nur** für ein managed Volume und **nur
  wenn kein managed Container** dieser `instanceId` mehr existiert. Status `removed | alreadyRemoved |
  containerStillExists | conflict | error | writeDisabled | invalid | unavailable`. Fehlt das Volume ⇒
  `alreadyRemoved` (idempotent); fremdes Volume ⇒ `conflict`.
- **Web-Service** `removeManagedVolumeForServer` (`src/core/volume-remove.ts`) + reine Helfer
  (`volume-remove-helpers.ts`) + **OWNER-only Server Action** `removeVolumeAction` (rate-limitiert).
  **Bestätigungs-Vorprüfung** über die **Step-024-Guard-Logik** `canRemoveManagedVolume`
  (`mapVolumeConfirmationGuard`): nur `RESOURCES_PREPARED` **und** `confirmVolumeDataLoss` +
  `confirmBackupRecommended` + getippt **`DELETE VOLUME`**. Der Agent re-verifiziert Container/Volume real.
- **Erhalten** ([ADR-0029](DECISIONS.md)): Credentials, `managedNetworkName`/`managedVolumeName` und der
  `ServerInstance`-Record bleiben unangetastet (reines `volumeRemoveSuccessUpdate` + Test). `provisioningStatus`
  bleibt `RESOURCES_PREPARED`; nur **`managedVolumeState='removed'`** markiert den Ist-Zustand.
- **UI (DE/EN):** **Gefahrenzone** auf der managed Detailseite (`RESOURCES_PREPARED`) mit Doppelbestätigung
  (zwei Checkboxen + getippte Eingabe `DELETE VOLUME`) und deutlichen Datenverlust-Hinweisen; nach Erfolg
  „Volume entfernt". **Keine** Network-/ServerInstance-/Credential-Lösch-Buttons.
- **Prisma:** `managedVolumeState` (Migration `20260702100000_add_managed_volume_state`).
- **Audit:** `deprovision.volumeRemove.requested/confirmed/blocked/completed/failed/conflict`,
  `deprovision.volume.removed/alreadyRemoved` (Target = ServerInstance-ID, **keine Secrets/Roh-Ausgaben**).
- Tests: Agent (volume rm **ohne `-f`**, kein network/container rm, containerStillExists, alreadyRemoved,
  conflict, unavailable, error, Token/Flag-Gate, Quell-Scan) und Web (Bestätigungs-Guard, Audit,
  Credentials/Network/Record bleiben via `volumeRemoveSuccessUpdate`, Quell-Scan). **280 Tests grün.**

#### Security
- OWNER-only; Agent-Token/-URL nur serverseitig (kein Browser→Agent). **Kein Force-Remove**, **keine
  Network-/Container-/Credential-/ServerInstance-Löschung**, kein `run/create/start/stop/restart/inspect/
  exec/cp/logs`, kein compose, kein Socket, keine fremde Ressource. Kein Secret im Client/Audit/Response,
  **kein Log-Lesen**. Datenverlust nur nach **Doppelbestätigung + getippter Bestätigung**. Quell-Scan-Tests
  erzwingen die Verbote. **[ADR-0029](DECISIONS.md).**

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (280) · `prisma validate` ✅.

### NDF Step 024 – Deprovisioning Safety Blueprint (2026-07-01)

> **Reines Sicherheits-/Planungsfundament – es wird NICHTS gelöscht.** Kein `docker volume rm`/`network
> rm`, kein neues Docker-Write-Kommando, kein Löschen von ServerInstance/Credentials, keine Migration.

#### Added
- **Reine, testbare Guard-/Planungslogik** (`packages/shared/src/provisioning/deprovision.ts`,
  über `@speakcore/shared`): `canRemoveManagedContainer`, `canRemoveManagedVolume`,
  `canRemoveManagedNetwork`, `canArchiveManagedServer`, `validateDeprovisioningRequest`,
  `buildDeprovisioningPlan`. Ergebnis (`DeprovisionEvaluation`) ist **immer `executable: false`**.
- **Stufenmodell** ([ADR-0028](DECISIONS.md)): (1) Container entfernen (live seit Step 022) → (2) Volume
  entfernen (**Datenverlust!**) → (3) Network entfernen → (4) ServerInstance archivieren. Jede Stufe mit
  klaren Guards, `dataLossRisk`, `warnings`, `rollbackLimitations`, geplanten `plannedActions`/`auditEvents`
  und deklarativem `nextSafeState`.
- **Bestätigungsmodell** (kein Vorab-Default): Volume-Löschung erfordert `confirmVolumeDataLoss` **und**
  `confirmBackupRecommended`; optionale getippte Bestätigung `DELETE VOLUME` (falls angegeben, muss sie
  passen). Network: `confirmNetworkUnused`. Archive: `confirmServerRecordArchive` + getroffene
  `confirmCredentialRemoval`-Entscheidung.
- **Managed-Only-Guards:** **fremde (nicht-managed) Ressourcen werden nie als löschbar geplant**
  (`volumeNotManaged`/`networkNotManaged` ⇒ `blocked`); geplante Namen stammen ausschließlich aus der
  `instanceId` (kein freier Nutzer-Input). Vordefinierte Audit-Events `deprovision.*` (keine Secrets).
- **UI (DE/EN):** nicht-ausführende **Info-Karte** auf der managed Detailseite (`RESOURCES_PREPARED`):
  „Deprovisioning noch nicht aktiv", Hinweis auf **Datenverlust** bei Volume-Löschung, echte Löschung
  folgt später. **Keine** Volume-/Network-/ServerInstance-Lösch-Buttons.
- Tests (shared): Volume blockiert bei vorhandenem Container/ohne Datenverlust-/Backup-Bestätigung/für
  fremdes Volume; Network blockiert bei Container/nicht-managed/in-use; fremde Ressourcen nie ausführbar;
  `executable===false`; kein Secret im Plan; **Quell-Scan (kein `docker volume rm`/`network rm`/`prisma`)**.
  **257 Tests grün.**

#### Security
- **Keine echte Löschung, keine neuen Docker-Kommandos, kein Socket/Logs/Inspect, keine Secrets.**
  Datenverlust-Risiko (Volume) explizit modelliert und in der UI benannt. Guards sind rein/testbar; kein
  UI-Button suggeriert echte Löschung. **[ADR-0028](DECISIONS.md).**

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (257) · `prisma validate` n. z.
  (kein Schema-Change).

### NDF Step 023 – Managed Restart Flow ohne `docker restart` (2026-07-01)

> Sicherer **Neustart** managed Container als **Stop→Start-Orchestrierung** (`RUNNING → Stop → Start →
> RUNNING`). **Kein** `docker restart`, **keine** neue Agent-Schreibaktion.

#### Added
- **Web-Orchestrator** `restartManagedContainerForServer` (`src/core/container-restart.ts`) + reine
  Helfer (`container-restart-helpers.ts`) + **OWNER-only Server Action** `restartContainerAction`
  (rate-limitiert). Nutzt **ausschließlich** die bestehenden **Stop**- (Step 021) und **Start**-Flows
  (Step 018) über deren Agent-Endpunkte – **kein** `docker restart`, kein neues Docker-Kommando.
- **Erneute Lizenzbestätigung** (Checkbox) beim Restart ([ADR-0027](DECISIONS.md)) – rechtlich sauber,
  ohne historische Audit-Auswertung. Ohne Zustimmung `licenseRequired` (kein Restart).
- **Fehlerhart getrennt:** Stop fehlgeschlagen ⇒ **kein Start**, Status bleibt `RUNNING`
  (`restartStopFailed`). Start fehlgeschlagen nach Stop ⇒ `CONTAINER_CREATED`/`runState='stopped'`
  (`restartStartFailed`). Erfolg ⇒ `RUNNING` + `runState='running'`. **Kein Reparaturverhalten** bei
  DB-/Ist-Inkonsistenz (nur `RUNNING` erlaubt; Healthcheck bleibt Ist-Quelle).
- **UI (DE/EN):** managed Detailseite bei `RUNNING` mit **Neu-starten-Button + Bestätigung +
  Lizenz-Checkbox** (zuerst stoppen, dann starten; keine Löschung; keine Logs; Healthcheck danach
  empfohlen). **Keine** Remove-/Volume-/Network-Buttons.
- **Audit:** `docker.containerRestart.requested/licenseConfirmed/stopStarted/stopCompleted/startStarted/
  completed/failed` (Target = ServerInstance-ID, **keine Secrets/Roh-Ausgaben**); die Teil-Flows schreiben
  zusätzlich ihre `docker.container(Stop|Start).*`-Events.
- Tests: Guard (`nur RUNNING`), vollständige Audit-Sequenzen (completed/stopFailed/startFailed/
  licenseRequired/invalidState), kein Secret im Audit, **Quell-Scan (kein `docker restart`/`rm`/`logs`/
  Socket)**. Bestehende Stop-/Start-Tests bleiben grün. **243 Tests grün.**

#### Security
- OWNER-only; die Sicherheitsgrenzen der Teil-Flows gelten automatisch (Token + `AGENT_DOCKER_WRITE_ENABLED`,
  Managed-Only, kein Browser→Agent). **Kein** `restart`/`run`/`create`/`rm`/`inspect`/`exec`/`cp`/`logs`,
  kein compose, kein Socket, keine Löschung, **kein Log-Lesen**, keine Secrets im Client/Audit. Quell-Scan-
  Test erzwingt, dass **kein** `docker restart` eingeführt wird. **[ADR-0027](DECISIONS.md).**

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (243) · `prisma validate` n. z.
  (kein Schema-Change).

### NDF Step 022 – REMOVE_MANAGED_CONTAINER ohne Volume-/Network-Löschung (2026-07-01)

> Kontrolliertes **Entfernen** eines **gestoppten** managed Containers. `CONTAINER_CREATED →
> RESOURCES_PREPARED`. **Kein** `-f`/`-v`, **keine** Volume-/Network-/Credential-/ServerInstance-Löschung.

#### Added
- **Agent-Aktion `removeTs3Container`** (`apps/agent/src/docker-remove.ts`) + Endpunkt
  **`POST /docker/provision/remove-container`** (Token-Gate + `AGENT_DOCKER_WRITE_ENABLED`): entfernt via
  **`docker rm <managed-name>`** (nie `-f`/`-v`, nie `volume`/`network` rm, nie `run/create/start/stop/
  restart`) **nur** einen bereits vorhandenen, per **managed-/instanceId-Label** geprüften, **nicht
  laufenden** Container. Status `removed | alreadyRemoved | stillRunning | conflict | error |
  writeDisabled | invalid | unavailable`. Läuft er noch ⇒ `stillRunning` (kein Remove); fremder Name ⇒
  `conflict`; **fehlt er ⇒ `alreadyRemoved` (idempotent)**.
- **Web-Service** `removeManagedContainerForServer` (`src/core/container-remove.ts`) + reine Helfer
  (`container-remove-helpers.ts`) + **OWNER-only Server Action** `removeContainerAction` (rate-limitiert).
  Guard: `CONTAINER_CREATED`/`RESOURCES_PREPARED` erlaubt; `RUNNING` ⇒ `stillRunning` („zuerst stoppen");
  sonst `invalidState`. Erfolg ⇒ `RESOURCES_PREPARED` + `runState='unknown'`.
- **Bewusst erhalten** ([ADR-0026](DECISIONS.md)): Credentials, `managedVolumeName`/`managedNetworkName`
  und der `ServerInstance`-Record bleiben unangetastet (per reinem `removeSuccessUpdate` + Test
  abgesichert). `managedContainerName` bleibt deterministisch, dient **nicht** als Existenzbeweis.
- **UI (DE/EN):** managed Detailseite bei `CONTAINER_CREATED` mit **Entfernen-Button + deutlicher
  Bestätigung** (nur der Container wird entfernt; Volume/Network/Zugangsdaten bleiben; TS3 wird nicht
  gestartet/gestoppt; laufenden Container zuerst stoppen); bei `RESOURCES_PREPARED` Hinweis „Ressourcen
  vorbereitet, Container nicht vorhanden". **Keine** Volume-/Network-Remove- oder ServerInstance-Lösch-Buttons.
- **Audit:** `docker.containerRemove.requested/completed/failed/conflict/stillRunning`,
  `docker.container.removed/alreadyRemoved` (Target = ServerInstance-ID, **keine Secrets/Roh-Ausgaben**).
- Tests: Agent (rm-not-`-f`/`-v`, kein volume/network rm, idempotent `alreadyRemoved`, `stillRunning`,
  conflict, unavailable, error, Token/Flag-Gate, Quell-Scan) und Web (Guard/Audit/Fehlerschlüssel,
  `removeSuccessUpdate` schützt Credentials/Volume/Network, Quell-Scan). **235 Tests grün.**

#### Security
- OWNER-only; Agent-Token/-URL nur serverseitig (kein Browser→Agent). **Kein** `-f`/`-v`, **kein Remove
  laufender Container**, **keine Volume-/Network-Löschung**, **keine Credential-/ServerInstance-Löschung**,
  kein `run/create/start/stop/restart/inspect/exec/cp/logs`, kein compose, kein Socket/Host-Mount, keine
  freien Docker-Parameter, keine fremde Ressource verändern. Kein Secret im Client/Audit/Agent-Response,
  **kein Log-Lesen**. Quell-Scan-Tests erzwingen dies. **[ADR-0026](DECISIONS.md).**

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (235) · `prisma validate` n. z.
  (kein Schema-Change).

### NDF Step 021 – STOP_MANAGED_CONTAINER (2026-07-01)

> Kontrolliertes **Stoppen** eines laufenden managed Containers. `RUNNING → CONTAINER_CREATED`
> (+ `runState='stopped'`). **Kein** Löschen/Restart, **kein** Log-Lesen, **keine** weitere Docker-Aktion.

#### Added
- **Agent-Aktion `stopTs3Container`** (`apps/agent/src/docker-stop.ts`) + Endpunkt
  **`POST /docker/provision/stop-container`** (Token-Gate + `AGENT_DOCKER_WRITE_ENABLED`): stoppt via
  **`docker stop --time 3`** (nie `rm`/`restart`/`start`) **nur** einen bereits vorhandenen, per
  **managed-/instanceId-Label** geprüften Container (Name aus `instanceId` abgeleitet). `execFile` ohne
  Shell, statische Argumente. Status `stopped | alreadyStopped | notFound | conflict | error |
  writeDisabled | invalid | unavailable`; **Idempotenz** (bereits gestoppt ⇒ `alreadyStopped`, kein Stop),
  **Konfliktschutz** (fremder Name ⇒ `conflict`), fehlt ⇒ `notFound`.
- **Web-Service** `stopManagedContainerForServer` (`src/core/container-stop.ts`) + reine Helfer
  (`container-stop-helpers.ts`) + **OWNER-only Server Action** `stopContainerAction` (rate-limitiert).
  Guard: nur `RUNNING`/`CONTAINER_CREATED`; sonst `invalidState`. Erfolg ⇒ `CONTAINER_CREATED` +
  `runState='stopped'`. Fehler ⇒ Status bleibt `RUNNING` mit generischem Fehlerschlüssel.
- **Kein neuer Lifecycle-Status** ([ADR-0025](DECISIONS.md)): der Container existiert weiter, nur
  gestoppt; ein späterer Start nutzt erneut `CONTAINER_CREATED → RUNNING`.
- **UI (DE/EN):** managed Detailseite bei `RUNNING` mit **Stop-Button + Bestätigung**
  („Der TS3-Container wird gestoppt. Daten bleiben erhalten.") + Hinweisen (nichts wird gelöscht,
  Volume/Network bleiben, keine Logs); bei `CONTAINER_CREATED` nach Stop Hinweis „Container vorhanden,
  aber nicht laufend" (Start-Button aus Step 018 bleibt nutzbar). **Keine** Remove-Buttons.
- **Audit:** `docker.containerStop.requested/completed/failed/conflict`,
  `docker.container.stopped/alreadyStopped` (Target = ServerInstance-ID, **keine Secrets/Roh-Ausgaben**).
- Tests: Agent (stop-not-rm/restart/start, `docker stop`, idempotent/`alreadyStopped`, conflict, notFound,
  unavailable, error, Token/Flag-Gate, Quell-Scan) und Web (Guard/Audit/Fehlerschlüssel, kein Secret im
  Audit, Quell-Scan). **215 Tests grün.**

#### Security
- OWNER-only; Agent-Token/-URL nur serverseitig (kein Browser→Agent). **Kein** `run/create/start/restart/
  rm/inspect/exec/cp/logs`, kein compose, kein Socket/Host-Mount, **keine Löschung** (Container/Volume/
  Network bleiben), keine freien Docker-Parameter, keine fremde Ressource verändern. Kein Secret im
  Client/Audit/Agent-Response, **kein Log-Lesen**. Quell-Scan-Tests erzwingen dies. **[ADR-0025](DECISIONS.md).**

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (215) · `prisma validate` n. z.
  (kein Schema-Change – `provisioningStatus`/`runState` wiederverwendet).

### NDF Step 020 – Managed Query-Adresse & TS3 Read-only Healthcheck aktiviert (2026-07-01)

> Schließt die Step-019-Lücke: managed Server bekommen eine **explizite** Query-Adresse, damit der
> read-only TS3-Check echte `reachable`/`unreachable`/`notConfigured` liefert. **Kein Raten, kein Portscan.**

#### Added
- **Managed Query-Adresse** (im vorhandenen `host`-Feld – **kein** Schema-Change): wird **explizit**
  gesetzt. **Env-Default + UI-Override** ([ADR-Empfehlung Option B]): `MANAGED_TS3_QUERY_HOST` belegt das
  Provisioning-Feld vor, die UI-Eingabe hat Vorrang (`resolveConfiguredQueryHost`). Leer ⇒ `null` ⇒
  Healthcheck bleibt `notConfigured`. **Nie** automatische IP-Ermittlung/Portscan.
- **Provisioning-Flow** (`/servers/provision`): neues optionales Feld „Query-Adresse / Host" (mit
  Hinweisen), server-seitig via **Step-008-Host-Validierung** geprüft (blockt Cloud-Metadaten/Link-Local/
  unspezifiziert; LAN/localhost erlaubt). Persistiert `host` am managed Record.
- **Query-Adresse bearbeiten** (`/servers/[id]`, managed): kompaktes OWNER-only Formular
  (`updateQueryAddressAction` → `updateManagedQueryAddress`); leert oder setzt `host` (validiert).
- **Healthcheck** nutzt jetzt die gespeicherte Adresse: läuft der Container **und** ist `host`/`queryPort`
  gesetzt ⇒ read-only TS3-`serverinfo` (Step-008/009-Client) ⇒ `reachable`/`unreachable`; sonst
  `notConfigured` (kein Portscan/Retry-Schleifen). Reine Entscheidung in `resolveTs3CheckMode`.
- **UI:** managed Detailseite zeigt **Query-Adresse** (`host:queryPort` oder „nicht konfiguriert") und den
  Healthcheck-Ist-Zustand; Hinweis „keine Portscans" ergänzt. Alle Texte DE/EN.
- **Audit:** `managed.queryAddress.set` (beim Provisioning mit Adresse), `managed.queryAddress.updated`
  (Bearbeiten), `healthcheck.ts3.notConfigured` (Container läuft, aber keine Adresse). **Keine** Secrets/
  Roh-TS3-/Docker-Ausgaben; Target = ServerInstance-ID.
- **Env:** `MANAGED_TS3_QUERY_HOST` in `.env.example` dokumentiert.
- Tests: `resolveConfiguredQueryHost` (Override/Env/leer), `resolveTs3CheckMode`, Host-Validierung
  (Metadaten/Link-Local/unspezifiziert blockiert, LAN/localhost erlaubt), `notConfigured`-Audit.
  **196 Tests grün.** DB-Smoke: `host` set/clear, external unverändert (`notManaged`), Audit ohne Secrets.

#### Security
- OWNER-only; Host-Validierung (Step 008) wiederverwendet; **keine** Portscans/externen IP-Checks/
  Raten. TS3-Client nur read-only; **keine** Roh-Antworten in DB; keine Secrets im Client/Audit.
  External Server unverändert funktionsfähig (DB-Smoke bestätigt). Rate-Limit für Healthcheck bleibt.

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (196) · `prisma validate` n. z.
  (kein Schema-Change – `host` wiederverwendet).

### NDF Step 019 – Managed Server Read-only Healthcheck (2026-07-01)

> **Read-only.** Unterscheidet ehrlich zwischen **Lifecycle-Status** (`provisioningStatus`, unverändert)
> und **Ist-Zustand** (Container läuft? TS3 erreichbar?). **Keine** Logs/Inspect/Portscans/Reparatur.

#### Added
- **Agent read-only Endpunkt** **`POST /docker/provision/container-status`** (`docker-status.ts`):
  **nur Token-Gate** (kein Write-Flag – read-only). Ermittelt via **`docker container ls`** mit
  **Label-Filtern** (`managed=true` + `instanceId`) den Laufzeitstatus; Containername intern aus
  `instanceId` abgeleitet. `execFile`, statische Argumente, keine Shell, **kein** `inspect`/`logs`/
  `exec`/`socket`. Status `running | created | exited | notFound | conflict | unavailable | error`;
  normalisiert, **keine** fremden Containerdetails/Roh-Ausgaben.
- **Web-Service** `runManagedHealthcheck` (`src/core/managed-health.ts`) + reine Helfer
  (`managed-health-helpers.ts`) + **OWNER-only Server Action** `healthcheckAction` (rate-limitiert):
  ruft den Container-Status ab und – **nur wenn der Container läuft** – optional den **read-only
  TS3-ServerQuery-Basisstatus** (`login/use/serverinfo`, bestehender Client aus Step 008/009).
- **Optionaler TS3-Check ehrlich begrenzt:** Da managed Server aktuell **keine** eindeutig erreichbare
  Query-Adresse haben (kein `host`), wird **nicht geraten** → `ts3ReachabilityStatus = notConfigured`
  (kein Portscan). Sobald ein Host/Query-Port vorliegt, greift der read-only Check.
- **Prisma** (Migration `20260701160000_add_managed_healthcheck`): `lastHealthCheckedAt`,
  `containerRuntimeStatus`, `ts3ReachabilityStatus`, `lastHealthErrorKey`, `lastSuccessfulHealthCheckAt`.
  **`provisioningStatus` bleibt** der letzte Lifecycle-Status; Healthcheck-Felder = Ist-Zustand.
- **UI (DE/EN):** managed Detailseite bei `RUNNING` mit Button **„Status prüfen"**, Anzeige von
  Container-Laufzeitstatus, TS3-Erreichbarkeit (ja/nein/unbekannt/nicht konfiguriert), letztem/letztem
  erfolgreichen Healthcheck und – falls TS3 erreichbar – Name/Version/Uptime/Clients. Hinweise:
  read-only, keine Logs, keine Reparatur. **Keine** Stop-/Remove-/Restart-Buttons.
- **Audit:** `healthcheck.managed.requested/completed/failed`, `healthcheck.container.running/notRunning`,
  `healthcheck.ts3.reachable/unreachable` (Target = ServerInstance-ID, **keine Secrets/Roh-Ausgaben**).
- Tests: Agent (Label-Filter, State-Normalisierung, notFound/conflict/unavailable/error, invalid,
  Token-Gate/read-only ohne Write-Flag, Quell-Scan) und Web (Guard/Audit/Fehlerschlüssel/runState,
  kein Secret im Audit, Quell-Scan). **191 Tests grün.**

#### Security
- OWNER-only; Agent-Token/-URL nur serverseitig (kein Browser→Agent). **Read-only:** kein Write-Flag,
  **kein** `run/create/start/stop/rm/inspect/exec/cp/logs`, kein compose, kein Socket, keine Portscans,
  **keine automatische Reparatur**. TS3-Client nur read-only (`login/use/serverinfo/version`). Keine
  Secrets/Roh-Docker-/TS3-Ausgaben in DB/Audit/Client.

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (191) · `prisma validate` ✅.

### NDF Step 018 – START_MANAGED_CONTAINER mit TS3-Lizenzzustimmung (2026-07-01)

> **Erster Start** eines bereits erstellten managed Containers. Übergang `CONTAINER_CREATED → RUNNING`.
> Nur `docker start`, **keine** weitere Docker-Aktion, **kein** Log-Lesen, **explizite** Lizenzzustimmung.

#### Added
- **Agent-Aktion `startTs3Container`** (`apps/agent/src/docker-start.ts`) + Endpunkt
  **`POST /docker/provision/start-container`** (Token-Gate + `AGENT_DOCKER_WRITE_ENABLED`): startet via
  **`docker start`** (nie `run`/`create`) **nur** einen bereits vorhandenen, SpeakCore-**managed** Container
  (Name aus `instanceId` abgeleitet + Managed-Label geprüft). `execFile` ohne Shell, statische Argumente.
  Status `started | running | notFound | conflict | error | writeDisabled | invalid | unavailable`;
  **Idempotenz** (läuft bereits ⇒ `running`, kein Start), **Konfliktschutz** (fremder Name ⇒ `conflict`),
  fehlt ⇒ `notFound`. **Lizenzzustimmung** (`licenseAccepted === true`) ist Pflicht (Defense-in-Depth).
- **Web-Service** `startManagedContainerForServer` (`src/core/container-start.ts`) + reine Helfer
  (`container-start-helpers.ts`) + **OWNER-only Server Action** `startContainerAction` (rate-limitiert).
  Guard: nur `CONTAINER_CREATED`/`RUNNING`; sonst `invalidState`. Ohne Lizenzzustimmung `licenseRequired`
  (Status unverändert). Erfolg ⇒ `RUNNING` + `runState = running`. Fehler ⇒ Status bleibt `CONTAINER_CREATED`
  mit generischem Fehlerschlüssel.
- **UI (DE/EN):** managed Detailseite mit **Lizenz-Checkbox** (kein Vorab-Default) + Hinweis
  („SpeakCore stellt nur die Verwaltung bereit; du bist für die TS3-Lizenz verantwortlich; der Start
  setzt die Lizenzbestätigung") + Button „Container starten" (bei `CONTAINER_CREATED`); bei `RUNNING`
  „Container wurde gestartet" + „TS3-Statusprüfung folgt später".
- **Audit:** `docker.containerStart.requested/licenseConfirmed/completed/failed/conflict`,
  `docker.container.started/alreadyRunning` (Target = ServerInstance-ID, **keine Secrets/ENV/Roh-Ausgabe**).
- **Lizenz-Befund (ADR-0024):** Das TS3-Image erwartet `TS3SERVER_LICENSE=accept` als **ENV beim
  `docker create`** (ein Startbefehl kann keine ENV ergänzen). Daher wird die (nicht-geheime, inerte)
  Lizenz-ENV in **Step 017** beim Create gesetzt; der **tatsächliche Serverlauf** wird durch die
  **explizite Lizenzzustimmung beim Start** freigegeben und auditiert. Kein Trick, kein Log-Lesen.
- Tests: Agent (start-not-run/create, `docker start <name>`, idempotent/`running`, conflict, notFound,
  unavailable, error, fehlende Lizenz ⇒ kein Start, Token/Flag-Gate, Quell-Scan) und Web (Guard/Audit
  inkl. `licenseConfirmed`, kein Secret im Audit, Fehlerschlüssel, Quell-Scan). **172 Tests grün.**

#### Security
- OWNER-only; Agent-Token/-URL nur serverseitig (kein Browser→Agent). **Kein** `run/create/stop/rm/
  inspect/exec/cp/logs`, **kein** compose, **kein** Socket/Host-Mount/privileged, **keine** freien
  Docker-Parameter, **keine** fremde Ressource verändern. Kein Secret im Client/Audit/Agent-Response.
  Quell-Scan-Tests erzwingen dies. **[ADR-0024](DECISIONS.md).**

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (172) · `prisma validate` n. z.
  (kein Schema-Change).

### NDF Step 017 – Managed CREATE_TS3_CONTAINER ohne Start (2026-07-01)

> **Container wird erstellt, aber NICHT gestartet.** Übergang `CONTAINER_PENDING → CONTAINER_CREATED`.
> Kein `docker run/start`, kein Log-Lesen, keine Secret-Ausgabe.

#### Added
- **Agent-Aktion `createTs3Container`** (`apps/agent/src/docker-container.ts`) + Endpunkt
  **`POST /docker/provision/create-container`** (Token-Gate + `AGENT_DOCKER_WRITE_ENABLED`): erstellt
  via **`docker create`** (nie `run`/`start`) einen managed Container aus einem **revalidierten** Plan.
  `execFile` ohne Shell, statische Argumente, Managed-Only-Labels/-Name, named Volume (kein Host-Mount).
  Ergebnisstatus `created|exists|conflict|error|writeDisabled|invalid|unavailable`; **Idempotenz**
  (managed exists ⇒ kein Create) und **Konfliktschutz** (fremder gleichnamiger Container ⇒ `conflict`).
- **Secret-Übergabe per ENV:** Das in Step 015 erzeugte ServerQuery-Admin-Passwort wird **serverseitig**
  entschlüsselt und dem Agent übergeben, der es als Container-ENV `TS3SERVERQUERY_ADMIN_PASSWORD` setzt.
  Dadurch erzeugt das TS3-Image **kein** Zufallspasswort in den Logs → **R-14 geschlossen**. Secret
  erscheint NIE im Browser/Log/Audit/Agent-Response.
- **Web-Service** `createManagedContainerForServer` (`src/core/container-create.ts`) + reine Helfer
  (`container-create-helpers.ts`) + **OWNER-only Server Action** `createContainerAction` (rate-limitiert).
  Status-Guard: nur `CONTAINER_PENDING`/`CONTAINER_CREATED`; sonst `invalidState`. Fehlender
  `SECRET_ENCRYPTION_KEY`/Credential blockiert (Status unverändert). Erfolg ⇒ `CONTAINER_CREATED` +
  `managedContainerName`. Fehler ⇒ Status bleibt `CONTAINER_PENDING` mit generischem Fehlerschlüssel.
- **Audit:** `docker.containerCreate.requested/completed/failed`, `docker.container.created/exists/conflict`
  (Target = ServerInstance-ID, **keine Secrets/ENV/Roh-Docker-Ausgabe**).
- **UI (DE/EN):** managed Detailseite mit „Container erzeugen"-Button (bei `CONTAINER_PENDING`) inkl.
  Hinweisen (wird erstellt, **nicht gestartet**; TS3 läuft danach **nicht**; Secrets werden nicht
  angezeigt); bei `CONTAINER_CREATED` Statusanzeige + „erstellt, aber noch nicht gestartet".
- Tests: Agent (create-Args/Labels/Ports/Volume/ENV, idempotent/exists, conflict, unavailable, error,
  Secret nur in create-Args nicht im Ergebnis, Token/Flag-Gate, Quell-Scan verbotener Kommandos) und
  Web (Guard/Audit/Fehlerschlüssel, kein Secret im Audit, Quell-Scan). 152 Tests grün.

#### Security
- OWNER-only; Agent-Token/-URL nur serverseitig (kein Browser→Agent). **Kein** `run/start/stop/rm/
  inspect/exec/cp/logs`, **kein** compose, **kein** Socket/Host-Mount/privileged, **keine** freien
  Docker-Parameter. Quell-Scan-Tests erzwingen dies. **[ADR-0023](DECISIONS.md).**

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (152) · `prisma validate` n. z.
  (kein Schema-Change).

### NDF Step 016 – Secret Encryption Key Rotation Foundation (2026-07-01)

> **Kein Docker, kein Container, kein TS3-Start, keine öffentliche UI/API.** Sichere Grundlage,
> um `SECRET_ENCRYPTION_KEY` später zu wechseln (Re-Encrypt aller `ServerCredential`).

#### Added
- **Rotations-Service** `rotateServerCredentialEncryptionKeys()` (`src/core/secret-rotation.ts`):
  entschlüsselt bestehende Credentials mit dem **alten**, verschlüsselt mit dem **neuen** Schlüssel
  (Format bleibt `v1`, AES-256-GCM). Rein serverseitig (Operator/CLI) – **keine Route, keine API,
  keine UI**. Rückgabe **nur Zählwerte** (`total/wouldRotate/rotated/skipped/failed` + `dryRun/sameKey`),
  **nie Secrets**.
- **Reine Logik** ausgelagert (`src/core/secret-rotation-helpers.ts`): `resolveRotationKeys`
  (Schlüsselprüfung), `planCredentialRotation` (Re-Encrypt-Planung, idempotentes `skipped` für bereits
  rotierte Werte, `failed` für unlesbare) – DB-frei und unit-getestet.
- **Krypto erweitert** (`src/core/crypto.ts`, abwärtskompatibel): `deriveKey`, `encryptWithKey`,
  `decryptWithKey`, `reencryptValue`. Bestehende `v1`-Werte bleiben mit ihrem Schlüssel lesbar;
  `encryptSecret/decryptSecret` (env-Schlüssel) unverändert.
- **Operator-CLI** `pnpm --filter @speakcore/web rotate-secrets [--dry-run]`
  (`apps/web/scripts/rotate-secrets.ts`): gibt nur Zählwerte aus, keine Secrets/Schlüssel.
- **Env** `SECRET_ENCRYPTION_KEY_NEW` (nur für Rotation; im Normalbetrieb leer) in `.env.example`
  dokumentiert.
- **Audit:** `security.secretRotation.dryRun/started/completed/failed` (Actor `system`, **keine
  Secrets/Schlüssel/Zählwerte-Leaks**).

#### Security
- Fehlender **alter oder neuer** Schlüssel ⇒ Abbruch **vor** DB-Zugriff (`RotationConfigError`).
- **Identischer** alter/neuer Schlüssel ⇒ kontrolliert `sameKey`, nichts wird geschrieben.
- **All-or-nothing:** Schreibvorgang läuft in einer Prisma-Transaktion; bei hartem Fehler (`failed>0`)
  wird **nichts** geschrieben. Bereits rotierte Werte werden übersprungen (idempotent, wiederholbar).
- External- **und** Managed-Credentials werden gleich behandelt und bleiben lesbar. Keine neue
  öffentliche Angriffsfläche (Quell-Scan-Test + `src/app`-Referenz-Test).

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ · `prisma validate` n. z.
  (kein Schema-Change).

### NDF Step 015 – Container Pending & Secret-Vorbereitung (2026-07-01)

> **Kein Docker-Container, kein TS3-Start.** Übergang `RESOURCES_PREPARED → CONTAINER_PENDING`
> inkl. generiertem, **verschlüsseltem** Secret und finalisiertem Container-Plan.

#### Added
- **OWNER-only Aktion** „Container-Erstellung vorbereiten" (`/servers/[id]`, managed): nur für
  `provisioningStatus = RESOURCES_PREPARED`; setzt nach Erfolg `CONTAINER_PENDING`. Rate-limitiert.
- **Secret-Generierung** (`generateSecret`, `node:crypto`): kryptographisch sicher, **nur
  alphanumerisch** (Shell-/ENV-sicher), ≥ 32 Zeichen. Wird **verschlüsselt** gespeichert
  (`ServerCredential`, AES-256-GCM, [ADR-0018](DECISIONS.md)); Benutzername server-seitig fest
  (`serveradmin`). **Nie** im Client/Log/Audit; **nicht** aus Docker-Logs gelesen (mitigiert R-14).
- **Ohne `SECRET_ENCRYPTION_KEY` bricht die Aktion ab** – Status bleibt `RESOURCES_PREPARED`.
- **Container-Plan finalisiert:** Plan wird aus persistierten Werten **rekonstruiert & revalidiert**
  (Step-010-Logik); `managedContainerName/NetworkName/VolumeName` (re)persistiert. Prisma:
  `fileTransferPort` ergänzt (Migration `20260701140500_add_file_transfer_port`).
- **Idempotenz:** bereits `CONTAINER_PENDING` ⇒ `alreadyPending` (kein neues Secret/keine
  Überschreibung). Ungültiger Status ⇒ `invalidState`.
- **Audit:** `ts3.containerPrepare.requested/secretCreated/completed/failed` (Target = ServerInstance-ID,
  **keine Secrets**).
- **UI (DE/EN):** managed Detailseite mit Vorbereiten-Button + Hinweisen (kein Container/kein Start/
  Secret wird verschlüsselt gespeichert); bei `CONTAINER_PENDING` Status + „Nächster Schritt:
  Container erzeugen". **Kein Secret** angezeigt.
- Tests: Secret-Generator (Charset/Länge/Unique), Status-Guard, Audit ohne Secrets, Quell-Scan
  (kein Docker/Agent im Web-Code). 116/116 grün.

#### Security
- OWNER-only; **kein Docker-Aufruf, keine Agent-Aktion**, kein Socket. Secret nur verschlüsselt in
  DB (per DB-Smoke bestätigt: keine Secret-Spalten in `ServerInstance`, Passwort entschlüsselbar).
  External-Credentials (Step 008/009) bleiben unberührt.

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (116/116) · `prisma validate` ✅.
- DB-Smoke: `RESOURCES_PREPARED → CONTAINER_PENDING`, 32-Zeichen-Secret verschlüsselt/entschlüsselbar,
  idempotent (1 Credential), fehlender Key blockiert (Status unverändert).

#### Notes
- **Weiterhin kein Container/Start.** Nächster Step: echtes `docker create` (managed, **ohne** Start).

### NDF Step 014 – Managed ServerInstance & Provisioning-State (2026-07-01)

> **Kein Container, kein TS3-Start.** Die in Step 013 vorbereiteten Ressourcen sind nun **persistent**
> mit einer `ServerInstance` (`mode = "managed"`) verknüpft.

#### Added
- **Prisma:** `ServerInstance` um Managed-Provisioning-Felder erweitert (`instanceId` @unique,
  `provisioningStatus`, `managedNetworkName/VolumeName/ContainerName`, `lastProvisioningStep`,
  `lastProvisioningErrorKey`, `resourcesPreparedAt`) + additive SQLite-Migration
  `20260701132908_managed_provisioning_state`. **External** Server (Step 008/009) bleiben unberührt.
- **Provisioning-Flow:** `/servers/provision` legt **vor** dem Agent-Aufruf einen **managed DRAFT**-
  Record an (jeder Versuch ist auditier-/nachvollziehbar), aktualisiert danach den `provisioningStatus`
  (`RESOURCES_PREPARED` / `RESOURCE_PREPARE_PARTIAL` / `RESOURCE_PREPARE_FAILED`; bei `writeDisabled`/
  `unavailable`/`unreachable` **bleibt DRAFT** – kein irreführender „fertiger" Server) und verlinkt den
  neuen Server-Eintrag.
- **Reine Mapper** (`resolveProvisioningStatus`, `provisioningErrorKey`) – unit-testbar.
- **UI (DE/EN):** `/servers` zeigt **External** und **Managed** mit passenden Status-Badges;
  `/servers/[id]` hat für `mode=managed` eine read-only Provisioning-Ansicht (Status, Network-/Volume-/
  Container-Name, „Noch kein Container erstellt", „Noch kein TS3-Server gestartet") – **keine**
  Start-/Stop-/Aktions-Buttons.
- **Audit** mit ServerInstance verknüpft (`target = serverId`): `docker.prepare.requested`,
  `docker.{network,volume}.{created,exists,conflict}`, `docker.prepare.completed`/`failed`.

#### Security
- OWNER-only; **`instanceId` und alle Docker-Namen/Labels werden server-seitig** aus dem validierten
  Plan erzeugt (kein Nutzereinfluss). **Keine Secrets/Roh-Agent-/Docker-Daten** in `ServerInstance`
  (per DB-Smoke bestätigt: keine secret-artigen Spalten).

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (110/110) · `prisma validate` ✅.
- DB-Smoke: managed Record persistiert (`instanceId`, Status), External + Credential weiter
  funktionsfähig, keine Secret-Spalten.

#### Notes
- **Weiterhin kein Container/Start.** Container-Erstellung (`CONTAINER_PENDING`→`CONTAINER_CREATED`)
  und Start folgen als eigene, geprüfte Steps.

### NDF Step 013 – Web-Integration & Audit für Managed Docker Prepare (2026-07-01)

> **Kein Container, kein TS3-Start.** Die Web-App kann als **OWNER** kontrolliert die Network/Volume-
> Vorbereitung beim Agent auslösen und auditieren.

#### Added
- **Web-Service** `prepareManagedTs3Resources(input, actor)` (`core/provisioning.ts`): re-validiert
  den Input (Step-010-Logik), ruft **serverseitig** `POST /docker/provision/prepare` beim Agent auf
  (`lib/agent-client.ts` → `prepareManagedResources`), **persistiert normalisierte Audit-Events** in
  der Web-DB und liefert ein UI-taugliches Ergebnis (**keine Secrets/Roh-Agent-Details**).
- **Reine Helfer** (`core/provisioning-helpers.ts`, testbar): `buildProvisionInput` (fixes
  `imageName`/`restartPolicy`, **keine** freien Docker-Parameter), `buildProvisionAuditEntries`
  (normalisierte Events, keine Secrets), `isOwner`.
- **Server Action + UI** `/servers/provision` (**OWNER-only**, `force-dynamic`): Formular
  (Anzeigename, Ports, Simple/Expert) + Warnhinweise („kein Container", „kein Start", „Write-Flag
  muss aktiv sein"). Ergebnisanzeige pro Ressource (`created/exists/conflict`) sowie
  `writeDisabled/unavailable/unreachable/invalid` mit klaren Hinweisen; Rollback-/Audit-Hinweis.
  Rate-limitiert (je Owner). Link von `/servers`.
- Audit-Aktionen: `docker.prepare.requested`, `docker.network.created/exists`,
  `docker.volume.created/exists`, `docker.prepare.conflict/writeDisabled/unavailable/invalid`.
- Web-Agent-Client um `prepareManagedResources()` (POST, Token aus Env, Timeout) erweitert.
- Tests: `isOwner`, `buildProvisionInput` (keine verbotenen Felder), Audit-Mapping (created/exists/
  conflict/writeDisabled/unreachable), keine Secrets im Audit, Quell-Scan (kein Docker-Kommando/
  `AGENT_URL` im Web-Provisioning-Code – Agent nur über `lib/agent-client`). 108/108 grün.

#### Security
- **OWNER-only**; Server Action/serverseitiger Fetch; **Agent-URL/Token nur serverseitig** (nie im
  Client); kein direkter Browser→Agent-Aufruf; keine freien Docker-Parameter; keine Secrets/Roh-
  Docker-Fehler im Client. Ergebnisse und Audit ohne Secrets/Hostpfade.

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (108/108) · `prisma validate` (kein Schema geändert).
- Runtime-Smoke: `/de/servers/provision` lädt und ist OWNER-geschützt (Redirect Login).

#### Notes
- **Es entsteht weiterhin kein Container und kein laufender TS3-Server.** Bei deaktiviertem
  Write-Flag meldet die UI `writeDisabled` mit klarem Sicherheitshinweis (keine automatische Aktivierung).

### NDF Step 012 – Erste Managed Docker Write-Aktion: Network & Volume (2026-07-01)

> **Kein Container, kein TS3-Start.** Erste schreibende Docker-Funktion, extrem eng begrenzt:
> nur managed **Network** + **Volume** aus einem validierten Provisioning-Plan.

#### Added
- **Agent-Endpunkt `POST /docker/provision/prepare`** (token-gated): legt idempotent das managed
  Voice-**Network** (`speakcore-network-voice`) und das managed **Volume**
  (`speakcore-volume-ts3-<instanceId>`) mit SpeakCore-Labels an. **Kein** Container, kein Start.
- **Feature-Flag `AGENT_DOCKER_WRITE_ENABLED`** (Default **false**): ohne Opt-in wird **keine**
  Docker-Schreibaktion ausgeführt (Antwort `status: "writeDisabled"`).
- **Serverseitige Re-Validierung** mit der Step-010-Logik (`validateTs3ProvisionInput`) – der Agent
  vertraut **nie** freien Nutzerparametern; Ressourcen entstehen nur aus dem intern gebauten Plan
  (`createTs3ProvisioningPlan`). Kein freies Image/Args/Host-Mount/privileged/Socket.
- **Idempotenz & Konfliktschutz:** bereits vorhandene **managed** Ressource ⇒ `exists` (kein
  erneutes Anlegen); gleichnamige **nicht** verwaltete Ressource ⇒ `conflict` (nicht anfassen/
  verändern/löschen). Availability-Probe ⇒ `unavailable` (kein Crash).
- **Deklarativer Rollback-Plan** (nur was in diesem Lauf erzeugt wurde) – **keine** automatische
  `rm`-Ausführung in Step 012. Audit-Events (`docker.network.*`/`docker.volume.*`) ohne Secrets.
- Ergebnis-Typen in `packages/types` (`ProvisionPrepareResult`, `ManagedResourceResult`,
  `ManagedRollbackEntry`, …). Kontrollierte Docker-CLI (`execFile`, statische Argumente, Timeout,
  keine Shell, kein Socket) in `docker-cli.ts`; Logik mit **injizierbarem** exec (`docker-write.ts`).
- ADR-0021 (Write-Opt-in-Flag + erster Write-Scope Network/Volume).
- Tests (Mock-exec, kein echtes Docker): write-disabled, Token-401, Plan→create-Kommandos + Labels,
  managed-exists (idempotent), unmanaged-Namenskonflikt, keine Secrets im Result, Source-Scan gegen
  schreibende/inspizierende Kommandos + Socket. 102/102 grün.

#### Security
- Write nur bei **Flag + gültigem Token**; `/health`/`/version` unverändert, `/docker/inventory`
  bleibt read-only. Kein Socket, keine Shell, keine freien Docker-Parameter. Fremde Ressourcen
  werden **nie** verändert/gelöscht. Ergebnis enthält **keine** Secrets/Hostpfade.

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (102/102).
- Runtime-Smoke (gebauter Agent, sichere Default-Konfiguration): `POST /docker/provision/prepare`
  → **401** ohne Token, **`writeDisabled`** mit Token (Flag aus) – **keine** Docker-Ressource erzeugt.

#### Notes
- **Es entsteht weiterhin kein Container und kein laufender TS3-Server.** Container-Erstellung/Start
  sowie automatisches Remove folgen als eigene, geprüfte Steps.

### NDF Step 011 – Managed-Only Docker Inventory (read-only) (2026-07-01)

> Erste echte Docker-Nähe im Agent – **ausschließlich lesend**. Kein Erstellen/Starten/Stoppen/
> Entfernen, **kein Docker-Socket**, keine Host-Manipulation, keine TS3-Installation.

#### Added
- **Agent-Endpunkt `GET /docker/inventory`** (read-only, **token-gated** wie `/system/snapshot`):
  liefert nur **SpeakCore-managed** Ressourcen (Container/Volumes/Netzwerke) mit gefilterten
  SpeakCore-Labels. `/health`, `/version`, `/system/snapshot` unverändert.
- **Read-only Docker-Abfragen** via `execFile` (statische Argumente, Timeout, keine Shell):
  `ps`/`volume ls`/`network ls` jeweils mit `--filter label=speakcore.managed=true` und statischem
  `--format`. Docker nicht verfügbar ⇒ `status: "unavailable"` (kein Crash).
- **Reiner Parser** (`docker-inventory-parser.ts`): trennt CLI-Ausgabe, **Managed-Only-Guard**
  (nicht-verwaltete Ressourcen werden verworfen), übernimmt **nur** SpeakCore-Labels. Keine
  Rohobjekte, keine fremden Container-/Ressourcendetails.
- **Typen** in `packages/types` (`DockerInventory`, `DockerManaged{Container,Volume,Network}`,
  `DockerInventoryStatus`, `DockerResourceKind`, `ManagedResourceLabelSet`).
- **Web (klein):** `/systemcheck` zeigt eine Karte „Docker-Inventar (nur SpeakCore-verwaltet)"
  mit Verfügbarkeit + Anzahl managed Container/Volumes/Netzwerke + Hinweis, dass fremde Ressourcen
  **nicht** verwaltet werden. Serverseitiger Abruf über `fetchDockerInventory()`.
- Tests: Parser (managed/unmanaged/Labels-Filter), Managed-Only-Guard, Docker-unavailable ohne
  Crash, Endpunkt token-gated, **Source-Scan** gegen schreibende/inspizierende Docker-Kommandos
  und Socket, kein fremdes Feld im DTO. 94/94 grün.

#### Security
- **Kein Docker-Socket**, kein Shell-Aufruf, **keine** schreibenden/steuernden Kommandos, kein
  `inspect`/`exec`/`cp`, keine freien Nutzerparameter. Nur managed Ressourcen werden detailliert;
  fremde Ressourcen werden **nicht enumeriert** und **nicht** in Details geleakt.

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (94/94).
- Runtime-Smoke (gebauter Agent, echtes Docker): `/docker/inventory` → `available`, 0 managed
  Ressourcen (Filter greift, kein fremdes Datum in der Antwort).

#### Notes
- Fremde/unmanaged Ressourcen werden bewusst **nicht** gezählt/aufgelistet (Vermeidung von
  Datenabfluss). Erste **schreibende** Aktion (`CREATE_MANAGED_NETWORK`/`CREATE_MANAGED_VOLUME`)
  folgt als eigener, sorgfältiger Step gegen den validierten Plan (Step 010).

### NDF Step 010 – Agent Docker Safety Foundation & TS3 Provisioning Blueprint (2026-07-01)

> **Es wird NICHTS installiert/ausgeführt.** Reine Planungs-/Validierungslogik + Sicherheitskonzept
> für spätere Agent-Docker-Aktionen. Kein `docker run/compose up/start/stop`, kein Container/Volume/
> Netzwerk, **kein Docker-Socket**, keine Host-Manipulation.

#### Added
- **Managed-Only-Prinzip:** SpeakCore verwaltet später nur Ressourcen, die es selbst erzeugt hat –
  eindeutige Labels (`speakcore.managed=true`, `speakcore.project`, `speakcore.instanceId`,
  `speakcore.service`) und Namenspräfixe (`speakcore-ts3-<id>`, `speakcore-volume-ts3-<id>`,
  `speakcore-network-voice`).
- **Agent-Aktionsmodell** (`AgentActionType` + `ALLOWED_AGENT_ACTIONS`): der Agent ist **kein**
  allgemeines Docker-Admin-Interface, nur eng definierte Aktionen. In Step 010 sind ausschließlich
  Planung/Validierung implementiert.
- **Provisioning-Blueprint** (`createTs3ProvisioningPlan`, rein): plant Container/Volumes/Netzwerke/
  Ports/Labels, Secret-**Anforderungen** (keine Werte), Warnungen, Rollback- und Audit-Schritte –
  **ohne Ausführung**.
- **Validierung** (`validateTs3ProvisionInput`): Ports gültig/keine Duplikate/keine reservierten
  Ports im Simple Mode; Image-Allowlist; Restart-Policy-Allowlist; kein Pfad-/Host-Mount als
  Volume; **immer abgelehnt:** privileged, Docker-Socket-Mount, Host-Mounts, freie Docker-Args.
- **Rollback- & Audit-Planstruktur** (Secrets werden nie protokolliert).
- Typen in `packages/types` (`provisioning.ts`), reine Logik in `packages/shared/provisioning/`.
- ADR-0019 (Docker-Zugriffsstrategie: CLI über Agent, Allowlist, statische Argumente),
  ADR-0020 (Managed-Only-Provisioning-Safety).
- Tests: Plan-Namen/Labels/Ports, ungültige/doppelte/reservierte Ports, Image-Allowlist,
  Host-Mount/Socket/privileged-Ablehnung, keine Secrets in Rollback/Audit. 87/87 grün.

#### Security
- **Docker-Socket in WebUI/Web-Container ist verboten.** Falls später im Agent nötig, nur mit
  separater Begründung + Härtung (ADR-0019). Keine freien Nutzerparameter; alle Docker-Argumente
  werden später **intern/statisch** aus dem validierten Plan erzeugt.
- Secret-Konzept: generieren + verschlüsselt speichern ([ADR-0018](DECISIONS.md)); nie in Logs/
  Audit/Client. **Risiko dokumentiert** (offizielles TS3-Image gibt Initial-Credentials in Logs aus,
  RISKS R-14).

#### Verifiziert
- `pnpm lint` ✅ · `pnpm typecheck` ✅ · `pnpm build` ✅ · `pnpm test` ✅ (87/87).

#### Notes
- **Warum noch keine Installation?** Echte Docker-Aktionen brauchen eine abgesicherte Docker-Anbindung
  im Agent; diese wird erst nach diesem Sicherheitsfundament in einem eigenen Step umgesetzt.

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
