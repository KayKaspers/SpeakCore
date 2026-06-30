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

## Empfehlungen für Betreiber

- WebUI nur über TLS exponieren (Reverse Proxy mit gültigem Zertifikat).
- Firewall: nur benötigte Ports öffnen (TS3-Ports, WebUI-Port). Agent-Port **nicht** öffentlich.
- Regelmäßige Backups und getestete Restores (siehe Installationsanleitungen).
- Audit-Log regelmäßig prüfen.

## Verantwortungsvolle Offenlegung

Sicherheitslücken bitte vertraulich melden, nicht über öffentliche Issues
(Kontaktweg folgt mit dem ersten Release).

## Referenzen

[SECURITY.md](../../project-brain/SECURITY.md) · [RISKS.md](../../project-brain/RISKS.md) ·
[Agent](agent.md)
