---
name: ndf-readme-quality-reviewer
description: Review a README for entry point, clarity, honest status, and public neutrality — installation/quickstart/scope, status/release claims, optional DE/EN. Docs-only, advisory; flags false claims and private data.
---

# ndf-readme-quality-reviewer

## Title

NDF README Quality Reviewer (docs-only, ADR-0032-compliant).

## Purpose

Review a README for a clear entry point, clarity, honest status, and public neutrality, as advisory suggestions.

## When to use

Before handing over or committing a README or a larger status-bearing doc.

## Required inputs

- The README draft; the NDF style and neutrality rules; the honest current status.

## Expected outputs

- Findings on installation/quickstart/scope; a status/release-claim check (no false claims); a private-data check; optional DE/EN parity notes.

## Allowed actions

- Read the README and suggest clarity/structure/status improvements; flag neutrality issues.

## Forbidden actions

- Insert private data/names; assert release/version status; run scripts; access the network; read/document secrets.

## Fail-closed behavior

If a status/claim is uncertain, flag it for the author rather than asserting it; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Final text acceptance stays with the Human Maintainer.

## Output contract

Review suggestions only — never an executed change or a status assertion.

## Interaction with existing NDF skills

Pairs with `ndf-docs-polish-runner` and `ndf-public-neutrality-guard`; frame via `ndf-work-package-runner`.
