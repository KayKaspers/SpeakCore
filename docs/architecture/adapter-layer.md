# Adapter Layer

> Maßgeblich: [ARCHITECTURE.md](../../project-brain/ARCHITECTURE.md) §3.4/§4,
> [ADR-0008](../../project-brain/DECISIONS.md).

## Idee

Jeder Server-Typ wird über einen **Adapter** angebunden. Die API kennt nur das generische
Adapter-Interface, nicht die Eigenheiten des konkreten Servers. So lassen sich später weitere
Systeme ergänzen, ohne API/WebUI umzubauen.

## Generisches Interface (konzeptionell, 0.1)

Ein Adapter stellt mindestens bereit:

| Operation | Zweck |
|-----------|-------|
| `connectExisting` | Verbindung zu einem bereits laufenden Server herstellen |
| `provision` | Neuen Server (über den Agent) installieren |
| `start` / `stop` / `restart` | Lebenszyklus steuern |
| `status` | Laufzustand & Basismetriken |
| `logs` | Logs abrufen |
| `backup` / `restore` | Daten sichern / wiederherstellen |

> Hinweis: Dies ist eine **konzeptionelle** Beschreibung für die Planung – noch kein Code
> (NDF Step 001).

## Implementierungsstand

- **0.1:** ausschließlich **TS3-Adapter** (TeamSpeak 3 ServerQuery).
- **Vorbereitet, nicht implementiert:** TS6-Adapter (WebQuery/API), Mumble-Adapter.

### Stand Step 008 – TS3 read-only

Erster produktiver Teil des TS3-Adapters: **bestehenden Server read-only verbinden**. Eigener,
minimaler ServerQuery-Client ([ADR-0017](../../project-brain/DECISIONS.md)) mit `login` → `use` →
`serverinfo` liefert Basisstatus (Name/Version/Plattform/Clients/Uptime/erreichbar). Query-Zugänge
werden **verschlüsselt** gespeichert ([ADR-0018](../../project-brain/DECISIONS.md)).

- **Nur read-only** – die schreibenden Methoden des generischen Interfaces (`provision`, `start`,
  `stop`, `restart`, `backup`, `restore`) sind bewusst **noch nicht** implementiert.
- Läuft im **Web-Backend**, nicht im Agent (keine Host-/Docker-Aktion nötig). Installation/Steuerung
  über den Agent folgen in späteren Steps.

**Stand Step 009 (Feinschliff):** Status kann manuell **aktualisiert** werden (persistierter
Snapshot statt Live-Connect bei jedem Aufruf); Server können **entfernt** werden (Credentials per
DB-Cascade mitgelöscht, ohne TS3-Aktion). Fehler werden **generisch** gespeichert/angezeigt (keine
Secrets/Roh-Antworten). Weiterhin **keine** Steuerung/Installation.

**External vs. Managed (ab Step 014):** `ServerInstance.mode` unterscheidet
- **`external`** – ein bestehender, read-only verbundener TS3-Server (Query-Zugang verschlüsselt).
- **`managed`** – von SpeakCore vorbereitete Ressourcen (Network/Volume) mit persistentem
  `provisioningStatus` (DRAFT → RESOURCES_PREPARED → **CONTAINER_PENDING** → **CONTAINER_CREATED** →
  **RUNNING**). Managed Records enthalten **keine** Secrets im `ServerInstance`.

**Container-Vorbereitung (Step 015):** `RESOURCES_PREPARED → CONTAINER_PENDING` erzeugt ein
**verschlüsseltes** ServerQuery-Admin-Secret (in `ServerCredential`) und finalisiert die Plan-Namen –
**ohne** Docker/Agent, **ohne** Container/Start. Das Secret wird nie angezeigt/geloggt und **nicht**
aus Docker-Logs gelesen.

**Container-Erstellung (Step 017):** `CONTAINER_PENDING → CONTAINER_CREATED` – der Adapter delegiert an
den Agent, der **`docker create` (kein Start)** ausführt. Das Secret wird **serverseitig** entschlüsselt
und dem Agent als Container-**ENV** (`TS3SERVERQUERY_ADMIN_PASSWORD`) übergeben – kein Log-Lesen
([ADR-0023](../../project-brain/DECISIONS.md)).

**Container-Start (Step 018):** `CONTAINER_CREATED → RUNNING` – nach **expliziter Lizenzzustimmung**
delegiert der Adapter an den Agent, der **`docker start`** (nur bereits vorhandener managed Container)
ausführt. `TS3SERVER_LICENSE=accept` wurde beim Create gesetzt (ENV lässt sich beim Start nicht ergänzen);
der Serverlauf wird durch die Zustimmung freigegeben ([ADR-0024](../../project-brain/DECISIONS.md)). Kein
Log-Lesen.

