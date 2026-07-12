---
title: Read-only Managed Backup Inspection
step: 045
status: implemented
executable: true
operation_mode: read-only
ndf_version: v1.0.0
---

# Read-only Managed Backup Inspection (SpeakCore, NDF Step 045)

> **Strikt read-only.** Prüft **genau ein** bestehendes managed Backup-Archiv. Die Archivdatei wird
> **nur** gelesen, um ihren SHA-256-Fingerprint zu streamen — **kein** Entpacken, **kein**
> Tar-Inhaltslisting, **kein** Öffnen einzelner Archiv-Einträge, **kein** Schreiben, **kein**
> Restore/Plan/Staging/Stop/Start. Grundlage: [Restore-Blueprint](MANAGED_BACKUP_RESTORE_BLUEPRINT.md),
> ADR-0039/0040/0041 (siehe [../../project-brain/DECISIONS.md](../../project-brain/DECISIONS.md)).

## Zweck

Feststellen, ob ein bestehendes managed Backup grundsätzlich für einen **späteren** Restore-Plan
geeignet wäre — und die maschinenlesbaren **Blocker**, die dem heute entgegenstehen. **Wichtig
(ADR-0040):** Bestandsbackups besitzen kein versioniertes Restore-Manifest ⇒ sie sind **nie**
`restoreEligible`. Die Inspection erkennt/zeigt ein Legacy-Backup an, gibt es aber **nicht** frei.

## Schnittstelle (interner Agent-Endpunkt)

`POST /docker/provision/inspect-backup` — **token-gated** (Bearer, wie alle Nicht-Liveness-Endpunkte;
**kein** `AGENT_DOCKER_WRITE_ENABLED` nötig, da read-only). Nicht öffentlich; keine
Browser→Agent-Direktverbindung. Die spätere Web-Owner-Prüfung (ADR-0039, OWNER-only) ersetzt dieser
interne Endpunkt **nicht**.

### Request

```json
{ "backupFileName": "speakcore-backup-ts3-<instanceId>-<timestamp>.tar.gz" }
```

**Nur** der managed Dateiname — **kein** Host-Pfad, **keine** instanceId (wird intern aus dem Namen
abgeleitet), **keine** freie Pfadangabe.

### Response (HTTP 200, normalisiert)

```json
{
  "backupFileName": "speakcore-backup-ts3-...-....tar.gz",
  "managed": true,
  "regularFile": true,
  "sizeBytes": 123456,
  "modifiedAt": "2026-07-12T00:00:00.000Z",
  "fingerprint": { "algorithm": "sha256", "value": "<hex>", "storedValue": "<hex-or-null>", "matchesStoredValue": true },
  "metadata": { "status": "valid", "fileName": "speakcore-backup-ts3-...-....metadata.json" },
  "manifest": { "status": "missing", "schemaVersion": null },
  "legacy": true,
  "compatibility": { "status": "incompatible", "reasons": ["RESTORE_MANIFEST_MISSING"] },
  "restoreEligible": false,
  "blockers": ["RESTORE_MANIFEST_MISSING"],
  "snapshot": { "sizeBytes": 123456, "modifiedAt": "2026-07-12T00:00:00.000Z", "sha256": "<hex>" }
}
```

`401` bei fehlender/ungültiger Agent-Authentifizierung; `400` bei unlesbarem JSON-Body. Domänen-
Ergebnisse (inkl. ungültiger Name/nicht gefunden) werden als **HTTP 200 mit normalisiertem Body**
zurückgegeben (Konvention wie `verify-backup`/`list-backups`).

## Status- und Blocker-Codes

