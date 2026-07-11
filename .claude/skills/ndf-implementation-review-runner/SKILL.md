---
name: ndf-implementation-review-runner
description: Review an implementation documentarily and structurally — scope-fit, architecture-fit, security, tests, docs, risks. Docs-only, advisory; no automatic code changes.
---

# ndf-implementation-review-runner

## Title

NDF Implementation Review Runner (docs-only, ADR-0032-compliant).

## Purpose

Review an implementation in a structured, documentary way without changing code.

## When to use

When reviewing a change for scope/architecture fit and quality.

## Required inputs

- The change/diff description and the relevant scope/architecture context.

## Expected outputs

- Findings on scope-fit, architecture-fit, security, tests, docs, and risks, with suggestions.

## Allowed actions

- Read and review; name gaps and risks.

## Forbidden actions

- Change code automatically; run scripts; access the network; read/document secrets; insert private data.

## Fail-closed behavior

If risk is unclear, flag it rather than approving; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Merge/approval and any code change stay with the Human Maintainer.

## Output contract

A review with suggestions — never an executed code change.

## Interaction with existing NDF skills

Pairs with `ndf-feature-scope-runner` and `ndf-test-strategy-runner`; frame via `ndf-work-package-runner`.
