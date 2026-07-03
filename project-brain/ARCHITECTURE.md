# ARCHITECTURE.md – SpeakCore Suite

> NDF Project Brain · Stand: 2026-06-30 · Architekturentscheidungen siehe [DECISIONS.md](DECISIONS.md)

## 1. Architekturprinzipien

1. **Strikt modular** – klar getrennte Komponenten mit definierten Schnittstellen.
2. **Privileg-Trennung** – die WebUI kontrolliert **niemals** direkt Docker, Host oder
   TeamSpeak. Alle privilegierten Aktionen laufen über den **SpeakCore Agent**.
3. **Adapter-Prinzip** – jeder Servertyp wird über einen Adapter angebunden; 0.1 implementiert
   nur den TS3-Adapter, die Abstraktion ist aber von Anfang an vorhanden.
4. **Safe by default** – sichere Voreinstellungen, generierte Secrets, keine Default-Passwörter.
5. **Schlanker Core** – Features kommen über die Roadmap, nicht über Scope-Creep.

## 2. Komponentenübersicht

```
┌──────────────────────────────────────────────────────────────────┐
│                          SpeakCore Suite                           │
│                                                                    │
│  ┌─────────────┐      ┌──────────────────────┐                     │
│  │ SpeakCore   │ HTTP │ SpeakCore Backend/API │                    │
│  │   WebUI     │◄────►│  (Auth, Wizard,       │                    │
│  │ (Next.js)   │      │   Preflight, Audit)   │                    │
│  └─────────────┘      └──────────┬───────────┘                     │
│                                   │                                 │
│                   ┌───────────────┼───────────────┐                │
│                   ▼               ▼               ▼                 │
│            ┌────────────┐  ┌─────────────┐  ┌──────────┐           │
│            │  Datenbank │  │Adapter Layer│  │ Audit-Log │          │
│            │  (SQLite)  │  │  (generisch)│  └──────────┘           │
│            └────────────┘  └──────┬──────┘                         │
│                                   ▼                                 │
│                            ┌────────────┐                          │
│                            │ TS3 Adapter│                          │
│                            └──────┬─────┘                          │
└───────────────────────────────────┼───────────────────────────────┘
                                     │ ServerQuery
        privilegierte Aktionen       ▼
   ┌──────────────┐  HTTP   ┌─────────────────┐    ┌──────────────────┐
   │ SpeakCore    │◄───────►│ SpeakCore Agent │───►│ Docker / Host     │
   │ Backend/API  │  Token  │ (separater Dienst)│  │ TeamSpeak 3 Server│
   └──────────────┘         └─────────────────┘    └──────────────────┘
```

## 3. Komponenten im Detail

### 3.1 SpeakCore WebUI
Next.js + TypeScript + TailwindCSS. Reine Präsentations-/Interaktionsschicht. Spricht
**ausschließlich** die SpeakCore API. Kennt weder Docker noch ServerQuery.

### 3.2 SpeakCore Backend/API
Geschäftslogik: Auth, Setup-Wizard, Preflight & Capacity Advisor, Server-Orchestrierung,
Backup/Restore-Steuerung, Audit-Log. Für 0.1 als Next.js Route Handler realisiert, jedoch
in einer **framework-unabhängigen Service-Schicht** gekapselt (spätere Extraktion möglich).
Siehe [ADR-0001](DECISIONS.md).

### 3.3 SpeakCore Agent
Separater Dienst mit den nötigen Rechten für Docker-/Host-Aktionen. **Einziger** Pfad zu
privilegierten Operationen (Container anlegen/starten/stoppen, TS3 installieren, Backups
auf Dateisystemebene, Systemcheck-Sonden). Authentifiziert via Bootstrap-Token, exponiert
eine minimale, klar definierte HTTP-API.

