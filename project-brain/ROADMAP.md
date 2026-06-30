# ROADMAP.md – SpeakCore Suite

> NDF Project Brain · Stand: 2026-06-30
> Reihenfolge ist Absicht, keine Terminzusage. Scope von 0.1 ist in [MVP.md](MVP.md) fixiert.

## Leitlinie

> Erst Vertrauen aufbauen, dann Funktionen erweitern.

Jede spätere Version baut auf einem stabilen, sicheren Kern auf. Neue Server-Typen kommen
ausschließlich über das Adapter-System, neue Funktionen perspektivisch über das Modul-/Plugin-System.

---

## 0.1 – Trust Core (aktuell)

**Fokus:** TeamSpeak 3, sichere Installation & Verwaltung, Vertrauen schaffen.
Vollständiger Umfang: [MVP.md](MVP.md).

Kurz: Docker-first, Setup-Wizard, Admin-Account, DE/EN, Simple/Expert Mode, Preflight &
Capacity Advisor, Umgebungsbewertung, Systemcheck, TS3 (verbinden + installieren),
Start/Stop/Restart, Logs, Dashboard, Backup/Restore, integrierte Hilfe, Audit-Log, Safe Defaults.

## 0.2 – Stabilisierung & Komfort (geplant)

- Härtung Agent-Kommunikation (mTLS / signierte Requests)
- Erweitertes Monitoring (Metriken, einfache Alerts)
- Verbesserte Backup-Strategien (Zeitpläne, Rotation)
- UX-Feinschliff Wizard & Dashboard
- Mehr Installationswege verifiziert/dokumentiert

## 0.3 – Mehrbenutzer & Rollen (geplant)

- Mehrere Benutzer, Rollen/Berechtigungen
- Feineres Audit-Log, Sitzungsverwaltung
- Optionaler PostgreSQL-Support (Umschaltbarkeit)

## 0.4+ – Weitere Adapter (geplant)

- **TeamSpeak 6** produktiv (WebQuery/API) über TS6-Adapter
- **Mumble** Adapter
- Vorbereitung Modul-/Plugin-System

## 1.0 – Suite (Vision)

- Stabiles, dokumentiertes Plugin-/Modulsystem
- Optional Matrix/Element, Jitsi als Adapter/Module
- Community-Funktionen (Portal, Tickets, Events) **nur** als Module, nie im Core

---

## Ausdrücklich NICHT eingeplant für den Core (jemals nur als Modul)

Plugin-Store, Community-Portal, Tickets, Events, Discord-Integration, native Mobile-Apps –
siehe [MVP.md](MVP.md) §4. Diese bleiben außerhalb des schlanken Cores.
