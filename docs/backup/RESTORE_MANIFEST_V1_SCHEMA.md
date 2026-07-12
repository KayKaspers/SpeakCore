---
title: Restore Manifest v1 – Format, Placement & Binding
step: 046
status: Proposed
executable: false
ndf_version: v1.0.0
---

# Restore Manifest v1 – Schema (SpeakCore, NDF Step 046)

> **`status: Proposed` / `executable: false`.** Dieses Dokument **implementiert nichts** und ändert
> **keine** Backup-Erstellung. Es definiert das verbindlich zu entscheidende Format des
> versionierten Restore-Manifests (ADR-0040 Accepted) und wird von **Proposed
> [ADR-0042](../../project-brain/DECISIONS.md)** getragen. Grundlage:
> [Restore-Blueprint](MANAGED_BACKUP_RESTORE_BLUEPRINT.md) · read-only Inspection:
> [READ_ONLY_BACKUP_INSPECTION.md](READ_ONLY_BACKUP_INSPECTION.md).

## Zweck

Ein Manifest v1 beschreibt **deterministisch und vollständig** die im Backup-Archiv enthaltenen
Nutzdaten (Pfade, Typen, Größen, Per-Datei-SHA-256) sowie die Kompatibilitäts-/Bindungsinformationen,
damit ein **späterer** Restore die Archivstruktur vor dem Apply belastbar validieren kann. Ohne
solches Manifest ist ein Backup **nicht restorefähig** (ADR-0040; Legacy).

## Dateiname & Ablage

- **Im Archiv:** exakt **`speakcore-backup-manifest.json`**, **genau einmal**, im **Archiv-Root**
  (kein Unterverzeichnis, kein benutzerdefinierter Name, kein Pfad aus Request/Konfiguration, keine
  alternativen Fundstellen). Das Manifest beschreibt die Nutzdaten, **nicht sich selbst**.
- **Externer managed Sidecar:** **identische Bytes** als `<backup-file-name>.manifest.json` neben der
  tar.gz in `AGENT_BACKUP_DIR` (schnelle read-only Inspection). Der Sidecar allein erzeugt **keine**
  Restore-Freigabe; die spätere **Restore-Referenz** ist das Manifest **im Archiv**.

## JSON-Beispiel (illustrativ, keine echten/produktiven Daten)

```json
{
  "schemaVersion": 1,
  "backupId": "speakcore-backup-ts3-<instanceId>-<timestamp>",
  "instanceId": "<instanceId>",
  "createdAt": "2026-07-12T00:00:00.000Z",
  "backupType": "managed-ts3-volume-backup",
  "speakCoreVersion": "0.1.0",
  "agentVersion": "0.1.0",
  "archiveFormat": "tar+gzip",
  "layoutVersion": 1,
  "expectedUncompressedSizeBytes": 123456,
  "expectedFileCount": 3,
  "entries": [
    { "path": "files/example.dat", "entryType": "file", "sizeBytes": 100, "sha256": "<64-hex>" },
    { "path": "sub", "entryType": "dir", "sizeBytes": 0 },
    { "path": "sub/server.sqlite", "entryType": "file", "sizeBytes": 123356, "sha256": "<64-hex>" }
  ],
  "compatibility": {
    "backupType": "managed-ts3-volume-backup",
    "archiveFormat": "tar+gzip",
    "layoutVersion": 1,
    "speakCoreVersion": "0.1.0",
    "agentVersion": "0.1.0",
    "teamspeakVersion": null,
    "sourcePlatform": null
  }
}
```

## Feldtabelle

| Feld | Pflicht | Typ | Bedeutung |
|------|---------|-----|-----------|
| `schemaVersion` | **ja** | integer | Manifest-Schema-Version (v1 = `1`); unbekannte Major ⇒ fail-closed. |
| `backupId` | **ja** | string | Stabile Backup-ID (Dateiname-Stamm ohne Endung). |
| `instanceId` | **ja** | string | Managed Instanz-ID (Instanzbindung). |
| `createdAt` | **ja** | string | ISO-8601 UTC. |
| `backupType` | **ja** | string | `managed-ts3-volume-backup`. |
| `speakCoreVersion` | **ja** | string | Erzeugende SpeakCore-Version. |
| `agentVersion` | **ja** | string | Erzeugende Agent-Version. |
| `archiveFormat` | **ja** | string | z. B. `tar+gzip`. |
| `layoutVersion` | **ja** | integer | Version des Volume-Datenlayouts. |
| `expectedUncompressedSizeBytes` | **ja** | integer | Summe der Nutzdatengrößen (Bomb-/Space-Gate). |
| `expectedFileCount` | **ja** | integer | Anzahl regulärer Dateien (Inode-Gate). |
| `entries` | **ja** | array | Sortierte Liste der Nutzdaten-Einträge (s. u.). |
| `compatibility` | **ja** | object | Kompatibilitätsinformationen (s. u.). |
| `compatibility.teamspeakVersion` | optional | string/null | TeamSpeak-Version/Build, falls bekannt. |
| `compatibility.sourcePlatform` | optional | string/null | Quellplattform, falls bekannt. |

