# Installation: Proxmox VM

> Empfohlene Variante unter Proxmox. Eine vollwertige VM bietet die beste Kompatibilität für Docker.

## Eignung

Der Preflight & Capacity Advisor erkennt eine Proxmox-VM-Umgebung und bewertet sie i. d. R.
günstig (🟢/🟡), sofern Ressourcen ausreichen.

## Empfehlungen

- Gast-OS: aktuelles 64-bit Linux (z. B. Debian/Ubuntu LTS).
- CPU/RAM/Storage großzügig nach erwarteter TS3-Last dimensionieren (Advisor gibt Hinweise).
- `qemu-guest-agent` im Gast installieren.
- Storage mit ausreichend freiem Platz für Container-Images, TS3-Daten und Backups.

## Ablauf

1. VM mit Linux-Gast erstellen.
2. Docker + Compose installieren.
3. SpeakCore wie unter [Docker](docker.md) starten.
4. Setup-Wizard durchlaufen; Preflight-Bewertung beachten.

## Hinweise

- VMs sind gegenüber LXC kompatibler für Docker und Kernel-nahe Funktionen.
- Backups: zusätzlich zu SpeakCore-Backups bietet sich Proxmox-Snapshot/Backup der VM an.

> Stand NDF Step 001: Planungsdokument für den geplanten 0.1-Ablauf.
