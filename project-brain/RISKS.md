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
  **Managed-Only + Aktions-Allowlist** ([ADR-0019](DECISIONS.md)/[ADR-0020](DECISIONS.md)): der Agent
  ist kein allgemeines Docker-Admin-Interface; kein Docker-Socket in WebUI/Web-Container.
  Stand Step 011: Docker-Nähe ist bislang **rein lesend** (`/docker/inventory`, nur managed
  Ressourcen, kein Socket/Schreiben); schreibende Aktionen kommen erst als eigener, geprüfter Step.

## R-14 – Secrets in Docker-Logs bei TS3-Provisionierung (spätere Umsetzung)
- **E:** mittel · **A:** mittel · **Risiko:** mittel
- **Beschreibung:** Das offizielle TeamSpeak-3-Image gibt beim ersten Start Initial-Credentials
  (ServerAdmin-Token/Query-Passwort) in die Container-Logs aus. Ein ungefiltertes Log-Handling
  könnte diese Secrets exponieren.
- **Gegenmaßnahmen (geplant, Step 010 dokumentiert):** Secrets von SpeakCore **selbst generieren**
  und verschlüsselt speichern ([ADR-0018](DECISIONS.md)); Query-Passwort möglichst per ENV/Secret
  vorgeben statt aus Logs auslesen; Container-Logs nie ungefiltert an Client/Audit weitergeben;
  Managed-Only-Prinzip ([ADR-0020](DECISIONS.md)). Konkrete Umsetzung im echten Installations-Step.

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
- **Stand Step 005:** Bewertungslogik umgesetzt & unit-getestet ([ADR-0016](DECISIONS.md));
  Grundregel **unbekannte Werte ⇒ nie grün** verhindert falsch-positive Grün-Bewertungen.
  Richtwerte sind als konservative Empfehlungen dokumentiert (keine Garantie); Kalibrierung an
  realen Hosts folgt mit den Agent-Sonden.

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
- **E:** mittel · **A:** hoch · **Risiko:** mittel *(durch Step 003/004 reduziert)*
- **Beschreibung:** Als Admin-Oberfläche ist die WebUI ein attraktives Ziel (Auth-Bypass, CSRF, XSS).
- **Gegenmaßnahmen:** Argon2id + sichere Sessions ([ADR-0006](DECISIONS.md)/[ADR-0012](DECISIONS.md)),
  CSRF via Server Actions, sichere Cookies, **Security-Header + Baseline-CSP** ([ADR-0015](DECISIONS.md)),
  **DB-gestütztes Login-/Setup-Rate-Limiting** ([ADR-0014](DECISIONS.md)), Audit-Log.
- **Rest:** nonce-basierte CSP noch offen (siehe R-11); Distributed Rate-Limiting erst bei Mehr-Instanz.

## R-11 – CSP mit `'unsafe-inline'` (Skripte)
- **E:** mittel · **A:** mittel · **Risiko:** mittel
- **Beschreibung:** Die Baseline-CSP erlaubt `script-src 'unsafe-inline'` (Next.js-Hydration ohne
  Nonce). Das schwächt den XSS-Schutz der CSP gegenüber einer nonce-/hash-basierten Variante.
- **Gegenmaßnahmen:** Strikte Eingabevalidierung/Output-Encoding (React) als primärer XSS-Schutz;
  übrige CSP-Direktiven restriktiv. **Geplant:** Umstieg auf nonce-basierte CSP ([ADR-0015](DECISIONS.md)).

## R-09 – Ein-Personen-/Bus-Faktor & Komplexität für 0.1
- **E:** mittel · **A:** mittel · **Risiko:** mittel
- **Beschreibung:** Der 0.1-Umfang ist trotz „klein" anspruchsvoll (Agent, Preflight, Backup).
- **Gegenmaßnahmen:** Klare NDF-Dokumentation, modulare Schnitte, Tests, Roadmap-Priorisierung,
  bewusste Reduktion auf TS3.