### Entry-Regeln

Je Eintrag mindestens: `path`, `entryType`, `sizeBytes`; für reguläre Dateien zusätzlich `sha256`.

- `entryType ∈ { "file", "dir" }`. **Symlinks, Hardlinks, Device Files, Pipes und sonstige Special
  Files sind in v1 unzulässig** (Manifest-Erzeugung schlägt fehl, kein „Überspringen").
- `sha256` **nur** für reguläre Dateien (lowercase Hex, 64 Zeichen). **Verzeichnisse erhalten keinen
  erfundenen Inhalts-Hash** (kein `sha256`).
- **Doppelte Pfade unzulässig.** Einträge **lexikalisch nach `path` sortiert**.
- Die **Manifest-Datei selbst** (`speakcore-backup-manifest.json`) ist **nicht** in `entries`.
- **Agent-Sidecars außerhalb des Archivs** (metadata.json, manifest.json) sind **nicht** in `entries`.

### Pfadnormalisierung

**Normalisierte POSIX-relative Pfade:** kein führendes `/`, kein `.`- oder `..`-Segment, keine
Backslashes, keine doppelten Pfadseparatoren. Alle Pfade relativ zum Archiv-Root (= Volume-Root).

### Hash-Format & deterministische Serialisierung

- SHA-256 als **lowercase Hex** (64 Zeichen); Streaming-Berechnung je Datei (kein Voll-Buffering).
- **UTF-8, kein BOM, LF-Zeilenenden.** Stabile Feld-/Key-Reihenfolge; `entries` nach `path` sortiert;
  ISO-8601-UTC für Zeitwerte; keine uneindeutigen Zahlen-/Datumsformate.
- **Empfohlen:** projektspezifische, dokumentierte deterministische Serialisierung (stabile
  Key-Reihenfolge + sortierte Einträge). **Kein** formaler Canonical-JSON-Standard, **keine** neue
  Dependency (ADR-0042).

## Bindung (Sidecar & Metadata)

Die bestehende `.metadata.json` (Sidecar) trägt künftig zusätzlich:
`backupId`, `instanceId`, `archiveFileName`, `archiveSizeBytes`, `archiveSha256`,
`manifestFileName`, `manifestSchemaVersion`, `manifestSha256`.

- **Archiv-Hash** bindet Metadata ↔ Archiv.
- **Manifest-Hash** bindet Metadata ↔ **exakte Manifest-Bytes**.
- Der **externe Sidecar** muss denselben `manifestSha256` haben.
- **Vor Restore-Apply** muss das Manifest **im Archiv** denselben Hash besitzen.
- Sidecar + Metadata **ersetzen keine** spätere Archivvalidierung; SHA-256 = **Integrität**, **keine**
  Signatur/externe Herkunftsgarantie.

## Snapshot-Konsistenz

**Grundsatz:** Das Manifest muss **exakt** die archivierte Datenstruktur beschreiben; ein Manifest
aus einem früheren/parallelen Live-Zustand ist **unzulässig**. **Bevorzugt:** Manifest **und** Archiv
werden aus **derselben** agent-kontrollierten, **unveränderlichen** Staging-Struktur erzeugt.

**Befund (aktueller Backup-Ablauf, `apps/agent/src/docker-backup.ts`):** Das Backup tart das Volume
**read-only** direkt (`-v <vol>:/data:ro ... tar -czf /backup/<finaler-Name> -C /data .`) — **ohne**
Staging-Kopie/Snapshot. Bewertete Optionen: (1) Hash live→archivieren · (2) archivieren→aus Archiv
ableiten · (3) kontrollierter Stopp · (4) **Staging-Kopie, Manifest+Archiv aus derselben Struktur** ·
(5) Dateisystem-Snapshot. **Empfohlen: (4)** — konsistent, plattformnah, ohne FS-Snapshot-Zwang.
⇒ **Die geforderte Garantie fehlt heute; die Manifest-Integration ist bis zu einem Staging-WP
BLOCKIERT** (kein schwächeres Konsistenzversprechen).

## Atomare Veröffentlichung (Zielablauf, konzeptionell)

1. private temporäre Staging-Boundary erzeugen → 2. Snapshot/Staging-Inhalt herstellen →
3. Manifest **aus genau dieser Struktur** erzeugen → 4. Manifest in die Archivstruktur aufnehmen →
5. Archiv **temporär** erzeugen → 6. Archiv-SHA-256 → 7. externe Manifest-Kopie **temporär** →
8. Metadata **temporär** → 9. alle Hash-/Konsistenzprüfungen → 10. **erst danach atomar** in den
managed Backup-Namensraum veröffentlichen.

**Kein unvollständiges Backup darf in der normalen Liste erscheinen.** **Befund:** die aktuelle
Erzeugung schreibt direkt unter dem finalen Namen (kein Temp-Name, kein atomarer Rename) ⇒ auch
dieser Punkt ist Teil des blockierenden Staging-/Atomic-Publish-WPs (OPEN-14).

## Fehler & Cleanup (fail-closed)

Bei Fehlschlag von Manifest-Erzeugung · Datei-Änderung während Hashing · unsupported file type ·
Staging-Kopie · Archivierung · Archiv-Hash · Sidecar-Schreiben · Metadata-Schreiben · atomarem
Rename · teilweisem Cleanup · Agent-Abbruch · Speichermangel gilt: **kein teilweise veröffentlichtes
managed Backup**, **keine Wiederverwendung unvollständiger Dateien**, temporäre Artefakte klar
erkennbar und **nicht listbar**, Cleanup-Fehler **sichtbar und auditierbar**.

## Legacy-Verhalten

Bestehende Backups ohne Manifest bleiben **Legacy**: `manifest: missing`, `legacy: true`,
`restoreEligible: false` (Step 045 / ADR-0040). Ein Backfill/Migration wäre ein **separates** WP und
ist ohne Original-Snapshot **nicht** vertrauenswürdig rekonstruierbar.

## Auswirkung auf die read-only Inspection (Step 045; hier nicht implementiert)

Künftige Manifest-Zustände: `missing` · `invalid` · `unsupported` · `present_unverified` ·
`verified`.
- `present_unverified` = externer Manifest-Sidecar vorhanden **und** gegen Metadata (Hash) geprüft.
- `verified` **erst**, wenn das Manifest **im Archiv** sicher geprüft wurde.
- Step 045 darf **nicht** allein wegen eines externen Sidecars `restoreEligible: true` liefern.
- Legacy-Backups bleiben `missing`/`legacy: true`/`restoreEligible: false`.

## Offene Entscheidungen

Freigabe von ADR-0042 (Human Maintainer); Staging-/Snapshot-Konsistenz + atomare Veröffentlichung
(OPEN-13/OPEN-14, blockierend für die Integration); endgültige Kompatibilitätslogik (separates WP);
ob/wie ein Legacy-Manifest-Backfill je erfolgt.

## Spätere Testanforderungen (nicht hier implementiert)

Deterministische Serialisierung (Byte-stabil) · Pfadnormalisierung/-Ablehnung (Traversal, absolut,
Backslash, Doppelseparator) · Ablehnung von Symlink/Hardlink/Special Files · Verzeichnis ohne
`sha256` · doppelte Pfade abgelehnt · sortierte Einträge · Manifest/Sidecar nicht in `entries` ·
Manifest-Hash = Sidecar-Hash = Archiv-internes-Manifest-Hash · Größen-/Dateizahl-Gates ·
unbekannte `schemaVersion` fail-closed.

## Folge-WPs

- **047 – Manifest v1 Types and Pure Validation:** gemeinsame Typen, Runtime-Validator,
  deterministische Serialisierung; **keine** Backup-Integration, **keine** FS-Änderung außerhalb Tests.
- **048 – Read-only Manifest Builder:** read-only Walking einer kontrollierten Test-/Staging-Struktur,
  Streaming-SHA-256 je Datei, Pfad-/Dateityp-Grenzen; **keine** produktive Backup-Integration.
- **049 – Staging and Snapshot Consistency:** nur nach nötiger ADR-Freigabe; agent-kontrollierte
  Staging-Struktur, Speicher-/Cleanup-Grenzen.
- **Später – Backup Creation Integration:** Manifest im Archiv, Sidecars, atomare Veröffentlichung;
  **keine** Restore-Ausführung.
