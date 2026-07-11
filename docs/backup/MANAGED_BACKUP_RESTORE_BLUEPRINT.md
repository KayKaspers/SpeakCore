---
title: Managed Backup Restore Blueprint
step: 043
status: draft-blueprint
executable: false
ndf_version: v1.0.0
authority_boundary: "Vorschlag/Planung. Human Maintainer (Kay) entscheidet und gibt frei; Nova plant/reviewt. Claude implementiert nichts in diesem Step."
---

# Managed Backup Restore Blueprint (SpeakCore, NDF Step 043)

> **`executable: false`** — Dieser Blueprint **implementiert keinen Restore**. Er ist ein
> implementierungsreifes Sicherheitskonzept für das spätere Wiederherstellen **genau eines**
> von SpeakCore verwalteten Backups. Es wird kein Archiv extrahiert, kein Dienst gestoppt und
> nicht in Backup-/TeamSpeak-Datenverzeichnisse geschrieben. **fail-closed** ist Standard.

## 5.1 Metadaten

- **Titel:** Managed Backup Restore Blueprint
- **Step:** 043
- **Status:** Blueprint / Entwurf (nicht ausführbar)
- **executable:** `false`
- **NDF-Version:** v1.0.0 (Tag `v1.0.0`, Commit `9dcadc1`)
- **Autoritätsgrenze:** Nur Human Maintainer (Kay) gibt Restore-Funktionen frei; Nova plant/reviewt;
  Claude setzt in diesem Step **nichts** um. Skills sind Vorschläge, keine Freigabe.
- **Betroffene Komponenten (später):** Agent (Docker-gestützte Extraktion/Apply, Stop/Start,
  Health), Web (Plan-/Execute-/Status-Endpunkte, Owner-Prüfung, Audit), `packages/shared`
  (reine Restore-Guard-/Planungslogik), `packages/types` (Restore-Typen), Prisma (Restore-State-/
  Audit-Persistenz — noch offen).
- **Nicht betroffene Komponenten:** Backup-Erstellung (032), Backup-Liste (033), Verify (035),
  Einzel-Delete (040), Rotation-Vorschau (041) bleiben unverändert; External-Server (`mode="external"`).
- **Abhängigkeiten:** vorhandener Backup-Lebenszyklus 032–041 (insb. Namensmuster, Verify/SHA-256,
  `AGENT_BACKUP_DIR`, Managed-Only-Docker-Prinzip, Owner-/Token-Grenzen).
- **Bekannte offene Entscheidungen:** siehe §5.22 und §6 (Manifest/Legacy, Pre-Restore-Pflicht,
  Apply-Strategie, State-Persistenz, Restore-Rollen).

## 5.2 Aktueller Ist-Zustand (nur Repository-Befund)

**Backup-Erstellung (Step 032, `apps/agent/src/docker-backup.ts`):** Ein kurzlebiger, gelabelter
Hilfscontainer (`alpine:3.20`) mountet das managed Volume **read-only** und erzeugt ein gzip-Tar:
`tar -czf /backup/<datei> -C /data .`. Quelle ist der **Inhalt** des Volumes
`speakcore-volume-ts3-<instanceId>` (relative Einträge, kein führender Verzeichnisname). Statische
`execFile`-Args, keine Shell, kein Socket.

**Speicherort:** serverseitiges Verzeichnis `AGENT_BACKUP_DIR` (Default `/var/lib/speakcore/backups`);
kein Client-Pfad. Dateiname intern: `speakcore-backup-ts3-<instanceId>-<timestamp>.tar.gz` plus
Sidecar `…-<timestamp>.metadata.json`.

