# Integrierte Hilfe – Deutsch

> Dieses Verzeichnis enthält die deutschsprachigen Hilfetexte, die in der SpeakCore-WebUI
> kontextbezogen eingebettet werden. In NDF Step 001 ist hier nur das Gerüst angelegt.

## Geplante Hilfethemen für 0.1

- Erste Schritte / Setup-Wizard
- Simple Mode vs. Expert Mode
- Preflight & Capacity Advisor (Ampelsystem 🟢/🟡/🔴) — *Kernlogik ab Step 005; ab Step 006/007 nutzt
  `/systemcheck` echte, read-only Daten des Agents (CPU/RAM/Speicher/OS/Docker-Status sowie erkannte
  Umgebung und IPv4/IPv6/DNS-Status), mit Fallback auf Beispieldaten, wenn der Agent nicht erreichbar
  ist. Es laufen **keine** externen Erreichbarkeitstests; es werden **keine IP-Adressen** angezeigt*
- Umgebungstypen (Proxmox VM/LXC, Bare Metal, VPS, NAS/Home)
- Systemcheck verstehen
- TeamSpeak-3-Server verbinden — *ab Step 008: bestehenden Server **read-only** verbinden
  (Host, Query-Port, Query-Zugang) und Basisstatus (Name/Version/Clients/Uptime) ansehen.
  Ab Step 009: Status manuell **aktualisieren**, letzten Check/letzte Verbindung sehen und den
  Server wieder **entfernen** (Zugangsdaten werden dabei gelöscht). Zugangsdaten sind verschlüsselt
  gespeichert. Weiterhin keine Steuerung/Installation.*
- Neuen TeamSpeak-3-Server installieren — *später. Stand Step 010–014: Sicherheitsfundament,
  read-only Docker-Inventar und – als **OWNER** unter `/servers/provision`, hinter Feature-Flag +
  Token – das kontrollierte Anlegen von managed **Network/Volume**. Die Vorbereitung ist jetzt als
  **managed Server-Eintrag** (Status „Ressourcen vorbereitet") gespeichert und unter `/servers`
  sichtbar. Ab Step 015 kann die **Container-Erstellung vorbereitet** werden (Status
  „Container-Erstellung vorbereitet"): SpeakCore erzeugt ein Secret und speichert es verschlüsselt.
  Ab Step 017 kann der **Container erstellt** werden (Status „Container erstellt"): via `docker create`,
  das Secret wird dem Container als ENV vorgegeben (kein Log-Lesen). Der Container wird **erstellt, aber
  nicht gestartet**. Ab Step 018 kann der **Container gestartet** werden (Status „Läuft"): via
  `docker start`, **nach expliziter Bestätigung der TeamSpeak-3-Lizenzbedingungen** (Checkbox). SpeakCore
  stellt nur die Verwaltung bereit – für die Lizenz-Einhaltung bist du selbst verantwortlich. Es werden
  weiterhin **keine** Docker-Logs gelesen und **keine** Secrets angezeigt. Eine TS3-Statusprüfung folgt
  in einem späteren Schritt.*
- Server starten/stoppen/neustarten — *ab Step 018: managed Container **starten** (nach
  Lizenzzustimmung). Ab Step 019: **read-only Healthcheck** („Status prüfen") – zeigt ehrlich, ob der
  Docker-Container läuft und (falls konfiguriert) ob der TS3-Dienst erreichbar ist. Ab Step 020 lässt
  sich eine **Query-Adresse** angeben (im Provisioning oder auf der Serverseite; Vorbelegung über
  `MANAGED_TS3_QUERY_HOST`), damit der TS3-Check echte Zustände „erreichbar/nicht erreichbar/nicht
  konfiguriert" liefert – **kein Portscan, keine automatische Ermittlung**. Ab Step 021 kann der
  Container **gestoppt** werden („Container stoppen" mit Bestätigung): via `docker stop`, Status wechselt
  auf „Container erstellt" (`runState = gestoppt`). **Es wird nichts gelöscht** – Volume und Network
  bleiben, ein späterer Start ist wieder möglich. Ab Step 022 kann ein **gestoppter** Container
  **entfernt** werden („Container entfernen" mit deutlicher Bestätigung): via `docker rm` (ohne Force),
  Status zurück auf „Ressourcen vorbereitet". **Es werden nur der Container entfernt** – **Volume,
  Network und gespeicherte Zugangsdaten bleiben erhalten**, die ServerInstance wird nicht gelöscht.
  Läuft der Container noch, musst du ihn zuerst stoppen. Ab Step 023 kann ein laufender Container **neu
  gestartet** werden („Container neu starten" mit Bestätigung + erneuter Lizenz-Checkbox): der Container
  wird **zuerst gestoppt und dann wieder gestartet** – **kein** `docker restart`, **keine** Löschung,
  **kein** Log-Lesen. Danach empfiehlt sich ein Healthcheck. **Kein** Log-Lesen, **kein** Inspect,
  **keine** Reparatur. Volume-/Network-Löschung (vollständiges Deprovisioning) folgt als eigener Schritt.
  Ab Step 024 gibt es dafür ein **Sicherheitskonzept** (Info-Karte „Deprovisioning noch nicht aktiv"): Es
  erklärt die Stufen (Container → Volume → Network → Server-Eintrag) und das **Datenverlust-Risiko** beim
  Löschen des Volumes. Ab Step 025 kann das **Datenvolume** in der **Gefahrenzone** tatsächlich gelöscht
  werden (`docker volume rm`, **ohne Force**) – nur bei bereits entferntem Container und nur nach
  **Doppelbestätigung** (Datenverlust + Backup) und getippter Eingabe **`DELETE VOLUME`**. Das ist
  **unwiderruflich** (vorher Backup!). **Network, Servereintrag und Zugangsdaten bleiben erhalten.**
  Ab Step 026 kann das **Voice-Netzwerk** entfernt werden (`docker network rm`, **ohne Force**) – aber
  **nur, wenn keine managed Container mehr existieren** (gemeinsam genutzte Ressource) und nach
  ausdrücklicher Bestätigung. Container, Volumes, Servereinträge und Zugangsdaten bleiben dabei erhalten;
  das Netzwerk kann später wieder erstellt werden. Ab Step 027 kann der **Servereintrag archiviert** werden
  („Deprovisioning abschließen") – **rein datenbankseitig**, ohne Docker-/Agent-Aktion. Der Eintrag wird
  **archiviert statt hart gelöscht** (bleibt aus Nachvollziehbarkeitsgründen erhalten) und verschwindet aus der
  aktiven Serverliste. Du triffst dabei eine **bewusste Entscheidung zu den Zugangsdaten** (behalten oder
  löschen) und tippst **`ARCHIVE SERVER`** zur Bestätigung. Zugangsdaten werden **nur** gelöscht, wenn du das
  ausdrücklich wählst.*
- Logs lesen
- Backup & Restore
- Sicherheit & Safe Defaults — *ab Step 016: Der Verschlüsselungsschlüssel für gespeicherte
  Zugangsdaten (`SECRET_ENCRYPTION_KEY`) kann rotiert werden. Reiner **Operator-/CLI-Vorgang**
  (`pnpm --filter @speakcore/web rotate-secrets`, mit `--dry-run` zum gefahrlosen Prüfen) – **keine
  Web-UI/API**. Vor der Rotation ein **Backup** anlegen; Secrets werden nie angezeigt.*
- Audit-Log

> Inhalte folgen in einem späteren NDF-Schritt. Englische Entsprechung: [`../en/`](../en/README.md).
