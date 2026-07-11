---
name: ndf-onboarding-friction-reviewer
description: Assess onboarding friction — first-run experience, setup steps, prerequisites, stumbling points, doc gaps, quickstart improvements. Docs-only, advisory; no dark patterns.
---

# ndf-onboarding-friction-reviewer

## Title

NDF Onboarding Friction Reviewer (docs-only, ADR-0032-compliant).

## Purpose

Assess onboarding friction and suggest improvements as an advisory document.

## When to use

When reviewing the first-run/onboarding experience of a project.

## Required inputs

- The onboarding flow, setup docs, and prerequisites (public/local).

## Expected outputs

- Findings on the first-run experience, setup steps, prerequisites, stumbling points, and doc gaps, with quickstart improvements.

## Allowed actions

- Review onboarding and suggest friction reductions.

## Forbidden actions

- Recommend dark patterns/pressure onboarding; run scripts; access the network; read/document secrets; insert private data.

## Fail-closed behavior

If a suggestion risks manipulation, prefer an honest alternative; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Onboarding decisions stay with the Human Maintainer.

## Output contract

An advisory onboarding review — never an executed change.

## Interaction with existing NDF skills

Pairs with `ndf-ux-flow-reviewer` and `ndf-readme-quality-reviewer`; frame via `ndf-work-package-runner`.

## Ethical-use boundaries

No pressure onboarding, forced sign-ups, or deceptive prompts; reduce friction honestly and respect user choice.