| Code | Bedeutung |
|------|-----------|
| `BACKUP_NAME_INVALID` | Name entspricht nicht dem strikten managed Muster (bzw. `/`, `\`, `..`, absoluter Pfad, falsche Endung, ungültige instanceId). |
| `BACKUP_OUTSIDE_MANAGED_BOUNDARY` | Aufgelöster Pfad läge außerhalb von `AGENT_BACKUP_DIR` (Defense-in-Depth; Name enthält bereits keine Separatoren). |
| `BACKUP_NOT_FOUND` | Datei existiert nicht. |
| `BACKUP_NOT_REGULAR_FILE` | Verzeichnis/Sonderdatei statt regulärer Datei. |
| `BACKUP_LINK_REJECTED` | Symlink (via `lstat` erkannt, wird **nicht** verfolgt). |
| `BACKUP_EMPTY` | Datei ist 0 Byte groß. |
| `BACKUP_CHANGED_DURING_INSPECTION` | Größe/mtime änderte sich während des Hashens ⇒ Ergebnis verworfen. |
| `ARCHIVE_READ_FAILED` | Datei konnte nicht gelesen/gehasht werden. |
| `METADATA_MISSING` | `.metadata.json`-Sidecar fehlt. |
| `METADATA_INVALID` | Sidecar unparsbar oder strukturell ungültig (Sanitisierung schlägt fehl). |
| `ARCHIVE_CHECKSUM_MISSING` | Kein gespeicherter Archiv-SHA-256 in den Metadaten. |
| `ARCHIVE_CHECKSUM_MISMATCH` | Gespeicherter ≠ neu berechneter SHA-256 (**Integritätsfehler**). |
| `RESTORE_MANIFEST_MISSING` | Kein versioniertes Restore-Manifest (ADR-0040) ⇒ Legacy. |
| `RESTORE_MANIFEST_UNSUPPORTED` | (reserviert) Manifest-Schema-Version nicht unterstützt. |
| `INSTANCE_BINDING_UNKNOWN` | Instanzbindung nicht bestätigbar (fehlende/ungültige Metadaten). |
| `RESTORE_COMPATIBILITY_UNKNOWN` | (reserviert) Kompatibilität nicht bestimmbar. |

**Trennung:** Anfrage-/Boundary-Fehler (`BACKUP_NAME_INVALID`, `BACKUP_OUTSIDE_MANAGED_BOUNDARY`,
`BACKUP_NOT_FOUND`, `BACKUP_NOT_REGULAR_FILE`, `BACKUP_LINK_REJECTED`) · beschädigte/ungültige
Zustände (`METADATA_INVALID`, `ARCHIVE_CHECKSUM_MISMATCH`, `BACKUP_CHANGED_DURING_INSPECTION`) ·
Legacy-/Kompatibilitätsblocker (`RESTORE_MANIFEST_MISSING`, `ARCHIVE_CHECKSUM_MISSING`,
`INSTANCE_BINDING_UNKNOWN`). Ein gültiges managed Legacy-Backup wird **erfolgreich** inspiziert und
liefert dennoch `restoreEligible: false`.

## Sicherheitsgrenzen

- **Dateiname:** kanonische strikte Validierung (`isValidBackupFileName`) — keine zweite, schwächere
  Prüfung; kein `/`, `\`, `..`, kein absoluter Pfad, feste `.tar.gz`-Endung; Sidecar-Name **intern**
  aus dem validierten Namen abgeleitet.
- **Pfadgrenze:** Zielpfad nur aus `AGENT_BACKUP_DIR` + validiertem Namen; kanonische
  Containment-Prüfung; keine freie Pfadangabe, keine Fallback-/Fuzzy-Suche.
- **Dateityp:** `lstat` **vor** dem Hashen — Symlinks/Junctions werden abgelehnt (nicht verfolgt),
  Verzeichnisse/Special Files abgelehnt.
- **Hashing:** SHA-256 **gestreamt** (kein Voll-Buffering); `stat` **vor und nach** dem Hashen —
  bei Größen-/mtime-Änderung wird das Ergebnis verworfen (`BACKUP_CHANGED_DURING_INSPECTION`). **Kein
  Schreiben, kein neuer Sidecar, kein automatisches Nachtragen eines fehlenden Hashes.**
- **Metadaten:** defensives JSON-Parsen + bestehende Sanitisierung (`sanitizeBackupMetadataForDisplay`);
  neben dem Archiv liegende Metadaten gelten **nicht** automatisch als vertrauenswürdig; gespeicherter
  vs. berechneter SHA-256 wird verglichen. Keine Secrets/Dateiinhalte in Fehlern.
- **Auth/Response:** bestehende Agent-Authentifizierung unverändert; keine Secrets/Tokens/vollen
  Host-Pfade/Stacktraces/Archivinhalte in Antworten oder Logs (`backup.inspect`).

## Legacy- und Manifest-Verhalten

In diesem Step wird **kein** Archiv geöffnet und **kein** Manifest erzeugt. Für heutige Backups gilt
daher immer: `manifestStatus: missing`, `legacy: true`, `restoreEligible: false`. Ein
Legacy-BackUp-Backfill/Manifest-Erzeugung ist ein **separates** späteres Work Package.

## Bekannte Plattformgrenzen

- Symlink-Ablehnung nutzt `lstat`. Windows-**Junctions/Reparse Points** werden über `lstat`/
  `isSymbolicLink` bzw. `isFile` bestmöglich erkannt; die Zuverlässigkeit ist plattform-/
  dateisystemabhängig. Symlink-Tests werden auf Plattformen ohne Symlink-Erstellungsrecht
  **nachvollziehbar geskippt** (nicht als bestanden vorgetäuscht).

## Nächste Abhängigkeit

Ein späteres **Restore Manifest Creation Foundation**-WP (Manifest beim Backup-Erstellen, ADR-0040)
macht Backups erst restorefähig. Restore-Plan/-Ausführung/Apply/Rollback (Blueprint §5.6–§5.15)
bleiben eigene, abgesicherte Steps. **Restore ist weiterhin nicht implementiert.**
