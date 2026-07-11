---
name: ndf-ux-flow-reviewer
description: Review user flows for clarity and friction — entry, setup, error messages, help/docs, barriers, improvements. Docs-only, advisory; no dark patterns.
---

# ndf-ux-flow-reviewer

## Title

NDF UX Flow Reviewer (docs-only, ADR-0032-compliant).

## Purpose

Review user flows for understandability and friction as an advisory document.

## When to use

When assessing a user flow's clarity and friction points.

## Required inputs

- The flow description or screens (public/local); no private user data.

## Expected outputs

- Findings on entry, setup, error messages, help/docs, and barriers, with improvement suggestions.

## Allowed actions

- Review the flow and suggest clarity/accessibility improvements.

## Forbidden actions

- Recommend dark patterns; run scripts; access the network; read/document secrets; insert private data.

## Fail-closed behavior

If a pattern could manipulate users, flag it and suggest an honest alternative; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Design decisions stay with the Human Maintainer.

## Output contract

An advisory UX review — never an executed change.

## Interaction with existing NDF skills

Pairs with `ndf-onboarding-friction-reviewer` and `ndf-ui-style-system-runner`; frame via `ndf-work-package-runner`.

## Ethical-use boundaries

No dark patterns, forced flows, or deceptive UI; accessibility and honest guidance come first.
