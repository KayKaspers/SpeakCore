---
name: ndf-project-adapter-quality-reviewer
description: Review project adapters and NDF applications to real projects for quality, neutrality, and reusability — scope, archetype, generic-vs-project-specific separation, setup/runbook/docs fit. Docs-only, advisory; no private project info in public NDF, no automatic migration.
---

# ndf-project-adapter-quality-reviewer

## Title

NDF Project Adapter Quality Reviewer (docs-only, ADR-0032-compliant).

## Purpose

Review project adapters, project transfers, and NDF applications to real projects for quality, neutrality, and reusability.

## When to use

When reviewing how NDF is applied to a real project or an adapter's quality.

## Required inputs

- The adapter/application under review (public/local); no secrets.

## Expected outputs

- Findings on adapter scope, project archetype, public-NDF neutrality, generic-vs-project-specific separation, setup/runbook/docs fit, and risks/non-goals.

## Allowed actions

- Review the adapter and suggest neutrality/reusability improvements.

## Forbidden actions

- Put private project information into public NDF; perform automatic migration; add private domains/names; perform git actions; run scripts; access the network; read/document secrets.

## Fail-closed behavior

If content is project-specific/private, keep it out of public NDF and flag the boundary; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Adapter/migration decisions stay with the Human Maintainer.

## Output contract

An advisory adapter-quality review — never a migration or an executed change.

## Interaction with existing NDF skills

Pairs with `ndf-existing-project-analysis-runner` and `ndf-privacy-data-minimization-reviewer`; neutrality via `ndf-public-neutrality-guard`.

## Specific risk boundaries

Project-local details never enter public NDF; no migration without an explicit WP scope; no private domains/names; no git actions.
