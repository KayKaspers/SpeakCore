---
name: ndf-changelog-writer
description: Help write consistent changelog entries for NDF work packages and releases. Use at the end of a WP to prepare a neutral, WP-referenced changelog entry. Docs-only, fail-closed; never invents release/tag/version status or triggers git/release actions.
---

# ndf-changelog-writer

## Title

NDF Changelog Writer (docs-only, ADR-0032-compliant).

## Purpose

Support consistent changelog entries for NDF work packages and releases — neutral, WP-referenced, in the NDF style (Keep-a-Changelog-like) — as a suggestion that never asserts or triggers a release.

## When to use

At the end of a work package, to prepare the changelog entry; and when consolidating entries for a release section.

## Required inputs

- The WP result, affected artifacts, and WP-ID.
- The existing changelog format and known notes.

## Expected outputs

- A neutral, consistent changelog entry suggestion with a WP reference, preserved known notes, and the "not v1.0 / no RC / full v1.x promise not active" invariants where relevant.

## Allowed actions

- Check the changelog format and structure the entry.
- Summarize WP results accurately and preserve known notes.

## Forbidden actions

- Invent a release/tag/version status or claim a version is released.
- Trigger commit/tag/release or any git write action.
- Insert private content, secret values, or reviewer identities.
- Activate a v1.0 / full v1.x promise.
- Document chain-of-thought.

## Fail-closed behavior

No invented release/version status; if status is uncertain, phrase neutrally and defer to the Human Maintainer. Anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private project names, real private domains, secret values, private search patterns, real reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Allowed role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions; Public Quality Gate and Public Neutrality mandatory.

## Human-maintainer-only boundaries

Version, tag, and release stay with the Human Maintainer, who performs commit/push/tag/release.

## Output contract

A single changelog entry suggestion — never a commit, tag, or release.

## Interaction with existing NDF skills

Complements `ndf-compact-context-summary-runner` (the entry aligns with the WP result summary); WP frame via `ndf-work-package-runner`; neutrality via `ndf-public-neutrality-guard`.
