# Installation: NAS / Home Server

> Beliebt für den Heimbetrieb (Synology, QNAP, TrueNAS, selbstgebaute Home-Server). Geräteabhängig
> sehr unterschiedlich – der Preflight & Capacity Advisor bewertet hier besonders sorgfältig.

## Eignung

- Leistungsfähige NAS/Home-Server mit Docker-Unterstützung: oft 🟡, bei guter Ausstattung 🟢.
- Schwache Geräte (wenig RAM/CPU, eingeschränkte Docker-Umgebung): häufig 🔴 → im Simple Mode
  blockiert, im Expert Mode nur mit bewusster Warnbestätigung.

## Voraussetzungen

- Docker-/Container-Unterstützung des Geräts (z. B. Synology Container Manager, QNAP Container
  Station, TrueNAS Apps/Docker).
- Ausreichend RAM und freier Speicher für Images, TS3-Daten und Backups.

## Hinweise

- NAS-Docker-Umgebungen weichen teils vom Standard ab (Pfade, Berechtigungen, Netzwerkmodi) –
  Hinweise des Wizards beachten.
- Heim-Internetanschlüsse: ggf. Portfreigaben/Firewall am Router nötig; DDNS für dynamische IPs.
- IPv4/IPv6, DNS, Ports und Backup-Speicher werden im Systemcheck geprüft.

## Sicherheit

- WebUI nicht ungeschützt ins Internet stellen; TLS/Reverse Proxy verwenden.
- Agent-Port niemals nach außen freigeben.

> Stand NDF Step 001: Planungsdokument für den geplanten 0.1-Ablauf.