**Stand Step 006–012:** read-only Endpunkte – `GET /health`, `GET /version`, `GET /system/snapshot`,
`GET /docker/inventory` (nur SpeakCore-managed; Docker nur lesend, **kein** Socket). Dazu die **erste
schreibende** Aktion `POST /docker/provision/prepare` – **nur** managed Network/Volume, hinter
**Token + Feature-Flag** (`AGENT_DOCKER_WRITE_ENABLED`, Default false), gegen validierten Plan,
idempotent, **kein Container/Start** ([ADR-0021](DECISIONS.md)). Für spätere Container-Aktionen ist ein
**Sicherheitsfundament** definiert (Managed-Only, Aktions-Allowlist, Provisioning-Blueprint/
Validierung – [ADR-0019](DECISIONS.md)/[ADR-0020](DECISIONS.md)), aber **noch nichts ausgeführt**.
Details: [docs/architecture/agent.md](../docs/architecture/agent.md).

### 3.4 Adapter Layer
Generische Abstraktion „Server-Typ". Definiert ein einheitliches Interface (provision, start,
stop, restart, status, logs, backup, restore, connectExisting). 0.1 implementiert nur den
**TS3-Adapter**. Details: [docs/architecture/adapter-layer.md](../docs/architecture/adapter-layer.md).

### 3.5 TS3 Adapter
Spricht TeamSpeak 3 **ServerQuery**. Verwaltet bestehende und neu installierte TS3-Server.
Speichert Query-Zugänge ausschließlich verschlüsselt (siehe [SECURITY.md](SECURITY.md)).

**Stand Step 008/009:** implementiert ist der **read-only**-Teil – „bestehenden Server verbinden",
Basisstatus **aktualisieren** und Server **entfernen** (Credentials per DB-Cascade). Eigener
minimaler ServerQuery-Client ([ADR-0017](DECISIONS.md)); AES-256-GCM-Secrets ([ADR-0018](DECISIONS.md)).
Läuft im **Web-Backend**, nicht im Agent. Installation/Start/Stopp folgen später über den Agent.
Nur read-only Kommandos (`login`/`use`/`serverinfo`).

### 3.6 Datenbank
SQLite für 0.1, Zugriff über ORM (Prisma, [ADR-0002](DECISIONS.md)). Schema so gehalten,
dass spätere Migration auf PostgreSQL möglich ist.

### 3.7 Integrierte Dokumentation / Hilfe
Kontextbezogene Hilfe (DE/EN) aus [docs/help/](../docs/help/), in der UI eingebettet.

### 3.8 Branding / Design-System
Zentrale Design-Tokens (`branding/design-tokens/`), in Tailwind eingebunden. Siehe
[BRANDING.md](BRANDING.md).

### 3.9 Plugin-System (NUR vorbereitet)
0.1 implementiert **kein** Plugin-System. Die Modulgrenzen werden jedoch so gezogen, dass
ein späteres Plugin-/Modulsystem aufgesetzt werden kann.

## 4. Datenfluss (Adapter-Prinzip)

```
0.1:    WebUI → SpeakCore API → Adapter Layer → TS3 Adapter → TeamSpeak 3 ServerQuery
später: WebUI → SpeakCore API → Adapter Layer → TS6 Adapter → TeamSpeak 6 WebQuery/API
```

## 5. Preflight & Capacity Advisor (Core-Modul)

Eigenständiges Core-Modul im Backend. Prüft Eignung der Grundinstallation, vorhandene
Ressourcen, sinnvoll mögliche Dienste, Limits und empfohlene Upgrades. Liefert eine
Ampelbewertung (🟢/🟡/🔴), die den Setup-Wizard steuert (siehe [MVP.md](MVP.md) §3).
Sonden, die Hostzugriff brauchen (z. B. Docker-Status, Ports, Firewall), laufen über den
**Agent**, nicht in der WebUI.

