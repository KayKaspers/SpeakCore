---
name: ndf-validation-evidence-reviewer
description: Review validation/evidence artifacts for NDF reviews, RC/final readiness, and G-13-style evidence questions — classify sources, rate strength, document limits honestly. Docs-only, advisory; invents no evidence and no reviewer identities.
---

# ndf-validation-evidence-reviewer

## Title

NDF Validation Evidence Reviewer (docs-only, ADR-0032-compliant).

## Purpose

Review validation and evidence artifacts for NDF reviews, RC/final readiness, and G-13-style evidence questions, honestly rating strength and limits.

## When to use

During readiness/evidence reviews (e.g., external-validation depth, RC vs final).

## Required inputs

- Existing validation/evidence artifacts in the repo; the review question; no secrets/private runs.

## Expected outputs

- An evidence matrix classifying sources (internal / neutral sample / independent / external / adoption / release-governance), rating strength (strong/moderate/limited/weak/insufficient), and documenting limits; a G-13/RC/final handling note.

## Allowed actions

- Read and classify existing evidence; rate strength; document limits.

## Forbidden actions

- Invent evidence; document reviewer identities; publish private-context runs as public evidence; force a network check; run scripts; read/document secrets.

## Fail-closed behavior

If evidence is thin or unproven, rate it honestly (limited/weak/insufficient) rather than overstating; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Evidence acceptance and readiness decisions stay with the Human Maintainer.

## Output contract

An advisory evidence assessment — never invented evidence or an executed check.

## Interaction with existing NDF skills

Pairs with `ndf-v1-readiness-review` and `ndf-feedback-triage-runner`; frame via `ndf-work-package-runner`; neutrality via `ndf-public-neutrality-guard`.

## Specific risk boundaries

Never claim false external validation; never carry private-context evidence into public NDF; never force a network verification.
