---
name: ndf-test-strategy-runner
description: Plan a test strategy for WPs or projects — unit/integration/smoke/manual checks, CI hints, acceptance criteria, regression risks. Docs-only, advisory; no obligation to execute tests.
---

# ndf-test-strategy-runner

## Title

NDF Test Strategy Runner (docs-only, ADR-0032-compliant).

## Purpose

Plan a test strategy for a work package or project as an advisory document.

## When to use

When defining how a change or project should be tested.

## Required inputs

- The feature/change scope and the acceptance criteria.

## Expected outputs

- A test plan covering unit/integration/smoke/manual checks, CI hints, acceptance criteria, and regression risks.

## Allowed actions

- Structure a test plan and name risks.

## Forbidden actions

- Execute tests as skill logic; run scripts; access the network; read/document secrets; insert private data.

## Fail-closed behavior

If coverage is uncertain, mark gaps rather than claiming completeness; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Running/accepting tests stays with the Human Maintainer.

## Output contract

An advisory test plan — never an executed test run.

## Interaction with existing NDF skills

Pairs with `ndf-feature-scope-runner` and `ndf-implementation-review-runner`; frame via `ndf-work-package-runner`.
