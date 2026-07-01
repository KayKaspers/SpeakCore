# Integrated Help – English

> This directory holds the English in-app help texts embedded contextually in the SpeakCore WebUI.
> In NDF Step 001 only the scaffold exists.

## Planned help topics for 0.1

- Getting started / Setup Wizard
- Simple Mode vs. Expert Mode
- Preflight & Capacity Advisor (traffic-light system 🟢/🟡/🔴) — *core logic from Step 005; from
  Step 006/007 `/systemcheck` uses real, read-only agent data (CPU/RAM/storage/OS/Docker status plus
  detected environment and IPv4/IPv6/DNS status), with a fallback to example data when the agent is
  unreachable. No external reachability tests are performed; no IP addresses are shown*
- Environment types (Proxmox VM/LXC, Bare Metal, VPS, NAS/Home)
- Understanding the System Check
- Connecting an existing TeamSpeak 3 server — *from Step 008: connect an existing server
  **read-only** (host, query port, query credentials) and view basic status
  (name/version/clients/uptime). From Step 009: manually **refresh** status, see last check/last
  connection, and **remove** the server (credentials are deleted). Credentials are stored encrypted.
  Still no control/installation.*
- Installing a new TeamSpeak 3 server — *later. As of Step 010 only the safety foundation
  (managed-only, validation, provisioning blueprint) is prepared – nothing is installed yet and no
  Docker action is performed.*
- Start/stop/restart a server
- Reading logs
- Backup & Restore
- Security & Safe Defaults
- Audit log

> Content follows in a later NDF step. German counterpart: [`../de/`](../de/README.md).
