---
name: ndf-feature-scope-runner
description: Sharpen feature scope before implementation — problem, goal, non-goal, acceptance criteria, risks, test/doc requirements. Docs-only, advisory; write actions only after human approval.
---

# ndf-feature-scope-runner

## Title

NDF Feature Scope Runner (docs-only, ADR-0032-compliant).

## Purpose

Sharpen a feature's scope before implementation as an advisory document.

## When to use

Before implementing a feature, to clarify scope and acceptance.

## Required inputs

- The feature idea and context (public/local).

## Expected outputs

- Problem, goal, non-goal, acceptance criteria, risks, and test/doc requirements.

## Allowed actions

- Structure the scope and acceptance criteria.

## Forbidden actions

- Perform write/implementation actions without explicit human approval; run scripts; access the network; read/document secrets; insert private data.

## Fail-closed behavior

If scope is ambiguous, list open questions rather than assuming; anything not explicitly allowed is forbidden.

## Public-neutrality requirements

No private names, real domains, secret values, private search patterns, reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value never. Role phrasing — DE: "Nova (ChatGPT) – die ChatGPT-basierte Planungs-, Architektur- und Review-Rolle."; EN: "Nova (ChatGPT) – the ChatGPT-based planning, architecture and review role."

## ADR-0032 safety boundaries

Docs-only, fail-closed; no scripts; no network; no secrets; no private data; no autonomous git/release/tag actions.

## Human-maintainer-only boundaries

Any write/implementation action stays with the Human Maintainer.

## Output contract

An advisory scope document — never an executed change.

## Interaction with existing NDF skills

Pairs with `ndf-architecture-blueprint-runner` and `ndf-test-strategy-runner`; frame via `ndf-work-package-runner`.
