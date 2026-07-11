---
name: ndf-naming-runner
description: Find and assess project/feature names — options, meaning, sound, risk, differentiation. Docs-only, advisory; no trademark claim without a proper check.
---

# ndf-naming-runner

## Title

NDF Naming Runner (docs-only, ADR-0032-compliant).

## Purpose

Find and assess project/feature names as an advisory document.

## When to use

When naming a project or feature.

## Required inputs

- The concept and context (public/local).

## Expected outputs

- Name options with meaning, sound, risk, and differentiation notes.

## Allowed actions

- Propose and assess names neutrally.

## Forbidden actions

- Assert trademark availability without a proper check; copy third-party marks; run scripts; access the network; read/document secrets; insert private data.

## Fail-closed behavior

If a name risks a trademark/availability conflict, flag it for a proper check rather than asserting it is free; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Name decisions and legal checks stay with the Human Maintainer.

## Output contract

An advisory naming list — never a trademark assertion or registration.

## Interaction with existing NDF skills

Pairs with `ndf-branding-kit-runner`; frame via `ndf-work-package-runner`; neutrality via `ndf-public-neutrality-guard`.
