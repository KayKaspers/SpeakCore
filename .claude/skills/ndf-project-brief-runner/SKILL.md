---
name: ndf-project-brief-runner
description: Produce neutral project briefs for NDF or NDF-based projects — goal, scope, non-goals, architecture hints, risks, next steps. Docs-only, advisory; no private project names in public NDF.
---

# ndf-project-brief-runner

## Title

NDF Project Brief Runner (docs-only, ADR-0032-compliant).

## Purpose

Produce neutral project briefs for NDF or NDF-based projects as advisory documents.

## When to use

When starting or scoping a project and a concise brief is needed.

## Required inputs

- The project goal and context (public/local); the NDF neutrality rules.

## Expected outputs

- A brief with goal, scope, non-goals, architecture hints, risks, and next steps.

## Allowed actions

- Structure a neutral project brief.

## Forbidden actions

- Write private project names/domains/search patterns into public NDF artifacts; run scripts; access the network; read/document secrets.

## Fail-closed behavior

If content is private or unclear, keep the brief generic and mark the gap; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

The brief stays generic in public NDF; project-specific concretization belongs only in the project's own repo. No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Scope/decision approval stays with the Human Maintainer.

## Output contract

An advisory brief — never an executed change.

## Interaction with existing NDF skills

Uses the `ndf-work-package-runner` frame; pairs with `ndf-existing-project-analysis-runner`; neutrality via `ndf-public-neutrality-guard`.
