# Installation: Bare Metal

> Direkte Installation auf physischer Hardware. Maximale Performance und Kontrolle.

## Eignung

Bare Metal wird vom Preflight & Capacity Advisor erkannt und bei ausreichenden Ressourcen
i. d. R. günstig bewertet (🟢).

## Voraussetzungen

- 64-bit Linux direkt auf der Hardware.
- Docker + Compose.
- Ausreichend Speicher für Images, TS3-Daten und Backups.

## Ablauf

1. Linux installieren und aktualisieren.
2. Docker + Compose installieren.
3. SpeakCore wie unter [Docker](docker.md) starten.
4. Setup-Wizard und Preflight-Bewertung durchlaufen.

## Hinweise

- Ohne Virtualisierungsschicht trägt der Host die volle Verantwortung für Backups/Recovery –
  SpeakCore-Backups regelmäßig testen.
- Netzwerk/Firewall sorgfältig konfigurieren: nur benötigte Ports öffnen; Agent-Port nie öffentlich.

> Stand NDF Step 001: Planungsdokument für den geplanten 0.1-Ablauf.
