---
name: ndf-public-release-body-reviewer
description: Review public release bodies / GitHub release notes for status correctness — Foundation/RC/final, pre-release/latest, v1.0/v1.x claims, visible known notes, neutrality. Docs-only, advisory; performs no GitHub action.
---

# ndf-public-release-body-reviewer

## Title

NDF Public Release Body Reviewer (docs-only, ADR-0032-compliant).

## Purpose

Review public release bodies, GitHub release notes, pre-release/latest/final claims, and v1.x compatibility statements for correctness and neutrality.

## When to use

Before a release body is published, to check status claims and known notes.

## Required inputs

- The release body draft and the true release status (Foundation/RC/final).

## Expected outputs

- A status check (Foundation/RC/final, pre-release/latest); a v1.0/v1.x-claim check; a visibility check for known/G-13/RC/final notes; a public-neutrality check.

## Allowed actions

- Review the release body against the true status and suggest corrections.

## Forbidden actions

- Assert publication when only prepared; perform any GitHub action; create/edit a release; decide "latest"; run scripts; access the network; read/document secrets.

## Fail-closed behavior

If status is uncertain, prefer "prepared/pending" over "published"; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Publishing, "latest", and release decisions stay with the Human Maintainer.

## Output contract

An advisory release-body review — never a GitHub action.

## Interaction with existing NDF skills

Pairs with `ndf-release-notes-runner`, `ndf-release-safety`, and `ndf-v1-readiness-review`; neutrality via `ndf-public-neutrality-guard`.

## Specific risk boundaries

No release creation; no tag creation; no "latest" decision by an AI agent; the Human Maintainer decides publication.
