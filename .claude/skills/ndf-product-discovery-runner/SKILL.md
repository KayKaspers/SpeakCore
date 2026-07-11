---
name: ndf-product-discovery-runner
description: Help with product/project discovery — audience, problem, value proposition, risks, MVP scope, non-goals. Docs-only, advisory; no manipulative-growth focus.
---

# ndf-product-discovery-runner

## Title

NDF Product Discovery Runner (docs-only, ADR-0032-compliant).

## Purpose

Help with product/project discovery as an advisory document, without a manipulative-growth focus.

## When to use

When exploring what a product/project should be and its MVP scope.

## Required inputs

- The idea and context (public/local).

## Expected outputs

- Audience, problem, value proposition, risks, MVP scope, and non-goals.

## Allowed actions

- Structure discovery and name risks.

## Forbidden actions

- Recommend manipulative growth or dark patterns; run scripts; access the network; read/document secrets; insert private data.

## Fail-closed behavior

If an approach risks manipulation, flag it and prefer an ethical alternative; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Product decisions stay with the Human Maintainer.

## Output contract

An advisory discovery document — never an executed change.

## Interaction with existing NDF skills

Pairs with `ndf-feature-scope-runner` and `ndf-ethical-growth-reviewer`; frame via `ndf-work-package-runner`.

## Ethical-use boundaries

No manipulative growth, dark patterns, addiction/pressure design, or deceptive value claims; user well-being and honesty come first.
