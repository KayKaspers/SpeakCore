# SECURITY.md – Sicherheitskonzept SpeakCore Suite

> NDF Project Brain · Stand: 2026-06-30
> Sicherheit ist ein Markenwert. Leitsatz: **Safe by default.**

## 1. Schutzziele

- **Vertraulichkeit** von Secrets, Query-Zugängen, Admin-Credentials.
- **Integrität** von Konfiguration, Backups und Audit-Trail.
- **Verfügbarkeit** der verwalteten Voice-Server (kein destruktives Verhalten ohne Bestätigung).
- **Nachvollziehbarkeit** wichtiger Aktionen (Audit-Log).

## 2. Vertrauensgrenzen

```
[ Internet/Admin ] ──TLS──► [ WebUI/API (exponiert) ] ──Token/privates Netz──► [ Agent (privilegiert) ] ──► [ Docker/Host/TS3 ]
```

- Die **WebUI/API** ist die einzige exponierte Komponente und damit primäres Angriffsziel.
- Der **Agent** ist **nicht** öffentlich erreichbar und besitzt die privilegierten Rechte.
- Die WebUI hat **keine** direkten Host-/Docker-/ServerQuery-Rechte ([ADR-0004](DECISIONS.md)).

## 3. Safe Defaults (verbindlich für 0.1)

1. **Keine Standardpasswörter** – der erste Admin wird im Wizard gesetzt.
2. **Secrets automatisch generieren** – Agent-Token, interne Schlüssel, TS3-Query-Passwörter.
3. **Query-Zugänge sicher speichern** – verschlüsselt at-rest, nie im Klartext, nie im Log.
4. **Warnungen bei riskanter Konfiguration** – z. B. offene Ports, schwache Umgebung (Preflight Rot/Gelb).
5. **Least Privilege** – Agent erhält nur die nötigen Rechte; UI/API niemals Host-Rechte.

## 4. Authentifizierung & Sitzungen

Umgesetzt in Step 003 ([ADR-0012](DECISIONS.md), [ADR-0013](DECISIONS.md)):

- Passwort-Hashing: **Argon2id** via `@node-rs/argon2` (memoryCost 19456, t=2, p=1).
- **OWNER-Account** wird nur erstellt, solange kein User existiert; Setup ist nicht
  wiederholbar; zusätzlicher `SETUP_LOCK`-Guard.
- Server-seitige Sessions: opaker 32-Byte-Zufallstoken im Cookie (`HttpOnly`, `SameSite=Lax`,
  `Secure` in Produktion). In der DB nur der **HMAC-SHA256-Hash** des Tokens (Schlüssel =
  `SESSION_SECRET`) → DB-Leak liefert ohne Secret keine nutzbaren Sitzungen. Logout entwertet
  serverseitig.
- Login liefert **generische** Fehlermeldungen (kein User-Enumeration-Leak); Fehlversuche werden
  auditiert.
- Formulare laufen über **Next.js Server Actions** (Same-Origin/CSRF-Mitigation); alle Prüfungen
  sind server-seitig autoritativ – Client-Validierung dient nur der UX.
- **Rate-Limiting** (Step 004): server-seitig, DB-gestützt (SQLite, [ADR-0014](DECISIONS.md)).
  Login: max. 10 Fehlversuche / 15 min je **IP und** Identifier; Setup: max. 5 / 15 min je IP.
  Erfolg setzt den Login-Zähler zurück; Sperren werden auditiert (`*.rate_limited`).
  Grenze: Single-Node-Zähler; IP aus Proxy-Headern (nur hinter vertrauenswürdigem Proxy belastbar).
- Kein externer IdP in 0.1 (Roadmap).

## 4a. Security-Header & CSP (Step 004)

Zentral in der Next.js-Middleware gesetzt ([ADR-0015](DECISIONS.md), `lib/security-headers.ts`):

- `Content-Security-Policy` (Baseline, s. u.)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (+ CSP `frame-ancestors 'none'`)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`
- `Strict-Transport-Security` – **nur in Produktion**

**Baseline-CSP:** `default-src 'self'`; `base-uri`/`form-action 'self'`; `frame-ancestors 'none'`;
`object-src 'none'`; `img-src`/`font-src 'self' data:`; `style-src 'self' 'unsafe-inline'`;
`script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'`/`ws:` nur im Dev für HMR).

