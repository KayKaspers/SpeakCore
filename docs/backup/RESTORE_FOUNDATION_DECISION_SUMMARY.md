---
title: Restore Foundation Decision Summary
step: 044 (accepted in 044a)
status: Accepted
executable: false
ndf_version: v1.0.0
accepted_on: 2026-07-12
accepted_by: Kay (Human Maintainer)
---

# Restore Foundation – Decision Summary (SpeakCore, NDF Step 044 · Accepted 044a)

> **`status: Accepted` (2026-07-12, Kay / Human Maintainer) · `executable: false`.** Kompakte
> Übersicht des Restore-Foundation-ADR-Pakets (ADR-0039–0041 in
> [../../project-brain/DECISIONS.md](../../project-brain/DECISIONS.md)) auf Basis des
> [Restore-Blueprints](MANAGED_BACKUP_RESTORE_BLUEPRINT.md).

## Klarstellungen (verbindlich)

- **`Accepted` bedeutet NICHT, dass Restore implementiert ist.** Es gibt keinen Restore-Code, keine
  Archiv-Extraktion, keine Write-/Apply-Funktion.
- **Alle drei ADRs bleiben `executable: false`.**
- **Step 045 darf ausschließlich eine read-only Restore-Inspection** planen/implementieren.
- **Nicht freigegeben:** Write-, Apply-, Stop-, Swap- oder Rollback-Funktionen.

## Entscheidungsübersicht

### ADR-0039 – Restore Authorization and Confirmation Model
- **Status:** **Accepted** (2026-07-12, Kay / Human Maintainer) · `executable: false`
- **Gewählte Entscheidung (v1):** `OWNER`-only, **keine separate Restore-Rolle in v1**; UI ist nur
  Bestätigungsfaktor (keine Autorität); serverseitige Re-Prüfung bei Plan **und** Ausführung;
  kurzlebiger, **einmalig** nutzbarer Plan gebunden an Benutzer+Instanz+Backup+Fingerprint+Plan-ID+
  Ablaufzeit; geänderter Zustand ⇒ Plan ungültig; kein Cross-Instance-, kein Fremd-/Upload-Restore,
  keine freien Hostpfade. **Bestätigungsphrase (exakt, serverseitig aus dem Plan erzeugt):**
  `RESTORE <INSTANZNAME> FROM <BACKUP-DATEINAME>`.
- **Verworfen/nicht gewählt:** Ja/Nein · alleinige Dateinamen- oder Instanznamen-Eingabe · feste
  Phrase ohne Plan-Bindung (zur Nachvollziehbarkeit erhalten).
- **Sicherheitsauswirkung:** verhindert UI-Spoofing, Replay, TOCTOU-Backup-Austausch.
- **Effekt auf Step 045:** Inspection bleibt read-only; Plan-/Execute-Endpunkte folgen erst in
  späteren, freigegebenen WPs (Blueprint §5.18).

### ADR-0040 – Restore Manifest and Legacy Backup Policy
- **Status:** **Accepted** (2026-07-12, Kay / Human Maintainer) · `executable: false`
- **Gewählte Entscheidung (v1):** versioniertes Manifest **zwingend**, beim Backup-Erstellen erzeugt,
  Teil der validierten Struktur. **Zwingende Inner-Felder:** Schema-Version · Backup-ID · Instanz-ID ·
  Erstellungszeitpunkt · Backup-Typ · SpeakCore-Version · Agent-Version · Archivformat · Layout-Version
  · erwartete unkomprimierte Gesamtgröße · erwartete Dateianzahl · normalisierte relative Pfade ·
  Eintragstypen · Dateigrößen · **SHA-256 je regulärer Datei**. **Äußere Metadaten:** Archivdateiname ·
  komprimierte Größe · **SHA-256 des vollständigen Archivs**. **Optional:** TS3-Version/Build ·
  Quellplattform · Kompatibilitätsmerkmale. SHA-256 = Integrität, **keine** Signatur/Herkunft.
  **Legacy ohne Manifest:** erkennen + anzeigen + **eindeutig „nicht restorefähig"**, kein Auto-Backfill,
  weder planbar noch ausführbar; Legacy-Behandlung = separates WP.
