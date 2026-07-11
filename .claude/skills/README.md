# NDF Docs-only Skills Pack

## Purpose

This directory holds the **NDF Docs-only Skills Pack** — a minimal, documentation-only skill pack that helps shorten Claude prompts for repeating NDF work without weakening NDF governance. Each skill encapsulates a stable, public-neutral block of NDF behavior (role, guardrails, closing formats, neutrality, context-pack upkeep) so that a work-package prompt can carry only the WP-specific parts.

The **core MVP** was implemented under NDF-WP-129 (based on the [Skills MVP Implementation Blueprint](../../docs/validation/foundation-0-9/SKILLS_MVP_IMPLEMENTATION_BLUEPRINT.md), WP-125); the **extended core skills** under NDF-WP-137 (based on the [Extended Skills Pack Blueprint](../../docs/validation/foundation-0-9/EXTENDED_SKILLS_PACK_BLUEPRINT.md), WP-136); the **remaining docs-only advisory skills** under NDF-WP-145 (based on the [External Skills Landscape & Prioritization](../../docs/validation/foundation-0-9/EXTERNAL_SKILLS_LANDSCAPE_AND_PRIORITIZATION.md), WP-135); and **eight additional advisory skills** under NDF-WP-146. The pack now holds **38 docs-only skills**. All skills follow the [Skill Security Policy](../../docs/agent-workflows/NDF_SKILL_SECURITY_POLICY.md) / [ADR-0032](../../docs/adr/ADR-0032-skill-security-policy.md).

## Included Skills

### Core MVP skills (WP-129)

1. [`ndf-work-package-runner`](ndf-work-package-runner/SKILL.md) — standardized NDF work-package execution with less prompt overhead.
2. [`ndf-compact-context-summary-runner`](ndf-compact-context-summary-runner/SKILL.md) — uniform, short, reusable Compact Context Summary and Report-to-Nova structure for handover.
3. [`ndf-public-neutrality-guard`](ndf-public-neutrality-guard/SKILL.md) — a public-neutrality reminder/guard for NDF artifacts (not a CI gate).
4. [`ndf-context-pack-maintainer`](ndf-context-pack-maintainer/SKILL.md) — keeps Context Packs consistent and short for lower-token handover.

### Extended core skills (WP-137)

5. [`ndf-skill-quality-reviewer`](ndf-skill-quality-reviewer/SKILL.md) — reviews NDF skill docs for quality, scope, ADR-0032 compliance, neutrality, overlap, and fail-closed behavior (advisory).
6. [`ndf-existing-project-analysis-runner`](ndf-existing-project-analysis-runner/SKILL.md) — structures a neutral, advisory analysis of an existing project for NDF onboarding.
7. [`ndf-docs-polish-runner`](ndf-docs-polish-runner/SKILL.md) — improves documentation clarity, structure, and consistency (advisory, no substance change).
8. [`ndf-changelog-writer`](ndf-changelog-writer/SKILL.md) — helps write consistent, neutral, WP-referenced changelog entries (never triggers a release).

### Remaining advisory skills — Core / Governance / Release (WP-145)

9. [`ndf-release-safety`](ndf-release-safety/SKILL.md) — checks release-adjacent WPs for safety boundaries; never performs tag/release actions.
10. [`ndf-adr-governance-review`](ndf-adr-governance-review/SKILL.md) — reviews ADR-relevant changes for governance consistency; never silently changes/finalizes an ADR.
11. [`ndf-v1-readiness-review`](ndf-v1-readiness-review/SKILL.md) — supports v1.0/RC/final readiness reviews; activates the v1.x promise only at final.
12. [`ndf-release-notes-runner`](ndf-release-notes-runner/SKILL.md) — creates/reviews release notes; never asserts publication or triggers a release.

### Remaining advisory skills — Docs / Communication (WP-145)

13. [`ndf-readme-quality-reviewer`](ndf-readme-quality-reviewer/SKILL.md) — reviews a README for entry point, clarity, honest status, and neutrality.
14. [`ndf-project-brief-runner`](ndf-project-brief-runner/SKILL.md) — produces neutral project briefs; no private project names in public NDF.

### Remaining advisory skills — Engineering / Architecture (WP-145)

15. [`ndf-architecture-blueprint-runner`](ndf-architecture-blueprint-runner/SKILL.md) — architecture blueprints (design-only, no implementation).
16. [`ndf-feature-scope-runner`](ndf-feature-scope-runner/SKILL.md) — sharpens feature scope; write actions only after human approval.
17. [`ndf-implementation-review-runner`](ndf-implementation-review-runner/SKILL.md) — documentary implementation review; no automatic code changes.
18. [`ndf-test-strategy-runner`](ndf-test-strategy-runner/SKILL.md) — plans a test strategy; no obligation to execute tests.
19. [`ndf-debugging-root-cause-reviewer`](ndf-debugging-root-cause-reviewer/SKILL.md) — structures debugging/root-cause analysis; no risky actions.

### Remaining advisory skills — Product / UX / Adoption (WP-145)