> **Limitierung:** `'unsafe-inline'` für Skripte ist nötig, weil Next.js Inline-Hydration-Skripte
> ohne Nonce ausliefert. Das schwächt den XSS-Schutz der CSP. Upgrade auf eine **nonce-basierte
> CSP** ist als Härtungsschritt vorgemerkt ([RISKS.md](RISKS.md) R-11).

## 5. Secret-Management

- Secrets ausschließlich über Umgebung/sicheren Store, **niemals** im Repository
  (siehe `.gitignore`: `.env*`, `secrets/`, `*.key`, `*.pem`, `*.sqlite`).
- `.env.example` dokumentiert benötigte Variablen ohne echte Werte.
- TS3-Query-Credentials (external **und** managed) werden **verschlüsselt** persistiert:
  **AES-256-GCM**, Schlüssel aus `SECRET_ENCRYPTION_KEY` ([ADR-0018](DECISIONS.md)). Ohne Schlüssel
  keine Speicherung; nie im Klartext, nie im Log/Audit, nie im Client.
- **Key-Rotation (Step 016, [ADR-0022](DECISIONS.md)):** `SECRET_ENCRYPTION_KEY` kann rotiert werden,
  indem alle `ServerCredential` mit dem alten Schlüssel ent- und mit einem neuen (`SECRET_ENCRYPTION_KEY_NEW`)
  wieder verschlüsselt werden (Format bleibt `v1`). Ausschließlich **Operator-/CLI-Vorgang**
  (`pnpm --filter @speakcore/web rotate-secrets [--dry-run]`) – **keine Web-UI, keine Route, keine API**.
  **Dry-Run** ändert nichts; der echte Lauf schreibt **transaktional** (all-or-nothing) und ist
  **idempotent** (bereits rotierte Werte werden übersprungen). Fehlt ein Schlüssel oder sind beide
  gleich, bricht der Vorgang kontrolliert ab. Ausgabe/Audit enthalten **nur Zählwerte**, nie Secrets
  oder Schlüssel. **Empfehlung: DB-Backup vor Rotation.**

## 4b. TS3-Verbindungen (read-only, Step 008)

- Nur **eingeloggte OWNER** können Server verbinden/ansehen (Server Actions, CSRF-Mitigation).
- Es werden **ausschließlich read-only** ServerQuery-Kommandos genutzt (`login`/`use`/`serverinfo`);
  **keine** Steuerung (kein Stop/Edit/Kick/Ban/Channel-/Gruppen-/Dateiaktionen). Timeouts gesetzt;
  Fehlermeldungen generisch (kein Secret-/Detail-Leak); Query-Antworten werden nicht ungefiltert
  an den Client gegeben.
- **SSRF-Härtung:** Host-Eingaben werden validiert; Cloud-Metadaten (`169.254.169.254`), Link-Local
  und `0.0.0.0`/`::` sind blockiert. Private LAN/localhost bleiben erlaubt (legitimes Self-Hosting)
  – das verbleibende SSRF-Restrisiko ist in [RISKS.md](RISKS.md) R-13 dokumentiert. Verbindungstests
  **und Status-Aktualisierungen** sind rate-limitiert.
- **Status-Snapshot (Step 009):** Es werden nur nicht-sensible Status-Metadaten persistiert
  (erreichbar, Name/Version/Plattform/Clients/Uptime, generischer Fehlerschlüssel) – **keine
  Secrets, keine rohen ServerQuery-Antworten**. **Server entfernen** löscht die Credentials per
  DB-Cascade und baut **keine** Verbindung zum TS3-Server auf.

## 6. Agent-Sicherheit

- Authentifizierung via generiertem **Bootstrap-Token** ([ADR-0005](DECISIONS.md)).
- Minimale, klar definierte API-Oberfläche; nur explizit modellierte Operationen.
- Eingabevalidierung aller Parameter (keine Shell-Injection in Docker-/Host-Aufrufe).
- Roadmap-Härtung: mTLS / signierte Requests, Audit jeder privilegierten Operation.

### Agent Docker Safety Foundation (Step 010 – Konzept, noch keine Ausführung)

- **Der Agent ist KEIN allgemeines Docker-Admin-Interface** ([ADR-0019](DECISIONS.md),
  [ADR-0020](DECISIONS.md)). Vorgesehen ist ausschließlich eine **eng definierte Aktions-Allowlist**
  (`AgentActionType`), keine freien Nutzerparameter.
