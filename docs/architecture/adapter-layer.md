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
