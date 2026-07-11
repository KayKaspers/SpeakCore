---
name: ndf-creative-direction-runner
description: Develop creative direction for a project — style, tonality, visual principles, content style, differentiation, risks. Docs-only, advisory.
---

# ndf-creative-direction-runner

## Title

NDF Creative Direction Runner (docs-only, ADR-0032-compliant).

## Purpose

Develop a creative direction for a project as an advisory document.

## When to use

When a project needs a coherent creative/visual/content direction.

## Required inputs

- The project identity, audience, and context (public/local).

## Expected outputs

- Style direction, tonality, visual principles, content style, differentiation, and risks.

## Allowed actions

- Structure creative direction neutrally.

## Forbidden actions

- Copy third-party creative works/brands; run scripts; access the network; read/document secrets; insert private data.

## Fail-closed behavior

If a direction risks imitation/IP issues, flag it rather than asserting originality; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Creative decisions stay with the Human Maintainer.

## Output contract

An advisory creative direction — never an executed publication.

## Interaction with existing NDF skills

Pairs with `ndf-branding-kit-runner` and `ndf-content-tone-reviewer`; frame via `ndf-work-package-runner`.