- **Managed-Only:** SpeakCore verwaltet später nur selbst erzeugte Ressourcen (Labels
  `speakcore.managed=true` + Namenspräfixe). Löschen/Steuern nur bei gültigen Managed-Labels.
- **Docker-Zugriff:** Docker-CLI über den Agent, Argumente **intern/statisch** aus einem validierten
  Plan. **Docker-Socket in WebUI/Web-Container ist verboten**; ein Socket im Agent bedürfte
  separater Begründung + Härtung.
- **Verboten (immer abgelehnt):** privileged, Docker-Socket-Mount, Host-Mounts/Pfade, freie
  Docker-Args, Images außerhalb der Allowlist, reservierte Ports im Simple Mode.

**Erste Write-Aktion (Step 012, [ADR-0021](DECISIONS.md)):** `POST /docker/provision/prepare` legt
**nur** managed **Network + Volume** an (kein Container/Start). Doppelter Schutz: **Token-Gate** +
**Feature-Flag** `AGENT_DOCKER_WRITE_ENABLED` (Default `false` ⇒ `writeDisabled`). Input wird
server-seitig **re-validiert** (Step-010-Logik); Ressourcen nur aus dem internen Plan (keine freien
Docker-Parameter). Idempotent; gleichnamige **fremde** Ressource ⇒ `conflict` (nie anfassen/löschen).
Kein Socket/Shell; Ergebnis ohne Secrets/Hostpfade. Rollback rein deklarativ (kein automatisches `rm`).

**Web-Auslösung (Step 013):** nur **OWNER** über eine Server Action (`/servers/provision`), die den
Agent **serverseitig** aufruft. **Agent-URL/Token bleiben serverseitig** (nie im Client); kein
direkter Browser→Agent-Aufruf; keine freien Docker-Parameter (Input server-seitig aus festen Werten
gebaut + re-validiert). Normalisierte **Audit-Events** werden in der DB persistiert – **ohne Secrets/
Roh-Agent-Details**. Rate-limitiert. Bei deaktiviertem Flag: klarer `writeDisabled`-Hinweis, keine
automatische Aktivierung.

**Managed ServerInstance (Step 014):** Vorbereitete Ressourcen werden persistent gebunden
(`mode = "managed"`, `instanceId`, `provisioningStatus`). **`instanceId`, Docker-Namen und Labels
werden ausschließlich server-seitig** aus dem validierten Plan erzeugt – **kein** Nutzereinfluss.
Der Record enthält **keine Secrets/Roh-Agent-/Docker-Daten**. `writeDisabled`/`unavailable`/
`unreachable` führen **nicht** zu einem irreführenden „prepared"-Status (bleibt DRAFT).

**Container-Vorbereitung (Step 015):** Übergang `RESOURCES_PREPARED → CONTAINER_PENDING` (OWNER-only,
**kein Docker/Agent**). SpeakCore **generiert das ServerQuery-Admin-Secret selbst** (alphanumerisch,
≥ 32 Zeichen) und speichert es **verschlüsselt** ([ADR-0018](DECISIONS.md)) – **nie** im Client/Log/
Audit, **nicht** aus Docker-Logs gelesen (frühe R-14-Entschärfung). Ohne `SECRET_ENCRYPTION_KEY`
bricht die Aktion ab (Status unverändert). Idempotent (kein Überschreiben bestehender Credentials).
**Container-Erstellung ohne Start (Step 017, [ADR-0023](DECISIONS.md)):** Übergang
`CONTAINER_PENDING → CONTAINER_CREATED`. Der Agent führt **nur `docker create`** aus (nie `run`/`start`),
hinter **Token + `AGENT_DOCKER_WRITE_ENABLED`**, aus einem revalidierten Plan (fester Name/Netzwerk/
named Volume – **kein Host-Mount**, Ports/Restart aus Allowlist, Managed-Labels). Das Query-Admin-Secret
wird **serverseitig entschlüsselt**, dem Agent übergeben und als Container-**ENV**
`TS3SERVERQUERY_ADMIN_PASSWORD` gesetzt ⇒ **kein Zufallspasswort in Logs, kein Log-Lesen** (R-14
geschlossen). OWNER-only, Idempotenz (`exists`) + Konfliktschutz (`conflict`). Kein Browser→Agent; Secret
nie im Client/Audit/Agent-Response. **Kein** `stop/rm/inspect/exec/cp/logs`, **kein** compose, **kein**
Socket/privileged.

