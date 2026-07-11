---
name: ndf-skill-trigger-quality-reviewer
description: Review skill names, descriptions, and when-to-use so Claude loads skills appropriately and avoids over/under-triggering or sprawl. Docs-only, advisory; no execution, no rename/merge/delete without an explicit WP scope.
---

# ndf-skill-trigger-quality-reviewer

## Title

NDF Skill Trigger Quality Reviewer (docs-only, ADR-0032-compliant).

## Purpose

Review skill names, descriptions, and trigger conditions so Claude loads skills appropriately, avoiding unnecessary or wrong triggering and skill sprawl.

## When to use

When adding/reviewing skills or auditing the pack's trigger quality.

## Required inputs

- The skill docs under review and the existing skill set (for overlap).

## Expected outputs

- Findings on name, description, and when-to-use; overlap with existing skills; too-broad/too-narrow triggers; skill-sprawl signals; a token-economy impact note.

## Allowed actions

- Read and review skill trigger metadata; suggest clearer names/descriptions/when-to-use.

## Forbidden actions

- Execute skills; auto-rename/merge/delete without an explicit WP scope; run scripts; access the network; read/document secrets.

## Fail-closed behavior

If a trigger is ambiguous, flag it rather than optimizing blindly; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Renames/merges/deletions and pack changes stay with the Human Maintainer.

## Output contract

An advisory trigger-quality review — never an executed skill change.

## Interaction with existing NDF skills

Pairs with `ndf-skill-quality-reviewer` and `ndf-skill-supply-chain-risk-reviewer`; frame via `ndf-work-package-runner`.

## Specific risk boundaries

Never optimize triggers in a way that weakens safety boundaries; never merge/delete skills without an explicit WP goal; never assert Claude-internal trigger logic as fact.
