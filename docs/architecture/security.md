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

## Secret-Key-Rotation (Step 016)

`SECRET_ENCRYPTION_KEY` lässt sich wechseln, ohne gespeicherte Zugangsdaten zu verlieren: ein
Operator setzt zusätzlich `SECRET_ENCRYPTION_KEY_NEW` und führt lokal
`pnpm --filter @speakcore/web rotate-secrets --dry-run` (nur Zählwerte) bzw. ohne `--dry-run` (schreibt
neu verschlüsselte Werte) aus. Der Vorgang ist **transaktional** (all-or-nothing) und **idempotent**;
er existiert **nur als CLI**, nicht als Web-UI/Route/API. Danach `SECRET_ENCRYPTION_KEY` auf den neuen
Wert setzen und `SECRET_ENCRYPTION_KEY_NEW` leeren. **Vor der Rotation ein DB-Backup anlegen.** Secrets
werden dabei nie ausgegeben. Details: [SECURITY.md §5](../../project-brain/SECURITY.md) /
[ADR-0022](../../project-brain/DECISIONS.md).

## Agent & Docker (Ausblick)

Der Agent ist **kein allgemeines Docker-Admin-Interface**. Für spätere Installationen gilt das
**Managed-Only-Prinzip** (nur selbst erzeugte, gelabelte Ressourcen), eine Aktions-Allowlist und
Docker-Argumente aus einem validierten Plan – **kein Docker-Socket im Web-Container**. Stand
Step 012–018: read-only (Planung/Validierung, Inventar) **plus** eng begrenzte **Write-Aktionen** –
managed **Network/Volume** (`/docker/provision/prepare`), **Container erstellen**
(`/docker/provision/create-container`, `docker create`) und **Container starten**
(`/docker/provision/start-container`, `docker start`), alle hinter **Token + Feature-Flag**
(`AGENT_DOCKER_WRITE_ENABLED`, Default `false`), idempotent, Managed-Only. In Step 015 erzeugt die
**Container-Vorbereitung** (`CONTAINER_PENDING`) rein web-seitig das Query-Admin-Secret und speichert es
**verschlüsselt**; in **Step 017** wird der Container erstellt (`CONTAINER_CREATED`) und das Secret dem
Agent **serverseitig** übergeben, der es als **ENV** setzt; in **Step 018** wird der Container nach
**expliziter Lizenzzustimmung** gestartet (`RUNNING`); in **Step 019** liefert ein **read-only
Healthcheck** (`/docker/provision/container-status`, nur Token, kein Write-Flag) via `docker container ls`
den Ist-Zustand (Container läuft? optional TS3 erreichbar?) – **ohne** Lifecycle-Status zu überschreiben.
In **Step 020** bekommt der managed Server eine **explizite Query-Adresse** (`host`; Env-Default
`MANAGED_TS3_QUERY_HOST` + UI-Override, **kein Raten**, Step-008-Host-Validierung), sodass der TS3-Check
echte `reachable`/`unreachable`/`notConfigured` liefert. In **Step 021** kann der Container **gestoppt**
werden (`docker stop`, `RUNNING → CONTAINER_CREATED` + `runState='stopped'`) – **ohne Löschung**, ohne
`rm/restart`. In **Step 022** kann der **gestoppte** Container **entfernt** werden (`docker rm`, ohne
`-f`/`-v`, `CONTAINER_CREATED → RESOURCES_PREPARED`) – **Volume, Network, Credentials und ServerInstance
bleiben erhalten**. In **Step 023** kann der Container **neu gestartet** werden – als **Stop→Start-
Orchestrierung** (`RUNNING → Stop → Start → RUNNING`), **ohne** `docker restart`, mit erneuter Lizenzbestätigung.
**Step 024** ergänzt ein **Deprovisioning-Sicherheitskonzept** (reine Guard-/Planungslogik, **keine Löschung**,
`executable: false`): Stufenmodell mit Datenverlust-/Bestätigungs-/Managed-Only-Guards für spätere Volume-/
Network-Remove-Steps. **Kein Log-Lesen**, kein Inspect, **keine Portscans/externen IP-Checks**, keine
Reparatur, kein Secret in Logs. Details:
[project-brain/SECURITY.md](../../project-brain/SECURITY.md), [agent.md](agent.md).

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
