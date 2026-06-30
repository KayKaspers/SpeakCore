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

## Sicherheitsprinzipien

- **Nicht öffentlich exponiert** (privates Compose-Netz / Loopback).
- **Least Privilege** – nur die wirklich benötigten Rechte.
- Jede privilegierte Aktion erzeugt einen **Audit-Log**-Eintrag.
- Roadmap-Härtung: mTLS / signierte Requests (siehe [ROADMAP.md](../../project-brain/ROADMAP.md)).

## Warum getrennt?

Die exponierte WebUI ist das primäre Angriffsziel. Durch die Trennung bleibt selbst bei einer
kompromittierten UI die Host-Kontrolle hinter einer zusätzlichen Vertrauensgrenze
(siehe [RISKS.md](../../project-brain/RISKS.md) R-01).
