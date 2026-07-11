---
name: ndf-debugging-root-cause-reviewer
description: Structure debugging and root-cause analysis — symptom, context, hypotheses, check paths, safe reproduction steps, fix options. Docs-only, advisory; no risky actions.
---

# ndf-debugging-root-cause-reviewer

## Title

NDF Debugging Root-Cause Reviewer (docs-only, ADR-0032-compliant).

## Purpose

Structure debugging and root-cause analysis as an advisory document.

## When to use

When diagnosing a bug or incident and a structured analysis helps.

## Required inputs

- The symptom, context, and available (public/local) information.

## Expected outputs

- Symptom, context, hypotheses, check paths, safe reproduction steps, and fix options.

## Allowed actions

- Structure the analysis and suggest safe check paths.

## Forbidden actions

- Recommend/execute risky or destructive actions; run scripts; access the network; read/document secrets; insert private data.

## Fail-closed behavior

If a step could be risky, prefer a safe/read-only alternative or flag it for human review; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Applying fixes and running risky steps stay with the Human Maintainer.

## Output contract

An advisory analysis — never an executed risky action.

## Interaction with existing NDF skills

Uses the `ndf-work-package-runner` frame; pairs with `ndf-implementation-review-runner`; results via `ndf-compact-context-summary-runner`.
