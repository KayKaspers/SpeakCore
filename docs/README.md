# SpeakCore Suite – Dokumentation

> Benutzer- und Betriebsdokumentation. Planungsdokumente liegen im
> [`project-brain/`](../project-brain/PROJECT.md).

## Inhalt

### Installation
Wähle die zu deiner Umgebung passende Anleitung. Der **Preflight & Capacity Advisor**
bewertet deine Umgebung zusätzlich automatisch (Ampelsystem).

- [Docker (empfohlen / Docker-first)](installation/docker.md)
- [Proxmox VM](installation/proxmox-vm.md)
- [Proxmox LXC](installation/proxmox-lxc.md)
- [Bare Metal](installation/bare-metal.md)
- [VPS / Rootserver](installation/vps-rootserver.md)
- [NAS / Home Server](installation/nas-home-server.md)

### Architektur
- [Überblick](architecture/overview.md)
- [SpeakCore Agent](architecture/agent.md)
- [Adapter Layer](architecture/adapter-layer.md)
- [Sicherheit](architecture/security.md)

### Branding / Design
- [Farben](branding/colors.md)
- [Typografie](branding/typography.md)
- [UI-Prinzipien](branding/ui-principles.md)

### Integrierte Hilfe
Kontextbezogene Hilfetexte (in der App eingebettet), zweisprachig:
- Deutsch: [`help/de/`](help/de/)
- Englisch: [`help/en/`](help/en/)

## Hinweis zum Stand

SpeakCore befindet sich in der Initialisierungsphase (NDF Step 001). Diese Dokumente
beschreiben den geplanten 0.1-Funktionsumfang ([MVP.md](../project-brain/MVP.md)); es
existiert noch kein produktiver Anwendungscode.
