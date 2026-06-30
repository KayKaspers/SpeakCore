# PROJECT.md – SpeakCore Suite

> NDF Project Brain · Stand: 2026-06-30 · Phase: 0.1 Initialisierung (NDF Step 001)

## 1. Projektname

**SpeakCore Suite**

## 2. Vision

SpeakCore Suite ist eine moderne, **selbsthostbare** Plattform zur Installation, Verwaltung
und Überwachung von Voice- und Community-Servern. SpeakCore ist ausdrücklich **kein einfaches
Webpanel**, sondern soll langfristig eine vollständige Self-Hosting-Suite werden mit:

- WebUI
- Setup-Assistent
- Systemcheck
- Serverinstallation
- Serververwaltung
- Backup / Restore
- Monitoring
- integrierter Hilfe
- Mehrsprachigkeit
- späterem Modul-/Plugin-System

## 3. Leitsatz

> **Erst Vertrauen aufbauen, dann Funktionen erweitern.**

Version 0.1 ist klein, stabil, sicher und professionell. **Kein Scope-Creep. Kein unnötiger
Funktionsballast. Der Core bleibt schlank.**

## 4. Markenwerte

Vertrauen · Kontrolle · Stabilität · Modularität · Open Source · Sicherheit · Community

## 5. Zielgruppen

| Persona | Bedürfnis | Modus |
|---------|-----------|-------|
| Einsteiger / Home-Hoster | Geführte, sichere Installation ohne Linux-Tiefenwissen | Simple Mode |
| Erfahrene Admins | Volle Kontrolle, Detaileinstellungen, Overrides | Expert Mode |
| Community-Betreiber | Stabiler Betrieb, Monitoring, Backups | beide |

## 6. Langfristige Zielrichtung (NICHT 0.1)

Unterstützung mehrerer selbsthostbarer Voice-/Community-Systeme:

- TeamSpeak 3  ← **einzige produktive Plattform in 0.1**
- TeamSpeak 6  ← nur architektonisch vorbereitet
- Mumble       ← Roadmap
- optional Matrix/Element ← Roadmap
- optional Jitsi ← Roadmap

## 7. Abgrenzung 0.1

Der verbindliche Scope ist in [MVP.md](MVP.md) fixiert. Alles, was dort nicht steht, ist
**nicht** Teil von 0.1. Die Releaseplanung steht in [ROADMAP.md](ROADMAP.md).

## 8. Erfolgskriterien für 0.1

1. Ein Einsteiger kann auf einem geeigneten Host per Docker in < 15 Minuten zu einem
   laufenden, abgesicherten TeamSpeak-3-Server gelangen.
2. Der Preflight & Capacity Advisor verhindert offensichtlich ungeeignete Installationen
   (Rot blockt Simple Mode).
3. Keine Standardpasswörter, keine im Klartext gespeicherten Secrets, vollständiges Audit-Log.
4. DE/EN vollständig im gesamten 0.1-UI.
5. Backup & Restore eines TS3-Servers funktioniert reproduzierbar.

## 9. Verwandte Dokumente

[ARCHITECTURE.md](ARCHITECTURE.md) · [MVP.md](MVP.md) · [DECISIONS.md](DECISIONS.md) ·
[RISKS.md](RISKS.md) · [SECURITY.md](SECURITY.md) · [BRANDING.md](BRANDING.md) ·
[WORKFLOW.md](WORKFLOW.md) · [ROADMAP.md](ROADMAP.md)
