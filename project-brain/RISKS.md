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

## R-14 – Secrets in Docker-Logs bei TS3-Provisionierung (geschlossen ab Step 017)
- **E:** mittel · **A:** mittel · **Risiko:** mittel → **niedrig (mitigiert)**
- **Beschreibung:** Das offizielle TeamSpeak-3-Image gibt beim ersten Start Initial-Credentials
  (ServerAdmin-Token/Query-Passwort) in die Container-Logs aus. Ein ungefiltertes Log-Handling
  könnte diese Secrets exponieren.
- **Gegenmaßnahmen (Step 015 + Step 017):** SpeakCore **generiert das Secret selbst**
  (`generateSecret`, alphanumerisch) und legt es **verschlüsselt** ab ([ADR-0018](DECISIONS.md)) –
  **bevor** ein Container existiert. Beim Container-Create wird das Query-Passwort per **ENV**
  (`TS3SERVERQUERY_ADMIN_PASSWORD`, [ADR-0023](DECISIONS.md)) vorgegeben ⇒ das Image erzeugt **kein**
  Zufallspasswort in den Logs. SpeakCore **liest niemals Docker-Logs** (Quell-Scan-Tests erzwingen dies);
  Secret wird nie geloggt/auditiert/im Client ausgegeben. Managed-Only ([ADR-0020](DECISIONS.md)).
- **Rest:** beim späteren Container-**Start**/Betrieb weiterhin keine ungefilterte Log-Ausgabe zulassen.

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
- **Stand Step 018 ([ADR-0024](DECISIONS.md)):** Der Container-**Start** erfordert eine **explizite
  Nutzer-Lizenzzustimmung** (Checkbox, kein Vorab-Default) und wird auditiert
  (`docker.containerStart.licenseConfirmed`). SpeakCore setzt die für das TS3-Image nötige Lizenz-ENV
  (`TS3SERVER_LICENSE=accept`) technisch beim Create, der tatsächliche Serverlauf wird aber erst nach
  der Zustimmung freigegeben. **SpeakCore stellt nur die Verwaltung bereit; die Lizenz-Einhaltung liegt
  beim Nutzer.** Offen: Zustimmung künftig bereits vor dem Create einholen; rechtliche Gesamtprüfung.

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
- **Stand Step 013:** Web-Auslösung nur **OWNER**, serverseitig (Agent-URL/Token nie im Client),
  rate-limitiert, normalisiertes Audit ohne Secrets.
- **Stand Step 014:** vorbereitete Ressourcen sind an eine managed `ServerInstance` gebunden
  (server-seitig erzeugte `instanceId`/Namen, keine Secrets). **Offen:** verwaiste Docker-Ressourcen,
  falls ein managed Record später entfernt wird (automatisches Remove ist ein eigener, geprüfter Step).
- **Stand Step 017:** erste **Container-Erstellung** (`docker create`, **kein Start**,
  [ADR-0023](DECISIONS.md)) – gleiche Guards (Flag + Token, Managed-Only, `execFile`/keine Shell,
  Idempotenz/`conflict`, kein `rm`); Secret nur als ENV, nie im Ergebnis/Audit/Log. Verwaiste
  Container bei späterem Entfernen bleiben offen (Remove = eigener Step).
- **Stand Step 018:** erster **Container-Start** (`docker start`, [ADR-0024](DECISIONS.md)) – gleiche
  Guards (Flag + Token, Managed-Only, `execFile`/keine Shell), **nur bereits vorhandene** managed
  Container, Idempotenz (`running`)/`conflict`/`notFound`, **kein** `run/create/stop/rm`, **kein**
  Log-Lesen; explizite Lizenzzustimmung nötig. Ergebnis/Audit ohne Secrets. Verwaiste/hängende
  Container (Stop/Remove) bleiben eigene, spätere Steps.
- **Stand Step 021:** **Container-Stop** (`docker stop --time 3`, [ADR-0025](DECISIONS.md)) – gleiche
  Guards, Managed-Only, Idempotenz (`alreadyStopped`)/`conflict`/`notFound`, **kein** `rm/restart/start`,
  **keine Löschung** (Volume/Network bleiben), **kein Log-Lesen**. `RUNNING → CONTAINER_CREATED` +
  `runState='stopped'` (kein neuer Lifecycle-Status).