**Container-Start mit Lizenzzustimmung (Step 018, [ADR-0024](DECISIONS.md)):** Übergang
`CONTAINER_CREATED → RUNNING`. Der Agent führt **nur `docker start`** aus (nie `run`/`create`), hinter
**Token + `AGENT_DOCKER_WRITE_ENABLED`**, **nur** für einen bereits vorhandenen, per Label geprüften
**managed** Container (Name aus `instanceId`). **Explizite TS3-Lizenzzustimmung** ist Pflicht
(Web-Checkbox ohne Vorab-Default **und** `licenseAccepted === true` im Agent-Request); ohne Zustimmung
kein Start. Die Zustimmung wird auditiert (`docker.containerStart.licenseConfirmed`). `TS3SERVER_LICENSE=accept`
ist eine nicht-geheime ENV, die beim **Create** gesetzt wird (am Start nicht ergänzbar); der Serverlauf
wird durch die Zustimmung freigegeben. OWNER-only, Idempotenz (`running`) + Konfliktschutz (`conflict`) +
`notFound` (kein falscher RUNNING). **Kein** `run/create/stop/rm/inspect/exec/cp/logs`, **kein** compose,
**kein Log-Lesen**, keine Portprüfung/Healthchecks/ServerQuery. Kein Browser→Agent; keine Secrets im
Request/Ergebnis/Audit. **SpeakCore stellt nur die Verwaltung bereit; Lizenz-Einhaltung liegt beim Nutzer**
(RISKS R-05).

**Read-only Healthcheck (Step 019):** Der Agent-Endpunkt `/docker/provision/container-status` ist
**read-only** (nur Token-Gate, **kein** Write-Flag): `docker container ls` mit Label-Filtern
(`managed=true` + `instanceId`), Name intern abgeleitet. **Kein** `inspect/logs/exec/start/stop/rm/run/
create`, kein compose, kein Socket, **kein Log-Lesen**, keine Portscans, **keine Reparatur**. Der
**Lifecycle-Status** (`provisioningStatus`) wird **nicht** überschrieben; separate Healthcheck-Felder
zeigen den Ist-Zustand (Container läuft/beendet/…; TS3 erreichbar/unbekannt/nicht konfiguriert). Der
optionale **TS3-Check** nutzt nur read-only ServerQuery-Kommandos (`login/use/serverinfo/version`) und
läuft nur bei laufendem Container mit konfigurierter Query-Adresse (sonst `notConfigured` – kein Raten).
Es werden **keine** Roh-Docker-/TS3-Ausgaben und **keine** Secrets gespeichert/ausgegeben.

**Managed Query-Adresse (Step 020):** Die Query-Adresse (`host`) wird **explizit** gesetzt – **Env-Default**
(`MANAGED_TS3_QUERY_HOST`) als Vorschlag, **UI-Override** hat Vorrang; **keine** automatische IP-Ermittlung,
**keine** Portscans, **keine** externen Erreichbarkeitschecks. Host wird mit der **Step-008-Validierung**
geprüft (Cloud-Metadaten/Link-Local/unspezifiziert blockiert; LAN/localhost erlaubt – Self-Hosting).
OWNER-only (Provisioning + Bearbeiten), rate-limitiert; Audit `managed.queryAddress.set/updated` ohne
Secrets/technische Dumps. External Server bleiben unverändert.

**Container-Stop (Step 021, [ADR-0025](DECISIONS.md)):** Übergang `RUNNING → CONTAINER_CREATED`
(+ `runState='stopped'`). Der Agent führt **nur `docker stop --time 3`** aus (nie `rm`/`restart`/`start`),
hinter **Token + `AGENT_DOCKER_WRITE_ENABLED`**, **nur** für einen per Label geprüften **managed**
Container (Name aus `instanceId`). **Keine Löschung** – Container/Volume/Network bleiben bestehen.
OWNER-only mit UI-Bestätigung, Idempotenz (`alreadyStopped`) + Konfliktschutz (`conflict`) + `notFound`.
**Kein** `run/create/start/restart/rm/inspect/exec/cp/logs`, **kein** compose, **kein Log-Lesen**, kein
Socket/Host-Mount. Kein Browser→Agent; keine Secrets im Request/Ergebnis/Audit.

