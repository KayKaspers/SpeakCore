# RELEASE_READINESS.md – SpeakCore Suite 0.1 Alpha

> NDF Step 031 · Stand: 2026-07-02 · Commit-Basis: `c6dd884`
> Zweck: transparente Release-Readiness-, Feature- und Sicherheitseinordnung für eine **interne 0.1 Alpha**.
> Dies ist **kein** öffentliches Release und **keine** Freigabe für produktive, exponierte Nutzung.

## Aktueller Status

**0.1 – Pre-Alpha / interne Alpha.** Fundament (Setup, Auth, Preflight), read-only TS3-Anbindung und der
**vollständige managed TS3-Lifecycle** (Prepare → Create → Start → Healthcheck → Stop/Restart → Remove) inkl.
**Deprovisioning** (Volume/Network-Remove, ServerRecord-Archivierung) sind vorhanden. Gefährlichere Fähigkeiten
(echtes Volume-Backup, Restore/Import, Hard-Delete, Unarchive) sind **bewusst noch nicht** enthalten – dafür
existieren bereits getestete **Blueprints/Guards** (Deprovisioning, Volume-Backup).

Leitsatz: **Erst Vertrauen aufbauen, dann Funktionen erweitern.**

## Feature-Matrix

### Enthalten (0.1)
| Bereich | Feature | Schritt |
|---|---|---|
| Onboarding | Setup-Wizard, Owner-Account (Argon2id) | 003 |
| Auth | Session (opaques Token + HMAC-Cookie), Login/Logout, Rate-Limit, Security-Header/CSP | 003–004 |
| Preflight | Capacity Advisor / `/systemcheck` (read-only) | 005–007 |
| Agent | `/health`, `/version`, read-only Snapshot, read-only Docker-Inventar (Managed-Only) | 006–007, 011 |
| External TS3 | Server read-only verbinden, Status/Refresh, entfernen (Credentials verschlüsselt) | 008–009 |
| Managed TS3 | Ressourcen-Prepare (Network/Volume, Flag+Token) | 010–014 |
| Managed TS3 | Secret-Prepare (verschlüsselt), Container **Create** (ENV, kein Log-Lesen) | 015, 017 |
| Managed TS3 | Container **Start** mit expliziter TS3-Lizenzbestätigung | 018 |
| Managed TS3 | read-only Healthcheck (Docker-Running-State + optional TS3), Query-Adresse | 019–020 |
| Managed TS3 | **Stop**, **Restart** (Stop→Start, kein `docker restart`) | 021, 023 |
| Deprovisioning | Container **Remove**, **Volume Remove** (Datenverlust-Schutz), **Network Remove** (Shared-Guard) | 022, 025–026 |
| Deprovisioning | ServerRecord **archivieren** (kein Hard-Delete), Archiv-Ansicht | 027–028 |
| Betrieb | Secret-**Rotation** (Operator/CLI), Metadaten-**Export** (JSON, ohne Secrets) | 016, 029 |
| Konzept | **Deprovisioning-Blueprint**, **Volume-Backup-Blueprint** (rein, `executable: false`) | 024, 030 |

### Bewusst NICHT enthalten (0.1)
- TS3 Channel-/User-/Rechteverwaltung, ServerQuery-Schreibaktionen
- **echtes** TS3-Datenbackup, **Restore**, **Import**
- **Hard-Delete** (ServerInstance), **Unarchive**, Credential-Wiederherstellung
- Docker `logs`/`inspect`/`exec`/`compose`, allgemeine Docker-Verwaltung, Docker-Socket im Web-Container
- mehrere Voice-Systeme produktiv; **TS6 / Mumble / Matrix / Jitsi** produktiv (nur architektonisch vorbereitet)

## Sicherheitsmatrix (managed Aktionen)

| Aktion | Agent | Docker-Write | Kommando | Flag | Token | OWNER | Datenverlust | Bestätigung | Audit |
|---|---|---|---|---|---|---|---|---|---|
| Ressourcen-Prepare | ja | ja | `network/volume create` | ja | ja | ja | nein | – | ja |
| Container Create | ja | ja | `docker create` (kein Start) | ja | ja | ja | nein | – (Secret per ENV) | ja |
| Container Start | ja | ja | `docker start` | ja | ja | ja | nein | **TS3-Lizenz** | ja |
| Healthcheck | ja | **nein** (read-only) | `container ls` | nein | ja | ja | nein | – | ja |
| Container Stop | ja | ja | `docker stop --time 3` | ja | ja | ja | nein | Bestätigung | ja |
| Container Restart | ja | ja | Stop→Start (**kein** `restart`) | ja | ja | ja | nein | **Lizenz** erneut | ja |
| Container Remove | ja | ja | `docker rm` (kein -f/-v) | ja | ja | ja | nein | Bestätigung | ja |
| **Volume Remove** | ja | ja | `docker volume rm` (kein -f) | ja | ja | ja | **JA** | Datenverlust + Backup + `DELETE VOLUME` | ja |
| Network Remove | ja | ja | `docker network rm` (kein -f) | ja | ja | ja | nein¹ | Bestätigung + „kein Container" | ja |
| Server Archive | **nein** | **nein** | – (rein DB) | nein | nein | ja | (Credential nur bei Wahl) | Archiv + Credential-Wahl + `ARCHIVE SERVER` | ja |
| Metadaten-Export | **nein** | **nein** | – (rein DB) | nein | nein | ja | nein | – | ja |
| Secret-Rotation | **nein** | **nein** | – (Operator/CLI) | nein | nein | Operator | nein² | env `SECRET_ENCRYPTION_KEY_NEW` | ja |

