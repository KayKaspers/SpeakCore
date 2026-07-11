---
name: ndf-ui-style-system-runner
description: Create UI style principles for projects — layout principles, component style, color system, typography hints, accessibility hints. Docs-only, advisory; does not force a concrete implementation.
---

# ndf-ui-style-system-runner

## Title

NDF UI Style System Runner (docs-only, ADR-0032-compliant).

## Purpose

Create UI style principles for a project as an advisory document, without forcing a concrete implementation.

## When to use

When a project needs consistent UI style guidance.

## Required inputs

- The product context and audience (public/local).

## Expected outputs

- Layout principles, component style, color system, typography hints, and accessibility hints.

## Allowed actions

- Structure UI style principles neutrally.

## Forbidden actions

- Force a specific implementation/framework; run scripts; access the network; read/document secrets; insert private data.

## Fail-closed behavior

If a choice is context-dependent, present options rather than mandating one; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

UI/design decisions stay with the Human Maintainer.

## Output contract

Advisory UI style principles — never an executed implementation.

## Interaction with existing NDF skills

Pairs with `ndf-ux-flow-reviewer` and `ndf-creative-direction-runner`; frame via `ndf-work-package-runner`.
