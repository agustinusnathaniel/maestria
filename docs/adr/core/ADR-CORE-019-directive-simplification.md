# ADR-CORE-019: Outcome-Owned, Proportionate Agent Methodology

## Status

Accepted (2026-08-22), Confidence: High. Consolidated 2026-10-03 with the global-rule scope, autonomy, review, routing, evidence, handoff, and incremental-delivery decisions made from 2026-06-12 through 2026-09-25. Earlier wording and superseded experiments remain in Git history.

## Context

OpenCode sessions repeatedly stopped before PR creation without a tool or authorization failure, treated cancelled delegates as reviewer verdicts, and asked for approval on routine delivery. Repeated rules and dead skill references increased context without making the outcome clearer. A universal specialist pipeline also multiplied context, latency, and cost for small tasks; observed session costs varied substantially by model, so one delegation depth could not serve every host and model.

Later audits found specialists selecting one slice without assigning the remainder, diagnosis running history searches regardless of symptoms, and checks repeated after their evidence was already sufficient. These were ownership and instruction problems. They did not justify relaxing host permissions, consequential authorization boundaries, or independent review.

## Decision

### Scope and routing

Global rules carry cross-cutting evidence, safety, authorization, review, and completion principles. Specialist prompts own domain methodology; host adapters own execution authority and enforcement. A rule that only repeats a host default does not earn always-loaded context. Independently loaded specialist prompts may repeat a binding constraint when standalone reliability requires it.

Choose the smallest safe route: direct work for familiar low-risk tasks, one focused specialist for a concrete outcome, or a full pipeline for genuine uncertainty or risk. The host decides whether direct execution is permitted. Explicit workflow modes govern their requested route without waiving safety or required review. Model economics inform judgment; this decision does not establish automatic price detection, a model-tier variable, or a telemetry-driven router.

The assigned outcome stays owned until its acceptance evidence exists. A specialist that decomposes work names ownership for the remainder; finishing one slice cannot represent completion of the whole assignment. Investigation, skill loading, comparisons, and checks follow missing evidence and applicable risk. History can help diagnosis, but an old line alone does not establish a regression's origin.

### Autonomy and delivery

Routine in-scope execution and validated feature-branch commits, pushes, and PR creation proceed under existing authorization. Where repository and host capabilities support PRs, implementation completes with reviewed changes on a pushed branch and an open PR carrying its acceptance evidence. Research, planning, and explicitly local or read-only work end at their requested artifact. Merge, release, production, protected branches, and consequential changes remain distinct authorization boundaries controlled by the host and user.

A failed or cancelled delegation is transport trouble, not a review verdict or lost authorization. Retry once with an adjusted brief, then report the concrete blocker. User-initiated cancellation is terminal. Repeated user rejection calls for approach reconsideration rather than repeated permission questions or the same attempted design.

Validate coherent slices before committing them when they provide useful review or rollback points. Plan independently acceptable PR boundaries early; stack only actual dependencies. Intermediate commits do not establish acceptance or authorize shipping. The delivery owner verifies the integrated result, including later changes, and reuses still-valid checks. Show a proposed design when architect or planner work guides implementation; this is visibility, not an extra approval checkpoint.

### Review and repair

The implementer cannot approve its own required review. A reviewer independently inspects original requirements, relevant source and diff, and acceptance evidence; maker narrative alone is not a signal of correctness. Access scope should make that independent evidence reachable without requiring the reviewer to accept the maker's preferred diagnosis.

Use one independent review and one repair/re-review pass when material blockers exist. Further passes require a named unresolved blocker or a repair regression, with at most three passes for the same outcome across delegations. Minor, speculative, and out-of-scope findings do not trigger repair. Empty or blocked review is not approval; report unavailable evidence and an honest incomplete outcome. Preserve concise actionable findings and concrete failure reporting rather than relying on exact verdict phrases as runtime enforcement.

The historical review specification of 2026-07-28 explicitly excluded maker-authored handoffs, implementation summaries, self-assessments, interpreted test narratives, and access lists that leaked the maker's reasoning from reviewer briefs; raw pass/fail counts were allowed. Original requirements, pre-work acceptance criteria, and the diff were required. Inability to assess them was a requirements finding, not permission to substitute the maker's explanation. The orchestrator retained handoffs for lifecycle control. This filters agreement bias without another stage, but costs disciplined context preparation and remains advisory rather than mechanically enforced.

