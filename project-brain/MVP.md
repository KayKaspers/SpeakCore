# MVP.md – Verbindlicher Scope für SpeakCore 0.1

> NDF Project Brain · Stand: 2026-06-30
> Dieses Dokument ist **verbindlich**. Änderungen nur per Eintrag in [DECISIONS.md](DECISIONS.md).

## 1. Grundsatz

SpeakCore 0.1 ist **klein, stabil, sicher, professionell** und ausschließlich auf
**TeamSpeak 3** fokussiert. Was hier nicht gelistet ist, ist **nicht** Teil von 0.1.

## 2. Pflichtumfang 0.1 (MUST)

| #  | Feature | Akzeptanzkriterium (Kurz) |
|----|---------|---------------------------|
| 1  | Docker-first Installation | `docker compose up` startet die Suite |
| 2  | Optionales Setup-Script für Einsteiger | One-Liner prüft Voraussetzungen & startet Wizard |
| 3  | Webbasierter Setup-Wizard | Geführter Erststart bis lauffähiger Zustand |
| 4  | Admin-Account-Erstellung | Erster Admin wird im Wizard sicher angelegt |
| 5  | Mehrsprachigkeit DE/EN | Vollständige UI-Übersetzung, umschaltbar |
| 6  | Simple Mode & Expert Mode | Umschaltbar; Simple blendet Risiko-Optionen aus |
| 7  | Preflight & Capacity Advisor (Core) | Ampelbewertung vor Installation |
| 8  | Bewertung Installationsumgebung | Erkennung/Bewertung: Proxmox VM, Proxmox LXC, Bare Metal, VPS/Rootserver, NAS/Home |
| 9  | Systemcheck | CPU, RAM, freier Speicher, Docker, Compose, OS, Netzwerk, Ports, Firewall, IPv4/IPv6, DNS, Backup-Speicher |
| 10 | TS3 als First-Class-Servertyp | TS3 ist erstklassig modelliert, nicht „angeflanscht" |
| 11 | Bestehenden TS3-Server verbinden | Verbindung via ServerQuery zu vorhandenem Server |
| 12 | Neuen TS3-Server per Agent installieren | Agent installiert TS3 als Docker-Container |
| 13 | TS3 Start / Stop / Restart | Über UI → API → Agent |
| 14 | Logs anzeigen | TS3- und Agent-Logs in der UI |
| 15 | Basis-Dashboard | Status, Ressourcen, Serverübersicht |
| 16 | Backup & Restore | TS3-Daten sichern und wiederherstellen |
| 17 | Integrierte Hilfe / Dokumentation | Kontextbezogene Hilfe (DE/EN) in der UI |
| 18 | Audit-Log | Wichtige Aktionen werden protokolliert |
| 19 | Safe Defaults | Keine Standardpasswörter; Secrets generiert; Query-Zugänge sicher; Warnungen bei Risiko |

## 3. Preflight-Ampellogik (Core-Verhalten)

| Ampel | Bedeutung | Simple Mode | Expert Mode |
|-------|-----------|-------------|-------------|
| 🟢 Grün | geeignet | fortfahren | fortfahren |
| 🟡 Gelb | möglich mit Einschränkungen | fortfahren mit Hinweis | fortfahren mit Hinweis |
| 🔴 Rot  | nicht empfohlen | **blockiert** | nur mit bewusster Warnbestätigung |

## 4. Explizit NICHT in 0.1 (OUT OF SCOPE)

Nur als spätere Roadmap/Architekturvorbereitung erlaubt:

- TeamSpeak 6 produktiv
- Mumble
- Matrix / Element
- Jitsi
- Plugin-Store
- Community-Portal
- Tickets
- Events
- Discord-Integration
- native Android-/iOS-App

## 5. Definition of Done für 0.1

- Alle MUST-Features (Tabelle §2) umgesetzt und getestet (Unit + API + E2E-Smoke).
- Safe Defaults und Audit-Log greifen nachweisbar.
- DE/EN vollständig.
- Installationswege aus [docs/installation/](../docs/installation/) verifiziert (mind. Docker + ein weiterer).
- Keine bekannten kritischen Sicherheitsmängel (siehe [SECURITY.md](SECURITY.md), [RISKS.md](RISKS.md)).

## 6. Bewusst verschoben (Architektur nur vorbereiten)

- Adapter-Layer ist generisch, aber nur der **TS3-Adapter** wird implementiert.
- Multi-User / Rollen über den ersten Admin hinaus → spätere Version.
- PostgreSQL-Support → vorbereitet via ORM, aber 0.1 läuft auf SQLite.
