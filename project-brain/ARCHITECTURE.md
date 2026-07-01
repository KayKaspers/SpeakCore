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

**Stand Step 006/010/011:** umgesetzt sind ausschließlich **read-only** Endpunkte – `GET /health`,
`GET /version`, `GET /system/snapshot` sowie `GET /docker/inventory` (nur SpeakCore-managed
Ressourcen; Docker nur lesend via `ps`/`volume ls`/`network ls` mit Managed-Filter, **kein**
Docker-Socket, keine Steuerung). Für spätere Container-Aktionen ist ein
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

## 7. Verwandte Dokumente

[docs/architecture/overview.md](../docs/architecture/overview.md) ·
[docs/architecture/agent.md](../docs/architecture/agent.md) ·
[docs/architecture/adapter-layer.md](../docs/architecture/adapter-layer.md) ·
[docs/architecture/security.md](../docs/architecture/security.md) · [DECISIONS.md](DECISIONS.md)
