---
name: ndf-skill-quality-reviewer
description: Review NDF skill documents for quality, scope, ADR-0032 compliance, public neutrality, overlap, fail-closed behavior, output contract, and token-economy value. Use before proposing/handing over a new or changed skill doc. Docs-only, advisory; never activates or executes skills.
---

# ndf-skill-quality-reviewer

## Title

NDF Skill Quality Reviewer (docs-only, ADR-0032-compliant).

## Purpose

Check new or changed NDF skill documents for quality, scope, ADR-0032 compliance, public neutrality, overlap with existing skills, fail-closed behavior, output contract, and token-economy value — as an advisory review, not a final approval.

## When to use

Before a new or changed `SKILL.md` is proposed or handed over (e.g., during a skill-implementation WP), and when auditing the existing skill pack for drift.

## Required inputs

- The draft/changed skill document (Markdown).
- ADR-0032 / the skill security policy and the required skill structure (13 fields).
- The list of existing NDF skills (for overlap checks).

## Expected outputs

- A structured review checklist: are the 13 required fields present; is the skill docs-only and fail-closed; are forbidden actions explicit; is neutrality respected; is there overlap/redundancy; is the token-economy value plausible.
- A GO / REWORK recommendation with concrete gaps named.

## Allowed actions

- Read and review skill documents and the policy.
- Name structure/boundary/overlap gaps and suggest fixes.

## Forbidden actions

- Activate, create, execute, or functionally rebuild skills; change `.claude/skills` beyond the reviewed doc.
- Run scripts; access the network; read/document secrets; embed private data; trigger git/release actions.
- Give a final approval (that is the Human Maintainer's).
- Document chain-of-thought.

## Fail-closed behavior

If any required field is missing, a boundary is unclear, or overlap is unresolved → recommend REWORK, not GO. Anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private project names, real private domains, secret values, private search patterns, real reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Allowed role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions; Public Quality Gate and Public Neutrality mandatory.

## Human-maintainer-only boundaries

The review is advisory. The Human Maintainer approves or rejects a skill and performs commit/push/tag/release.

## Output contract

A review checklist plus a GO/REWORK suggestion — never an activation, execution, or approval.

## Interaction with existing NDF skills

Complements `ndf-work-package-runner` (WP frame) and `ndf-public-neutrality-guard` (neutrality is authoritative there). Review results feed into `ndf-compact-context-summary-runner` for the Report to Nova.
