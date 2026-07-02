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

## 6. Ergebnisprotokoll (Vorlage)

| Check | Ergebnis | Notiz |
|---|---|---|
| install/validate/migrate | ☐ | |
| lint/typecheck/test/build | ☐ | 332 Tests |
| web+agent start | ☐ | |
| agent /health,/version | ☐ | |
| snapshot+inventory (Token) | ☐ | read-only |
| writeDisabled ohne Flag | ☐ | keine Docker-Aktion |
| Setup-Wizard | ☐ | |
| Serverliste + Archiv-Tabs | ☐ | |
| Export ohne Secrets | ☐ | |
