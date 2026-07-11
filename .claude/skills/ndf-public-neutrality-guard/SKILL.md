---
name: ndf-public-neutrality-guard
description: Remind and check for NDF public-neutrality rules in artifacts and prompts. Use before handover/commit to flag private names, domains, secrets, or search patterns. A guard/reminder, not a CI gate. Docs-only, fail-closed; never reads or outputs secret values.
---

# ndf-public-neutrality-guard

## Title

NDF Public Neutrality Guard (docs-only, ADR-0032-compliant).

## Purpose

Keep public-neutrality rules consistent across NDF artifacts and shorten their repetition in prompts by encapsulating them here. This is a **guard/reminder**, not a full CI gate.

## When to use

Use before a handover, before a suggested commit, or when drafting public NDF text, to check for non-neutral content.

## Required inputs

- Public text drafts / artifacts to be checked.

## Expected outputs

- Neutrality reminders and flags for potential violations.
- Suggested neutral phrasings that prefer public NDF terms.
- A clear note that the Public Quality Gate remains authoritative and is triggered separately.

## Allowed actions

- Remind of the neutrality rules and the secret-name rule.
- Flag suspected private names, real private domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data.
- Name the secret `NDF_PUBLIC_NEUTRALITY_DENYLIST` (name only).

## Forbidden actions

- Read, reconstruct, or output the value/content of any secret or denylist.
- Replace or stand in for the Public Quality Gate (`scripts/check_public_quality.py`).
- Claim a gate is green when it has not actually been run.
- Insert private project data or private logic.

## Fail-closed behavior

If neutrality is uncertain, mark the content as **not neutral** and recommend revision or a real gate run. Anything not explicitly allowed is forbidden.

## Public-neutrality requirements

Forbidden in outputs: private project names, real private domains, secret values, private search patterns, real reviewer identities, org-internal names, personal data. Allowed role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts (this guard does not run the gate script); no network; no secrets; no private data; no autonomous git/release/tag actions; Public Quality Gate and Public Neutrality mandatory.

## Human-maintainer-only boundaries

Guard output is advisory. The Human Maintainer and the real Public Quality Gate make the authoritative neutrality decision; the Human Maintainer performs commit/push/tag/release.

## Output contract

Advisory flags and reminders only — never a gate verdict and never an executed check. Must always state that the real gate is authoritative.

## Compact Context Summary / Report-to-Nova requirements

When used within a WP, neutrality findings should be reflected in the Report to Nova (e.g., a Public-Neutrality line), without ever disclosing secret values.