**Container-Remove (Step 022, [ADR-0026](DECISIONS.md)):** Übergang `CONTAINER_CREATED → RESOURCES_PREPARED`
(+ `runState='unknown'`). Der Agent führt **nur `docker rm`** aus (**kein `-f`/`-v`**, nie `volume`/`network`
rm, nie `run/create/start/stop/restart`), hinter **Token + `AGENT_DOCKER_WRITE_ENABLED`**, **nur** für einen
per Label geprüften **managed**, **nicht laufenden** Container. Läuft er noch ⇒ `stillRunning` (zuerst
stoppen). **Volume, Network, Credentials und der `ServerInstance`-Record bleiben erhalten** – nur der
Container wird entfernt. OWNER-only mit **deutlicher Bestätigung**, Idempotenz (`alreadyRemoved`) +
Konfliktschutz (`conflict`). **Kein** `inspect/exec/cp/logs`, **kein** compose, **kein Log-Lesen**, kein
Socket/Host-Mount. Kein Browser→Agent; keine Secrets im Request/Ergebnis/Audit.

**Container-Restart (Step 023, [ADR-0027](DECISIONS.md)):** **Kein `docker restart`** und **keine** neue
Agent-Schreibaktion – der Restart orchestriert web-seitig die bestehenden **Stop**- und **Start**-Flows
(`RUNNING → Stop → Start → RUNNING`), deren Sicherheitsgrenzen (Token + `AGENT_DOCKER_WRITE_ENABLED`,
Managed-Only, OWNER-only, keine Löschung, kein Log-Lesen) automatisch gelten. **Erneute Lizenzbestätigung**
per Checkbox. Kein Start bei Stop-Fehler; kein `RUNNING` bei Start-Fehler. Kein Browser→Agent; keine Secrets
im Client/Audit.

**Deprovisioning-Blueprint (Step 024, [ADR-0028](DECISIONS.md)):** **reine Planungs-/Guard-Logik, es wird
NICHTS gelöscht** (`executable: false`). **Kein** `docker volume rm`/`network rm`, **kein** neues
Docker-Write-Kommando, **kein** Socket/Logs/Inspect, **kein** Löschen von ServerInstance/Credentials, keine
Migration. Stufenmodell mit **Managed-Only-Guards** (fremde Ressourcen nie löschbar; Namen nur aus
`instanceId`) und **Bestätigungsmodell**: Volume-Löschung erfordert `confirmVolumeDataLoss` +
`confirmBackupRecommended` (optional getippt `DELETE VOLUME`); Network `confirmNetworkUnused`; Archive
`confirmServerRecordArchive` + Credential-Entscheidung. Datenverlust-Risiko (Volume) ist explizit
modelliert und in der UI benannt; kein Button suggeriert echte Löschung.

**Volume-Remove (Step 025, [ADR-0029](DECISIONS.md)):** erste **echte, irreversible** Löschung. Der Agent
führt **nur `docker volume rm`** aus (**kein `-f`**, nie `network`/`container` rm), hinter **Token +
`AGENT_DOCKER_WRITE_ENABLED`**, **nur** für ein per Label geprüftes **managed** Volume und **nur wenn kein
managed Container** mehr existiert (`containerStillExists` sonst). Web erzwingt über den Step-024-Guard die
**Doppelbestätigung** `confirmVolumeDataLoss` + `confirmBackupRecommended` + getippt **`DELETE VOLUME`** (kein
Vorab-Default). **Credentials, Network und ServerInstance bleiben erhalten**; nur `managedVolumeState='removed'`.
Fehlt das Volume ⇒ idempotent `alreadyRemoved`; fremdes Volume ⇒ `conflict`. Kein Browser→Agent; keine
Secrets/Roh-Docker-Ausgaben; kein Log-Lesen.

