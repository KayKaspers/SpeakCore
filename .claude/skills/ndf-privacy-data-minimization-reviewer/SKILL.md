---
name: ndf-privacy-data-minimization-reviewer
description: Review NDF and project artifacts for data minimization, private/personal data, log/telemetry risks, and public-NDF suitability. Docs-only, advisory; forbids secrets and gives no binding legal advice.
---

# ndf-privacy-data-minimization-reviewer

## Title

NDF Privacy / Data-Minimization Reviewer (docs-only, ADR-0032-compliant).

## Purpose

Review NDF and project artifacts for data minimization, private/personal data, log/telemetry risks, and public-NDF suitability.

## When to use

Before publishing or committing artifacts that could carry private/personal data.

## Required inputs

- The artifact under review (public/local); no secrets.

## Expected outputs

- Flags for private/personal data; a secret-value prohibition; reviewer-identity avoidance; a critical check of log/telemetry/debug data; a public-NDF vs project-local split; data-minimization suggestions.

## Allowed actions

- Review artifacts and recommend data minimization/neutrality fixes.

## Forbidden actions

- Output secrets; add private domains/names to public NDF; give binding legal/GDPR advice; run scripts; access the network.

## Fail-closed behavior

If data sensitivity is unclear, treat it as sensitive and recommend removal/minimization; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Privacy decisions and legal compliance stay with the Human Maintainer.

## Output contract

An advisory privacy/data-minimization review — never a compliance guarantee.

## Interaction with existing NDF skills

Pairs with `ndf-public-neutrality-guard` and `ndf-project-adapter-quality-reviewer`; frame via `ndf-work-package-runner`.

## Specific risk boundaries

No secrets output; no private domains/names in public NDF; no GDPR/compliance guarantee; human review required.
