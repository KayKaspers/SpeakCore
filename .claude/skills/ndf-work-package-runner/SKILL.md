---
name: ndf-work-package-runner
description: Standardized NDF work-package execution with less prompt overhead. Use when running an NDF work package (WP) so the stable role, guardrails, self-check, and closing structure do not need to be repeated in the prompt. Docs-only, fail-closed, no git/release actions.
---

# ndf-work-package-runner

## Title

NDF Work Package Runner (docs-only, ADR-0032-compliant).

## Purpose

Encapsulate the stable, repeating frame of an NDF work package so a WP prompt can carry only WP-specific content (goals, task list, file paths, proposed commit message, expected result). Reduces prompt overhead without weakening governance.

## When to use

Use when executing an NDF work package in Full, Standard, or Short Prompt Mode. In Short Prompt Mode, use only within the Short-Prompt allowances (a current Context Pack must exist and the case must not be a Short-forbidden one: security policy, ADR, scope lock, release readiness, release prep, destructive/git-write/tag actions, unclear requirements).

## Required inputs

- The WP prompt (goals, task list, affected public file paths, expected result).
- The applicable Prompt Mode (or a request to select one).
- Public repository content only.

## Expected outputs

- A structured WP execution scaffold: mandatory pre-checks, the WP-specific steps, affected-file identification, and a standard closing structure.
- A reminder of the applicable hard limits and Human-Maintainer-only boundaries.
- A pointer to produce the Report to Nova and Compact Context Summary at the end (see `ndf-compact-context-summary-runner`).

## Allowed actions

- Structure WP steps and identify relevant public files.
- Repeat the NDF role description and hard limits.
- Suggest the Prompt Mode (the prompt may override).
- Recommend documentary status/roadmap/context-pack updates in the repository style.
- Reference the self-check commands (`git status`, `git diff --stat`, `git diff`) as human/self-check instructions.

## Forbidden actions

- Replace concrete WP goals or invent file paths.
- Bypass the Public Quality Gate, human review, or any release/readiness gate.
- Activate optional WPs.
- Execute or allow commit, push, tag, release, or any git write action.
- Run scripts, access the network, read/document secrets, or embed private data.
- Document chain-of-thought.

## Fail-closed behavior

If required WP context is missing or ambiguous, produce **no** execution scaffold; instead ask for clarification or request Full Prompt Mode. Anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private project names, real private domains, secret values, private search patterns, real reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Allowed role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions; Public Quality Gate and Public Neutrality mandatory.

## Human-maintainer-only boundaries

The Human Maintainer alone decides GO / GO WITH NOTES / REWORK / STOP and performs commit, push, tag, and release. This skill produces suggestions only; it makes no irreversible decision.

## Output contract

The runner output is a suggested scaffold and reminder set — never an executed action. It must end by pointing to the mandatory Report to Nova and Compact Context Summary.

## Compact Context Summary / Report-to-Nova requirements

Every WP handled with this skill must still close with a Report to Nova and a Compact Context Summary (via `ndf-compact-context-summary-runner`). These closing blocks are mandatory and must not be dropped for compression.