**Stand Step 005 ([ADR-0016](DECISIONS.md)):** Die **Kernlogik** ist umgesetzt – Typen in
`packages/types` (`preflight.ts`) und **reine Bewertungsfunktionen** in
`packages/shared/preflight/` (`runPreflight`, `evaluateCpu/Memory/Storage/…`), ohne Next.js-/DB-/
Agent-/Host-Abhängigkeit und vollständig unit-getestet. Es werden **noch keine echten Hostdaten**
erhoben; `ResourceSnapshot` ist Eingabe (in Step 005 Demo-/Dummy-Daten). Die echte Erhebung
übernehmen spätere **Agent-Sonden**. Grundregel: **unbekannte Werte ⇒ nie grün**; Richtwerte sind
konservative Empfehlungen, keine Garantie.

## 6. Deployment-Topologie (0.1)

Docker Compose mit getrennten Services:
- `speakcore-web` (WebUI + API, Next.js)
- `speakcore-agent` (privilegierter Agent)
- `speakcore-db` entfällt in 0.1 (SQLite als Datei-Volume)
- TS3-Server laufen als vom Agent verwaltete Container

Vertrauensgrenze: Die WebUI/API ist exponiert; der Agent ist **nicht** öffentlich erreichbar
und nur von der API über Token/privates Netz ansprechbar. Härtung: [docs/architecture/security.md](../docs/architecture/security.md).

## 6a. Repository-Struktur (Monorepo, ab Step 002)

pnpm Workspaces ([ADR-0009](DECISIONS.md)):

```text
apps/
├── web/      SpeakCore WebUI + API (Next.js, TS, Tailwind, next-intl, Prisma)
└── agent/    SpeakCore Agent (node:http, minimal, tsup-Build)
packages/
├── types/    geteilte Typen & spätere API-Verträge (@speakcore/types)
├── shared/   Konstanten, App-Metadaten, Versionsinfo (@speakcore/shared)
└── config/   geteilte Base-tsconfig (@speakcore/config)
docker-compose.yml   Skeleton (web + agent), Agent ohne Host-/Docker-Rechte
```

Gemeinsame Scripts laufen rekursiv (`pnpm -r`). Workspace-Pakete werden als TS-Quelle
konsumiert: `web` via `transpilePackages`, `agent` via tsup-Bundling ([ADR-0010](DECISIONS.md)).

## 6b. Auth-/Setup-Schichten (ab Step 003)

Die Web-App trennt UI, App-Glue und framework-unabhängige Kernlogik ([ADR-0001](DECISIONS.md)):

```text
apps/web/src/
├── app/[locale]/            UI & Server Actions (setup, login, dashboard)
│   ├── page.tsx             Einstieg → Redirect je nach Setup-/Auth-Zustand
│   ├── setup/               Wizard + createOwnerAction
│   ├── login/               Login-/Logout-Actions
│   └── dashboard/           geschützte Route
├── lib/auth.ts              Next-Glue: Cookies setzen/lesen, getCurrentUser (server-only)
└── core/                    framework-unabhängig (testbar):
    ├── db, users, session, audit
    ├── password / password-policy   (Argon2id + reine Policy)
    └── setup / setup-state          (Zustandslogik + reine Helfer)
```

Auth-/Setup-Datenfluss:

```
Browser → Server Action (core/*) → Prisma (SQLite)
Session: HttpOnly-Cookie (Roh-Token)  ↔  DB speichert HMAC(SESSION_SECRET, token)
```

Auth-Routen sind `force-dynamic` (pro Request ausgewertet). Details:
[SECURITY.md](SECURITY.md) §4, [ADR-0012](DECISIONS.md)/[ADR-0013](DECISIONS.md).

Managed-Docker-Prepare-Flow (ab Step 013), **OWNER-only**, **serverseitig**:

```
Browser (Owner) → Server Action → core/provisioning → lib/agent-client (Token aus Env)
                → Agent POST /docker/provision/prepare → Docker (nur Network/Volume)
Ergebnis → normalisiert → UI  +  Audit-Events → AuditLog (DB, ohne Secrets)
```

Der Browser spricht den Agent **nie** direkt an; Agent-URL/Token bleiben serverseitig.

