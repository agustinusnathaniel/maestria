# ADR-CORE-019: Outcome-Owned, Proportionate Agent Methodology

## Status

Accepted (2026-08-22), Confidence: High. Condensed 2026-11-27 to the decisions that still hold after the main loop ([CORE-035](ADR-CORE-035-main-loop-with-one-reviewer.md)) and the always-on split ([CORE-036](ADR-CORE-036-always-on-core-and-skill-map.md)); it absorbed the testing record CORE-028's evidence principle. Earlier pipeline, specialist, and review-briefing wording is in Git history.

## Context

OpenCode sessions repeatedly stopped before creating a PR without any tool or authorization failure, treated cancelled delegates as reviewer verdicts, and asked for approval on routine delivery. Repeated rules and dead skill references grew the context without making the outcome clearer, and a universal specialist pipeline multiplied cost and latency for small tasks. Later audits found work split into slices with nobody owning the rest, investigation run regardless of symptoms, and checks repeated after their evidence was sufficient. These were ownership and instruction problems. They did not justify relaxing host permissions, authorization boundaries, or independent review.

## Decision

### Scope

Always-on rules carry what every turn needs: evidence, safety, authorization, review, and completion. Task-shaped method lives in skills, and host adapters own execution authority and enforcement. A rule that only repeats a host default does not earn always-on context.

### Ownership and routing

Take the smallest safe route: direct work for familiar low-risk tasks, more method for genuine uncertainty or risk. Workflow modes change the route without waiving safety or required review. Model cost informs judgment; there is no automatic price detection, model-tier variable, or telemetry router. The assigned outcome stays owned until its acceptance evidence exists, and whoever splits work names the owner of the remainder. Investigation and checks follow missing evidence; an old line in history does not by itself establish where a regression came from.

### Autonomy and delivery

Routine in-scope work, feature-branch commits, pushes, and PR creation proceed under existing authorization. Implementation ends with reviewed changes on a pushed branch and an open PR carrying its acceptance evidence; research, planning, and explicitly local work end at their requested artifact. Merge, release, production, protected branches, and consequential changes stay separate authorization boundaries. Delivery method belongs to the main loop, not the global rules, because the reviewer receives the global rules but does not deliver; a test in `packages/core/tests/directives.test.ts` keeps it there.

A failed or cancelled delegation is transport trouble, not a review verdict or lost authorization: retry once with an adjusted brief, then report the blocker. User cancellation is terminal. Repeated user rejection calls for a different approach, not repeated permission questions.

### Review and repair

The implementer cannot approve its own required review. The reviewer inspects the original requirements, source, diff, and acceptance evidence itself; the maker's narrative is not evidence. Use one review and, only when blockers exist, one repair and re-review, with at most three passes for one outcome across delegations. Minor, speculative, and out-of-scope findings do not trigger repair. An empty or blocked review is not approval.

### Evidence

Each behavioral contract has one canonical home and is projected through [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md). Deterministic checks establish machine-readable, sync, and safety contracts; they cannot establish cross-host model behavior. Exact wording or heading order is not preservation evidence: generated projections are checked by `check-sync`, runtime contracts by executable tests, and model behavior by [directive change review](../../directive-change-review.md). The testing procedure lives in [the testing guide](../../testing.md) and the `implement` skill.

## Consequences

- Outcome ownership and explicit completion reduce delivery stalls; coherent slices give review and rollback points.
- Single-home rules and proportionate routing reduce context and maintenance, at the cost of more model judgment and escalation when risk warrants it.
- Independent review costs another context and is advisory on hosts without runtime review gates; the methodology says so.
- Behavioral improvements need scenario evidence across hosts and models; shorter prompts do not guarantee them.

## Alternatives Considered

- **Patch repeated approval and stop-condition prose:** rejected because duplication and unclear ownership caused the stalls.
- **One pipeline for every task:** rejected because delegation cost and host capability vary.
- **Solve autonomy through permissions alone:** rejected because hosts own permissions and clear completion still matters within them.
- **Every procedure in global rules, or every obligation in optional skills:** rejected because the first bloats context and the second hides cross-role obligations behind an unloaded skill.
- **Mandatory test-authoring stages or a spec-owner role:** rejected because extra roles and hops do not supply a missing capability.
- **Design approval or a fixed spec header for every task:** rejected because ordinary authorization and task-sized evidence already set the boundary.
- **Exact-wording pins as preservation evidence:** rejected because harmless edits break them and they cannot prove model behavior.

## Related Decisions

- [CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md): capability and enforcement claims.
- [OC-001](../opencode/ADR-OC-001-tool-permission-design.md): the OpenCode permission boundary.

## Date

2026-08-22; absorbed CORE-028 (2026-09-24) on 2026-11-27.
