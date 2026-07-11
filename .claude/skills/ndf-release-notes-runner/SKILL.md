---
name: ndf-release-notes-runner
description: Create or review NDF release notes — distinguish RC / Foundation / final, keep known notes visible, keep changelog consistency. Docs-only, fail-closed; never asserts publication or performs tag/release actions.
---

# ndf-release-notes-runner

## Title

NDF Release Notes Runner (docs-only, ADR-0032-compliant).

## Purpose

Create or review release notes in the NDF style, distinguishing RC / Foundation / final, without asserting publication or triggering a release.

## When to use

During release-prep to draft or check release notes.

## Required inputs

- The release type (RC/Foundation/final), the WP results, known notes, and the changelog.

## Expected outputs

- Structured release notes with the correct release-type label, visible known notes, and changelog-consistent phrasing.

## Allowed actions

- Draft/structure release notes; keep known notes visible; check changelog consistency.

## Forbidden actions

- Assert that a release is published; perform tag/release actions; activate v1.0/full v1.x promise; run scripts; access the network; read/document secrets.

## Fail-closed behavior

If publication status is uncertain, phrase as "prepared/pending" rather than "published"; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Publishing the release stays with the Human Maintainer.

## Output contract

A release-notes draft/review — never a publication or a tag/release.

## Interaction with existing NDF skills

Pairs with `ndf-changelog-writer` and `ndf-release-safety`; frame via `ndf-work-package-runner`; neutrality via `ndf-public-neutrality-guard`.

## Release/governance limitations

Never claims a release is live; the RC is labeled as a candidate, not final; the full v1.x promise is a final-v1.0 human-maintainer step (ADR-0031).
