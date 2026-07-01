# SECURITY.md – Sicherheitskonzept SpeakCore Suite

> NDF Project Brain · Stand: 2026-06-30
> Sicherheit ist ein Markenwert. Leitsatz: **Safe by default.**

## 1. Schutzziele

- **Vertraulichkeit** von Secrets, Query-Zugängen, Admin-Credentials.
- **Integrität** von Konfiguration, Backups und Audit-Trail.
- **Verfügbarkeit** der verwalteten Voice-Server (kein destruktives Verhalten ohne Bestätigung).
- **Nachvollziehbarkeit** wichtiger Aktionen (Audit-Log).

## 2. Vertrauensgrenzen

```
[ Internet/Admin ] ──TLS──► [ WebUI/API (exponiert) ] ──Token/privates Netz──► [ Agent (privilegiert) ] ──► [ Docker/Host/TS3 ]
```

- Die **WebUI/API** ist die einzige exponierte Komponente und damit primäres Angriffsziel.
- Der **Agent** ist **nicht** öffentlich erreichbar und besitzt die privilegierten Rechte.
- Die WebUI hat **keine** direkten Host-/Docker-/ServerQuery-Rechte ([ADR-0004](DECISIONS.md)).

## 3. Safe Defaults (verbindlich für 0.1)

1. **Keine Standardpasswörter** – der erste Admin wird im Wizard gesetzt.
2. **Secrets automatisch generieren** – Agent-Token, interne Schlüssel, TS3-Query-Passwörter.
3. **Query-Zugänge sicher speichern** – verschlüsselt at-rest, nie im Klartext, nie im Log.
4. **Warnungen bei riskanter Konfiguration** – z. B. offene Ports, schwache Umgebung (Preflight Rot/Gelb).
5. **Least Privilege** – Agent erhält nur die nötigen Rechte; UI/API niemals Host-Rechte.

## 4. Authentifizierung & Sitzungen

Umgesetzt in Step 003 ([ADR-0012](DECISIONS.md), [ADR-0013](DECISIONS.md)):

- Passwort-Hashing: **Argon2id** via `@node-rs/argon2` (memoryCost 19456, t=2, p=1).
- **OWNER-Account** wird nur erstellt, solange kein User existiert; Setup ist nicht
  wiederholbar; zusätzlicher `SETUP_LOCK`-Guard.
- Server-seitige Sessions: opaker 32-Byte-Zufallstoken im Cookie (`HttpOnly`, `SameSite=Lax`,
  `Secure` in Produktion). In der DB nur der **HMAC-SHA256-Hash** des Tokens (Schlüssel =
  `SESSION_SECRET`) → DB-Leak liefert ohne Secret keine nutzbaren Sitzungen. Logout entwertet
  serverseitig.
- Login liefert **generische** Fehlermeldungen (kein User-Enumeration-Leak); Fehlversuche werden
  auditiert.
- Formulare laufen über **Next.js Server Actions** (Same-Origin/CSRF-Mitigation); alle Prüfungen
  sind server-seitig autoritativ – Client-Validierung dient nur der UX.
- **Rate-Limiting** (Step 004): server-seitig, DB-gestützt (SQLite, [ADR-0014](DECISIONS.md)).
  Login: max. 10 Fehlversuche / 15 min je **IP und** Identifier; Setup: max. 5 / 15 min je IP.
  Erfolg setzt den Login-Zähler zurück; Sperren werden auditiert (`*.rate_limited`).
  Grenze: Single-Node-Zähler; IP aus Proxy-Headern (nur hinter vertrauenswürdigem Proxy belastbar).
- Kein externer IdP in 0.1 (Roadmap).

## 4a. Security-Header & CSP (Step 004)

Zentral in der Next.js-Middleware gesetzt ([ADR-0015](DECISIONS.md), `lib/security-headers.ts`):

- `Content-Security-Policy` (Baseline, s. u.)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (+ CSP `frame-ancestors 'none'`)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`
- `Strict-Transport-Security` – **nur in Produktion**

**Baseline-CSP:** `default-src 'self'`; `base-uri`/`form-action 'self'`; `frame-ancestors 'none'`;
`object-src 'none'`; `img-src`/`font-src 'self' data:`; `style-src 'self' 'unsafe-inline'`;
`script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'`/`ws:` nur im Dev für HMR).

> **Limitierung:** `'unsafe-inline'` für Skripte ist nötig, weil Next.js Inline-Hydration-Skripte
> ohne Nonce ausliefert. Das schwächt den XSS-Schutz der CSP. Upgrade auf eine **nonce-basierte
> CSP** ist als Härtungsschritt vorgemerkt ([RISKS.md](RISKS.md) R-11).

## 5. Secret-Management

- Secrets ausschließlich über Umgebung/sicheren Store, **niemals** im Repository
  (siehe `.gitignore`: `.env*`, `secrets/`, `*.key`, `*.pem`, `*.sqlite`).
