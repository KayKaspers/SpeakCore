# Sicherheit (Betrieb)

> Konzept: [project-brain/SECURITY.md](../../project-brain/SECURITY.md). Dieses Dokument fasst
> die für Betreiber relevanten Punkte zusammen.

## Vertrauensgrenzen

```
[ Admin/Internet ] ─TLS→ [ WebUI/API (exponiert) ] ─Token/privates Netz→ [ Agent ] → [ Docker/Host/TS3 ]
```

Nur die WebUI/API ist exponiert. Der Agent ist nicht öffentlich erreichbar.

## Safe Defaults (in 0.1 verbindlich)

- Keine Standardpasswörter – Admin wird im Wizard gesetzt.
- Secrets (Agent-Token, Query-Passwörter, interne Schlüssel) werden automatisch generiert.
- TS3-Query-Zugänge werden verschlüsselt gespeichert, nie im Klartext, nie im Log.
- Warnungen bei riskanter Konfiguration (offene Ports, schwache Umgebung via Preflight).

## Auth-Härtung (Step 004)

- **Rate-Limiting** für Login (10 Fehlversuche / 15 min je IP und Identifier) und Setup
  (5 / 15 min je IP), DB-gestützt. Erfolgreicher Login setzt den Zähler zurück.
- **Security-Header** auf allen Seiten-Routen: CSP (Baseline), `nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS (nur Produktion).
- Details & Baseline-CSP: [SECURITY.md](../../project-brain/SECURITY.md) §4/§4a.

## Empfehlungen für Betreiber

- WebUI nur über TLS exponieren (Reverse Proxy mit gültigem Zertifikat) – aktiviert HSTS und
  macht `Secure`-Cookies wirksam.
- **Reverse Proxy muss `X-Forwarded-For`/`X-Real-IP` korrekt setzen**, sonst greift das
  IP-basierte Rate-Limiting nur eingeschränkt (Identifier-Limit bleibt aktiv).
- Firewall: nur benötigte Ports öffnen (TS3-Ports, WebUI-Port). Agent-Port **nicht** öffentlich.
- Regelmäßige Backups und getestete Restores (siehe Installationsanleitungen).
- Audit-Log regelmäßig prüfen (u. a. `login.failure`, `login.rate_limited`).

## Verantwortungsvolle Offenlegung

Sicherheitslücken bitte vertraulich melden, nicht über öffentliche Issues
(Kontaktweg folgt mit dem ersten Release).

## Referenzen

[SECURITY.md](../../project-brain/SECURITY.md) · [RISKS.md](../../project-brain/RISKS.md) ·
[Agent](agent.md)
