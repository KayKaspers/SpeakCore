---
name: ndf-v1-readiness-review
description: Support v1.0 / RC / final readiness reviews — distinguish RC vs final, check G-13 and final criteria visibly, activate the v1.x promise only at final. Docs-only, fail-closed; never invents v1.0 claims or performs release actions.
---

# ndf-v1-readiness-review

## Title

NDF v1.0 Readiness Review (docs-only, ADR-0032-compliant).

## Purpose

Support v1.0 / RC / final readiness reviews by structuring an honest check against the release criteria without claiming v1.0 maturity or activating anything.

## When to use

During RC or final readiness reviews on the v1.0 path.

## Required inputs

- The v1.0 release criteria (RC vs final), the gap/evidence reviews, and the current status.

## Expected outputs

- An RC-vs-final distinction; a visible check of G-13 and the final criteria; a met/met-with-notes/gap/blocker assessment; a go/no-go recommendation with notes.

## Allowed actions

- Read the criteria and status; structure the readiness check honestly.

## Forbidden actions

- Invent v1.0 claims; activate the full v1.x promise; perform any release/tag action; run scripts; access the network; read/document secrets.

## Fail-closed behavior

If a criterion is unproven, mark it honestly (not met/tracked) rather than claiming it; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

The go/no-go decision and any v1.0/v1.x activation stay with the Human Maintainer.

## Output contract

An advisory readiness assessment — never a release or an activation.

## Interaction with existing NDF skills

Uses the `ndf-work-package-runner` frame; pairs with `ndf-release-safety`; results via `ndf-compact-context-summary-runner`.

## Release/governance limitations

The full v1.x compatibility promise is activated only at final v1.0 by the Human Maintainer (ADR-0031); the RC is a candidate, not final; G-13 stays tracked until deepened or documented as an accepted boundary.