**Network-Remove (Step 026, [ADR-0030](DECISIONS.md)):** entfernt das **geteilte** Voice-Network. Der Agent
führt **nur `docker network rm speakcore-network-voice`** aus (**kein `-f`**, nie `volume`/`container` rm),
hinter **Token + `AGENT_DOCKER_WRITE_ENABLED`**, mit **festem** Namen (keine freien Namen). **Nur wenn kein
managed Container** mehr existiert (`inUseByManagedContainers` sonst) – über `container ls` ungefiltert nach
instanceId. Web erzwingt **`confirmNetworkUnused`** (Step-024-Guard). Fehlt das Network ⇒ `alreadyRemoved`;
fremdes ⇒ `conflict`. **Container, Volumes, Credentials und ServerInstance bleiben erhalten** (Option A: kein
Statusfeld; Audit-Target = auslösende ServerInstance-ID). Kein Browser→Agent; keine Secrets/Roh-Ausgaben;
kein Log-Lesen.

**ServerRecord-Archivierung (Step 027, [ADR-0031](DECISIONS.md)):** abschließender Deprovisioning-Schritt,
**rein Web-/DB-seitig – keine Docker-/Agent-Aktion**. **Archivieren statt hart löschen** (`archivedAt` gesetzt,
`ServerInstance` bleibt, **Audit-Historie unangetastet**). OWNER-only, nur managed + `RESOURCES_PREPARED`
(external abgelehnt), mit `confirmServerRecordArchive` + **bewusster Credential-Entscheidung** (`keep`/`remove`)
+ getippt `ARCHIVE SERVER`. **Credentials werden nur bei ausdrücklicher `remove`-Wahl gelöscht** (sonst
verschlüsselt behalten). Keine Secrets im Client/Audit/Ergebnis; **kein Hard-Delete**, **keine Audit-Löschung**;
archivierte Server zeigen keine Lifecycle-Aktionen.

**Archiv-Ansicht (Step 028):** **rein lesende** UI-Ergänzung – `/servers` mit Tabs „Aktiv | Archiviert"
(`listServers({ view })`). **Keine** neue Schreibaktion, **keine** Docker-/Agent-Imports, keine Secrets im
Client, **keine Lifecycle-Aktionen bei archivierten Servern**, **kein** Hard-Delete/Unarchive/Credential-
Änderung/Audit-Löschung. Quell-Scan-Tests erzwingen dies.

**Server-Export (Step 029, [ADR-0032](DECISIONS.md)):** OWNER-only read-only **JSON-Export** managed Server
(GET `/servers/[id]/export`, optional `?audit=1`). **Rein Web-/DB-seitig – kein Docker/Agent.** **Keine
Secrets/Credentials/verschlüsselten Werte** (Credentials komplett ausgeschlossen; nur `credentialStatus`),
**keine Roh-Prisma-Objekte/Roh-Dumps**, keine Sessions/Tokens/Env-Werte. Optionale Audit-Historie **redigiert**
(nur `action/actor/target/result/createdAt`, keine Payloads). **Keine DB-Schreiboperation außer dem Export-Audit**
(ohne Exportinhalt). `assertExportContainsNoSecrets` als Defense-in-Depth; Secret-Leak-Tests. **Kein Import/
Restore/Unarchive/Hard-Delete.**

