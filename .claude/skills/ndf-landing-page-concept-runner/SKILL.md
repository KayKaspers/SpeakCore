---
name: ndf-landing-page-concept-runner
description: Create landing-page concepts — audience, hero, value proposition, feature blocks, trust/safety notes, CTA without pressure mechanics. Docs-only, advisory.
---

# ndf-landing-page-concept-runner

## Title

NDF Landing Page Concept Runner (docs-only, ADR-0032-compliant).

## Purpose

Create a landing-page concept as an advisory document, with honest CTAs and no pressure mechanics.

## When to use

When drafting a landing-page concept for a project.

## Required inputs

- The audience, value proposition, and context (public/local).

## Expected outputs

- Audience, hero, value proposition, feature blocks, trust/safety notes, and a CTA without pressure mechanics.

## Allowed actions

- Structure the landing-page concept neutrally.

## Forbidden actions

- Recommend pressure/deceptive CTAs or dark patterns; run scripts; access the network; read/document secrets; insert private data.

## Fail-closed behavior

If a CTA pressures or misleads, prefer an honest alternative; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Publishing decisions stay with the Human Maintainer.

## Output contract

An advisory landing-page concept — never an executed publication.

## Interaction with existing NDF skills

Pairs with `ndf-content-tone-reviewer` and `ndf-ethical-growth-reviewer`; frame via `ndf-work-package-runner`.
