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
- Neuen TeamSpeak-3-Server installieren — *später. Stand Step 010–012: Sicherheitsfundament
  (Managed-Only, Validierung, Blueprint), read-only Docker-Inventar und – hinter Feature-Flag +
  Token – das kontrollierte Anlegen von managed **Network/Volume**. Es wird weiterhin **kein**
  Container erstellt und **kein** TS3-Server gestartet.*
- Server starten/stoppen/neustarten
- Logs lesen
- Backup & Restore
- Sicherheit & Safe Defaults
- Audit-Log

> Inhalte folgen in einem späteren NDF-Schritt. Englische Entsprechung: [`../en/`](../en/README.md).
