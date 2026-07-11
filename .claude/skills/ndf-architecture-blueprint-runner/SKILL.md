---
name: ndf-architecture-blueprint-runner
description: Produce architecture blueprints for new or existing projects — context, goals/non-goals, components, data flows, security, deployment assumptions, ADR candidates. Docs-only, advisory; no implementation.
---

# ndf-architecture-blueprint-runner

## Title

NDF Architecture Blueprint Runner (docs-only, ADR-0032-compliant).

## Purpose

Produce an architecture blueprint (design-only) for a new or existing project without implementing anything.

## When to use

When a project or feature needs a documented architecture direction before implementation.

## Required inputs

- The project context, goals, and constraints (public/local); no secrets.

## Expected outputs

- A blueprint with context, goals/non-goals, components, data flows, security considerations, deployment assumptions, and ADR candidates.

## Allowed actions

- Structure a conceptual architecture and name ADR candidates.

## Forbidden actions

- Implement code; run scripts; access the network; read/document secrets; insert private data.

## Fail-closed behavior

If a requirement is unclear, mark it as an open question rather than assuming; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Design approval and any implementation decision stay with the Human Maintainer.

## Output contract

A conceptual blueprint — never implementation or an executed change.

## Interaction with existing NDF skills

Uses the `ndf-work-package-runner` frame; pairs with `ndf-feature-scope-runner` and `ndf-existing-project-analysis-runner`; neutrality via `ndf-public-neutrality-guard`.
