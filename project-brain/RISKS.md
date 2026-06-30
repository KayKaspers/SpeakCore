# RISKS.md – Risikoregister SpeakCore Suite

> NDF Project Brain · Stand: 2026-06-30
> Bewertung: Eintritt (E) und Auswirkung (A) je niedrig/mittel/hoch.

## Legende

- **E** = Eintrittswahrscheinlichkeit · **A** = Auswirkung · **Risiko** = E × A (grob)

---

## R-01 – Privileg-Eskalation über den Agent
- **E:** mittel · **A:** hoch · **Risiko:** hoch
- **Beschreibung:** Der Agent benötigt weitreichende Docker-/Host-Rechte. Eine kompromittierte
  WebUI/API oder ein schwacher Agent-Token könnte zu Host-Übernahme führen.
- **Gegenmaßnahmen:** Strikte Privileg-Trennung ([ADR-0004](DECISIONS.md)), Agent nicht öffentlich
  exponiert, generierte Bootstrap-Tokens, minimale Agent-API, Audit-Log, später mTLS ([ADR-0005](DECISIONS.md)).

## R-02 – Unsichere Speicherung von TS3-Query-Zugängen / Secrets
- **E:** mittel · **A:** hoch · **Risiko:** hoch
- **Beschreibung:** ServerQuery-Zugänge und Secrets im Klartext wären ein gravierendes Leck.
- **Gegenmaßnahmen:** Verschlüsselte Speicherung, generierte Secrets, keine Default-Passwörter,
  `.env`/Secrets nie im Repo (siehe [SECURITY.md](SECURITY.md), `.gitignore`).

## R-03 – Scope-Creep
- **E:** hoch · **A:** mittel · **Risiko:** hoch
- **Beschreibung:** Druck, früh weitere Server-Typen/Features aufzunehmen, gefährdet Stabilität
  und den schlanken Core.
- **Gegenmaßnahmen:** [MVP.md](MVP.md) ist verbindlich; Out-of-Scope-Liste; Änderungen nur via ADR.

## R-04 – Fehleinschätzung der Hostumgebung (Preflight)
- **E:** mittel · **A:** mittel · **Risiko:** mittel
- **Beschreibung:** Falsche Grün-Bewertung führt zu instabilem Betrieb; falsche Rot-Bewertung
  frustriert geeignete Nutzer.
- **Gegenmaßnahmen:** Konservative Schwellwerte, transparente Begründung der Ampel, Expert-Override
  mit bewusster Warnbestätigung, iteratives Tuning anhand realer Hosts.

## R-05 – TS3-Lizenz-/Betriebsbedingungen
- **E:** mittel · **A:** hoch · **Risiko:** hoch
- **Beschreibung:** TeamSpeak 3 unterliegt eigenen Lizenz-/Nutzungsbedingungen (z. B. Slot-Limits,
  Server-Lizenz). SpeakCore darf diese nicht unterlaufen.
- **Gegenmaßnahmen:** Klare Hinweise im Wizard, keine Umgehung von Limits, rechtliche Prüfung
  vor Verteilung von TS3-Binaries/Images (offener Punkt, siehe [DECISIONS.md](DECISIONS.md)).

## R-06 – Datenverlust bei Backup/Restore
- **E:** mittel · **A:** hoch · **Risiko:** hoch
- **Beschreibung:** Fehlerhafte Restores können Serverdaten zerstören.
- **Gegenmaßnahmen:** Restore niemals destruktiv ohne Bestätigung; Integritätsprüfung der Backups;
  „dry-run"/Vorschau; Audit-Log; Tests als Teil der Definition of Done.

## R-07 – Komplexität der Installationsumgebungen
- **E:** hoch · **A:** mittel · **Risiko:** mittel
- **Beschreibung:** Proxmox VM/LXC, Bare Metal, VPS, NAS verhalten sich unterschiedlich
  (z. B. LXC-Einschränkungen, NAS-Docker-Eigenheiten).
- **Gegenmaßnahmen:** Umgebungs-spezifische Doku ([docs/installation/](../docs/installation/)),
  Umgebungserkennung im Preflight, ehrliche Ampelbewertung statt „läuft überall".

## R-08 – Sicherheit der exponierten WebUI
- **E:** mittel · **A:** hoch · **Risiko:** hoch
- **Beschreibung:** Als Admin-Oberfläche ist die WebUI ein attraktives Ziel (Auth-Bypass, CSRF, XSS).
- **Gegenmaßnahmen:** Argon2id + sichere Sessions ([ADR-0006](DECISIONS.md)), CSRF-Schutz,
  sichere Cookies, Security-Header, Rate-Limiting für Login, Audit-Log.

## R-09 – Ein-Personen-/Bus-Faktor & Komplexität für 0.1
- **E:** mittel · **A:** mittel · **Risiko:** mittel
- **Beschreibung:** Der 0.1-Umfang ist trotz „klein" anspruchsvoll (Agent, Preflight, Backup).
- **Gegenmaßnahmen:** Klare NDF-Dokumentation, modulare Schnitte, Tests, Roadmap-Priorisierung,
  bewusste Reduktion auf TS3.

## R-10 – i18n-Drift (DE/EN)
- **E:** mittel · **A:** niedrig · **Risiko:** niedrig
- **Beschreibung:** Übersetzungen veralten gegenüber dem Code.
- **Gegenmaßnahmen:** next-intl mit typsicheren Keys ([ADR-0007](DECISIONS.md)), DE/EN-Vollständigkeit
  als Definition-of-Done-Kriterium.

---

## Risiko-Überblick

| ID | Risiko | Stufe |
|----|--------|-------|
| R-01 | Privileg-Eskalation Agent | hoch |
| R-02 | Secret-Speicherung | hoch |
| R-03 | Scope-Creep | hoch |
| R-05 | TS3-Lizenz | hoch |
| R-06 | Datenverlust Backup/Restore | hoch |
| R-08 | WebUI-Sicherheit | hoch |
| R-04 | Preflight-Fehleinschätzung | mittel |
| R-07 | Umgebungskomplexität | mittel |
| R-09 | Komplexität/Bus-Faktor | mittel |
| R-10 | i18n-Drift | niedrig |
