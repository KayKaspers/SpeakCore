# SpeakCore Suite

> Eine moderne, selbsthostbare Plattform zur Installation, Verwaltung und Überwachung
> von Voice- und Community-Servern.

**Status:** `0.1 – Pre-Alpha / NDF Step 001 (Projektinitialisierung)`
**Lizenz:** Open Source (Lizenz noch festzulegen – siehe [offene Punkte](project-brain/DECISIONS.md))

---

## Was ist SpeakCore?

SpeakCore Suite ist **kein einfaches Webpanel**, sondern eine vollständige Self-Hosting-Suite
mit Setup-Assistent, Systemcheck, Serverinstallation, Verwaltung, Backup/Restore, Monitoring
und integrierter Hilfe. Der Leitsatz des Projekts lautet:

> **Erst Vertrauen aufbauen, dann Funktionen erweitern.**

Version `0.1` ist bewusst klein, stabil, sicher und professionell gehalten und unterstützt
**ausschließlich TeamSpeak 3** als erste produktive Zielplattform. Weitere Systeme
(TeamSpeak 6, Mumble, Matrix, Jitsi) sind architektonisch vorbereitet, aber **nicht** Teil von 0.1.

## Schnellüberblick

| Bereich        | 0.1 |
|----------------|-----|
| Installation   | Docker-first, optionales Setup-Script |
| Onboarding     | Webbasierter Setup-Wizard, Simple & Expert Mode |
| Sprachen       | Deutsch / Englisch |
| Umgebungscheck | Preflight & Capacity Advisor (Ampelsystem) |
| Voice-Server   | TeamSpeak 3 (First-Class) |
| Betrieb        | Start/Stop/Restart, Logs, Dashboard |
| Datensicherung | Backup & Restore |
| Sicherheit     | Safe Defaults, Audit-Log, generierte Secrets |

## Projektdokumentation (NDF Project Brain)

Die gesamte Planungs- und Architekturdokumentation liegt im
[`project-brain/`](project-brain/)-Verzeichnis (Nova Development Framework):

- [PROJECT.md](project-brain/PROJECT.md) – Vision, Ziele, Leitsätze
- [MVP.md](project-brain/MVP.md) – verbindlicher Scope für 0.1
- [ARCHITECTURE.md](project-brain/ARCHITECTURE.md) – Systemarchitektur & Komponenten
- [DECISIONS.md](project-brain/DECISIONS.md) – Architekturentscheidungen (ADR)
- [ROADMAP.md](project-brain/ROADMAP.md) – Releaseplanung
- [RISKS.md](project-brain/RISKS.md) – Risikoregister
- [SECURITY.md](project-brain/SECURITY.md) – Sicherheitskonzept
- [BRANDING.md](project-brain/BRANDING.md) – Corporate Design
- [WORKFLOW.md](project-brain/WORKFLOW.md) – Arbeitsweise & Konventionen
- [CHANGELOG.md](project-brain/CHANGELOG.md) – Änderungshistorie

Benutzer- und Betriebsdokumentation: [`docs/`](docs/README.md).
Design-System & Tokens: [`branding/`](branding/README.md).

## Architektur in einem Satz

```
WebUI  →  SpeakCore API  →  Adapter Layer  →  TS3 Adapter  →  TeamSpeak 3 ServerQuery
                         ↘  SpeakCore Agent  →  Docker / Host
```

Die **WebUI kontrolliert niemals direkt Docker, Host oder TeamSpeak.** Alle privilegierten
Aktionen laufen ausschließlich über den **SpeakCore Agent**. Details:
[ARCHITECTURE.md](project-brain/ARCHITECTURE.md).

## Mitwirken

Siehe [WORKFLOW.md](project-brain/WORKFLOW.md). Aktuell befindet sich das Projekt in der
Initialisierungsphase – es existiert noch **kein produktiver Anwendungscode**.
