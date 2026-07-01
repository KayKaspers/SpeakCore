# @speakcore/agent

SpeakCore Agent – der **privilegierte Dienst**, über den später alle Docker-/Host-/Server-Aktionen
laufen ([ARCHITECTURE.md](../../project-brain/ARCHITECTURE.md), ADR-0004/0005).

> **NDF Step 002 – nur Skeleton.** Der Agent führt **keine** Host-/Docker-Aktionen aus.
> Nur `GET /health` und `GET /version`. Token-Auth ist als Konzept (`src/auth.ts`) vorhanden,
> aber bewusst noch nicht an Endpunkte gebunden.

## Designentscheidung: minimale Abhängigkeiten

Der Agent nutzt den eingebauten `node:http`-Server – **keine** Runtime-Frameworks/Dependencies.
Begründung: kleinste Angriffsfläche und minimales Supply-Chain-Risiko für die sicherheitskritische,
privilegierte Komponente (siehe [SECURITY.md](../../project-brain/SECURITY.md), Risiko R-01).
Siehe ADR-0010 in [DECISIONS.md](../../project-brain/DECISIONS.md).

## Entwicklung

```bash
# aus dem Repo-Root
pnpm --filter @speakcore/agent dev      # tsx watch, http://localhost:4000
pnpm --filter @speakcore/agent test     # node:test über tsx
pnpm --filter @speakcore/agent build    # tsup → dist/index.js (self-contained)
```

## Endpunkte

| Methode | Pfad                | Zweck                                              |
|---------|---------------------|----------------------------------------------------|
| GET     | `/health`           | Status & Uptime (offen)                            |
| GET     | `/version`          | Name/Version/NDF-Step (offen)                      |
| GET     | `/system/snapshot`  | **read-only** Systemdaten (Step 006/007, Token-gated) |
| GET     | `/docker/inventory` | **read-only** Managed-Only Docker-Inventar (Step 011, Token-gated) |
| POST    | `/docker/provision/prepare` | **write** (Token + Flag): managed Network/Volume (Step 012, kein Container) |

`/system/snapshot` liest nur ungefährliche Daten (CPU/RAM/Speicher/OS/Node-/Agent-Version,
Docker-Verfügbarkeit via `--version`; ab Step 007 zusätzlich erkannte **Umgebung** via
`systemd-detect-virt` und **Netzwerk**-Status – nur Booleans/Anzahl, **keine IP-Adressen**).
**Kein** Docker-Socket, keine Container-Operationen, keine Steuerung, **keine externen Requests**.
Ist `AGENT_BOOTSTRAP_TOKEN` gesetzt, ist ein Bearer-Token erforderlich. Optional: `AGENT_DATA_PATH`
legt den Pfad fest, dessen freier Speicher gemeldet wird (Default cwd).
