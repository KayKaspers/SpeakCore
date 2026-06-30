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
- Connecting an existing TeamSpeak 3 server
- Installing a new TeamSpeak 3 server
- Start/stop/restart a server
- Reading logs
- Backup & Restore
- Security & Safe Defaults
- Audit log

> Content follows in a later NDF step. German counterpart: [`../de/`](../de/README.md).
