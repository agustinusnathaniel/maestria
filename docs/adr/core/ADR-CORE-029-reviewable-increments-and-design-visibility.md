# ADR-CORE-029: Reviewable Increments and Design Visibility

## Status

Accepted (2026-09-25)

## Context

Maestria already asks builders for small reviewable increments and planners for verifiable phases, but its delivery sequence places every commit after final verification and describes a single PR. That can turn a multi-slice outcome into one large commit and PR. Architect and planner outputs also lack an explicit step that shows their proposed design to the user before dependent implementation.

## Goals

- Make verified implementation slices useful commit and rollback points.
- Plan independently reviewable PR boundaries before multi-slice work grows large.
- Show users an understandable design when architect or planner work guides implementation.
- Preserve integrated verification, independent review, authorization, and PR delivery.

## Non-Goals

- No fixed commit or PR size, mandatory split for cohesive work, or requirement to use stacked PRs.
- No approval checkpoint for ordinary design briefs.
- No runtime enforcement, new specialist, or required HTML artifact.

## Decision

1. Commit coherent implementation slices after proportionate validation when they provide useful review or rollback points. Run the integrated checks before delivery, including changes made after earlier commits.
2. For multi-slice outcomes, plan PR boundaries early and split the diff before delivery if implementation reveals another independently acceptable, verifiable slice. Prefer independent PRs that can be reviewed and accepted separately; use stacked PRs only for actual dependencies. Each PR carries its own scope, evidence, and review, while the outcome retains one bounded repair budget and final integrated verification.
3. When architect or planner work guides implementation, the orchestrator presents a concise user-facing design brief before dependent edits. The specialist supplies the intended behavior, affected boundaries, changes or phases, trade-offs, and verification. Use tables or diagrams when they improve understanding; no particular visual format is required.
4. Keep cross-role delivery obligations in canonical rules and orchestrator guidance, role-specific design and planning guidance in specialist directives, and PR preparation mechanics in the standalone `create-pull-request` skill.

## Consequences

- Reviewers can inspect smaller coherent changes and users can see the proposed design before it is built.
- Multi-PR delivery needs explicit dependency and base-branch information, plus evidence for each PR.
- Intermediate commits may precede the final integrated review; they do not establish acceptance or authorize shipping.
- Agents must use judgment about useful boundaries, which may vary by task and host.

## Assumptions

- `[verified]` The previous canonical orchestrator sequence placed commit after final verification, and the builder already preferred small reviewable increments.
- `[verified]` Canonical directives generate platform projections through `scripts/sync-all`; the PR methodology skill is maintained separately.
- `[inferred]` Earlier coherent boundaries will improve review and rollback for multi-slice changes; cross-host behavior needs scenario evidence beyond text-contract tests.

## Alternatives Considered

- **Put all detail in always-loaded core rules:** rejected because PR stacking and presentation mechanics apply only to some outcomes and would increase directive load.
- **Put everything in optional skills:** rejected because verified incremental commits, reviewable delivery, and design visibility are cross-role obligations that an optional skill might never reach.
- **Require a design approval and visual artifact for every change:** rejected because small, known changes do not need that ceremony, and authorization boundaries already govern consequential decisions.

## Verification

Run the canonical directive tests, `scripts/sync-all`, `scripts/check-sync`, and repository completion checks. Compare representative multi-slice and small-fix runs across supported hosts before claiming a measured behavior improvement.

## Related Decisions

- [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): canonical source and generated projections.
- [CORE-019](ADR-CORE-019-directive-simplification.md): terminal PR delivery and single-home contracts.
- [CORE-023](ADR-CORE-023-evidence-led-directives.md): proportionate methodology and verification.

## Date

2026-09-25
