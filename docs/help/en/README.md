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
- Installing a new TeamSpeak 3 server — *later. As of Step 010–014: safety foundation, read-only
  Docker inventory, and – as **OWNER** under `/servers/provision`, behind a feature flag + token – the
  controlled creation of managed **network/volume**. The preparation is now stored as a **managed
  server record** (status “Resources prepared”) and visible under `/servers`. From Step 015 the
  **container creation can be prepared** (status “Container creation prepared”): SpeakCore generates a
  secret and stores it encrypted. From Step 017 the **container can be created** (status “Container
  created”): via `docker create`, with the secret passed to the container as an ENV (no log reading).
  The container is **created but not started**. From Step 018 the **container can be started** (status
  “Running”): via `docker start`, **after explicitly confirming the TeamSpeak 3 license terms** (checkbox).
  SpeakCore only provides the management layer – you are responsible for license compliance. Docker logs
  are still **never** read and secrets are **never** displayed. A TS3 status check will follow in a later
  step.*
- Start/stop/restart a server — *from Step 018: **start** a managed container (after license
  confirmation). From Step 019: a **read-only health check** ("Check status") honestly shows whether the
  Docker container is running and (if configured) whether the TS3 service is reachable. From Step 020 you
  can set a **query address** (during provisioning or on the server page; pre-filled from
  `MANAGED_TS3_QUERY_HOST`) so the TS3 check returns real states "reachable/unreachable/not configured" –
  **no port scan, no automatic detection**. From Step 021 the container can be **stopped** ("Stop
  container" with confirmation): via `docker stop`, the status returns to "Container created"
  (`runState = stopped`). **Nothing is deleted** – volume and network are kept, and a later start is
  possible again. **No** log reading, **no** inspect, **no** repair, **no** remove action. Remove/restart
  follow in their own steps.*
- Reading logs
- Backup & Restore
- Security & Safe Defaults — *from Step 016: the encryption key for stored credentials
  (`SECRET_ENCRYPTION_KEY`) can be rotated. This is an **operator/CLI-only** task
  (`pnpm --filter @speakcore/web rotate-secrets`, with `--dry-run` for a safe preview) – **no
  web UI/API**. Take a **backup** before rotating; secrets are never displayed.*
- Audit log

> Content follows in a later NDF step. German counterpart: [`../de/`](../de/README.md).
