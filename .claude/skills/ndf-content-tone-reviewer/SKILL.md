---
name: ndf-content-tone-reviewer
description: Review language, tone, and communication consistency — audience, tone, clarity, trust, optional DE/EN. Docs-only, advisory; no misleading claims.
---

# ndf-content-tone-reviewer

## Title

NDF Content Tone Reviewer (docs-only, ADR-0032-compliant).

## Purpose

Review language, tone, and communication consistency as an advisory document.

## When to use

When checking content for tone, clarity, and trust before handover.

## Required inputs

- The content draft, the target audience, and the NDF neutrality rules.

## Expected outputs

- Findings on audience fit, tone, clarity, and trust, with optional DE/EN notes.

## Allowed actions

- Review content and suggest tone/clarity improvements.

## Forbidden actions

- Recommend misleading claims; insert private data; run scripts; access the network; read/document secrets.

## Fail-closed behavior

If a claim is unverifiable or misleading, flag it rather than endorsing it; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Content decisions stay with the Human Maintainer.

## Output contract

An advisory content review — never an executed publication.

## Interaction with existing NDF skills

Pairs with `ndf-docs-polish-runner` and `ndf-public-neutrality-guard`; frame via `ndf-work-package-runner`.