**Volume-Backup-Blueprint (Step 030, [ADR-0033](DECISIONS.md)):** **reine Planungs-/Guard-Logik, es wird
NICHTS gesichert** (`executable: false`). **Kein** Docker-Kommando/Hilfscontainer, **kein** Agent-Endpunkt,
**kein** Archivfile/Download, **kein** Restore/Import, **keine** DB-Schreiboperation, **keine** Pfad-/Shell-
Verarbeitung, **keine** Secrets. Guard: nur managed + gültige instanceId + managed Volume vorhanden (nicht
`removed`) + **Container nicht laufend** + Bestätigungen (sensibel/Storage/gestoppt, optional getippt
`CREATE BACKUP`). Fremde Ressourcen nie sicherbar. **Backup-Dateien gelten als potenziell sensibel** (nie
„secret-free"); Metadaten selbst ohne Secrets. Unterschied: **Metadaten-Export ≠ Volume-Backup**.

**Echtes Volume-Backup (Step 032, [ADR-0034](DECISIONS.md)):** `POST /docker/provision/backup-volume`
(Token + Write-Flag). Einziges erlaubtes Muster: kurzlebiger, gelabelter Hilfscontainer
(`docker run --rm … -v <volume>:/data:ro -v <AGENT_BACKUP_DIR>:/backup alpine:3.20 tar -czf …`),
ausschließlich **statische `execFile`-Args**, keine Shell, kein Socket. **Serverseitig festgelegt:**
Backup-Ziel (`AGENT_BACKUP_DIR`) und Image (allowlisted `alpine:3.20`, Existenz vorab geprüft, kein
unkontrollierter Pull) – der Client liefert **keinen** Pfad, **kein** Image, **keine** Docker-Args
(Dateiname intern generiert ⇒ keine Pfad-Traversal). Quelle strikt **read-only**. **Konservativ:**
blockiert, wenn irgendein managed Container der `instanceId` existiert (realer Pfad: Stop → Remove →
Backup bei `RESOURCES_PREPARED`). OWNER-only, 3 Bestätigungen + getippt `CREATE BACKUP` (Web **und**
Agent via Step-030-Guard, Defense-in-Depth). `metadata.json` ohne Secrets (`containsSecrets: "unknown"`);
Ergebnis nur mit Dateiname (kein Host-Pfad), keine Roh-Docker-Ausgabe. **Kein** Restore/Import/
Browser-Download; Aufbewahrung/Schutz der serverseitigen Dateien liegt beim Betreiber.

**Read-only Backup-Liste (Step 033):** `POST /docker/provision/list-backups` – Token-Gate, **kein**
Write-Flag (reine Sichtbarkeit). **Kein Docker, kein `execFile`, keine Shell, kein Socket**; gelesen
wird ausschließlich `AGENT_BACKUP_DIR` (kein Client-Pfad, keine Pfad-Traversal): nur Dateien mit
**striktem** Namensmuster der angefragten `instanceId`, keine Subdirectories, keine Symlinks, keine
fremden Dateien. `tar.gz`-Inhalte werden **nie** gelesen/entpackt; `.metadata.json` (max. 64 KB) wird
**Feld-für-Feld sanitisiert** (nur bekannte Felder, `instanceId`/`backupFileName` müssen passen,
sonst `invalid` – kein Roh-Dump). Antwort ohne Host-Pfade/Secrets; Web prüft zusätzlich
(`assertBackupListContainsNoSecrets`) und verwirft verdächtige Antworten. OWNER-only; Audit
`backup.managedVolume.list.*` ohne Dateiliste/Metadaten. **Kein** Download/Restore/Delete –
Rotation/Löschung wäre ein eigener, gefährlicher Step.

**Backup-Integrität (Step 034):** SHA-256-Prüfsumme über die erzeugte tar.gz – **reine
Integritätsinformation, keine Verschlüsselung, keine Signatur/Authentizität** (wird auch so
kommuniziert). Berechnung serverseitig gestreamt (`node:crypto`, kein execFile/Shell/Docker, kein
Entpacken, Dateiinhalt verlässt den Agent nie). Die Prüfsumme ist **kein Secret** (Response/Anzeige
erlaubt), wird aber **nicht ins Audit** übernommen (nur Event `checksumCreated`). Die Liste
akzeptiert nur strikt valide `checksum`-Objekte (`sha256`, 64 Hex) – sonst `invalid`. Backup-Dateien
bleiben **sensibel**; die Prüfsumme schützt nicht vor unbefugtem Lesen, nur vor unbemerkter
Beschädigung/Veränderung ohne Neuberechnung.

**Read-only Backup-Verify (Step 035):** `POST /docker/provision/verify-backup` – Token-Gate, **kein**
Write-Flag, **kein** Docker/`execFile`/Shell/Socket, **keine Schreibaktion** (auch kein Nachrüsten
fehlender Prüfsummen), **kein** Entpacken/Download (Dateiinhalt verlässt den Agent nie). Dateiname
wird **strikt** gegen das Instanz-Muster validiert (kein `/`/`\`/`..`, keine fremden Instanzen);
alle Zugriffe nur über `AGENT_BACKUP_DIR`. Response nur Status + Prüfsummenwerte (keine Host-Pfade,
keine Roh-Metadaten, keine Secrets). OWNER-only; Web prüft den Dateinamen zusätzlich vor
(`isSafeBackupFileName`, Defense-in-Depth). Audit `backup.managedVolume.verify.*` bewusst **ohne
Dateinamen** (keine Dateilisten im Audit) und ohne Prüfsummenwerte. Grenzen: `mismatch` erkennt
Veränderung/Beschädigung, aber **keine Authentizität** (wer Datei + metadata.json ändern kann,
kann beide konsistent halten – keine Signatur).
- **Secrets bei Provisionierung:** generieren + verschlüsselt speichern ([ADR-0018](DECISIONS.md));
  nie in Docker-Logs/Audit/Client. Beim Container-Create per **ENV** vorgegeben statt aus Logs gelesen
  (RISKS R-14 geschlossen). Container-**Start**/Betrieb: kein ungefiltertes Log-Handling (späterer Step).

### Read-only-Snapshot & Docker-Inventar (Step 006/007/011)

- Der Agent stellt bislang **ausschließlich lesende** Endpunkte bereit; `GET /system/snapshot`
  liefert ungefährliche System-, **Umgebungs-** und **Netzwerk**-Daten (CPU/RAM/Speicher/OS/Node-/
  Agent-Version, Docker-Verfügbarkeit, erkannte Umgebung, IPv4/IPv6/DNS-Status).
- `GET /docker/inventory` (Step 011, **token-gated**, read-only) listet **nur SpeakCore-managed**
  Docker-Ressourcen (Filter `speakcore.managed=true`) mit gefilterten SpeakCore-Labels –
  **keine** Rohobjekte, **keine** fremden Ressourcendetails, kein Enumerieren fremder Ressourcen.
  Keine schreibenden/inspizierenden Kommandos, kein Socket. Nicht verfügbar ⇒ `unavailable`.
- **Kein Docker-Socket**, keine Container-Operationen, keine Portscans, keine Host-Änderungen,
  **keine externen Requests/IP-Checks**, keine Router-/NAT-/UPnP-Aktionen, keine aktive
  Erreichbarkeitsprüfung. CLI (Docker/`systemd-detect-virt`) nur via `execFile` ohne Shell,
  **statische Argumente**, **Timeout**. Nicht ermittelbar ⇒ `unknown` (nie `absent`/falsch grün).
- **Datenschutz:** Netzwerkdaten werden auf **Booleans/Anzahl** reduziert – **keine IP-Adressen
  oder Interface-Namen** verlassen den Agent (Screenshot-sicher).
- **Token-Gate:** ist `AGENT_BOOTSTRAP_TOKEN` gesetzt, erfordert `/system/snapshot` ein gültiges
  Bearer-Token (401 sonst). Ohne Token nur im **privaten Compose-Netz** vorsehen, **nie öffentlich**.
- Die WebUI ruft den Agent **nur serverseitig** ab; kein Secret/keine Agent-URL gelangt in den Client.

## 7. Web-Sicherheit

- CSRF-Schutz für state-changing Requests.
- Output-Encoding / Schutz gegen XSS.
- Security-Header (CSP, `X-Content-Type-Options`, `Referrer-Policy`, HSTS bei TLS).
- Strikte Eingabevalidierung (Server-seitig, nicht nur Client).

## 8. Audit-Log

- Protokolliert mindestens: Login/Logout, Admin-Anlage, Serverinstallation,
  Start/Stop/Restart, Backup/Restore, Konfigurationsänderungen, Agent-Aufrufe.
- Einträge mit Zeitstempel, Akteur, Aktion, Ziel, Ergebnis. Keine Secrets im Log.

## 9. Backup/Restore-Sicherheit

- **Backups (seit Step 032):** read-only Quelle, serverseitiges Ziel/Image, mehrfache Bestätigung,
  Dateien gelten als **sensibel** (Betreiber-Verantwortung für Aufbewahrung/Zugriffsschutz).
- Restore ist niemals still-destruktiv; Bestätigung + Vorschau erforderlich (siehe [RISKS.md](RISKS.md) R-06).
  **Restore/Import sind in 0.1 nicht implementiert** (eigenes Security-Design, späterer Step).
- Integritätsprüfung der Backups (geplant; 0.1 erzeugt tar.gz + metadata.json ohne Prüfsumme).

## 10. Verantwortungsvolle Offenlegung (Responsible Disclosure)

- Sicherheitslücken bitte **nicht** über öffentliche Issues melden, sondern vertraulich an die
  Maintainer (Kontaktweg wird mit dem ersten öffentlichen Release festgelegt – offener Punkt).

## 11. Referenzen

[docs/architecture/security.md](../docs/architecture/security.md) · [RISKS.md](RISKS.md) ·
[DECISIONS.md](DECISIONS.md)