- **Stand Step 022:** **Container-Remove** (`docker rm`, [ADR-0026](DECISIONS.md)) – gleiche Guards,
  Managed-Only, **nur gestoppte** Container (`stillRunning` sonst), **kein `-f`/`-v`**, **keine Volume-/
  Network-/Credential-/ServerInstance-Löschung**, Idempotenz (`alreadyRemoved`)/`conflict`. `CONTAINER_CREATED
  → RESOURCES_PREPARED`. **Volume-/Network-Remove** (verwaiste Ressourcen, vollständiges Deprovisioning)
  bleibt ein eigener, deutlich gefährlicherer Step mit Backup-/Bestätigungskonzept.
- **Stand Step 023:** **Restart** ([ADR-0027](DECISIONS.md)) führt **kein** neues Docker-Kommando ein –
  reine Web-Orchestrierung der Stop-/Start-Flows (`RUNNING → Stop → Start → RUNNING`) mit erneuter
  Lizenzbestätigung. Kein Start bei Stop-Fehler; kein `RUNNING` bei Start-Fehler; kein Reparaturverhalten
  bei DB-/Ist-Inkonsistenz (Healthcheck bleibt Ist-Quelle).
- **Stand Step 019:** **read-only Healthcheck** (`docker container ls` mit Label-Filtern) – **kein**
  Write-Flag, **kein** `inspect/logs/exec/start/stop/rm`, kein Socket, keine Portscans, **keine
  Reparatur**. Trennt Lifecycle- vs. Ist-Zustand; keine Roh-Ausgaben/Secrets. Optionaler TS3-Check nur
  read-only; für managed Server aktuell meist `notConfigured` (keine eindeutige Query-Adresse – offen).

## R-16 – Fehlerhafte/unvollständige Secret-Key-Rotation (Step 016)
- **E:** niedrig · **A:** mittel · **Risiko:** niedrig-mittel
- **Beschreibung:** Beim Wechsel von `SECRET_ENCRYPTION_KEY` könnten Credentials unlesbar werden
  (falscher alter Schlüssel, Abbruch mitten im Vorgang, Verwechslung alt/neu).
- **Gegenmaßnahmen ([ADR-0022](DECISIONS.md)):** Rotation nur als **Operator-/CLI-Vorgang** (keine
  UI/Route/API); **Dry-Run** vorab; **Transaktion** (all-or-nothing – bei hartem Fehler wird nichts
  geschrieben); **Idempotenz** (bereits rotierte Werte werden übersprungen, Wiederholung sicher);
  Abbruch **vor** DB-Zugriff bei fehlendem altem/neuem Schlüssel; identische Schlüssel ⇒ kein
  Schreiben; bestehende `v1`-Werte bleiben mit ihrem Schlüssel entschlüsselbar. Ausgabe/Audit nur
  **Zählwerte**, nie Secrets/Schlüssel.
- **Rest/geplant:** **DB-Backup vor Rotation** (Betreiberpflicht, dokumentiert); optional späteres
  `v2`-Format mit Key-ID für unterbrechungsfreie Multi-Key-Rotation.

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
- **Stand Step 020:** Die managed **Query-Adresse** (`host`) wird **explizit** gesetzt (Env-Default +
  UI-Override, kein Raten) und mit **derselben Host-Validierung** geprüft (Metadaten/Link-Local/
  unspezifiziert blockiert). Der read-only Healthcheck nutzt nur diese Adresse – **keine Portscans,
  keine externen IP-Checks**. Das SSRF-Restrisiko bleibt wie bei external Servern (owner-eingegebener
  Host im eigenen Netz); die strengere Egress-Kontrolle gilt für beide Fälle als späterer Step.

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
| R-14 | Secrets in Docker-Logs (Provisionierung) | niedrig *(mitigiert ab Step 017)* |
| R-13 | SSRF über TS3-Host-Eingabe | niedrig-mittel |
| R-15 | Erste schreibende Docker-Aktion | niedrig-mittel |
| R-16 | Secret-Key-Rotation | niedrig-mittel |
| R-10 | i18n-Drift | niedrig |
| R-12 | Agent-Snapshot ohne Token | niedrig |
