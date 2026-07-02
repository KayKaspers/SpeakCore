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
  possible again. From Step 022 a **stopped** container can be **removed** ("Remove container" with an
  explicit confirmation): via `docker rm` (no force), status returns to "Resources prepared". **Only the
  container is removed** – **volume, network and stored credentials are kept**, the server instance is not
  deleted. If the container is still running, stop it first. **No** log reading, **no** inspect, **no**
  repair. From Step 023 a running container can be **restarted** ("Restart container" with confirmation and
  a fresh license checkbox): the container is **stopped first and then started again** – **no** `docker
  restart`, **no** deletion, **no** log reading. A health check afterwards is recommended. **No** log
  reading, **no** inspect, **no** repair. Volume/network deletion (full deprovisioning) follows in its own
  step. From Step 024 there is a **safety concept** for it (info card "Deprovisioning not active yet"):
  it explains the stages (container → volume → network → server record) and the **data-loss risk** when
  deleting the volume. From Step 025 the **data volume** can actually be deleted in the **danger zone**
  (`docker volume rm`, **without force**) – only when the container is already removed and only after a
  **double confirmation** (data loss + backup) and typing **`DELETE VOLUME`**. This is **irreversible**
  (back up first!). **Network, server record and credentials are kept.** From Step 026 the **voice network**
  can be removed (`docker network rm`, **without force**) – but **only when no managed containers exist
  anymore** (shared resource) and after an explicit confirmation. Containers, volumes, server records and
  credentials are kept; the network can be re-created later. From Step 027 the **server record can be archived**
  ("Complete deprovisioning") – **database-only**, no Docker/agent action. The record is **archived instead of
  hard-deleted** (kept for traceability) and disappears from the active server list. You make a **deliberate
  credential decision** (keep or delete) and type **`ARCHIVE SERVER`** to confirm. Credentials are **only**
  deleted if you explicitly choose so. From Step 028 archived servers are findable again via the **server
  list**: tabs **“Active | Archived”**; the archived view shows an archive badge, the archiving date and the
  credential status (kept/deleted). Archived servers offer **no** lifecycle actions and there is **no**
  un-archive or hard delete. From Step 029 a managed server (active or archived) can be **exported as JSON**
  ("Download export", optionally with audit history): it contains **only non-secret metadata** – **no
  credentials, no secrets**. The export is **not a backup/restore of the TS3 data** (volume contents),
  DB-only (no Docker/agent), and there is **no import**. From Step 032 you can create a **real volume
  backup** for a managed server in status "Resources prepared" (container removed, not archived):
  3 checkboxes (sensitive data / storage responsibility / container stopped) + typing **`CREATE BACKUP`**.
  The backup is stored **server-side** in the agent backup directory (`.tar.gz` + `.metadata.json`) –
  **no browser download, no restore, no import**. The file can contain **sensitive TS3 data**: store it
  securely and restrict access. From Step 033 the **"Backups (view only)"** card (also for archived
  servers) shows the existing backup files after clicking "Show backups": file name, size,
  created/modified and metadata status – **visibility only**, no download, no restore, no delete.
  From Step 034 new backups get a **SHA-256 checksum** shown in the list (truncated, expandable):
  it verifies the file's **integrity** – it is **not encryption** and not a signature; backups can
  still contain sensitive TS3 data.*
- Reading logs
- Backup & Restore — *from Step 032: backups exist (server-side, read-only source); from Step 033:
  backups are viewable; from Step 034: SHA-256 integrity checksum; **restore follows later as its
  own hardened step**.*
- Security & Safe Defaults — *from Step 016: the encryption key for stored credentials
  (`SECRET_ENCRYPTION_KEY`) can be rotated. This is an **operator/CLI-only** task
  (`pnpm --filter @speakcore/web rotate-secrets`, with `--dry-run` for a safe preview) – **no
  web UI/API**. Take a **backup** before rotating; secrets are never displayed.*
- Audit log

> Content follows in a later NDF step. German counterpart: [`../de/`](../de/README.md).
