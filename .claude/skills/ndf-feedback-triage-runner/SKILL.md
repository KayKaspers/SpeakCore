---
name: ndf-feedback-triage-runner
description: Triage feedback, RC responses, issues, review and known notes neutrally and structurally — classify source, rate severity, propose action. Docs-only, advisory; invents no feedback and documents no reviewer identities.
---

# ndf-feedback-triage-runner

## Title

NDF Feedback Triage Runner (docs-only, ADR-0032-compliant).

## Purpose

Triage feedback, RC responses, issues, review notes, and known notes in a neutral, structured way.

## When to use

When collating and triaging feedback (e.g., RC feedback before final readiness).

## Required inputs

- The feedback items (public/local), stripped of identities; no private data.

## Expected outputs

- A feedback matrix classifying source (internal/external/public/maintainer/unknown), rating severity (blocker/high/medium/low/note), proposing action (fix before final / document as known limitation / no action / needs review), and a public-neutrality status.

## Allowed actions

- Structure and classify existing feedback; propose actions with reasons.

## Forbidden actions

- Invent feedback; document reviewer identities; add personal data; access the network; run scripts; read/document secrets.

## Fail-closed behavior

If no feedback exists, state "no feedback captured yet" rather than inventing it; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Prioritization and action decisions stay with the Human Maintainer.

## Output contract

An advisory triage matrix — never invented feedback or an executed action.

## Interaction with existing NDF skills

Pairs with `ndf-validation-evidence-reviewer` and `ndf-v1-readiness-review`; neutrality via `ndf-public-neutrality-guard`.

## Specific risk boundaries

No personal data in public NDF; no external opinion presented as representative; no priority without a stated reason.