- `.env.example` dokumentiert benötigte Variablen ohne echte Werte.
- TS3-Query-Credentials werden **verschlüsselt** persistiert: **AES-256-GCM**, Schlüssel aus
  `SECRET_ENCRYPTION_KEY` ([ADR-0018](DECISIONS.md)). Ohne Schlüssel keine Speicherung; nie im
  Klartext, nie im Log/Audit, nie im Client. Key-Rotation noch offen (RISKS/Roadmap).

## 4b. TS3-Verbindungen (read-only, Step 008)

- Nur **eingeloggte OWNER** können Server verbinden/ansehen (Server Actions, CSRF-Mitigation).
- Es werden **ausschließlich read-only** ServerQuery-Kommandos genutzt (`login`/`use`/`serverinfo`);
  **keine** Steuerung (kein Stop/Edit/Kick/Ban/Channel-/Gruppen-/Dateiaktionen). Timeouts gesetzt;
  Fehlermeldungen generisch (kein Secret-/Detail-Leak); Query-Antworten werden nicht ungefiltert
  an den Client gegeben.
- **SSRF-Härtung:** Host-Eingaben werden validiert; Cloud-Metadaten (`169.254.169.254`), Link-Local
  und `0.0.0.0`/`::` sind blockiert. Private LAN/localhost bleiben erlaubt (legitimes Self-Hosting)
  – das verbleibende SSRF-Restrisiko ist in [RISKS.md](RISKS.md) R-13 dokumentiert. Verbindungstests
  sind rate-limitiert.

## 6. Agent-Sicherheit

- Authentifizierung via generiertem **Bootstrap-Token** ([ADR-0005](DECISIONS.md)).
- Minimale, klar definierte API-Oberfläche; nur explizit modellierte Operationen.
- Eingabevalidierung aller Parameter (keine Shell-Injection in Docker-/Host-Aufrufe).
- Roadmap-Härtung: mTLS / signierte Requests, Audit jeder privilegierten Operation.

### Read-only-Snapshot (Step 006/007)

- Der Agent stellt bislang **ausschließlich lesende** Endpunkte bereit; `GET /system/snapshot`
  liefert ungefährliche System-, **Umgebungs-** und **Netzwerk**-Daten (CPU/RAM/Speicher/OS/Node-/
  Agent-Version, Docker-Verfügbarkeit, erkannte Umgebung, IPv4/IPv6/DNS-Status).
- **Kein Docker-Socket**, keine Container-Operationen, keine Portscans, keine Host-Änderungen,
  **keine externen Requests/IP-Checks**, keine Router-/NAT-/UPnP-Aktionen, keine aktive
  Erreichbarkeitsprüfung. CLI (Docker/`systemd-detect-virt`) nur via `execFile` ohne Shell,
  **statische Argumente**, **Timeout**. Nicht ermittelbar ⇒ `unknown` (nie `absent`/falsch grün).
- **Datenschutz:** Netzwerkdaten werden auf **Booleans/Anzahl** reduziert – **keine IP-Adressen
  oder Interface-Namen** verlassen den Agent (Screenshot-sicher).
- **Token-Gate:** ist `AGENT_BOOTSTRAP_TOKEN` gesetzt, erfordert `/system/snapshot` ein gültiges
  Bearer-Token (401 sonst). Ohne Token nur im **privaten Compose-Netz** vorsehen, **nie öffentlich**.
- Die WebUI ruft den Agent **nur serverseitig** ab; kein Secret/keine Agent-URL gelangt in den Client.

## 7. Web-Sicherheit

- CSRF-Schutz für state-changing Requests.
- Output-Encoding / Schutz gegen XSS.
- Security-Header (CSP, `X-Content-Type-Options`, `Referrer-Policy`, HSTS bei TLS).
- Strikte Eingabevalidierung (Server-seitig, nicht nur Client).

## 8. Audit-Log

- Protokolliert mindestens: Login/Logout, Admin-Anlage, Serverinstallation,
  Start/Stop/Restart, Backup/Restore, Konfigurationsänderungen, Agent-Aufrufe.
- Einträge mit Zeitstempel, Akteur, Aktion, Ziel, Ergebnis. Keine Secrets im Log.

## 9. Backup/Restore-Sicherheit

- Restore ist niemals still-destruktiv; Bestätigung + Vorschau erforderlich (siehe [RISKS.md](RISKS.md) R-06).
- Integritätsprüfung der Backups.

## 10. Verantwortungsvolle Offenlegung (Responsible Disclosure)

- Sicherheitslücken bitte **nicht** über öffentliche Issues melden, sondern vertraulich an die
  Maintainer (Kontaktweg wird mit dem ersten öffentlichen Release festgelegt – offener Punkt).

## 11. Referenzen

[docs/architecture/security.md](../docs/architecture/security.md) · [RISKS.md](RISKS.md) ·
[DECISIONS.md](DECISIONS.md)
