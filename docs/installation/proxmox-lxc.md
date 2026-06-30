# Installation: Proxmox LXC

> LXC ist ressourcenschonend, bringt für Docker aber Einschränkungen mit. Der Preflight &
> Capacity Advisor bewertet LXC daher vorsichtiger (oft 🟡).

## Wichtige Einschränkungen

- Docker in LXC erfordert i. d. R. einen **privilegierten** Container bzw. spezielle Optionen
  (`nesting=1`, ggf. `keyctl=1`). Das senkt die Isolation.
- Manche Kernel-/Netzwerkfunktionen verhalten sich anders als in einer VM.
- Für Einsteiger ist eine [Proxmox VM](proxmox-vm.md) der robustere Weg.

## Ablauf (für erfahrene Nutzer)

1. LXC mit aktuellem Linux-Template anlegen, Nesting aktivieren.
2. Docker + Compose installieren.
3. SpeakCore wie unter [Docker](docker.md) starten.
4. Preflight-Bewertung **besonders ernst nehmen** – bei 🔴 nur im Expert Mode mit bewusster
   Warnbestätigung fortfahren.

## Sicherheitshinweis

Privilegierte LXC verringern die Isolation gegenüber dem Host. In Kombination mit dem
privilegierten SpeakCore Agent ist hier erhöhte Sorgfalt geboten
(siehe [SECURITY.md](../../project-brain/SECURITY.md), [RISKS.md](../../project-brain/RISKS.md) R-07).

> Stand NDF Step 001: Planungsdokument für den geplanten 0.1-Ablauf.
