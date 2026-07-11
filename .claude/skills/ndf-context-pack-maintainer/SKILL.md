---
name: ndf-context-pack-maintainer
description: Keep NDF Context Packs consistent and short so Nova/Claude handover needs fewer tokens. Use when updating a Context Pack after a WP. Docs-only, fail-closed; does not invent status, change release status without confirmation, or activate optional WPs.
---

# ndf-context-pack-maintainer

## Title

NDF Context Pack Maintainer (docs-only, ADR-0032-compliant).

## Purpose

Keep Context Packs consistent, current, and short — the precondition for Standard and Short Prompt Mode to work safely — so that handover between Nova (ChatGPT) and Claude uses fewer tokens.

## When to use

Use after a work package completes, or whenever the Context Pack has drifted from the current phase status.

## Required inputs

- Public repository / WP context (results, decisions, status).
- The existing Context Pack (or the Context Pack Template for a new one).

## Expected outputs

- A consistent Context Pack proposal following the recommended structure: Last WP, Current Phase, Status, Decisions, Known Notes, Next Recommended WP, Compact History, Prompt Recommendation.
- References instead of repetition where possible.

## Allowed actions

- Update or check the Context Pack documentarily.
- Condense history entries while preserving decisions and safety/evidence context.

## Forbidden actions

- Invent project status, decisions, or evidence.
- Activate the v1.0 status or activate optional WPs.
- Insert private project content or secret values.
- Change release status without explicit confirmation.
- Remove safety/evidence context in the name of brevity.
- Document chain-of-thought.

## Fail-closed behavior

Do not incorporate unclear, unconfirmed, or private content. If a status is unconfirmed, keep the prior status and flag the gap rather than guessing. Anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private project names, real private domains, secret values, private search patterns, real reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Allowed role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions; Public Quality Gate and Public Neutrality mandatory.

## Human-maintainer-only boundaries

The Context Pack proposal is a suggestion. The Human Maintainer confirms status changes and performs commit/push/tag/release.

## Output contract

A documentary Context Pack proposal only — never an executed change to release status and never an invented status.

## Compact Context Summary / Report-to-Nova requirements

The maintained Context Pack should carry the current Compact History and a Next Prompt Recommendation so that later handovers (Report to Nova / Compact Context Summary) stay short and accurate.
