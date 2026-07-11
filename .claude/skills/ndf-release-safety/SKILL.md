---
name: ndf-release-safety
description: Check release-adjacent NDF work for safety boundaries — readiness, tag/release steps as human-maintainer instructions only, latest/pre-release/RC/final distinction, v1.0/v1.x claim checks. Docs-only, fail-closed; never performs autonomous tag/release actions.
---

# ndf-release-safety

## Title

NDF Release Safety (docs-only, ADR-0032-compliant).

## Purpose

Check release-adjacent work packages against safety boundaries and structure release-prep documentation without triggering any release.

## When to use

During release-prep, readiness, or post-release WPs, to structure checklists and repeat the human-maintainer-only release rules.

## Required inputs

- Release-prep drafts, criteria, and the current status.

## Expected outputs

- A release-readiness structure; tag/release steps documented as human-maintainer instructions; a latest/pre-release/RC/final distinction; a v1.0/v1.x-claim check; documentary rollback/correction notes.

## Allowed actions

- Structure release checklists and readiness reviews.
- Repeat "only the Human Maintainer tags/releases".

## Forbidden actions

- Create/push/move a tag; create or edit a GitHub release; assert publication.
- Activate v1.0/full v1.x promise; run scripts; access the network; read/document secrets.

## Fail-closed behavior

If readiness or a claim is unclear, recommend NO-GO/notes rather than GO; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Tag, release, and publication decisions stay with the Human Maintainer.

## Output contract

Checklists and documented manual steps only — never an executed tag/release.

## Interaction with existing NDF skills

Uses the `ndf-work-package-runner` frame; pairs with `ndf-release-notes-runner` and `ndf-changelog-writer`; results via `ndf-compact-context-summary-runner`.

## Release/governance limitations

Never sets a release "latest"; never activates the v1.x compatibility promise (that is a final-v1.0 human-maintainer step under ADR-0031); rollback/correction is documented only and decided by the Human Maintainer.