- **Verworfen/nicht gewählt:** kein Manifest · optionales Manifest.
- **Sicherheitsauswirkung:** macht Bomb-/Größen-/Struktur-Gates belastbar; Per-Datei-SHA-256 erlaubt
  Post-Extraktions-Validierung. **Vier getrennte Prüfziele:** Integrität · Herkunft · Instanzbindung ·
  Versionskompatibilität.
- **Effekt auf Step 045:** Inspection prüft/annotiert Manifest-Präsenz + Kompatibilität und markiert
  Legacy als inkompatibel — **ohne** Freigabe; Manifest-Erzeugung ist ein späterer Backup-WP.

### ADR-0041 – Mandatory Pre-Restore Safety Backup
- **Status:** **Accepted** (2026-07-12, Kay / Human Maintainer) · `executable: false`
- **Gewählte Entscheidung (v1):** vor jedem Apply **verpflichtender** neuer managed Sicherungspunkt;
  **kein Owner-Override in v1**; Restore **stoppt** bei Fehlschlag der Erstellung **oder** Validierung;
  **Speichermangel = harter Blocker**; bevorzugte Rollback-Quelle. **Retention/Schutz:** nach
  erfolgreichem Restore **≥ 7 Tage** gegen Rotation geschützt; die **7-Tage-Frist beginnt erst nach
  erfolgreichem Start + Health-Check**; bei fehlgeschlagenem Restore/Rollback **bis zur manuellen
  Klärung geschützt**; **keine Auto-Löschung** bei `ROLLBACK_FAILED`/`CLEANUP_REQUIRED`/vergleichbar.
  Technische Rotation-Ausnahme = separates WP.
- **Verworfen/nicht gewählt:** Owner-Override mit Zusatzbestätigung · Restore ohne Sicherung.
- **Sicherheitsauswirkung:** garantierte Rollback-Grundlage; fehlgeschlagener Apply wird rücksicherbar
  statt Datenverlust; Schutzfristen verhindern vorschnelle Rotation der Rettungskopie.
- **Effekt auf Step 045:** keine — Pre-Restore-Backup/Rollback sind Apply-nahe WPs (Blueprint
  §5.11/§5.15), Step 045 bleibt read-only.

## Bewusst vertagte Folge-ADRs (nicht in Step 044)

Apply-/Rollback-Strategie & Verzeichnis-Swap · Linux-/Windows-/Docker-Volume-Portabilität ·
Restore-State-Persistenz · Lock-Persistenz & Lease-Modell · Audit-Datenmodell · Wiederanlauf nach
Agent-Neustart · Diagnoseartefakt-Retention. (Als OPEN-6…OPEN-12 in
[../../project-brain/DECISIONS.md](../../project-brain/DECISIONS.md) vorgemerkt.)

## Nächster Schritt

- **Step 045 – Read-only Restore Inspection** (geplant, **für Planung freigegeben nach Nova-Review**;
  ADR-Freigabe ist mit 044a erfolgt): reine Analyse/Guard-Logik (Namensmuster, Fingerprint,
  Manifest-/Legacy-Erkennung, Kompatibilitätsanzeige) **ohne** Extraktion/Write/Apply. Umfang strikt
  read-only; Write-/Apply-/Stop-/Swap-/Rollback-Funktionen bleiben **nicht freigegeben**.
- **Vertagt (Folge-ADRs OPEN-6…OPEN-12):** Apply/Rollback · Portabilität · State-/Lock-Persistenz ·
  Audit-Datenmodell · Wiederanlauf · Diagnose-Retention — bleiben offen.