**Read-only Healthcheck (Step 019):** Unterscheidet **Lifecycle-Status** (`provisioningStatus`, bleibt
`RUNNING`) vom **Ist-Zustand**. Der Adapter fragt den Agent read-only nach dem Container-Laufzeitstatus
(`docker container ls`, kein Inspect/Logs) und – wenn der Container läuft und eine Query-Adresse
konfiguriert ist – optional read-only `serverinfo` (Step-008/009-Client). Ergebnis in separaten
Healthcheck-Feldern; **keine** Reparatur, **keine** Stop-/Remove-Aktion.

**Managed Query-Adresse (Step 020):** Die read-only-Query-Adresse wird **explizit** im `host`-Feld
gespeichert (Env-Default `MANAGED_TS3_QUERY_HOST` + UI-Override, **kein Raten**, Step-008-Host-Validierung).
Damit liefert der Healthcheck echte `reachable`/`unreachable`/`notConfigured` – **ohne Portscans/externe
Checks**.

**Container-Stop (Step 021):** `RUNNING → CONTAINER_CREATED` (+ `runState='stopped'`) – der Adapter
delegiert an den Agent, der **`docker stop`** (nur bereits vorhandener managed Container) ausführt. **Kein**
neuer Lifecycle-Status, **keine Löschung** (Volume/Network bleiben), kein `rm/restart`, **kein Log-Lesen**
([ADR-0025](../../project-brain/DECISIONS.md)).

**Container-Remove (Step 022):** `CONTAINER_CREATED → RESOURCES_PREPARED` (+ `runState='unknown'`) – der
Adapter delegiert an den Agent, der **`docker rm`** eines **gestoppten** managed Containers ausführt (**kein**
`-f`/`-v`). **Volume, Network, Credentials und der `ServerInstance`-Record bleiben erhalten**; läuft der
Container noch ⇒ `stillRunning` ([ADR-0026](../../project-brain/DECISIONS.md)).

**Container-Restart (Step 023):** `RUNNING → Stop → Start → RUNNING` – **kein `docker restart`** und **keine**
neue Agent-Aktion: der Web-Orchestrator ruft die bestehenden Stop-/Start-Flows nacheinander auf (erneute
Lizenz-Checkbox). Kein Start bei Stop-Fehler; kein `RUNNING` bei Start-Fehler
([ADR-0027](../../project-brain/DECISIONS.md)).

**Deprovisioning-Blueprint (Step 024):** **reine Guard-/Planungslogik** (`@speakcore/shared` `deprovision.ts`,
`executable: false`) – **noch keine Löschung**. Stufenmodell Container→Volume→Network→Archive mit
Datenverlust-/Bestätigungs-/Managed-Only-Modell ([ADR-0028](../../project-brain/DECISIONS.md)).

**Volume-Remove (Step 025):** erste **echte** Deprovisioning-Stufe – der Adapter delegiert an den Agent, der
**`docker volume rm`** (**kein `-f`**) eines **managed** Volumes **nur ohne Container** ausführt. Web erzwingt
Doppelbestätigung + getippt `DELETE VOLUME` (Step-024-Guard). **Credentials/Network/ServerInstance bleiben
erhalten**, `managedVolumeState='removed'` ([ADR-0029](../../project-brain/DECISIONS.md)).

**Network-Remove (Step 026):** entfernt das **geteilte** Voice-Network – der Adapter delegiert an den Agent,
der **`docker network rm`** (**kein `-f`**) **nur ausführt, wenn kein managed Container** mehr existiert
(`inUseByManagedContainers` sonst). Web erzwingt `confirmNetworkUnused`. **Option A:** kein Statusfeld
(globale Ressource). **Container/Volumes/Credentials/ServerInstance bleiben erhalten**
([ADR-0030](../../project-brain/DECISIONS.md)). **ServerRecord-Archive** und ein optionaler
**Agent-vermittelter Query-Proxy** folgen als eigene Steps.

## Datenfluss

```
WebUI → SpeakCore API → Adapter Layer → [TS3 Adapter] → TeamSpeak 3 ServerQuery
                                       → (später: TS6 / Mumble Adapter)
```

Privilegierte Schritte (Container/Host) delegiert der Adapter an den
[SpeakCore Agent](agent.md) – er führt sie nicht selbst aus.

## Designregel

Das Interface bleibt bewusst generisch, **ohne** über TS3 hinaus zu spekulieren. Erweiterungen
für TS6/Mumble erfolgen erst, wenn diese Adapter tatsächlich gebaut werden
(vgl. [ROADMAP.md](../../project-brain/ROADMAP.md)).
