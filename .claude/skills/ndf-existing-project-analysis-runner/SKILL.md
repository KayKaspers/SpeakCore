---
name: ndf-existing-project-analysis-runner
description: Structure a neutral, advisory analysis of an existing project so NDF can be applied to a real project repo. Use when onboarding an existing repo into an NDF workflow. Docs-only, fail-closed; keeps private project content out of public NDF, no network/secrets/git actions.
---

# ndf-existing-project-analysis-runner

## Title

NDF Existing Project Analysis Runner (docs-only, neutral, ADR-0032-compliant).

## Purpose

Structure the neutral, advisory analysis of an existing project (structure, existing docs, architecture/stack hints, risks, open questions, NDF-fit, candidate work packages) so NDF can be applied to a real project repo — without fixing private details into public NDF artifacts.

## When to use

When onboarding an existing project repository into an NDF workflow, or when assessing whether/how NDF fits a project.

## Required inputs

- The locally readable project structure and existing documentation.
- The WP goal (what the analysis should inform).
- No secrets, no private credentials.

## Expected outputs

- A structured analysis outline: project structure overview, existing docs captured, architecture/stack hints, risks and open questions, an NDF-fit assessment, and candidate work packages — all as suggestions.

## Allowed actions

- Read project files and summarize structure generically.
- Propose a neutral analysis structure and candidate WPs.

## Forbidden actions

- Write private project names, real domains, or private search patterns into public NDF artifacts.
- Read/output secrets; embed private data.
- Run scripts; access the network/API; perform git/release actions; perform automatic migration.
- Document chain-of-thought.

## Fail-closed behavior

If content is private, unclear, or unverifiable → do not incorporate it into public NDF; mark it as a gap. Anything not explicitly allowed is forbidden.

## Public-neutrality requirements

The analysis structure stays generic in public NDF; any project-specific concretization (names, domains, search patterns) belongs solely in the project's own repo, never in public NDF. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Allowed role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions; no automatic migration; Public Quality Gate and Public Neutrality mandatory.

## Human-maintainer-only boundaries

Assessment and scope decisions stay with the Human Maintainer, who performs commit/push/tag/release.

## Output contract

An advisory analysis outline and candidate WPs — never an executed change or migration.

## Interaction with existing NDF skills

Uses the `ndf-work-package-runner` frame; neutrality via `ndf-public-neutrality-guard`; results handed over via `ndf-compact-context-summary-runner`; any project-fit context can be kept current via `ndf-context-pack-maintainer` (in the project's own repo, not public NDF).