**Managed ServerInstance (ab Step 014):** Vorbereitete Ressourcen werden persistent an eine
`ServerInstance` mit `mode = "managed"` gebunden (`instanceId`, `provisioningStatus`, Network-/
Volume-/Container-Name). Der DRAFT-Record entsteht **vor** dem Agent-Aufruf (auditierbar) und wird
je nach Ergebnis auf `RESOURCES_PREPARED`/`_PARTIAL`/`_FAILED` bzw. DRAFT (writeDisabled/unavailable)
gesetzt. **Keine Secrets** im Record; **noch kein Container/Start.** Abgrenzung external/managed:
[docs/architecture/adapter-layer.md](../docs/architecture/adapter-layer.md).

**Container-Vorbereitung (Step 015):** `RESOURCES_PREPARED → CONTAINER_PENDING`. SpeakCore generiert
das ServerQuery-Admin-Secret selbst und legt es **verschlüsselt** in `ServerCredential` ab
([ADR-0018](DECISIONS.md)); der Container-Plan wird rekonstruiert/revalidiert. **Kein Docker/Agent,
kein Container/Start.** Secret nie im Client/Log/Audit (R-14 früh entschärft).

**Container-Erstellung (Step 017):** `CONTAINER_PENDING → CONTAINER_CREATED`, **OWNER-only**,
serverseitig: `core/container-create` → `lib/agent-client` → Agent `POST /docker/provision/create-container`
→ **`docker create` (kein Start)**. Das Secret wird serverseitig entschlüsselt und dem Agent als
Container-**ENV** (`TS3SERVERQUERY_ADMIN_PASSWORD`) übergeben – **kein Log-Lesen** (R-14 geschlossen),
Managed-Only, idempotent (`exists`)/Konfliktschutz (`conflict`). Nie Secret im Client/Audit/Agent-Response.
Details: [ADR-0023](DECISIONS.md).

**Container-Start (Step 018):** `CONTAINER_CREATED → RUNNING`, **OWNER-only**, serverseitig:
`core/container-start` → `lib/agent-client` → Agent `POST /docker/provision/start-container` →
**`docker start`** (nur bereits vorhandener managed Container). Erfordert eine **explizite
Lizenz-Checkbox** (`licenseAccepted`); ohne Zustimmung kein Start (`licenseRequired`). Audit hält die
Zustimmung fest (`docker.containerStart.licenseConfirmed`). Idempotent (`running`)/Konfliktschutz
(`conflict`)/`notFound`; **kein** `run/create/stop/rm`, **kein Log-Lesen**. `TS3SERVER_LICENSE=accept`
wird beim Create gesetzt (ENV am Start nicht ergänzbar). Details: [ADR-0024](DECISIONS.md).

**Read-only Healthcheck (Step 019):** `core/managed-health` → `lib/agent-client` → Agent
`POST /docker/provision/container-status` (**read-only**, nur Token, kein Write-Flag) via
`docker container ls` mit Label-Filtern. Trennt **Lifecycle-Status** (`provisioningStatus`, bleibt
`RUNNING`) vom **Ist-Zustand** (neue Felder `containerRuntimeStatus`, `ts3ReachabilityStatus`,
`lastHealthCheckedAt`, `lastSuccessfulHealthCheckAt`, `lastHealthErrorKey`). Optional read-only
TS3-`serverinfo` (Step-008/009-Client), wenn der Container läuft **und** eine Query-Adresse konfiguriert
ist – sonst `notConfigured` (kein Portscan). **Keine** Logs/Inspect/Reparatur.

**Managed Query-Adresse (Step 020):** Die Adresse, unter der die Web-App den TS3-ServerQuery-Port
**read-only** erreicht, wird **explizit** im `host`-Feld gespeichert (kein neues Feld). **Env-Default**
(`MANAGED_TS3_QUERY_HOST`) belegt das Provisioning-Formular vor, die **UI-Eingabe hat Vorrang**
(`resolveConfiguredQueryHost`); **nichts wird geraten**. Host wird mit der Step-008-Validierung geprüft.
Damit liefert der Healthcheck echte `reachable`/`unreachable`/`notConfigured`. Bearbeiten via OWNER-only
`updateQueryAddressAction`. Audit: `managed.queryAddress.set/updated`.

