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