## R-12 – Agent-Snapshot ohne Token-Schutz
- **E:** niedrig · **A:** niedrig · **Risiko:** niedrig
- **Beschreibung:** Ist `AGENT_BOOTSTRAP_TOKEN` nicht gesetzt, ist `GET /system/snapshot`
  ungeschützt. Bei versehentlicher Exposition könnten **nicht-sensible** Systeminfos (Kerne, RAM,
  OS, Docker-Version) ausgelesen werden – keine Secrets, keine Steuerung.
- **Gegenmaßnahmen:** Agent nur im **privaten Compose-Netz**, nie öffentlich exponieren
  ([ADR-0004](DECISIONS.md)); Token-Gate aktivieren (`AGENT_BOOTSTRAP_TOKEN`); read-only Daten
  bewusst minimal gehalten (kein Pfad-/ENV-Leak; **Netzwerk nur Booleans/Anzahl, keine IP-Adressen**
  – Step 007). Spätere Härtung: Token verpflichtend + mTLS.

## R-15 – Erste schreibende Docker-Aktion (Network/Volume)
- **E:** niedrig · **A:** mittel · **Risiko:** niedrig-mittel
- **Beschreibung:** Mit Step 012 kann der Agent erstmals Docker-Ressourcen **erzeugen**
  (managed Network/Volume). Fehlkonfiguration oder Missbrauch könnte ungewollte Ressourcen anlegen.
- **Gegenmaßnahmen:** **Feature-Flag** `AGENT_DOCKER_WRITE_ENABLED` (Default false) **und**
  Token-Gate; **Managed-Only** + Labels; server-seitige **Re-Validierung** ([ADR-0020](DECISIONS.md)/
  [ADR-0021](DECISIONS.md)); **Idempotenz**; **kein** Anfassen fremder Ressourcen (`conflict`);
  **kein** automatisches `rm`, kein Container/Start; `execFile` ohne Shell, statische Argumente,
  kein Socket. Ergebnis ohne Secrets.
- **Rest/geplant:** automatisches Rollback-`rm` und Container-Erstellung als eigene, geprüfte Steps.

## R-13 – SSRF über TS3-Host-Eingabe (read-only)
- **E:** niedrig · **A:** mittel · **Risiko:** niedrig-mittel
- **Beschreibung:** Der Verbindungstest baut eine TCP-Verbindung zu einem **owner-eingegebenen**
  Host auf. Private LAN/localhost sind erlaubt (Self-Hosting), daher könnte ein Owner theoretisch
  interne Dienste im eigenen Netz ansprechen. Es werden jedoch nur read-only ServerQuery-Kommandos
  gesendet und die Antwort wird nicht ungefiltert an den Client gegeben.
- **Gegenmaßnahmen:** Nur **authentifizierte OWNER**; Blockliste für Cloud-Metadaten/Link-Local/
  unspezifizierte Adressen; Timeouts; Rate-Limit; generische Fehler; kein Roh-Response-Leak.
- **Rest/geplant:** strengere Egress-Kontrolle (Allowlist/DNS-Rebinding-Schutz/Auflösungsprüfung)
  als späterer Security-Step. Bewusst offen, um legitimes LAN-Self-Hosting nicht zu brechen.

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
| R-04 | Preflight-Fehleinschätzung | mittel |
| R-07 | Umgebungskomplexität | mittel |
| R-08 | WebUI-Sicherheit | mittel *(reduziert)* |
| R-09 | Komplexität/Bus-Faktor | mittel |
| R-11 | CSP `'unsafe-inline'` | mittel |
| R-14 | Secrets in Docker-Logs (Provisionierung) | mittel |
| R-13 | SSRF über TS3-Host-Eingabe | niedrig-mittel |
| R-15 | Erste schreibende Docker-Aktion | niedrig-mittel |
| R-10 | i18n-Drift | niedrig |
| R-12 | Agent-Snapshot ohne Token | niedrig |