**Container-Stop (Step 021):** `RUNNING → CONTAINER_CREATED` (+ `runState='stopped'`), **OWNER-only**,
serverseitig: `core/container-stop` → `lib/agent-client` → Agent `POST /docker/provision/stop-container` →
**`docker stop --time 3`** (nur bereits vorhandener managed Container). **Kein** neuer Lifecycle-Status
(Container existiert weiter, nur gestoppt – [ADR-0025](DECISIONS.md)); ein späterer Start nutzt erneut
`CONTAINER_CREATED → RUNNING`. Idempotent (`alreadyStopped`)/Konfliktschutz (`conflict`)/`notFound`;
**kein** `rm/restart/start`, **keine Löschung**, **kein Log-Lesen**. Audit: `docker.containerStop.*`.

**Container-Remove (Step 022):** `CONTAINER_CREATED → RESOURCES_PREPARED` (+ `runState='unknown'`),
**OWNER-only** mit deutlicher Bestätigung, serverseitig: `core/container-remove` → `lib/agent-client` →
Agent `POST /docker/provision/remove-container` → **`docker rm`** (nur ein **gestoppter** managed
Container, **kein** `-f`/`-v`). Läuft er noch ⇒ `stillRunning` (zuerst stoppen); fehlt er ⇒ idempotent
`alreadyRemoved`; fremder Name ⇒ `conflict`. **Volume, Network, Credentials und der `ServerInstance`-
Record bleiben erhalten** ([ADR-0026](DECISIONS.md)). Audit: `docker.containerRemove.*`.

**Container-Restart (Step 023):** `RUNNING → Stop → Start → RUNNING`, **OWNER-only** mit erneuter
Lizenz-Checkbox. **Kein `docker restart`** und **keine** neue Agent-Aktion: `core/container-restart`
orchestriert die bestehenden **Stop**- (Step 021) und **Start**-Flows (Step 018). Kein Start bei
Stop-Fehler (`restartStopFailed`, bleibt `RUNNING`); kein `RUNNING` bei Start-Fehler
(`restartStartFailed`, `CONTAINER_CREATED`/`runState='stopped'`). Kein Reparaturverhalten bei Inkonsistenz.
Audit: `docker.containerRestart.*` ([ADR-0027](DECISIONS.md)).

**Deprovisioning-Blueprint (Step 024):** **reine, getestete Guard-/Planungslogik** in `@speakcore/shared`
(`deprovision.ts`, `executable: false`) – **noch keine Löschung**. Stufenmodell Container→Volume→Network→
Archive mit `dataLossRisk`, Bestätigungsmodell (Volume = `confirmVolumeDataLoss` + `confirmBackupRecommended`),
Managed-Only-Guards (fremde Ressourcen nie löschbar) und vordefinierten `deprovision.*`-Audit-Events. UI:
nicht-ausführende Info-Karte. Details: [ADR-0028](DECISIONS.md).

**Volume-Remove (Step 025):** erste **echte, irreversible** Löschung – `core/volume-remove` →
`lib/agent-client` → Agent `POST /docker/provision/remove-volume` → **`docker volume rm`** (**kein `-f`**),
**nur** managed Volume, **nur ohne Container**. Web-seitig erzwingt der Step-024-Guard `canRemoveManagedVolume`
die Bestätigungen (`confirmVolumeDataLoss` + `confirmBackupRecommended` + getippt `DELETE VOLUME`).
`provisioningStatus` bleibt `RESOURCES_PREPARED`; `managedVolumeState='removed'` markiert den Ist-Zustand.
**Credentials/Network/ServerInstance bleiben erhalten** ([ADR-0029](DECISIONS.md)).

