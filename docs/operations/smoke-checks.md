# Smoke-Checks – SpeakCore Suite 0.1 Alpha

> NDF Step 031. Manuelle + automatisierbare **read-only**-Prüfungen vor einer internen Alpha.
> **Keine destruktiven Aktionen**, kein echtes Provisioning, keine Docker-Writes.

## 0. Grundsatz

Diese Checks führen **keine** gefährlichen Aktionen aus: **kein** `docker run/start/stop/rm`,
**kein** `docker volume rm`, **kein** `docker network rm`, **kein** echtes Provisioning. Docker-Write-Aktionen
sind ohnehin durch `AGENT_DOCKER_WRITE_ENABLED` (Default `false`) im Agent gesperrt.

## 1. Automatisierbar (Build/Test-Kette)

```bash
pnpm install
# Prisma (Web): validieren + Migrationen anwenden (non-interaktiv)
DATABASE_URL="file:./dev.db" pnpm --dir apps/web exec prisma validate
DATABASE_URL="file:./dev.db" pnpm --dir apps/web exec prisma migrate deploy
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Erwartung: alle grün; **332 Tests** ohne Fehler; `prisma validate` = valid.

Optional per Script (PowerShell, Windows): [`scripts/smoke-check.ps1`](../../scripts/smoke-check.ps1) –
führt genau diese Kette aus und prüft optional die read-only Agent-Endpunkte (nur `GET`, keine Writes).

## 2. Dienste starten (lokal)

```bash
cp apps/web/.env.example apps/web/.env       # SESSION_SECRET + SECRET_ENCRYPTION_KEY setzen!
cp apps/agent/.env.example apps/agent/.env   # AGENT_BOOTSTRAP_TOKEN identisch zu apps/web
pnpm --filter @speakcore/web db:migrate      # bzw. migrate deploy (siehe oben)
pnpm dev                                      # web :3000 (/de) + agent :4000
```

## 3. Agent read-only prüfen (Bearer-Token, falls gesetzt)

```bash
curl -fsS http://localhost:4000/health                                  # {"status":"ok",...}
curl -fsS http://localhost:4000/version                                 # Versionsinfo
curl -fsS -H "authorization: Bearer $TOKEN" http://localhost:4000/system/snapshot   | head -c 200
curl -fsS -H "authorization: Bearer $TOKEN" http://localhost:4000/docker/inventory  | head -c 200
```

Erwartung: `/health` + `/version` immer erreichbar; Snapshot/Inventar nur mit gültigem Token; Inventar zeigt
**nur** SpeakCore-managed Ressourcen (Managed-Only) und **keine** fremden Details.

## 4. „Kein Docker-Write ohne Flag" (read-only Verhalten bestätigen)

Mit `AGENT_DOCKER_WRITE_ENABLED=false` (Default) liefern die Write-Endpunkte `writeDisabled` und führen
**keine** Docker-Aktion aus. Beispiel (erwartet `{"status":"writeDisabled"}`):

```bash
curl -fsS -X POST -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{}' http://localhost:4000/docker/provision/prepare
```

> Hinweis: Dies ist **kein** Provisioning – bei deaktiviertem Flag passiert nichts.

## 5. Manuelle UI-Prüfungen

- **Setup-Wizard:** Erstaufruf → Systemmodus wählen → Owner-Account anlegen (Argon2id) → Login/Dashboard.
- **Serverliste `/servers`:** aktive Server sichtbar; Tabs **Aktiv | Archiviert** funktionieren.
- **Archivliste:** `?view=archived` zeigt nur archivierte Server (Badge, Datum, Credential-Status), **keine**
  Lifecycle-Aktionen.
- **Export:** auf `/servers/[id]` „Export herunterladen" → JSON-Datei ohne Secrets/Credentials; mit
  Audit-Historie optional. **Kein** Restore/Import.
- **Managed Detail:** Status/Healthcheck/Deprovisioning-Gefahrenzone/Backup-Info-Karte prüfen –
  Bestätigungen greifen, **kein** Button suggeriert nicht vorhandene Fähigkeiten.
- **Volume-Backup (Step 032, hier nur Formular-Check, kein echtes Backup):** In der Gefahrenzone
  (`RESOURCES_PREPARED`) das Backup-Formular öffnen – ohne alle 3 Checkboxen bzw. ohne getipptes
  `CREATE BACKUP` blockt die Aktion mit klarem Hinweis. Ein **echtes** Backup wird in dieser
  nicht-destruktiven Smoke-Runde **nicht** ausgelöst (benötigt Write-Flag + vorhandenes Volume);
  wer es bewusst testet: Datei landet serverseitig in `AGENT_BACKUP_DIR` und ist **sensibel**.
- **Backup-Liste (Step 033, komplett read-only – gefahrlos):** Auf `/servers/[id]` eines managed
  Servers in der Karte „Backups (nur Ansicht)" auf **„Backups anzeigen"** klicken. Erwartung:
  Liste mit Dateiname/Größe/Zeitstempel/Metadatenstatus, „Keine Backups gefunden." bei leerem
  Verzeichnis oder „Backup-Verzeichnis … nicht verfügbar" ohne `AGENT_BACKUP_DIR`. **Keine**
  Download-/Restore-/Delete-Buttons; keine Docker-Aktion, kein Write-Flag nötig. Bei Backups aus
  Step 034 zusätzlich: `SHA-256: <gekürzt>…` + „Vollständige Prüfsumme anzeigen"; ältere Backups
  zeigen „Prüfsumme fehlt" (beides korrekt).
- **Backup-Verify (Step 035, komplett read-only – gefahrlos):** In der Backup-Liste bei einem
  Eintrag auf **„Prüfsumme prüfen"** klicken. Erwartung: grünes Banner „Prüfung erfolgreich …"
  (bzw. „Prüfsumme fehlt" bei Step-032-Backups). Rotes „stimmt NICHT überein" nur, wenn die Datei
  tatsächlich verändert wurde. Es wird nichts geschrieben/geladen/gelöscht.
- **Checksum-Backfill (Step 038, gefahrlos – tar.gz bleibt unverändert):** Bei einem älteren
  Backup mit „Prüfsumme fehlt" auf **„Prüfsumme nachtragen"** klicken. Erwartung: grünes Banner
  „Prüfsumme wurde nachgetragen …"; erneuter Klick wäre nicht mehr möglich (Button verschwindet),
  ein direkter zweiter Agent-Aufruf ergäbe `alreadyPresent`. Danach funktioniert „Prüfsumme
  prüfen" für dieses Backup.
- **Backup-Download (Step 037, read-only – gefahrlos, aber Datei ist sensibel):** Nach einem
  Verify mit Ergebnis „gültig" erscheint am Eintrag die Download-Form. Ohne beide Checkboxen bzw.
  ohne getipptes `DOWNLOAD BACKUP` blockt die Route mit klarem Hinweis (Redirect zurück zur
  Liste). Mit allen Bestätigungen liefert der Browser die tar.gz als Datei-Download (Prüfsumme
  wird vorher serverseitig erneut geprüft; max. 5/h). **Keine** Restore-/Delete-/Rotate-/
  Import-Buttons; die heruntergeladene Datei sicher aufbewahren oder nach dem Test löschen.

## 6. Ergebnisprotokoll (Vorlage)

| Check | Ergebnis | Notiz |
|---|---|---|
| install/validate/migrate | ☐ | |
| lint/typecheck/test/build | ☐ | 454 Tests |
| web+agent start | ☐ | |
| agent /health,/version | ☐ | |
| snapshot+inventory (Token) | ☐ | read-only |
| writeDisabled ohne Flag | ☐ | keine Docker-Aktion |
| Setup-Wizard | ☐ | |
| Serverliste + Archiv-Tabs | ☐ | |
| Export ohne Secrets | ☐ | |
