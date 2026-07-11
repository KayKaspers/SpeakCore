---
name: ndf-adr-governance-review
description: Review ADR-relevant changes for governance consistency — ADR status, next number derived from context (not invented), ADR-0031/0032 boundaries. Docs-only, fail-closed; never silently changes an ADR or finalizes one without human review.
---

# ndf-adr-governance-review

## Title

NDF ADR Governance Review (docs-only, ADR-0032-compliant).

## Purpose

Review ADR-relevant changes for governance consistency and structure ADR needs without autonomously accepting, renumbering, or migrating ADRs.

## When to use

When a change may need an ADR, or when checking ADR consistency and the next free number.

## Required inputs

- The ADR policy, existing (public) ADRs, and the change under review.

## Expected outputs

- An ADR-need check; the next free number derived from context; an ADR-0031/0032 boundary check; a structure suggestion; a "supersede vs rewrite" reminder.

## Allowed actions

- Read the ADR policy and existing ADRs; propose whether an ADR is needed and its structure.
- Derive the next free number from the existing set (not invented).

## Forbidden actions

- Silently change an ADR; autonomously mark an ADR Accepted; renumber/migrate ADRs; finalize without human review.
- Run scripts; access the network; read/document secrets.

## Fail-closed behavior

If the ADR status or number is unclear, flag it for human review rather than guessing; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Accepting, superseding, or finalizing an ADR stays with the Human Maintainer.

## Output contract

An advisory ADR-need/structure suggestion — never an executed ADR change.

## Interaction with existing NDF skills

Uses the `ndf-work-package-runner` frame; pairs with `ndf-skill-quality-reviewer`; neutrality via `ndf-public-neutrality-guard`.

## Release/governance limitations

Respects ADR-0031 (v1.x compatibility) and ADR-0032 (skill security) as binding and unchanged; does not activate the full v1.x promise; the next free ADR number is derived, not invented.