**Network-Remove (Step 026):** entfernt das **geteilte** Voice-Network – `core/network-remove` →
`lib/agent-client` → Agent `POST /docker/provision/remove-network` → **`docker network rm
speakcore-network-voice`** (**kein `-f`**), **nur wenn kein managed Container** mehr existiert
(`inUseByManagedContainers` sonst). Web erzwingt `confirmNetworkUnused` (Step-024-Guard).
**Option A:** kein ServerInstance-Statusfeld (globale Ressource; Ist-Zustand via Inventory/Agent + Audit).
**Container/Volumes/Credentials/ServerInstance bleiben erhalten** ([ADR-0030](DECISIONS.md)).

**ServerRecord-Archivierung (Step 027):** abschließender Deprovisioning-Schritt, **rein Web-/DB-seitig
(kein Docker/Agent)** – `core/server-archive`. **Archivieren statt hart löschen** (`archivedAt`, ServerInstance
bleibt, Audit erhalten). Nutzt den Step-024-Guard `canArchiveManagedServer`; nur managed + `RESOURCES_PREPARED`;
mit `confirmServerRecordArchive` + **bewusster Credential-Entscheidung** (`keep`/`remove`) + getippt
`ARCHIVE SERVER`. Archivierte Server werden ausgeblendet und zeigen keine Lifecycle-Aktionen
([ADR-0031](DECISIONS.md)).

**Archiv-Ansicht (Step 028):** `/servers` bietet **Tabs „Aktiv | Archiviert"** (`listServers({ view })`,
reine Filter in `core/servers-list.ts`: `archivedAt: null` vs. `archivedAt != null`). Die archivierte
Ansicht zeigt Archiv-Badge/-Datum + Credential-Status, **ohne** neue Schreib-/Lifecycle-/Docker-/Agent-
Aktion (kein Hard-Delete, kein Unarchive).

**Server-Export (Step 029):** read-only **JSON-Export** managed Server – `core/server-export` + GET-Route
`/servers/[id]/export` (`?audit=1`), **kein Docker/Agent**, **keine DB-Schreiboperation außer Export-Audit**.
Versioniertes Format mit **explizitem Feld-Mapping** (nur nicht-geheime Metadaten + `credentialStatus`,
optional redigierte Audit-Historie). **Keine Secrets/Credentials** (`assertExportContainsNoSecrets` als
Defense-in-Depth). OWNER-only; aktive + archivierte managed Server; **kein Restore/Import/Unarchive**
([ADR-0032](DECISIONS.md)).

**Volume-Backup-Blueprint (Step 030):** **reine, getestete Guard-/Planungslogik** in `@speakcore/shared`
(`backup.ts`, `executable: false`) – **noch kein echtes Backup**. Guard (managed + gültige instanceId +
managed Volume vorhanden/nicht `removed` + Container **nicht laufend**), Bestätigungsmodell, Datei-/Metadaten-
Vorlage (`containsSecrets: "unknown"`, read-only Quelle) und `backup.managedVolume.*`-Audit-Konzept. UI:
nicht-ausführende Info-Karte ([ADR-0033](DECISIONS.md)). **Metadaten-Export ≠ Volume-Backup**
(letzteres kann sensible TS3-Daten enthalten).