**Erkennung managed Backups (Steps 033/035/040):** strikter Regex
`^speakcore-backup-ts3-<instanceId>-<TS>\.tar\.gz$` mit `TS = \d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z`;
kein `/`, `\`, `..`; keine fremden Instanzen; nie `.metadata.json` als primäres Ziel; kein Directory
Listing für gezielte Operationen; Symlinks/Sonderdateien werden beim Listing über Dirent-`isFile`
verworfen.

**Vorhandene Namens-/Pfadvalidierung:** `backupFileRegex(instanceId)` / `isValidBackupFileName`
(Agent), `isSafeBackupFileName` (Web, Defense-in-Depth). Alle Datei-Ops laufen ausschließlich über
`AGENT_BACKUP_DIR` + intern abgeleitete Namen.

**Archiv-Inhalt:** die Roh-Dateien des TS3-Datenvolumes (aus Code ableitbar: alles unter dem
Volume-Mount). **Interne TS3-Verzeichnisstruktur ist im Repo nicht spezifiziert → als *unbekannt*
markiert.** Ob das busybox-`tar` von `alpine:3.20` Symlinks/Hardlinks/Sonderdateien speichert und
wie es sie beim Entpacken behandelt, ist **nicht im Repo dokumentiert → *unbekannt*, defensiv zu
behandeln.**

**Metadaten (`BackupMetadata`, `packages/types`):** `backupVersion`, `product` (`"SpeakCore"`),
`kind` (`"managed-ts3-volume-backup"`), `createdAt`, `instanceId`, `serverDisplayName`, `volumeName`,
`backupFileName?`, `checksum? { algorithm:"sha256", value, createdAt }`, `containsSecrets:"unknown"`,
`createdBy`, `notes[]`. **Vorhanden.** **Nicht vorhanden (→ *fehlt*):** eingebettetes Manifest im
Archiv, Per-Datei-Prüfsummen, erwartete Dateiliste, unkomprimierte Gesamtgröße, Dateianzahl,
SpeakCore-Version, Agent-Version, TeamSpeak-Version, Restore-Kompatibilitätsfeld. Die
`checksum.value` ist eine SHA-256 **über die gesamte tar.gz** (Integrität, **keine** Signatur/
Authentizität). Sidecar `.metadata.json` ist **unsigniert**. Legacy-Backups aus Step 032 haben ggf.
**keine** `checksum` (Backfill Step 038 nur auf Owner-Aktion).

**Start-/Stop-/Health-Funktionen (Repo):** `docker-start.ts` (Status `started|running|…`),
`docker-stop.ts` (`stopped|alreadyStopped|…`), `docker-status.ts` (Laufzeitstatus, read-only),
`docker-remove.ts`, `docker-restart.ts`. Web-Healthcheck (Step 019) persistiert
`containerRuntimeStatus` (`running|created|exited|notFound|conflict|unavailable|error`) und
`ts3ReachabilityStatus` (`reachable|unreachable|unknown|notConfigured`) getrennt vom
`provisioningStatus`.

**Owner-/Agent-/Audit-Grenzen (Repo):** Web-Aktionen prüfen `user.role !== 'OWNER'`. Der Agent
gated **alle** Nicht-Liveness-Endpunkte per Bootstrap-Token (`isValidToken`/Bearer); **Docker-Write**
zusätzlich per Flag `dockerWriteEnabled` (`AGENT_DOCKER_WRITE_ENABLED`). Read-only Backup-Endpunkte
(list/verify/delete-metadata) sind token-gated **ohne** Write-Flag; destruktive/Docker-Schreib-
Aktionen setzen `writeEnabled`. Der Agent kennt **keine** Web-Rolle → Owner-Prüfung liegt im Web.
Audit: flaches `AuditLog { action, actor, target?, result }` (+ `createdAt`); Audit-Events enthalten
bewusst **keine** Dateinamen/Prüfsummen/Host-Pfade/Secrets. Volume `speakcore-volume-ts3-<id>` wird
im Container am **im Provisioning-Plan definierten `mountPath`** gemountet (**exakter Pfad aus dem
Plan, nicht im Blueprint hartkodiert**).

**Für Restore noch fehlende Voraussetzungen:** kein Restore-Endpunkt/-Code, kein Restore-State-
Modell, kein Restore-Lock, kein Manifest/Per-Datei-Integrität, keine sichere Extraktions-/Staging-
Pipeline, kein Pre-Restore-Sicherungspunkt-Zwang, kein Rollback-Pfad, keine Kompatibilitäts-/
Versionsprüfung, keine strukturierten Restore-Audit-Felder.

## 5.3 Restore-Scope (erster Umfang)

**Minimalziel:** genau **ein** ausgewähltes managed Backup → genau **eine** dazugehörige managed
TeamSpeak-Instanz (dieselbe `instanceId`, dasselbe Volume `speakcore-volume-ts3-<instanceId>`).

Ausgeschlossen: Cross-Instance-Restore; Upload/Import fremder Archive; Restore aus beliebigen
Hostpfaden; partieller Datei-Restore; Multi-Backup-Bulk-Restore; automatischer/geplanter Restore;
Restore ohne Owner-Bestätigung; Restore auf `mode="external"`-Server.

**Zielbindung:** Das Backup ist strikt an seine `instanceId` gebunden (Namensmuster + Metadaten
`instanceId`); Restore ist nur zulässig, wenn die Ziel-`instanceId` exakt übereinstimmt. Der Restore
wirkt ausschließlich auf den **Inhalt** des managed Volumes dieser Instanz.

## 5.4 Trust Boundaries

Für jede Grenze: nicht-vertrauenswürdige Eingaben · Validierungsort · finale autoritative Instanz ·
niemals frei vorgebbare Pfade.

| Grenze | Nicht vertrauenswürdig | Validierung | Autoritativ | Nie frei vom Nutzer |
|--------|------------------------|-------------|-------------|---------------------|
| Browser/UI | alle Eingaben, angezeigte Warnungen, „Bestätigt"-Flags | — | — | jeder Pfad |
| Benutzer/Owner | Rollenbehauptung, Plan-Annahme | Web (Session/RBAC) **und** erneut serverseitig bei Execute | Web-Server | Backup-/Ziel-/Staging-Pfad |
| Web-Anwendung | Client-Requests, Body | Web validiert Owner, Instanz, Dateiname, Plan-Bindung | Web-Server | Host-Pfade zum Agent |
| Datenbank | gespeicherter Instanz-/Plan-Zustand (kann veraltet sein) | Re-Read + Revalidierung bei Execute | Web-Server (Konsistenzprüfung) | — |
| Agent | Request-Parameter (`instanceId`, `fileName`, Plan-/Confirm-Token) | Agent re-validiert Muster/Boundary/Confirm unabhängig | **Agent** (Dateisystem-/Docker-Autorität) | `AGENT_BACKUP_DIR`, Staging-, Ziel-Pfad |
| managed Backup-Verzeichnis | Verzeichnisinhalt (fremde/manipulierte Dateien) | strikter Regex + `isFile`, kein Listing als Ziel | Agent | Pfad = nur `AGENT_BACKUP_DIR` |
| ausgewähltes Backup-Archiv | **Archiv-Inhalt komplett nicht vertrauenswürdig** | Vor-Extraktions-Scan + sichere Extraktion + Post-Scan | Agent | Einträge nie als Zielpfad übernehmen |
| Staging-Verzeichnis | — (agent-erzeugt) | zufälliger Pfad, restriktive Rechte | Agent | vom Nutzer nie bestimmbar |
| TS3-Zielverzeichnis (Volume) | — | nur intern aufgelöst aus `instanceId` | Agent | nie frei; nur `speakcore-volume-ts3-<id>` |
| Host-Dateisystem | Traversal/Escape-Versuche aus dem Archiv | Zielpfad-Validierung je Eintrag, `realpath`-Containment | Agent | außerhalb der managed Boundary tabu |
| laufender TS3-Prozess | — | kontrollierter Stop vor Apply | Agent | — |
| Audit-/Statusdaten | Client-behauptete Ergebnisse | Server schreibt Audit selbst | Web/Agent | — |

**Grundsatz:** Der **Agent** ist die einzige dateisystem-/docker-autoritative Instanz; er vertraut
**keinem** Web-/Client-Input und re-validiert alles. Kein Pfad außer dem intern abgeleiteten
Volume-/Backup-/Staging-Pfad wird je akzeptiert.

## 5.5 Bedrohungsmodell

Bewertung nach SpeakCore-Konvention: **E** = Eintrittswahrscheinlichkeit, **A** = Auswirkung
(niedrig/mittel/hoch). Alle Gegenmaßnahmen sind **Blueprint-Anforderungen** an die spätere Umsetzung.

| # | Bedrohung | E | A | Gegenmaßnahme (Pflicht in Umsetzung) |
|---|-----------|---|---|--------------------------------------|
| T1 | `../` Path Traversal in Archiv-Einträgen | mittel | hoch | Jeden Eintragspfad normalisieren; nach Extraktion `realpath` muss innerhalb Staging/Ziel liegen; sonst Abbruch. |
| T2 | Absolute Archivpfade (`/etc/…`, `C:\…`) | mittel | hoch | Absolute Pfade ablehnen; nur relative, containment-geprüfte Ziele. |
| T3 | Windows-/Unix-Pfadvarianten (Backslash, Laufwerk, UNC) | mittel | hoch | Beide Separatoren + Laufwerks-/UNC-Präfixe als unsicher werten. |
| T4 | Symlink-Escape | mittel | hoch | Keine Symlinks folgen; Symlink-Einträge ablehnen oder nur containment-sicher; Extraktion ohne Link-Deref. |
| T5 | Hardlink-Escape | niedrig | hoch | Hardlink-Einträge ablehnen. |
| T6 | Manipulierte Archiv-Einträge (Typ-Flags) | mittel | hoch | Nur reguläre Dateien + Verzeichnisse zulassen; alles andere ablehnen. |
| T7 | Device/Special Files, Named Pipes | niedrig | hoch | Verbotene Dateitypen → Abbruch. |
| T8 | Unerwartete Dateitypen | mittel | mittel | Allowlist der Eintragstypen; Rest blockiert. |
| T9 | Archive Bomb (Kompressionsverhältnis) | mittel | hoch | Harte Grenze für entpackte Gesamtgröße; Abbruch bei Überschreitung; kein Vollentpacken „auf Verdacht". |
| T10 | Extrem viele kleine Dateien (Inode-Bombe) | mittel | mittel | Grenze für Dateianzahl. |
| T11 | Unkomprimierte Größenüberschreitung | mittel | hoch | Größenbudget vor/während Extraktion prüfen; Streaming-Zähler. |
| T12 | Beschädigte/unvollständige Archive | mittel | mittel | SHA-256 gegen Metadaten (falls vorhanden) + Tar-Integritätsprüfung; sonst Abbruch. |
| T13 | Backup-Austausch zwischen Plan und Ausführung | mittel | hoch | Plan bindet Backup-Fingerprint (Größe+mtime+SHA-256); Re-Check unmittelbar vor Apply (TOCTOU). |
| T14 | Race Conditions / gleichzeitige Ops | mittel | hoch | Server-seitiger Restore-Lock (§5.16), gegenseitiger Ausschluss. |
| T15 | TOCTOU (Datei/Instanz ändert sich) | mittel | hoch | Prüfung möglichst nah an Nutzung; Fingerprint-Revalidierung; Extraktion aus Staging-Kopie. |
| T16 | Falsche Instanzzuordnung | niedrig | hoch | `instanceId` aus Name **und** Metadaten muss zur Zielinstanz passen. |
| T17 | Cross-Tenant/Cross-Instance-Zugriff | niedrig | hoch | Nur exakte `instanceId`; kein Cross-Instance-Ziel. |
| T18 | Unzureichender Speicherplatz | mittel | mittel | Preflight-Schätzung: Staging + Pre-Restore-Backup + Rollback; Abbruch bei Unterdeckung. |
| T19 | Manipulierte Metadaten (Sidecar) | mittel | mittel | Metadaten strikt sanitisieren (bekannte Felder); Sidecar ist **unsigniert** → keine Vertrauensbehauptung; Integrität nur via SHA-256 der tar.gz. |
| T20 | Inkompatible Backup-Version | mittel | mittel | `backupVersion`/`kind` prüfen; unbekannte Version → nicht restorefähig. |
| T21 | Inkonsistente Dateirechte/Ownership | mittel | mittel | Nach Apply definierte Rechte/Ownership setzen (agent-kontrolliert). |
| T22 | Teilrestore (halb angewandt) | mittel | hoch | Atomarer Apply-Ansatz (§5.13) + Rollback; kein sichtbarer Live-Halbzustand. |
| T23 | Prozessabbruch mitten im Apply | mittel | hoch | State-Persistenz + Wiederanlauf/Rollback (§5.14/§5.15). |
| T24 | Strom-/Agent-Ausfall | niedrig | hoch | Lock-Lease + Recovery-Zustand `CLEANUP_REQUIRED`; kein Auto-Fortsetzen ohne Revalidierung. |
| T25 | Fehlgeschlagener Neustart nach Apply | mittel | hoch | Health-Gate; bei Fehlschlag Rollback-Versuch; sonst kritischer Zustand. |
| T26 | Manipulierte Restore-Bestätigung | niedrig | hoch | Bestätigung serverseitig gebunden (Instanz+Backup+Plan-ID+User+Ablauf); UI nie autoritativ. |
| T27 | Replay einer alten Restore-Anforderung | mittel | hoch | Einmalige Plan-/Operation-ID + Ablaufzeit + Verbrauch; Replay abgelehnt. |
| T28 | Konkurrierender Backup-/Delete-/Rotation-/Restore-Vorgang | mittel | hoch | Globaler Instanz-Lock über alle Backup-/Lifecycle-Ops. |

## 5.6 Restore-Planungsphase (read-only, Pflicht vor jeder Write-Aktion)

Der Restore-**Plan** ist rein lesend und übernimmt **keine** freien Hostpfade. Er zeigt mindestens:

Zielinstanz (ID + Name) · Backup-Dateiname · Backup-ID (falls Metadaten) · Erstellungszeitpunkt ·
erkannte Archivgröße · **erwartete entpackte Größe** (nur falls sicher bestimmbar, sonst als
*unbekannt/geschätzt* markieren) · Backup-Format/Schema (`kind`, `backupVersion`) · **intern
aufgelöster** managed Zielpfad (Volume, kein Host-Pfad in der UI) · aktueller Instanzstatus
(`provisioningStatus`, `containerRuntimeStatus`, `ts3ReachabilityStatus`) · erforderlicher Stop
(ja/nein) · geschätzter Speicherbedarf (Staging + Pre-Restore-Backup + Rollback) · geplantes
Staging-Verzeichnis (nur als „agent-intern", kein konkreter Pfad an den Client) · vorgesehener
Pre-Restore-Sicherungspunkt · geplante Validierungen (Gates §5.8) · geplante Rollback-Schritte ·
Auswirkung auf Verfügbarkeit (Downtime-Fenster) · offene Warnungen · Blocker · Bestätigungs-
anforderung · **Plan-Gültigkeit/Ablaufzeit**. Der Plan enthält eine eindeutige **Plan-ID** und den
**Backup-Fingerprint** (Größe + mtime + SHA-256), an den die spätere Ausführung gebunden ist.

## 5.7 Autorisierung und Bestätigung

- **Rolle:** auf Basis des bestehenden RBAC OWNER-only (wie alle sensiblen Backup-Aktionen). Ob
  Restore eine **eigene** Rolle/Recht braucht, ist **ADR-Kandidat** (§6).
- **Serverseitige Revalidierung:** bei Execute erneut Owner-/Rolle prüfen; **keine** Vertrauens-
  annahme aus der UI. DB-Zustand frisch lesen.
- **Starke, gebundene Bestätigung:** an Instanz + Backup(-Fingerprint) + Plan-ID + Benutzer +
  Ablaufzeit; **Replay-Schutz** (einmalige, verbrauchbare Plan-/Operation-ID).
- **Erneute Bestätigung**, wenn sich Backup-Fingerprint oder Instanzzustand seit Planerstellung
  geändert haben.
- **Bestätigungsform (Vorschlag, an SpeakCore-Muster angelehnt, aber ADR-pflichtig):** getippte
  Kombination aus exaktem Backup-Dateinamen **und/oder** exaktem Instanznamen **plus** expliziter
  Phrase (z. B. `RESTORE BACKUP`) — konsistent mit `CREATE BACKUP` / `DELETE BACKUP` (Steps 032/040).
  **Nicht als beschlossen dargestellt:** die exakte Phrase/Kombination ist eine Human-Maintainer-/
  ADR-Entscheidung.

## 5.8 Preflight-Gates (feste Reihenfolge, fail-closed)

Je Gate: **Eingabe · autoritative Prüfstelle · PASS · FAIL-Verhalten · Audit-Event · Benutzerhinweis
· Wiederholung.** FAIL = Abbruch ohne Zustandsänderung (kein Stop, keine Extraktion), sofern nicht
anders vermerkt.

1. **Auth gültig** — Bearer-Token/Session · Agent bzw. Web · gültig · 401/Abbruch · `restore.gate.auth` · „Anmeldung erforderlich" · nach Re-Login.
2. **Owner/Rolle** — Session-Rolle · Web (Execute erneut) · OWNER · 403/Abbruch · `restore.gate.role` · „Nur Owner" · nein.
3. **Instanz managed & eindeutig** — `instanceId` · Web/DB · genau eine managed Instanz, `mode≠external` · Abbruch · `restore.gate.instance` · „Instanz ungültig" · nein.
4. **Backup managed & eindeutig** — `fileName`+`instanceId` · Agent · Regex-Match, genau eine Datei · Abbruch · `restore.gate.backup` · „Backup ungültig" · nein.
5. **Backup in Boundary** — Pfad · Agent · nur `AGENT_BACKUP_DIR`, kein Traversal · Abbruch · `restore.gate.boundary` · generisch · nein.
6. **Dateiname strikt validiert** — `fileName` · Agent · `backupFileRegex` · Abbruch · `restore.gate.filename` · generisch · nein.
7. **Reguläre Datei, kein Symlink** — stat/lstat · Agent · `isFile`, kein Symlink · Abbruch · `restore.gate.filetype` · generisch · nein.
8. **Backup seit Plan unverändert** — Fingerprint (Größe+mtime+SHA-256) · Agent · == Plan · Abbruch, **Re-Plan nötig** · `restore.gate.fingerprint` · „Backup geändert, bitte neu planen" · ja (neuer Plan).
9. **Archivtyp zulässig** — Header · Agent · gzip-Tar · Abbruch · `restore.gate.archivetype` · generisch · nein.
10. **Archiv lesbar** — Tar-Scan · Agent · vollständig lesbar · Abbruch · `restore.gate.readable` · „Archiv beschädigt" · nein.
11. **Inhaltsliste sicher** — Eintragsliste (ohne Extraktion) · Agent · nur erlaubte Typen/Pfade · Abbruch · `restore.gate.listing` · generisch · nein.
12. **Keine absoluten/traversierenden Pfade** — Einträge · Agent · alle relativ, containment-sicher · Abbruch · `restore.gate.paths` · generisch · nein.
13. **Keine Symlink-/Hardlink-Escapes** — Einträge · Agent · keine Links · Abbruch · `restore.gate.links` · generisch · nein.
14. **Keine verbotenen Dateitypen** — Einträge · Agent · Allowlist · Abbruch · `restore.gate.types` · generisch · nein.
15. **Größen-/Dateianzahlgrenzen** — Summe/Anzahl · Agent · ≤ Limits · Abbruch · `restore.gate.limits` · „Backup zu groß" · nein.
16. **Backup-Struktur vollständig** — erwartete Struktur/Manifest · Agent · vollständig · Abbruch · `restore.gate.structure` · generisch · nein (bzw. Legacy-Regel §5.10).
17. **Backup-/Instanzkompatibilität** — `backupVersion`,`kind`,(TS3-Version?) · Agent/Web · kompatibel · Abbruch · `restore.gate.compat` · „inkompatibel" · nein.
18. **Ausreichend Speicher** — Staging+Backup+Rollback · Agent · frei ≥ Bedarf · Abbruch · `restore.gate.space` · „zu wenig Speicher" · ja (nach Freigabe).
19. **Kein konkurrierender Vorgang** — Lock-Status · Agent/Web · frei · Abbruch/Queue · `restore.gate.lock` · „anderer Vorgang läuft" · ja.
20. **Instanzzustand erlaubt Restore** — Runtime-Status · Agent · stoppbar/gestoppt · Abbruch · `restore.gate.state` · generisch · ja.
21. **Bestätigung gültig** — Confirm-Token · Web/Agent · gebunden+nicht abgelaufen+unverbraucht · 409/Abbruch · `restore.gate.confirm` · „erneut bestätigen" · ja (neue Bestätigung).
22. **Audit-Vorbedingungen** — Audit-Sink · Web/Agent · schreibbar · Abbruch · `restore.gate.audit` · generisch · nein.

## 5.9 Sicherer Staging-Prozess

- Staging **ausschließlich** in einer vom Agent kontrollierten managed Boundary (z. B. Unterordner
  unterhalb eines agent-eigenen Restore-Arbeitsverzeichnisses; **nicht** im Live-Volume, **nicht**
  in `AGENT_BACKUP_DIR`).
- **Zufälliger, nicht vom Nutzer bestimmbarer** Staging-Pfad; **restriktive Rechte** (nur Agent).
- **Keine** Extraktion direkt ins Live-Ziel.
- **Sichere Archivprüfung vor Extraktion** (Gates 9–16): Typ, Lesbarkeit, Eintragsliste, Pfade,
  Links, Dateitypen, Größen/Anzahl.
- **Sichere Extraktion ohne Folgen externer Links** (kein Symlink-Deref; Extraktion mit striktem
  Containment; pro Eintrag Zielpfad validieren, `realpath` muss im Staging liegen).
- **Limits** für Dateianzahl und Gesamtgröße mit laufendem Zähler (Abbruch bei Überschreitung).
- **Validierung nach Extraktion** (Post-Scan: keine Links/Sonderdateien entstanden; Struktur/Größen
  plausibel; optional Per-Datei-Checks, falls Manifest §5.10).
- **Cleanup:** bei Fehler Staging vollständig entfernen; **Audit des Cleanup-Ergebnisses**; bei
  **nicht vollständig möglichem Cleanup** → Zustand `CLEANUP_REQUIRED`, sichtbarer Warnhinweis,
  kein stilles Ignorieren, Diagnoseartefakte erhalten.

## 5.10 Backup-Format und Manifest

**Befund:** Backups sind gzip-Tar des Volume-Inhalts **ohne eingebettetes Manifest**; der Sidecar
`.metadata.json` trägt Basisfelder + optionale SHA-256 (über die gesamte tar.gz). **Es gibt keine
Per-Datei-Prüfsummen, keine erwartete Dateiliste, keine entpackte Größe.**

**Anforderung (Implementierungsvoraussetzung) — versioniertes Restore-Manifest.** Vorschlag für
Pflicht-/Optionalfelder:

| Feld | Status |
|------|--------|
| `manifestSchemaVersion` | **zwingend** |
| `backupId` | **zwingend** (falls eingeführt; sonst Dateiname als ID) |
| `instanceId` | **zwingend** |
| `createdAt` | **zwingend** |
| `backupType` (`managed-ts3-volume-backup`) | **zwingend** |
| `sha256` (gesamte tar.gz) | **zwingend** (bereits vorhanden) |
| `totalUncompressedSize` | **zwingend** (für Bomb-/Space-Gates) |
| `fileCount` | **zwingend** |
| `speakcoreVersion` | optional (empfohlen) |
| `agentVersion` | optional (empfohlen) |
| `teamspeakVersion` | optional |
| `includedPaths` / erwartete Struktur | optional |
| Per-Datei-Prüfsummen | optional (stärkere Post-Validierung) |
| `restoreCompatibility` | optional |

**Legacy-Backups ohne (ausreichendes) Manifest:** **Vorschlag — zunächst grundsätzlich NICHT
restorefähig** (fail-closed), bis mindestens `sha256` + `totalUncompressedSize` + `fileCount`
vorliegen. Optionaler späterer **Backfill** (analog Step 038) kann fehlende Felder ergänzen —
**ADR-/eigener-WP-Kandidat**. **Keine kryptografische Eigenschaft behaupten**, die nicht existiert:
die vorhandene SHA-256 belegt **Integrität ab Erstellungs-/Backfill-Zeitpunkt**, **keine
Authentizität/Signatur**.

## 5.11 Pre-Restore-Sicherungspunkt

- **Standardmäßig verpflichtend:** vor dem Apply wird ein **neuer** managed Backup-Sicherungspunkt
  des aktuellen Volume-Zustands erstellt und validiert (SHA-256), bevor irgendetwas verändert wird.
- **Restore stoppt**, wenn der Sicherungspunkt nicht erfolgreich erstellt **und** validiert wurde
  (kein stilles Überspringen).
- Ein **Owner-Override** (Skip) wäre nur nach **eigener ADR**, zusätzlicher Bestätigung und Audit
  zulässig — im Blueprint **nicht** als beschlossen dargestellt.
- Berücksichtigen: zusätzlicher Speicherbedarf (Space-Gate 18); Fehler bei der Sicherung → Abbruch;
  **Retention/Kennzeichnung** als Pre-Restore-Backup (eigener Marker/Notiz); **Schutz vor sofortiger
  automatischer Rotation**; Nutzung als **Rollback-Quelle** (§5.15).

## 5.12 Prozesssteuerung (sichere Reihenfolge)

1. Plan erzeugen (read-only) → 2. Plan prüfen → 3. Owner bestätigt (gebunden) → 4. serverseitige
Revalidierung (Owner/Instanz/Backup-Fingerprint/Confirm) → 5. **Restore-Lock** setzen →
6. **Pre-Restore-Sicherung** erstellen + validieren → 7. Backup in **Staging** prüfen + extrahieren →
8. Staging vollständig validieren (Post-Scan) → 9. Zielinstanz **kontrolliert stoppen** → 10. finalen
Zustand erneut prüfen (Fingerprint/State) → 11. Restore **anwenden** (§5.13) → 12. Dateirechte/
Ownership setzen → 13. Zielstruktur validieren → 14. Instanz **starten** → 15. **Health-Prüfung** →
16. Restore als erfolgreich auditieren → 17. Staging kontrolliert bereinigen → 18. Lock freigeben.

**Downtime-Minimierung (kritische Prüfung):** Schritte 5–8 (Lock, Pre-Restore-Backup, Staging,
Vollvalidierung) **vor** dem Stop (Schritt 9) ausführen — der Stop soll erst unmittelbar vor dem
Apply erfolgen. Der eigentliche Apply (11) hält das Downtime-Fenster minimal; Fingerprint-Re-Check
(10) direkt vor Apply schließt das TOCTOU-Fenster.

## 5.13 Apply-Strategie (Vergleich)

| Strategie | Sicherheit | Portabilität | Docker/Volume | Win/Linux | Rollback | Downtime | Teilzustand-Risiko |
|-----------|-----------|--------------|---------------|-----------|----------|----------|--------------------|
| In-place-Ersetzung (löschen+kopieren im Live-Volume) | niedrig | hoch | einfach | ähnlich | schwer | mittel | **hoch** |
| Temporäres Ziel + Verzeichnis-Swap | hoch | mittel | volume-abhängig | **unterschiedlich** | gut | niedrig | niedrig |
| Rename/Move-basierter Austausch | hoch | mittel | volume-abhängig | **unterschiedlich** | gut | niedrig | niedrig |
| Copy-and-Replace | mittel | hoch | einfach | ähnlich | mittel | mittel | mittel |
| Dateisystem-atomarer Austausch | **hoch** | niedrig | fs-abhängig | **stark unterschiedlich** | sehr gut | sehr niedrig | sehr niedrig |

**Empfehlung (offen, plattformabhängig):** Bevorzugt **„temporäres Ziel im Volume + atomarer
Verzeichnis-Swap"** über einen **agent-kontrollierten Hilfscontainer** (analog Backup-Muster:
`alpine:3.20`, statische Args, keine Shell), der das Volume **read-write** und das Staging mountet und
den Austausch innerhalb des Volumes vornimmt. **Offene Plattformfragen (ADR):** atomare Verzeichnis-
Swaps sind auf Docker-Volumes/verschiedenen Host-FS **nicht garantiert atomar**; Windows-Hosts
verhalten sich anders. Daher: Apply-Strategie ist **ADR-pflichtig** und muss pro unterstützter
Plattform verifiziert werden. Der Restore-Apply ist eine **Docker-Write-Aktion** → erfordert das
bestehende `AGENT_DOCKER_WRITE_ENABLED`-Flag.

## 5.14 Zustandsmodell

Zustände: `PLANNED · AWAITING_CONFIRMATION · PREFLIGHT_RUNNING · PREFLIGHT_FAILED · READY ·
SAFETY_BACKUP_RUNNING · STAGING · STAGED · STOPPING · APPLYING · STARTING · VERIFYING · COMPLETED ·
FAILED · ROLLBACK_RUNNING · ROLLED_BACK · ROLLBACK_FAILED · CLEANUP_REQUIRED`.

Je Zustand zu dokumentieren (in der Umsetzung): **Eintrittsbedingung · erlaubte Folgezustände ·
persistierte Infos · Benutzeranzeige · Audit-Event · Wiederanlaufverhalten nach Agent-/Prozess-
abbruch.** Auszug der Sicherheits-Übergänge (die spätere Umsetzung darf ein *einfacheres* Modell
wählen, muss aber dieselben Sicherheitsübergänge abbilden):

- `PLANNED → AWAITING_CONFIRMATION → PREFLIGHT_RUNNING → {PREFLIGHT_FAILED | READY}`
- `READY → SAFETY_BACKUP_RUNNING → STAGING → STAGED → STOPPING → APPLYING → STARTING → VERIFYING → {COMPLETED | FAILED}`
- jeder Fehlerzustand ab `APPLYING`: `→ ROLLBACK_RUNNING → {ROLLED_BACK | ROLLBACK_FAILED}`
- Abbruch/Ausfall in einem Write-Zustand ⇒ beim Wiederanlauf **kein Auto-Fortsetzen**; Übergang
  nach `CLEANUP_REQUIRED` bzw. Rollback nach Revalidierung. `ROLLBACK_FAILED` ist **terminal-kritisch**.

## 5.15 Rollback

- **Automatischer Rollback** wird versucht, wenn nach begonnenem Apply (`APPLYING`/`STARTING`/
  `VERIFYING`) ein Fehler auftritt und ein gültiger **Pre-Restore-Sicherungspunkt** vorliegt.
- **Kein sicherer Auto-Rollback**, wenn der Pre-Restore-Sicherungspunkt fehlt/ungültig ist oder der
  Volume-Zustand nicht eindeutig bestimmbar ist → `ROLLBACK_FAILED`/`CLEANUP_REQUIRED`, manuelle
  Recovery.
- **Datenquelle für Rollback:** der validierte Pre-Restore-Sicherungspunkt (§5.11).
- **Fehlgeschlagener Neustart:** Rollback-Versuch; danach Health erneut; bei anhaltendem Fehler
  kritischer, sichtbarer Zustand.
- **Teilweiser Apply:** durch temp-Ziel+Swap vermeiden; falls doch → Rollback aus Sicherungspunkt.
- **Fehlgeschlagener Rollback:** **kritischer, sichtbarer Zustand** (`ROLLBACK_FAILED`),
  Diagnoseartefakte + Staging **erhalten**, Owner klar informieren, manuelle Recovery-Anleitung,
  Audit mit hoher Schwere, Risikostatus setzen.
- **Owner-Kommunikation:** eindeutige Statusanzeige (COMPLETED/ROLLED_BACK/ROLLBACK_FAILED/
  CLEANUP_REQUIRED) statt „Fehler".

## 5.16 Locks und Konkurrenz

- **Serverseitige gegenseitige Ausschließung** je Instanz zwischen: Backup-Erstellung, Einzel-Delete,
  Bulk-Delete, Rotation, **Restore**, Start, Stop, Restart, Instanzlöschung, Agent-/Konfigurations-
  änderung.
- **Lock-Scope:** pro `instanceId` (Restore hält den Instanz-Lock exklusiv für die gesamte Sequenz).
- **Lock-Owner:** die Restore-Operation-ID; **Lease/Ablauf** gegen verwaiste Locks bei Agent-/
  Prozessausfall; **Verhalten bei Prozessabbruch:** Lease läuft aus → Recovery revalidiert, kein
  Blind-Übernehmen. **Manuelle Freigabe** nur als dokumentierter Owner-Eingriff mit Audit.
- **Schutz gegen zwei parallele Restore-Anforderungen:** zweite Anforderung wird abgelehnt/`queued`
  (Gate 19). **Audit** jeder Lock-Akquise/-Freigabe. Persistenzform (DB vs. agent-lokal) ist
  **ADR-Kandidat** (§6).

## 5.17 Audit

Mindest-Audit-Felder (ohne Secrets/Tokens/Dateiinhalte): **Restore-Operation-ID · Plan-ID ·
Benutzer-ID · Rolle · Zielinstanz-ID · Backup-ID bzw. Dateiname · Backup-Fingerprint (SHA-256) ·
Zeitpunkt · Quelle der Anforderung · Planergebnis · Bestätigungsergebnis · Ergebnis je
Preflight-Gate · Pre-Restore-Sicherung · Stop-Ergebnis · Apply-Ergebnis · Start-Ergebnis ·
Health-Ergebnis · Rollback-Ergebnis · Cleanup-Ergebnis · Fehlerklasse · Abschlussstatus.**

**Befund/Anforderung:** Das bestehende `AuditLog` ist **flach** (`action, actor, target, result,
createdAt`). Der Restore braucht **deutlich mehr strukturierte Felder** → entweder (a) kompakte
Kodierung in `action`/`target` mit stabiler ID-Referenz, oder (b) Schema-Erweiterung/
Restore-Event-Tabelle. **Das ist ADR-/Migration-Kandidat** (§6). **Abweichung von der bisherigen
Linie „kein Dateiname im Audit":** ein Restore ist zustandsersetzend; Backup-Referenz/Fingerprint im
Restore-Audit ist für Nachvollziehbarkeit **vertretbar**, aber ausdrücklich eine Human-Maintainer-/
ADR-Entscheidung (bisher wurde bei Backup-Delete bewusst **kein** Dateiname auditiert).

## 5.18 API- und UI-Konzept (nur konzeptionell)

**Getrennte Endpunkte:** **Plan** (read-only, erzeugt Plan-ID + Fingerprint) · **Execute** (nimmt
Plan-ID + gebundene Bestätigung; startet die serverseitige Restore-Operation, gibt Operation-ID
zurück) · **Status** (fragt serverseitigen Zustand über Operation-ID ab) · **Audit/History-Ansicht**.

- **Idempotente Operation-ID** + Schutz gegen doppelte Requests (verbrauchbare Plan-ID; wiederholter
  Execute mit derselben ID liefert denselben laufenden Vorgang, startet keinen zweiten).
- **Keine langlaufende Restore-Operation an eine einzelne HTTP-Verbindung binden:** Execute startet
  asynchron, Fortschritt via Status-Polling (serverseitiger Zustand ist autoritativ).
- **Keine Autorität im Browser:** UI zeigt Plan/Warnungen/Downtime/Status, hält aber keine
  Entscheidungsgewalt; alle Gates serverseitig.
- **Architektur-Passung:** analog bestehender Web→Agent-Muster (serverseitiger Agent-Call mit Token,
  nie Browser→Agent). **Neue Infrastruktur (Job-Queue/Worker) nicht ungeprüft voraussetzen** — ob
  ein Hintergrund-Worker nötig ist oder der Agent den Vorgang selbst zustandsbehaftet fährt, ist
  **offene Frage/ADR** (§5.22/§6).

## 5.19 Fehler- und Recovery-Matrix

| Fall | Abbruchpunkt | Veränderter Zustand | Auto-Rollback | Manueller Eingriff | Audit-Schwere | Benutzerinfo |
|------|--------------|---------------------|---------------|--------------------|---------------|--------------|
| Backup nicht gefunden | Preflight (4) | keiner | – | nein | niedrig | „Backup nicht gefunden" |
| Backup nicht managed | Preflight (4/6) | keiner | – | nein | niedrig | generisch |
| Backup verändert (Fingerprint) | Gate 8 | keiner | – | Re-Plan | mittel | „Backup geändert, neu planen" |
| Archiv beschädigt | Gate 10 | keiner | – | nein | mittel | „Archiv beschädigt" |
| Unsicherer Archivpfad | Gate 12 | keiner | – | nein | **hoch** | generisch |
| Symlink/Hardlink gefunden | Gate 13 | keiner | – | nein | **hoch** | generisch |
| Größenlimit überschritten | Gate 15 | keiner | – | nein | mittel | „Backup zu groß" |
| Speicher unzureichend | Gate 18 | keiner | – | Speicher freigeben | mittel | „zu wenig Speicher" |
| Manifest fehlt (Legacy) | Gate 16 | keiner | – | Backfill/ADR | mittel | „nicht restorefähig" |
| Version inkompatibel | Gate 17 | keiner | – | nein | mittel | „inkompatibel" |
| Pre-Restore-Backup fehlgeschlagen | Schritt 6 | keiner (Live unverändert) | – | nein | **hoch** | „Restore abgebrochen (Sicherung fehlgeschlagen)" |
| Staging fehlgeschlagen | Schritt 7/8 | nur Staging | Staging-Cleanup | nein | mittel | „Vorbereitung fehlgeschlagen" |
| Stop fehlgeschlagen | Schritt 9 | keiner (nicht gestoppt) | – | ja | **hoch** | „Instanz konnte nicht gestoppt werden" |
| Apply teilweise fehlgeschlagen | Schritt 11 | Volume evtl. teilweise | **ja** (Pre-Restore) | ggf. | **hoch** | „Restore fehlgeschlagen, Rücksicherung läuft" |
| Rechte nicht setzbar | Schritt 12 | Volume verändert | ja | ggf. | **hoch** | generisch |
| Start fehlgeschlagen | Schritt 14 | Volume verändert | **ja** | ggf. | **hoch** | „Start fehlgeschlagen, Rücksicherung" |
| Health-Check fehlgeschlagen | Schritt 15 | Volume verändert, läuft evtl. | **ja** | ggf. | **hoch** | „Instanz ungesund, Rücksicherung" |
| Rollback erfolgreich | — | zurück auf Pre-Restore | – | nein | **hoch** | „Restore rückgängig gemacht" |
| Rollback fehlgeschlagen | — | **inkonsistent** | – | **ja, kritisch** | **kritisch** | „Kritisch: manuelle Recovery nötig" |
| Cleanup fehlgeschlagen | Schritt 17 | Staging-Reste | – | ja | mittel | `CLEANUP_REQUIRED` |
| Agent-Verbindung verloren | beliebig | zustandsabhängig | via Recovery | ggf. | **hoch** | „Verbindung verloren, Status prüfen" |
| Prozessabbruch/Neustart | beliebig | zustandsabhängig | via Recovery + Lease | ggf. | **hoch** | „Vorgang unterbrochen, Recovery" |

## 5.20 Teststrategie (spätere Implementierung, hier nicht implementiert)

**Zwingende Implementierungs-Gates (Blocker):** Pfad-/Dateinamenvalidierung; Archive-Traversal-
Fixtures; absolute Pfade; Symlink-/Hardlink-Archive; Special Files; Archive-Bomb-Limits; beschädigte
Archive; falsche Instanzbindung; erfolgreicher Rollback; Audit-Vollständigkeit; Owner-/RBAC-
Verletzung; Bestätigungs-Replay.

**Weitere (wichtig, aber nicht Release-blockierend im engeren Sinn):** Manifest-Versionen; TOCTOU-
Änderung; konkurrierende Vorgänge; fehlender Speicher; fehlgeschlagenes Pre-Restore-Backup; Stop-/
Start-Fehler; Health-Fehler; Apply-Teilabbruch; **fehlgeschlagener Rollback**; Agent-Neustart während
Restore; End-to-End-Happy-Path. (Fehlgeschlagener Rollback ist wegen kritischer Auswirkung ebenfalls
als **Blocker** zu behandeln.)

Alle Tests sind **Unit-/Integration-Fixtures** ohne echten Dienststopp; destruktive E2E nur gegen
Wegwerf-Instanzen in einer Testumgebung.

## 5.21 Implementierungszerlegung (kleine Folge-WPs; hier NICHT umsetzen)

Je WP: **Ziel · Abhängigkeit · Risiko · grober Scope · Out-of-Scope · erwartete Tests ·
`executable`.**

1. **Restore-Datenmodell & ADR** — Ziel: Typen + State-/Audit-Persistenzentscheidung. Abh.: dieser
   Blueprint. Risiko: mittel. Scope: `packages/types`, ADR in `project-brain/DECISIONS.md`.
   Out: kein Endpoint. Tests: Typ-/ADR-Review. `executable: false` (Design/ADR).
2. **Manifest- & Kompatibilitätsentscheidung** — Ziel: Pflicht-/Optionalfelder, Legacy-Regel.
   Abh.: 1. Risiko: mittel. Scope: shared/types + ADR. Out: kein Backfill. Tests: Schema-Validierung.
   `executable: false` (Blueprint/ADR) → danach optional Backfill-WP `executable: true`.
3. **read-only Restore-Inspection** — Ziel: reine Guard-/Analyse (Regex, Fingerprint, Metadaten,
   Legacy). Abh.: 1–2. Risiko: niedrig. Scope: `packages/shared` (rein). Out: keine Extraktion.
   Tests: Unit. `executable: true` (reine Logik, keine Dateiwirkung).
4. **Restore-Plan-Endpunkt** — Ziel: read-only Plan + Plan-ID + Fingerprint. Abh.: 3. Risiko: mittel.
   Scope: Web + Agent read-only. Out: kein Apply. Tests: Plan-Guards. `executable: true`.
5. **Owner-Bestätigung & Plan-Bindung** — Ziel: gebundene, ablaufende, replay-sichere Bestätigung.
   Abh.: 4. Risiko: hoch. Scope: Web. Out: kein Apply. Tests: Replay/Expiry. `executable: true`.
6. **Sichere Archivvalidierung** — Ziel: Vor-Extraktions-Scan (Typen/Pfade/Links/Limits). Abh.: 3.
   Risiko: hoch. Scope: Agent (read-only Scan). Out: keine Extraktion ins Live. Tests: Traversal/
   Bomb-Fixtures. `executable: true`.
7. **Staging & Limits** — Ziel: sichere Extraktion in agent-Boundary. Abh.: 6. Risiko: hoch. Scope:
   Agent (Docker-Write). Out: kein Live-Apply. Tests: Containment/Cleanup. `executable: true`.
8. **Pre-Restore-Sicherungspunkt** — Ziel: Pflicht-Sicherung + Validierung + Marker. Abh.: 7 +
   Backup-Erstellung. Risiko: mittel. Scope: Agent/Web. Out: keine Rotation. Tests: Fehlerfall.
   `executable: true`.
9. **Restore-Lock** — Ziel: Instanz-Mutex über alle Backup-/Lifecycle-Ops. Abh.: 1. Risiko: hoch.
   Scope: Web/Agent + Persistenz (ADR). Out: —. Tests: Parallelität. `executable: true`.
10. **Agent-Apply & Rollback** — Ziel: atomarer Apply + Rollback aus Pre-Restore. Abh.: 7–9. Risiko:
    **sehr hoch**. Scope: Agent (Docker-Write, Write-Flag). Out: keine UI. Tests: Teilabbruch/
    Rollback. `executable: true`.
11. **Start-/Health-Verifikation** — Ziel: Start + Health-Gate nach Apply. Abh.: 10 + Steps 018/019.
    Risiko: hoch. Scope: Agent/Web. Out: —. Tests: Start-/Health-Fehler. `executable: true`.
12. **UI-Flow** — Ziel: Plan→Bestätigung→Execute→Status. Abh.: 4–5,11. Risiko: mittel. Scope: Web.
    Out: keine Autorität im Browser. Tests: Flow. `executable: true`.
13. **Audit & History** — Ziel: strukturierte Restore-Audit-Felder + Ansicht. Abh.: 1. Risiko:
    mittel. Scope: Web (+ ggf. Migration). Out: keine Secrets. Tests: Audit-Vollständigkeit.
    `executable: true`.
14. **Security-Tests** — Ziel: die Blocker-Fixtures aus §5.20. Abh.: 6–11. Risiko: mittel. Scope:
    Tests. `executable: true`.
15. **E2E & Release-Gate** — Ziel: Happy-Path + Recovery gegen Wegwerf-Instanz. Abh.: alle. Risiko:
    hoch. Scope: Tests/Doku. `executable: true`.

**Nummerierung:** bewusst als lokale Teilschritt-Liste (1..15) ohne feste NDF-Step-Nummern, um
Kollisionen mit der Queue zu vermeiden; die konkrete Step-Nummer des **unmittelbar nächsten** WP
vergibt die Work-Package-Queue.

## 5.22 Entscheidungen und offene Fragen

**Im Blueprint empfohlen (aber nicht endgültig beschlossen):** Minimalscope 1-Backup→1-Instanz;
read-only Plan mit Fingerprint-Bindung; Pflicht-Pre-Restore-Sicherung; Staging in agent-Boundary;
temp-Ziel+Swap-Apply via Hilfscontainer; Instanz-Lock; fail-closed für Legacy ohne Manifest.

**Zwingend per ADR zu klären:** (1) Restore-Vertrauens-/Rollenmodell (eigene Rolle/Recht?);
(2) Manifest-Pflichtfelder + Versionskompatibilität + Legacy-Behandlung/Backfill; (3) Apply-/
Rollback-Strategie inkl. Plattform-Atomarität (Docker-Volume/Windows/Linux); (4) verpflichtender
Pre-Restore-Sicherungspunkt (+ etwaiger Override); (5) Restore-State-/Lock-Persistenz (DB vs.
agent-lokal) und Audit-Schema-Erweiterung; (6) Bestätigungsphrase/-kombination.

**Noch durch Repository-Befund aufzulösen:** interne TS3-Datenstruktur im Volume; busybox-`tar`-
Verhalten für Links/Sonderdateien; exakter Volume-`mountPath` (aus Provisioning-Plan); ob ein
Hintergrund-Worker nötig ist.

**Human-Maintainer-Entscheidungen:** Freigabe der Restore-Fähigkeit überhaupt; Plattform-Support;
Audit-Detailtiefe (Dateiname/Fingerprint im Restore-Audit ja/nein); Override-Politiken.

## 6. ADR- und Risikoeinordnung

**ADR-Kandidaten (noch KEINE Accepted-ADR):** Restore-Vertrauensmodell · Manifest & Versions-
kompatibilität · Apply-/Rollback-Strategie · verpflichtender Pre-Restore-Sicherungspunkt ·
Restore-State-/Lock-Persistenz (+ Audit-Schema). Diese sind erst nach Repository-/Plattform-Klärung
und Human-Maintainer-Freigabe entscheidbar; hier nur als Kandidaten dokumentiert.

**Risiken (in `project-brain/RISKS.md` unter R-06 fortzuschreiben):** Restore ist eine
**destructive/zustandsersetzende** Operation (höchste Sorgfaltsstufe); **fehlender Restore** bleibt
bis zur Umsetzung eine **Produktlücke**; **Backup-Rotation fehlt weiterhin** (Speicherwachstum in
`AGENT_BACKUP_DIR`); ein Backup ist erst nach **verifiziertem Restore-Prozess** als belastbare
Recovery-Grundlage zu betrachten (aktuell: Erstellung/Integrität geprüft, Wiederherstellung **nicht**).
