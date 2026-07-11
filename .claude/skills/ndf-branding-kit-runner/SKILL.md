---
name: ndf-branding-kit-runner
description: Create or review branding kits for projects — name, slogan, color world, logo ideas, typography hints, asset list. Docs-only, advisory; copies no third-party brands.
---

# ndf-branding-kit-runner

## Title

NDF Branding Kit Runner (docs-only, ADR-0032-compliant).

## Purpose

Create or review a branding kit for a project as an advisory document.

## When to use

When a project needs a coherent branding direction.

## Required inputs

- The project identity/context (public/local).

## Expected outputs

- Name, slogan, color world, logo ideas, typography hints, and an asset list.

## Allowed actions

- Structure branding ideas neutrally.

## Forbidden actions

- Copy third-party brands/trademarks; run scripts; access the network; read/document secrets; insert private data.

## Fail-closed behavior

If a name/mark risks a trademark conflict, flag it for a proper check rather than asserting availability; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Branding decisions stay with the Human Maintainer.

## Output contract

An advisory branding kit — never an executed asset publication.

## Interaction with existing NDF skills

Pairs with `ndf-naming-runner` and `ndf-creative-direction-runner`; frame via `ndf-work-package-runner`.