**Echtes Volume-Backup (Step 032):** Agent-Aktion `BACKUP_MANAGED_VOLUME`
(`POST /docker/provision/backup-volume`, Token + Write-Flag, [ADR-0034](DECISIONS.md)): kurzlebiger,
gelabelter Hilfscontainer sichert das managed Volume **read-only** (`-v <volume>:/data:ro`) in ein
**serverseitiges** Verzeichnis (`AGENT_BACKUP_DIR`) mit **festem allowlisted Image** (`alpine:3.20`,
Existenz vorab geprüft) – statische `execFile`-Args, keine Shell, kein Client-Pfad/-Image/-Arg,
Dateiname intern (`speakcore-backup-ts3-<instanceId>-<timestamp>.tar.gz` + `.metadata.json` ohne
Secrets). **Konservativ:** nur wenn **kein** managed Container der `instanceId` existiert
(`RESOURCES_PREPARED`, nicht archiviert, Volume nicht `removed`). Web: OWNER-only, 3 Checkboxen +
getippt `CREATE BACKUP` (Step-030-Guard, Web **und** Agent), Audit `backup.managedVolume.*`,
**keine DB-Schreiboperation außer Audit**. Download/Storage-Konzept, **Restore/Import** und die
**Hard-Delete-Policy** folgen als eigene, abgesicherte Steps.

**Read-only Backup-Liste (Step 033):** `POST /docker/provision/list-backups` (Token-Gate, **kein**
Write-Flag – reine Sichtbarkeit ohne Docker/`execFile`/Shell). Listet **nur** Dateien mit striktem
Muster `speakcore-backup-ts3-<instanceId>-<timestamp>.tar.gz` aus `AGENT_BACKUP_DIR` (keine Subdirs/
Symlinks/fremden Instanzen); `.metadata.json` (max. 64 KB) wird **sanitisiert** angezeigt (nur
bekannte Felder, `instanceId`/`backupFileName` müssen passen, sonst `invalid`); `tar.gz`-Inhalte
werden nie gelesen. Web: OWNER-only Karte auf `/servers/[id]` (aktiv **und archiviert**, Laden erst
per Klick), `assertBackupListContainsNoSecrets` als Defense-in-Depth, Audit
`backup.managedVolume.list.*` **ohne Dateiliste**. **Kein** Download/Restore/Delete/Entpacken –
Sichtbarkeit vor Download, Restore oder Löschung.

**Backup-Integrität (Step 034):** neue Backups erhalten eine **SHA-256-Prüfsumme** (verschachteltes
`checksum`-Objekt in `metadata.json`; serverseitig gestreamt via `node:crypto` – kein Docker/execFile/
Shell, kein Entpacken). Response enthält `checksumSha256` (kein Secret); die Backup-Liste validiert
das Feld strikt (64 Hex, `sha256`; vorhanden-aber-ungültig ⇒ `invalid`) und zeigt es gekürzt an.
**Integrität, keine Verschlüsselung/Signatur**; Audit nur als Event `checksumCreated` ohne Wert.

**Read-only Backup-Verify (Step 035):** `POST /docker/provision/verify-backup` (Token-Gate, **kein**
Write-Flag). `instanceId` + Dateiname werden **strikt** validiert (exaktes Instanz-Muster, keine
Pfadbestandteile); die Metadaten-Datei wird intern abgeleitet, sanitisiert und die **neu berechnete**
SHA-256 (gestreamt, kein Entpacken) mit dem `checksum`-Wert verglichen ⇒
`valid/mismatch/metadataMissing/checksumMissing/…`. **Keine Schreibaktion** (kein Nachrüsten
fehlender Prüfsummen – Option A). Web: OWNER-only „Prüfsumme prüfen" pro Backup-Eintrag (auch für
archivierte managed Server), Ergebnis-Banner in der Backup-Liste; Audit
`backup.managedVolume.verify.*` (+ `verify.mismatch`) bewusst **ohne Dateinamen/Prüfsummenwerte**.

**Backup-Download-Blueprint (Step 036, [ADR-0035](DECISIONS.md)):** **reine, getestete
Guard-/Planungslogik** (`backup-download.ts` in `@speakcore/shared`, `executable: false`) – **kein
Download, kein Streaming, keine Route**. Guards: managed + OWNER + striktes Dateinamensmuster +
Backup existiert + Metadaten gültig + Checksum vorhanden + **Verify `valid` als harte Regel** +
Rate-Limit + 2 Bestätigungen + getippt `DOWNLOAD BACKUP`. **Zielbild Option A:** Web-proxied
Streaming (Browser → Web → Agent → Browser; nie Browser→Agent, kein Buffering). Policies modelliert
(5/h, 20/Tag, Timeout 600 s, Warnung ab 1 GiB); Audit `backup.managedVolume.download.*` ohne
Inhalt/Dateiname.

