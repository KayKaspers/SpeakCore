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

- Passwort-Hashing: **Argon2id** ([ADR-0006](DECISIONS.md)).
- Serverseitige Sessions, Cookies `HttpOnly`, `Secure`, `SameSite`.
- Login mit Rate-Limiting / Brute-Force-Schutz.
- Kein externer IdP in 0.1 (Roadmap).

## 5. Secret-Management

- Secrets ausschließlich über Umgebung/sicheren Store, **niemals** im Repository
  (siehe `.gitignore`: `.env*`, `secrets/`, `*.key`, `*.pem`, `*.sqlite`).
- `.env.example` dokumentiert benötigte Variablen ohne echte Werte.
- TS3-Query-Credentials werden verschlüsselt persistiert (Schlüssel getrennt vom Datenbestand).

## 6. Agent-Sicherheit

- Authentifizierung via generiertem **Bootstrap-Token** ([ADR-0005](DECISIONS.md)).
- Minimale, klar definierte API-Oberfläche; nur explizit modellierte Operationen.
- Eingabevalidierung aller Parameter (keine Shell-Injection in Docker-/Host-Aufrufe).
- Roadmap-Härtung: mTLS / signierte Requests, Audit jeder privilegierten Operation.

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
