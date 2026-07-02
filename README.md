# SpeakCore Suite

> Eine moderne, selbsthostbare Plattform zur Installation, Verwaltung und Überwachung
> von Voice- und Community-Servern.

**Status:** `0.1 – Pre-Alpha / NDF Step 001 (Projektinitialisierung)`
**Lizenz:** Open Source (Lizenz noch festzulegen – siehe [offene Punkte](project-brain/DECISIONS.md))

---

## Was ist SpeakCore?

SpeakCore Suite ist **kein einfaches Webpanel**, sondern eine vollständige Self-Hosting-Suite
mit Setup-Assistent, Systemcheck, Serverinstallation, Verwaltung, Backup/Restore, Monitoring
und integrierter Hilfe. Der Leitsatz des Projekts lautet:

> **Erst Vertrauen aufbauen, dann Funktionen erweitern.**

Version `0.1` ist bewusst klein, stabil, sicher und professionell gehalten und unterstützt
**ausschließlich TeamSpeak 3** als erste produktive Zielplattform. Weitere Systeme
(TeamSpeak 6, Mumble, Matrix, Jitsi) sind architektonisch vorbereitet, aber **nicht** Teil von 0.1.

## Schnellüberblick

| Bereich        | 0.1 |
|----------------|-----|
| Installation   | Docker-first, optionales Setup-Script |
| Onboarding     | Webbasierter Setup-Wizard, Simple & Expert Mode |
| Sprachen       | Deutsch / Englisch |
| Umgebungscheck | Preflight & Capacity Advisor (Ampelsystem) |
| Voice-Server   | TeamSpeak 3 (First-Class) |
| Betrieb        | Start/Stop/Restart, Logs, Dashboard |
| Datensicherung | Backup & Restore |
| Sicherheit     | Safe Defaults, Audit-Log, generierte Secrets |

## Projektdokumentation (NDF Project Brain)

Die gesamte Planungs- und Architekturdokumentation liegt im
[`project-brain/`](project-brain/)-Verzeichnis (Nova Development Framework):

- [PROJECT.md](project-brain/PROJECT.md) – Vision, Ziele, Leitsätze
- [MVP.md](project-brain/MVP.md) – verbindlicher Scope für 0.1
- [ARCHITECTURE.md](project-brain/ARCHITECTURE.md) – Systemarchitektur & Komponenten
- [DECISIONS.md](project-brain/DECISIONS.md) – Architekturentscheidungen (ADR)
- [ROADMAP.md](project-brain/ROADMAP.md) – Releaseplanung
- [RISKS.md](project-brain/RISKS.md) – Risikoregister
- [SECURITY.md](project-brain/SECURITY.md) – Sicherheitskonzept
- [BRANDING.md](project-brain/BRANDING.md) – Corporate Design
- [WORKFLOW.md](project-brain/WORKFLOW.md) – Arbeitsweise & Konventionen
- [CHANGELOG.md](project-brain/CHANGELOG.md) – Änderungshistorie

Benutzer- und Betriebsdokumentation: [`docs/`](docs/README.md).
Design-System & Tokens: [`branding/`](branding/README.md).

## Architektur in einem Satz

```
WebUI  →  SpeakCore API  →  Adapter Layer  →  TS3 Adapter  →  TeamSpeak 3 ServerQuery
                         ↘  SpeakCore Agent  →  Docker / Host
```

Die **WebUI kontrolliert niemals direkt Docker, Host oder TeamSpeak.** Alle privilegierten
Aktionen laufen ausschließlich über den **SpeakCore Agent**. Details:
[ARCHITECTURE.md](project-brain/ARCHITECTURE.md).

## Monorepo & Entwicklung

Ab NDF Step 002 ist ein **Monorepo** (pnpm Workspaces) vorhanden – ein **technisches
Grundgerüst ohne fachliche Features** (keine TS3-Verbindung/-Installation, keine echte
Docker-Steuerung).

```text
apps/web      SpeakCore WebUI + API (Next.js, TS, Tailwind, next-intl, Prisma) – Skeleton
apps/agent    SpeakCore Agent (node:http) – /health & /version
packages/     types · shared · config (geteilte Typen/Konstanten/tsconfig)
```

Voraussetzungen: **Node.js ≥ 20** und **pnpm ≥ 9** (`corepack enable`).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env      # DATABASE_URL + SESSION_SECRET (zwingend!) setzen
pnpm --filter @speakcore/web db:migrate     # SQLite-Migration anwenden + Prisma Client
pnpm dev                                     # web (:3000 → /de) + agent (:4000) parallel

