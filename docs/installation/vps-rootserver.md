# Installation: VPS / Rootserver

> Häufigster Weg für öffentlich erreichbare Voice-Server. Achtung auf Ressourcenlimits und
> Netzwerk-/Firewall-Konfiguration.

## Eignung

Der Preflight & Capacity Advisor erkennt VPS/Rootserver und bewertet abhängig von CPU/RAM/
Speicher und Virtualisierungstyp (KVM meist 🟢/🟡; stark eingeschränkte Container-VPS evtl. 🔴).

## Voraussetzungen

- 64-bit Linux (KVM-basierter VPS bevorzugt; bei OpenVZ/Container-VPS Docker-Einschränkungen möglich).
- Docker + Compose.
- Öffentliche IPv4/IPv6 je nach Anbieter.

## Ablauf

1. Server absichern (Updates, SSH-Härtung, Firewall).
2. Docker + Compose installieren.
3. SpeakCore wie unter [Docker](docker.md) starten.
4. WebUI **nur über TLS** exponieren (Reverse Proxy + Zertifikat).

## Netzwerk & Sicherheit

- Nur benötigte Ports öffnen: WebUI (über Proxy/TLS) und TS3-Ports. Agent-Port niemals öffentlich.
- IPv4/IPv6, DNS und Ports werden im Systemcheck geprüft.
- Brute-Force-Schutz/Reverse-Proxy-Rate-Limiting für die Admin-UI empfohlen
  (siehe [SECURITY.md](../../project-brain/SECURITY.md)).

> Stand NDF Step 001: Planungsdokument für den geplanten 0.1-Ablauf.