**Web-proxied Backup-Download (Step 037, [ADR-0036](DECISIONS.md)):** Umsetzung des Blueprints.
Browser → `POST /[locale]/servers/[id]/backups/download` (OWNER-only, Bestätigungen ohne Defaults:
2 Checkboxen + getippt `DOWNLOAD BACKUP`) → Rate-Limit **5/h je Owner+Server** → **Verify direkt
vor Download** (Option A: SHA-256 serverseitig erneut geprüft, nur `valid` streamt) → serverseitiger
Agent-Call `GET /docker/provision/download-backup` (Token-Gate, striktes Instanz-Muster, nur
`tar.gz`, nie `.metadata.json`) → Stream wird **ohne Komplett-Einlesen** durchgereicht
(Backpressure, Gesamttimeout 600 s). **Nie Browser→Agent.** Audit
`download.requested/blocked/confirmed/started/failed` ohne Dateiname/Prüfsumme – **`started` ist
der letzte zuverlässige Punkt**, `completed` wird ehrlich nicht geloggt. UI: Download-Form nur nach
frisch bestätigtem Verify-`valid`.

**Checksum-Backfill (Step 038):** `POST /docker/provision/backfill-backup-checksum` (Token-Gate,
kein Docker-Write-Flag – keine Docker-Aktion; Datei-Schreibaktion durch explizite Bestätigung +
OWNER-Flow gedeckt). Trägt bei Step-032-Backups **ohne** Prüfsumme eine SHA-256 in die
`.metadata.json` nach – die **tar.gz bleibt unverändert**. **Kein Blind-Merge:** Metadaten werden
sanitisiert gelesen und **normalisiert** neu geschrieben (nur bekannte Felder + `checksum`);
vorhandene Prüfsumme ⇒ `alreadyPresent` ohne Schreibaktion (idempotent). Web: OWNER-only Button
„Prüfsumme nachtragen" nur bei gültigen Metadaten ohne Prüfsumme (auch archivierte Server); Audit
`backup.managedVolume.checksumBackfill.*` ohne Dateiname/Prüfsumme.

**Backup-Delete/Rotation-Blueprint (Step 039, [ADR-0037](DECISIONS.md)):** **reine, getestete
Guard-/Planungslogik** (`backup-delete.ts` in `@speakcore/shared`, `executable: false`) – **kein
Löschen, keine Route, keine Dateioperation**. Einzel-Delete-Guards: managed + OWNER + striktes
Dateinamensmuster + Backup existiert + 3 Bestätigungen + getippt `DELETE BACKUP`
(`dataLossRisk: irreversible`; Ziel wäre genau eine Datei + metadata.json, nie Wildcards/Ordner).
**Verify ist für Delete nur Warnung** (verifyMismatch/neverVerified/metadataMissing/
checksumMissing/onlyBackup/serverArchived/largeFile blockieren nicht). **Rotation nur als
Dry-Run**: Policy-Modell + eigener Bestätigungssatz (`DELETE BACKUPS`), Kandidaten/Geschützte mit
Schutzgrund, Warnung `wouldDeleteAllBackups`; keine Scheduler. Audit `delete.*`/`rotation.*` ohne
Dateinamen. Echter Einzel-Delete, Rotation-Ausführung und Restore folgen je als eigene Steps.

## 7. Verwandte Dokumente

[docs/architecture/overview.md](../docs/architecture/overview.md) ·
[docs/architecture/agent.md](../docs/architecture/agent.md) ·
[docs/architecture/adapter-layer.md](../docs/architecture/adapter-layer.md) ·
[docs/architecture/security.md](../docs/architecture/security.md) · [DECISIONS.md](DECISIONS.md)
