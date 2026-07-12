---
title: Restore Foundation Decision Summary
step: 044
status: Proposed
executable: false
ndf_version: v1.0.0
---

# Restore Foundation – Decision Summary (SpeakCore, NDF Step 044)

> **`status: Proposed` / `executable: false`.** Kompakte Übersicht des Restore-Foundation-ADR-Pakets
> (ADR-0039–0041 in [../../project-brain/DECISIONS.md](../../project-brain/DECISIONS.md)) auf Basis
> des [Restore-Blueprints](MANAGED_BACKUP_RESTORE_BLUEPRINT.md).

## Klarstellungen (verbindlich)

- **Proposed ist NICHT Accepted.** Keine dieser Entscheidungen ist ohne ausdrückliche
  **Human-Maintainer-Freigabe (Kay)** beschlossen.
- **Restore bleibt NICHT implementiert.** Es gibt keinen Restore-Code, keine Archiv-Extraktion,
  keine Write-/Apply-Funktion.
- **Step 045 darf zunächst nur eine read-only Restore-Inspection planen oder implementieren** —
  keine Write- oder Apply-Funktion ist freigegeben.

## Entscheidungsübersicht

### ADR-0039 – Restore Authorization and Confirmation Model
- **Status:** Proposed · `executable: false`
- **Nova-Empfehlung:** `OWNER`-only; UI ist nur Bestätigungsfaktor (keine Autorität); serverseitige
  Re-Prüfung bei Plan **und** Ausführung; Bestätigung gebunden an Benutzer+Instanz+Backup+
  Fingerprint+Plan-ID+Ablaufzeit, einmalig (Replay-Schutz); geänderter Zustand ⇒ Plan ungültig;
  kein Cross-Instance-, kein Fremd-/Upload-Restore, keine freien Hostpfade.
- **Alternativen:** Ja/Nein · Dateiname · Instanzname · feste Phrase · Einmal-Token →
  empfohlen: starke Eingabe **plus** serverseitige Plan-/Fingerprint-Bindung.
- **Sicherheitsauswirkung:** verhindert UI-Spoofing, Replay, TOCTOU-Backup-Austausch.
- **Benötigte Human-Maintainer-Entscheidung:** exakte Bestätigungsphrase/-kombination; eigene
  Restore-Rolle ja/nein.
- **Abhängigkeit für Folge-WPs:** Grundlage für Plan-/Execute-Endpunkte (Blueprint §5.18).

### ADR-0040 – Restore Manifest and Legacy Backup Policy
- **Status:** Proposed · `executable: false`
- **Nova-Empfehlung:** versioniertes Manifest **zwingend**, beim Backup-Erstellen erzeugt, Teil der
  validierten Struktur; SHA-256 = Integrität, **keine** Herkunft/Signatur; **Legacy ohne Manifest
  zunächst nicht restorefähig**; keine Vertrauensableitung aus Name/Sidecar; Inspection darf Legacy
  als inkompatibel **anzeigen**, nicht freigeben; Backfill = separates WP.
- **Alternativen:** kein Manifest · optionales Manifest · **zwingend + Legacy fail-closed
  (empfohlen)**.
- **Sicherheitsauswirkung:** macht Bomb-/Größen-/Struktur-Gates belastbar; verhindert Restore aus
  unvollständig verifizierbaren Backups. **Vier getrennte Eigenschaften:** Integrität · Herkunft ·
  Instanzbindung · Versionskompatibilität.
- **Benötigte Human-Maintainer-Entscheidung:** finale Pflicht-/Optionalfelder; ob/wann Legacy-Backfill.
- **Abhängigkeit für Folge-WPs:** definiert, was die Restore-Inspection prüft; berührt einen späteren
  Backup-Erstellungs-WP.

### ADR-0041 – Mandatory Pre-Restore Safety Backup
- **Status:** Proposed · `executable: false`
- **Nova-Empfehlung:** vor jedem Restore **verpflichtender** neuer managed Sicherungspunkt; Restore
  **stoppt** bei Fehlschlag der Erstellung/Validierung; **kein Owner-Override in v1**; eindeutige
  Kennzeichnung; kein sofortiges Rotations-Löschen; Speicher-Preflight; harter Blocker bei
  Speichermangel; bevorzugte Rollback-Quelle; Retention später separat.
- **Alternativen:** **verpflichtend ohne Override (empfohlen)** · Override mit Zusatzbestätigung ·
  ohne Sicherung (abgelehnt).
- **Sicherheitsauswirkung:** garantierte Rollback-Grundlage; fehlgeschlagener Apply wird
  rücksicherbar statt Datenverlust.
- **Benötigte Human-Maintainer-Entscheidung:** ob je ein Override; Retention-Politik.
- **Abhängigkeit für Folge-WPs:** Voraussetzung für Apply/Rollback-WPs (Blueprint §5.11/§5.15).

## Bewusst vertagte Folge-ADRs (nicht in Step 044)

Apply-/Rollback-Strategie & Verzeichnis-Swap · Linux-/Windows-/Docker-Volume-Portabilität ·
Restore-State-Persistenz · Lock-Persistenz & Lease-Modell · Audit-Datenmodell · Wiederanlauf nach
Agent-Neustart · Diagnoseartefakt-Retention. (Als OPEN-6…OPEN-12 in
[../../project-brain/DECISIONS.md](../../project-brain/DECISIONS.md) vorgemerkt.)

## Nächster Schritt

- **Step 045 – Read-only Restore Inspection** (geplant, **blockiert bis ADR-Freigabe**): reine
  Analyse/Guard-Logik (Namensmuster, Fingerprint, Manifest-/Legacy-Erkennung, Kompatibilitätsanzeige)
  **ohne** Extraktion/Write/Apply. Voraussetzung: Human-Maintainer-Freigabe von ADR-0039–0041 (bzw.
  der für 045 relevanten Teile von ADR-0040).
