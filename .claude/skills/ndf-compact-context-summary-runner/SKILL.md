---
name: ndf-compact-context-summary-runner
description: Produce a uniform, short, reusable Compact Context Summary and Report-to-Nova block for NDF handover. Use at the end of an NDF work package to standardize handover with fewer tokens. Docs-only, fail-closed, no private data, no chain-of-thought.
---

# ndf-compact-context-summary-runner

## Title

NDF Compact Context Summary Runner (docs-only, ADR-0032-compliant).

## Purpose

Standardize the two most-repeated closing blocks of an NDF work package — the **Report to Nova** and the **Compact Context Summary** — into a short, copyable, reusable form, so they do not need to be re-templated in every prompt.

## When to use

Use at the end of any NDF work package, and whenever a compact handover to Nova (ChatGPT) or a new session is needed.

## Required inputs

- The WP result and decision (GO / GO WITH NOTES / REWORK / STOP).
- The gate status (honest).
- Changed files, next steps, open notes, and the unchanged governance invariants.

## Expected outputs

- A **Report to Nova** with the fixed section structure (result, changed files, key notes, next step, proposed commit message).
- A **Compact Context Summary** covering: WP, decision, status, changed files, next steps, open notes, unchanged governance invariants — short and copyable.

## Allowed actions

- Generate both closing blocks from the provided WP result.
- Reflect the gate result and decision honestly.

## Forbidden actions

- Force long justifications; keep it short and copyable.
- Insert private context details, secret values, or private project names.
- Invent missing decisions or embellish a WP result.
- Hide gate failures or replace the Human Maintainer's decision.
- Document chain-of-thought.

## Fail-closed behavior

If the decision or gate status is unclear, output a conservative result (REWORK / notes) rather than GO, and mark the uncertainty explicitly. Anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private project names, real private domains, secret values, private search patterns, real reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Allowed role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions; Public Quality Gate and Public Neutrality mandatory.

## Human-maintainer-only boundaries

The summary and report are suggestions for the Human Maintainer, who decides GO / GO WITH NOTES / REWORK / STOP and performs commit, push, tag, and release.

## Output contract

Two blocks only: Report to Nova and Compact Context Summary. Both are mandatory at WP end and must reflect the true result.

## Compact Context Summary / Report-to-Nova requirements

This skill **is** the enforcement point for both mandatory blocks: it must always produce them and never drop them for compression.