The same decision blocked the normal commit flow after three passes with unresolved material fixes. It required surfacing attempted approaches, remaining findings, and the last attempted delta; proceeding required explicit user acknowledgment of that delta or architectural redesign. The delta and verdict stayed in the session summary even after an override. This failure-boundary checkpoint interrupts autonomy deliberately, avoiding silent shipping while allowing an accountable user choice; overrides still cannot waive safety, host authority, or protected-branch rules.

These historical specifications were unique to the earlier decision record: the 2026-09-28 source audit found the canonical directives carrying the broader maker/checker, triage, repair-bound, and compact blocker contracts, rather than the explicit context exclusions and detailed failure exit. This consolidation preserves their rationale without claiming that the current runtime or directives implement those specifications. Verify operational behavior in the [canonical rules](../../../packages/core/agent-directives/rules.md) and [orchestrator](../../../packages/core/agent-directives/specialists/orchestrator.md).

### Contracts and optional specifications

Keep each behavioral contract in its canonical home, then project it through [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md). Skill catalogs name verified available skills; host discovery handles niche capabilities. PR preparation mechanics belong in the applicable delivery skill, with current tool capabilities checked when needed.

Delegation carries a compact, format-agnostic handoff: outcome, context and constraints, acceptance and evidence, assumptions or blockers, and next step. Historically called Spec-Driven Delegation, this is contract-driven delegation; it requires neither a spec file nor a machine-validated fixed field count. Dispatch validation and host tool permissions remain separate mechanisms.

An optional intent helper may reference an owning specification when persistence across steps reduces risk. External spec formats keep ownership of their files and checklists. The helper borrows read-only analysis, explicit ambiguity, append-only progress notes, and phased acceptance; it owns no storage, vendors no schema, rewrites no owning spec, and adds no specialist or auto-sync system. Tiny tasks can omit it.

Testing policy and its reasons live in [CORE-028](ADR-CORE-028-behavior-first-testing-and-evidence-preserving-reduction.md) and [the testing guide](../../testing.md). Deterministic source checks establish the contracts they exercise; prose checks cannot establish cross-host model behavior or measured gains.

## Consequences

- Outcome ownership and explicit completion reduce delivery stalls, while coherent slices improve review and rollback.
- Single-home rules and selective delegation reduce maintenance and context load. They give up some niche heuristics and structured handoffs, so agents must escalate when risk or missing evidence warrants it.
- Independent review costs another context and may be advisory on hosts without runtime review gates. The methodology must describe that limitation honestly.
- More judgment is required from models. Behavioral improvements need representative scenario evidence across hosts and model tiers; they are not guaranteed by shorter prompts.
- Multi-PR work requires per-PR acceptance and integrated verification while sharing one bounded repair budget.

## Alternatives Considered

- **Patch repeated approval and stop-condition prose:** rejected because duplication and ambiguous ownership caused the stalls; another caveat would preserve them.
- **Apply the full pipeline universally, or reserve cheap work for blitz alone:** rejected because delegation cost and host capability vary, and a user mode is not a model-economics policy.
- **Solve autonomy through permissions alone:** rejected because the host owns those controls and clear completion still matters within permitted execution.
- **Remove specialist methodology or use minimal principles alone:** rejected because role ownership, acceptance, independent review, and useful handoffs remain needed.
- **Add separate mandatory test-authoring stages or a spec-owner role:** rejected because extra context hops and roles do not supply a missing architectural capability.
- **Put every procedure in global rules or every obligation in optional skills:** rejected because the former bloats context while the latter can hide cross-role obligations behind an unloaded skill.
- **Require design approval or a fixed spec header for every task:** rejected because ordinary authorization and task-sized evidence already define the needed boundary.

## Related Decisions

- [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): canonical ownership and host projections.
- [CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md): capability and enforcement claims.
- [CORE-028](ADR-CORE-028-behavior-first-testing-and-evidence-preserving-reduction.md): behavior-first testing and evidence.
- [OC-001](../opencode/ADR-OC-001-tool-permission-design.md): the OpenCode permission boundary.

## Date

2026-08-22; consolidated 2026-10-03.