20. [`ndf-product-discovery-runner`](ndf-product-discovery-runner/SKILL.md) — product/project discovery; no manipulative-growth focus.
21. [`ndf-ux-flow-reviewer`](ndf-ux-flow-reviewer/SKILL.md) — reviews user flows; no dark patterns.
22. [`ndf-onboarding-friction-reviewer`](ndf-onboarding-friction-reviewer/SKILL.md) — assesses onboarding friction; no pressure onboarding.
23. [`ndf-behavioral-adoption-reviewer`](ndf-behavioral-adoption-reviewer/SKILL.md) — ethical adoption/behavioral-design review; no manipulation/dark patterns.
24. [`ndf-ethical-growth-reviewer`](ndf-ethical-growth-reviewer/SKILL.md) — ethical growth/support/donation review; voluntary support only.

### Remaining advisory skills — Creative / Branding / Content (WP-145)

25. [`ndf-branding-kit-runner`](ndf-branding-kit-runner/SKILL.md) — branding kits; copies no third-party brands.
26. [`ndf-creative-direction-runner`](ndf-creative-direction-runner/SKILL.md) — creative direction; no imitation/IP issues.
27. [`ndf-naming-runner`](ndf-naming-runner/SKILL.md) — project/feature naming; no trademark claim without a proper check.
28. [`ndf-ui-style-system-runner`](ndf-ui-style-system-runner/SKILL.md) — UI style principles; does not force a concrete implementation.
29. [`ndf-landing-page-concept-runner`](ndf-landing-page-concept-runner/SKILL.md) — landing-page concepts; CTAs without pressure mechanics.
30. [`ndf-content-tone-reviewer`](ndf-content-tone-reviewer/SKILL.md) — language/tone/consistency review; no misleading claims.

### Additional advisory skills — Evidence / Quality / Privacy / Adapter (WP-146)

31. [`ndf-validation-evidence-reviewer`](ndf-validation-evidence-reviewer/SKILL.md) — reviews validation/evidence artifacts (source class, strength, limits); invents no evidence/identities.
32. [`ndf-skill-trigger-quality-reviewer`](ndf-skill-trigger-quality-reviewer/SKILL.md) — reviews skill names/descriptions/when-to-use to avoid over/under-triggering and sprawl.
33. [`ndf-skill-supply-chain-risk-reviewer`](ndf-skill-supply-chain-risk-reviewer/SKILL.md) — reviews external-skill supply-chain risk; no network/install/copy of third-party code.
34. [`ndf-public-release-body-reviewer`](ndf-public-release-body-reviewer/SKILL.md) — reviews release bodies for status/claim correctness; performs no GitHub action.
35. [`ndf-feedback-triage-runner`](ndf-feedback-triage-runner/SKILL.md) — triages feedback neutrally (source/severity/action); invents no feedback/identities.
36. [`ndf-accessibility-reviewer`](ndf-accessibility-reviewer/SKILL.md) — reviews docs/UI/flows for accessibility; claims no certification.
37. [`ndf-privacy-data-minimization-reviewer`](ndf-privacy-data-minimization-reviewer/SKILL.md) — reviews for data minimization/private data; forbids secrets; no binding legal advice.
38. [`ndf-project-adapter-quality-reviewer`](ndf-project-adapter-quality-reviewer/SKILL.md) — reviews project adapters for quality/neutrality; no private info in public NDF, no auto-migration.

## Non-Goals

- No active automation, tool orchestration, or autonomous execution.
- No standalone `ndf-prompt-mode-selector` (prompt-mode selection stays integrated in `ndf-work-package-runner`).
- No git/release/tag automation, no OAuth/API/MCP/network skills, no secret-processing skills, no payment/crypto automation, no social autoposting, no offensive security tool runners, no autonomous multi-agent orchestration, no private project logic in public NDF.
- No scripts, no executable files, no network access, no secret access, no private data.
- No git/release/tag actions and no autonomous commit/push/tag/release.
- No activation of optional WPs (WP-130/131/132) and no v1.0 / v1.0-RC / full v1.x promise activation.

## Security Boundaries (ADR-0032)

All skills are **docs-only** and **fail-closed**: whatever is not explicitly allowed is forbidden. No skill may run scripts, access the network, read or document secrets, embed private data, or trigger git/release/tag actions. Every skill output is a **suggestion**; the Human Maintainer decides GO / GO WITH NOTES / REWORK / STOP and performs all commit/push/tag/release actions.

## Public Neutrality

Skills and their outputs must stay public-neutral: no private project names, real private domains, secret values, private search patterns, real reviewer identities, org-internal names, or personal data. The secret name `NDF_PUBLIC_NEUTRALITY_DENYLIST` may be named; its value/content must never be named, reconstructed, or output. The Public Quality Gate v0.2 (`scripts/check_public_quality.py --strict`) stays authoritative and is triggered separately (human/CI).

## Token-Economy Goal

Move the stable, repeating prompt frame (role, hard limits, neutrality/secret rules, closing format, Report to Nova, Compact Context Summary, self-check) out of the per-WP prompt and into these skills, so that prompts carry only WP-specific goals, file paths, and the proposed commit message. Target: fewer usage-limit problems, less repetition, no safety regression.

## Important Reminders

- Skills are aids for **prompt compression**, not decision-makers.
- Skills **do not replace human review** or the Public Quality Gate.
- Skills **must not** perform git/release actions.
- Skills **must not** bypass gates or activate optional WPs.
