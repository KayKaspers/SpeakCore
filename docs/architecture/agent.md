# SpeakCore Agent

> Privilegierter Dienst. Maßgeblich: [ARCHITECTURE.md](../../project-brain/ARCHITECTURE.md) §3.3,
> [SECURITY.md](../../project-brain/SECURITY.md), [ADR-0004/0005](../../project-brain/DECISIONS.md).

## Zweck

Der Agent ist die **einzige** Komponente mit Docker-/Host-Rechten. Er führt alle privilegierten
Operationen aus, die WebUI und API selbst nicht ausführen dürfen.

## Verantwortlichkeiten (0.1)

- TS3-Server als Docker-Container provisionieren, starten, stoppen, neustarten.
- Logs einsammeln und an die API liefern.
- Backup-/Restore-Operationen auf Dateisystemebene.
- Systemcheck-Sonden, die Hostzugriff erfordern (Docker-Status, Ports, Firewall, Speicher,
  Netzwerk/DNS, IPv4/IPv6) für den Preflight & Capacity Advisor.

## Schnittstelle

- Minimale, klar definierte HTTP-API; nur explizit modellierte Operationen.
- Authentifizierung über generiertes **Bootstrap-Token** ([ADR-0005](../../project-brain/DECISIONS.md)).
- Strikte Eingabevalidierung – keine ungeprüften Parameter in Docker-/Host-Aufrufe.

### Endpunkte (Stand Step 006)

| Methode | Pfad | Zweck |
|---------|------|-------|
| GET | `/health` | Status & Uptime (offen, Liveness) |
| GET | `/version` | Name/Version/NDF-Step (offen) |
| GET | `/system/snapshot` | **read-only** Systemdaten für Preflight (Token-gated, wenn gesetzt) |

## `/system/snapshot` – was gelesen wird (Step 006/007)

**Gelesen (lesend, ungefährlich):**
- **System (Step 006):** CPU-Kerne & Architektur, RAM gesamt/frei, freier Speicher am
  **Agent-Datenpfad**, OS/Plattform/Release, Node-/Agent-Version, Docker- & Compose-Verfügbarkeit
  (+ Version via `docker --version` / `docker compose version`).
- **Umgebung (Step 007):** `systemd-detect-virt` (Fallback `/proc/1/cgroup`) → VM / Container /
  Bare Metal / Unknown. Bei Unsicherheit `unknown` + `confident:false` (kein Raten).
- **Netzwerk (Step 007):** aus `os.networkInterfaces()` + `dns.getServers()` nur **Booleans/Anzahl**:
  IPv4/IPv6 vorhanden, externe Schnittstelle vorhanden, Interface-Anzahl, DNS konfiguriert (+Anzahl).
  **Keine IP-Adressen/Interface-Namen** – Screenshot-/Datenschutz-sicher.

**Ausdrücklich NICHT:** keine Container-Operationen (`ps`/`inspect`/`run`/Start/Stop), **kein
Docker-Socket** (`/var/run/docker.sock`), keine Portscans, keine Firewall-/Host-Änderungen, **keine
externen Requests/IP-Checks**, keine Router-/NAT-/UPnP-Aktionen, keine aktive Erreichbarkeitsprüfung,
keine TS3-Verbindung. CLI-Aufrufe nur mit **statischen Argumenten** über `execFile` (keine Shell →
keine Command-Injection) mit **Timeout**. Ist Docker/Umgebung nicht ermittelbar, lautet der Wert
`unknown` (nie fälschlich `absent`) – die WebUI mappt das zu „gelb", nie zu falschem „grün".

> **Öffentliche Erreichbarkeit** (offene Ports, NAT, Firewall von außen) wird **nicht** geprüft –
> das erfordert aktive/externe Tests und ist einem späteren, gesonderten Step mit eigenem
> Sicherheitskonzept vorbehalten.

> Warum kein Docker-Socket? Ein gemounteter Docker-Socket entspricht faktisch Root auf dem Host.
> Für reine Systeminformationen ist er unnötig und würde die Angriffsfläche massiv erhöhen. Eine
> sichere Docker-**Verwaltung** (Steuerung) folgt erst in späteren Steps mit eigenem Sicherheitskonzept.

## Sicherheitsprinzipien

- **Nicht öffentlich exponiert** (privates Compose-Netz / Loopback).
- **Least Privilege** – nur die wirklich benötigten Rechte.
- Jede privilegierte Aktion erzeugt einen **Audit-Log**-Eintrag.
- Roadmap-Härtung: mTLS / signierte Requests (siehe [ROADMAP.md](../../project-brain/ROADMAP.md)).

## Warum getrennt?

Die exponierte WebUI ist das primäre Angriffsziel. Durch die Trennung bleibt selbst bei einer
kompromittierten UI die Host-Kontrolle hinter einer zusätzlichen Vertrauensgrenze
(siehe [RISKS.md](../../project-brain/RISKS.md) R-01).