¹ Netzwerk ist geteilt: Remove nur, wenn **kein** managed Container mehr existiert. ² Rotation ist transaktional/idempotent; **Backup vor Rotation empfohlen**.

## Notwendige Env-Variablen

| Variable | Ort | Zweck | Hinweis |
|---|---|---|---|
| `DATABASE_URL` | web | SQLite-Pfad | Pflicht |
| `SESSION_SECRET` | web | Session-HMAC | **Pflicht**, ≥ 32 Zeichen |
| `SECRET_ENCRYPTION_KEY` | web | AES-256-GCM Schlüssel | **Pflicht** für Credentials/Secrets |
| `SECRET_ENCRYPTION_KEY_NEW` | web | Rotation | nur temporär; Backup vor Rotation |
| `SETUP_LOCK` | web | Owner-Erstellung sperren | in Produktion `true` nach Setup |
| `NEXT_PUBLIC_APP_URL` | web | absolute Links | – |
| `MANAGED_TS3_QUERY_HOST` | web | Healthcheck-Query-Adresse | leer = `notConfigured`, kein Raten |
| `AGENT_URL` | web | Agent-Basis-URL | nur privates Netz |
| `AGENT_BOOTSTRAP_TOKEN` | web + agent | Agent-Auth | **identisch** in beiden; nie committen |
| `AGENT_PORT` | agent | HTTP-Port | Default 4000 |
| `AGENT_DOCKER_WRITE_ENABLED` | agent | **Docker-Write-Freischaltung** | **Default false**; ohne Flag `writeDisabled` |
| `AGENT_DATA_PATH` | agent | Snapshot-Speicherpfad | optional |

Details/Kommentare: [`apps/web/.env.example`](../apps/web/.env.example), [`apps/agent/.env.example`](../apps/agent/.env.example).

## Migrationsstatus

9 Prisma-Migrationen (SQLite), non-interaktiv via `prisma migrate deploy` anwendbar (`migrate dev` benötigt in
dieser Umgebung ein TTY). Letzte: `20260702140000_add_server_archive`. Anwenden:
`DATABASE_URL="file:./dev.db" pnpm --dir apps/web exec prisma migrate deploy`.

## Teststatus

`pnpm lint` / `typecheck` / `build` / `test` grün. **332 Tests** (49 shared + 176 web + 107 agent), inkl.
Quell-Scans gegen verbotene Docker-Kommandos, Secret-Leak-Tests und Guard-/Audit-Tests. Prisma-Schema
seit Step 027 unverändert (Step 031 ohne Schema-Change).

## Manuelle Smoke-Checks

Siehe [`docs/operations/smoke-checks.md`](../docs/operations/smoke-checks.md) (+ optionales, **nicht-destruktives**
`scripts/smoke-check.ps1`). Kurz: install → prisma validate/deploy → lint/typecheck/test/build → web+agent
starten → Agent `/health`,`/version`,Snapshot, Docker-Inventar (read-only) → Setup-Wizard/Serverliste/Archiv/
Export manuell prüfen. **Keine destruktiven Aktionen, kein echtes Provisioning.**

## Release-Blocker & Einordnung (0.1 Alpha)

- **Keine harten Blocker** für eine **interne** Alpha bei den obigen Grenzen.
- **Nicht für öffentliche/exponierte Produktion:** kein echtes Backup/Restore, SSRF-Restrisiko (R-13),
  Key-Rotation ohne automatische Historie, TS3-Lizenzverantwortung beim Betreiber (R-05).
- `AGENT_DOCKER_WRITE_ENABLED=true` nur auf einem Host, auf dem SpeakCore managed Ressourcen verwalten darf.

## Nächste Schritte (nach 0.1)
1. **Echter Volume-Backup-Step** (nutzt Step-030-Guard; read-only Quelle, gestoppter Container).
2. Backup-Download-/Storage-Konzept.
3. **Restore/Import** – nur mit eigenem Security-Design.
4. Read-only **Healthcheck-/ServerQuery**-Erweiterung; ggf. Agent-vermittelter Query-Proxy.
5. **Hard-Delete-Policy** – ganz zuletzt, nach Backup-/Export-Konzept.