# Qualitäts-Checks
pnpm lint && pnpm typecheck && pnpm build && pnpm test
```

Beim ersten Aufruf öffnet sich der **Setup-Wizard**: Systemmodus wählen und den **Owner-Account**
anlegen (Passwort Argon2id-gehasht). Danach Login/Dashboard. `SESSION_SECRET` ist Pflicht
(z. B. `openssl rand -hex 32`); `SETUP_LOCK=true` sperrt die Owner-Erstellung dauerhaft.

Docker (Skeleton): `docker compose up --build` (web + agent; Agent ohne Host-/Docker-Rechte).

## Funktionsstand

- **Vorhanden (Step 003):** Setup-Wizard, lokaler Owner-Account, Argon2id, Sessions/Login/Logout,
  geschütztes Dashboard, Audit-Log, generischer Adapter-**Typvertrag**.
- **Härtung (Step 004):** DB-gestütztes Login-/Setup-Rate-Limiting, zentrale Security-Header +
  Baseline-CSP, Session-Cleanup.
- **Preflight (Step 005–007):** Bewertungslogik + `/systemcheck` mit echten read-only Agent-Daten
  (System, Umgebung, Netzwerk) und Demo-Fallback.
- **TS3 (Step 008–009):** bestehenden TeamSpeak-3-Server **read-only verbinden** (`/servers`),
  Basisstatus ansehen, **aktualisieren** und Server wieder **entfernen** (Credentials werden gelöscht);
  Query-Zugänge verschlüsselt gespeichert (`SECRET_ENCRYPTION_KEY`).
- **Agent-Docker (Step 010–026):** Sicherheitsfundament + read-only Inventar; als OWNER hinter
  Feature-Flag (`AGENT_DOCKER_WRITE_ENABLED`) + Token das kontrollierte Anlegen von managed
  Network/Volume; persistente managed `ServerInstance` (`RESOURCES_PREPARED`), Container-Vorbereitung
  (`CONTAINER_PENDING`) inkl. verschlüsseltem Secret, **echte Container-Erstellung**
  (`CONTAINER_CREATED`, `docker create`) mit Secret-Übergabe per ENV (kein Log-Lesen) und **Container-
  Start** (`RUNNING`, `docker start`) nach **expliziter TS3-Lizenzzustimmung**; **read-only Healthcheck**
  (`docker container ls`) zeigt den Ist-Zustand (Container läuft? optional TS3 erreichbar?) getrennt vom
  Lifecycle-Status. Ab Step 020 eine **explizite Query-Adresse** (Env-Default `MANAGED_TS3_QUERY_HOST` +
  UI-Override) aktiviert den read-only TS3-Check (`reachable`/`unreachable`/`notConfigured`) — **kein**
  Log-Lesen/Inspect/Portscan, kein Raten, keine Reparatur. Ab Step 021 lässt sich der Container
  **stoppen** (`docker stop`, zurück auf `CONTAINER_CREATED` + `runState=stopped`) — **ohne Löschung**,
  ohne `rm`/`restart`. Ab Step 022 lässt sich ein **gestoppter** Container **entfernen** (`docker rm` ohne
  `-f`/`-v`, zurück auf `RESOURCES_PREPARED`) — **Volume, Network, Credentials und ServerInstance bleiben**.
  Ab Step 023 lässt sich ein laufender Container **neu starten** — als **Stop→Start-Orchestrierung**
  (`RUNNING → Stop → Start → RUNNING`), **ohne** `docker restart`, mit erneuter Lizenzbestätigung.
- **Deprovisioning-Blueprint (Step 024):** getestetes Sicherheits-/Planungsfundament (Stufen Container →
  Volume → Network → Archiv, Datenverlust-/Bestätigungs-/Managed-Only-Guards). Ab **Step 025** ist die erste
  echte Stufe aktiv: **Datenvolume löschen** (`docker volume rm`, **ohne Force**, nur ohne Container, mit
  Doppelbestätigung + getippt `DELETE VOLUME`) — Credentials/Network/ServerInstance bleiben erhalten. Ab
  **Step 026** das **geteilte Voice-Netzwerk** entfernen (`docker network rm`, **ohne Force**, nur wenn kein
  managed Container mehr existiert, mit Bestätigung) — Container/Volumes/Credentials/ServerInstance bleiben.
  Ab **Step 027** den **Servereintrag archivieren** (rein DB-seitig, kein Docker/Agent, **kein Hard-Delete**,
  Credential-Löschung nur bei ausdrücklicher Wahl, getippt `ARCHIVE SERVER`). Ab **Step 028** sind archivierte
  Server über die **Serverliste** (Tabs „Aktiv | Archiviert") auffindbar — rein lesend, ohne Lifecycle-Aktionen.
  Ab **Step 029** lässt sich ein managed Server als **JSON exportieren** (nicht-geheime Metadaten + optional
  Audit-Historie, **ohne Secrets/Credentials**, kein Docker/Agent, kein Restore). Ab **Step 030** ein
  getestetes **Volume-Backup-Konzept** (reine Guard-/Planungslogik, `executable: false`, Backup-Dateien
  gelten als sensibel) — **noch kein echtes Backup**.
- **Noch kein** echtes Volume-Backup, kein Import/Restore, kein Unarchive, keine finale Hard-Delete-Policy,
  kein Agent-vermittelter Query-Proxy.
- **Secret-Rotation (Step 016):** Grundlage zum Wechsel von `SECRET_ENCRYPTION_KEY` – Re-Encrypt aller
  gespeicherten Zugangsdaten als **Operator-/CLI-Vorgang** (`pnpm --filter @speakcore/web rotate-secrets`,
  inkl. `--dry-run`), transaktional & idempotent, **keine Web-UI/API**, keine Secret-Ausgabe.
- **Noch nicht:** read-only Healthcheck/TS3-ServerQuery-Connect zum managed Server, Stop/Remove,
  Backup/Restore, Plugin-/Community-Module.

## Mitwirken

Siehe [WORKFLOW.md](project-brain/WORKFLOW.md). Voice-Server-Verwaltung folgt in späteren Steps.
