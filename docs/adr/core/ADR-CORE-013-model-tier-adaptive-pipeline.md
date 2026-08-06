# ADR-CORE-013: Route-scoped orchestration with hard-rule preservation

## Status

Accepted for the canonical directive layer (2026-08-06). This ADR documents prompt and documentation behavior. It does not claim universal runtime enforcement across platforms.

## Context

The previous directive set treated the full recon/design/implementation/review ceremony as the normal shape of work. That made selective routing contradictory: small direct work still acquired child-agent expectations, focused work implied automatic review, and mode documents described different pipeline semantics. The cost and latency of delegation vary by task, model, and platform, so the canonical contract must scope ceremony to the route that needs it.

The route rehaul must optimize when policy applies, not reduce the meaning or detail of the prior hard rules. In particular, route selection cannot remove verification, ownership, maker/checker review before landing, safety checkpoints, autonomous shipping, or the autonomy principle of exhausting data and proceeding with documented assumptions.

## Decision

Canonical directives define three per-turn routes:

| Route | Canonical behavior |
| --- | --- |
| `direct` | Host or native direct execution. No Maestria child or handoff during execution. |
| `focused` | One targeted specialist. Landing work receives one independent reviewer before landing. Research-only and non-landing work remains review-free unless concrete risk requires review. |
| `full` | One thinker, one worker, and one independent reviewer by default. Extra fan-out or review lenses require evidenced risk. |

Direct implementation that will land escalates to a review-capable route before commit, push, publish, merge, or PR creation. Direct execution remains zero-child. This preserves the maker/checker split while retaining a direct default for simple work.

Full review is blind to maker-authored narrative: it receives the original requirements, acceptance criteria, and diff. Findings are triaged as `[fix]`, `[dismiss]`, or `[escalate]`. Review/fix work is bounded to three cycles; unresolved `[fix]` findings fail loud and block landing, and any unresolved `[escalate]` finding blocks landing until its required decision is recorded. Multi-lens review is reserved for evidenced multi-concern or high-risk full work and scales down to one pass for expensive or slow models.

The canonical modes are semantic aliases for these routes:

- `fein` selects `full`.
- `sonar` selects focused research and never implements.
- `blitz` selects `direct` and never delegates to a Maestria specialist.

An ordinary implementation request authorizes the orchestrator's autonomous route-scoped commit/push/publish/PR flow unless explicitly limited to research-only, no-commit, or no-ship. Specialists may commit, push, or create a PR only when the orchestrator delegates the exact operation, files, message, and validation. Direct root work follows the same flow. Human checkpoints are limited to migrations/data, production, security, irreversible decisions, and safety ambiguity. Shipping requires status, diff, history, branch, and worktree inspection; every change under `packages/` or any behavior-affecting change requires a changeset, while docs-only or internal-only changes follow repository conventions; a docs audit for internal docs, user docs, and changelog; a conventional message; intended-file staging; clean-state verification; and a non-primary feature branch. PRs contain Summary, Changes or Work Results, Testing, and Breaking Changes.

Handoffs are route-scoped. Direct turns have none. Focused work uses the compact five-field contract. Full or cross-agent work uses the existing seven fields. Project workflow and rules are discovered when the selected route needs them and propagated through relevant handoffs, without mandatory startup reconnaissance. Project `.maestria` rules may add constraints but cannot waive or override canonical `!!!` rules; core hard rules take precedence.

## Hard rules preserved

The canonical `!!!` rules remain explicit for: not assuming; consulting docs before unfamiliar APIs or migrations; not anthropomorphizing effort; never leaking internal context; writing for humans without em dashes; never deleting what was not created; selecting the route before progress; preserving routed ownership; validating before handoff or landing; preserving maker/checker separation; and stopping for irreversible risk.

The autonomy contract also retains exhaust-data behavior, two-rejection stop and escalation, role-scoped mandatory skill availability checks, triggered optional skills, unrecognized-branch/worktree handling, docs-with-code, Work Results after builder code changes, and a maximum of three iterations. These rules are optimized by route, not weakened by it.

## Consequences

### Positive

- Small, familiar work can stay direct without child-agent overhead.
- Focused work has one owner and gets independent review when it will land.
- Full work retains a predictable blind maker/checker path with bounded loops.
- Hard safety, autonomy, shipping, and public-output rules remain explicit.
- Mode documents, handoffs, patterns, and the core rules use one contract.

### Negative

- Direct and focused non-landing routes intentionally give up routine independent checking.
- Risk criteria require judgment and concrete evidence.
- Platform adapters may provide only advisory enforcement for prompt-level boundaries.
- Fail-loud review findings can block autonomous landing until the safety or redesign input is resolved.

## Alternatives considered

### Keep the full pipeline universal

Rejected. It conflicts with route selection and imposes unnecessary model and latency overhead on low-risk work.

### Use `blitz` as the only shortcut

Rejected. A mode-specific escape hatch does not define ordinary focused work or make the route contract consistent across platforms.

### Remove hard rules from smaller routes

Rejected. Route selection scopes ceremony, not safety, ownership, verification, review-before-landing, public-output, or autonomous-shipping meaning.

### Add runtime model-price feedback

Deferred. Platform telemetry and model naming are not uniform. The canonical directive contract can be implemented and tested independently of that future runtime work.

## Assumptions

- `[verified]` Canonical source files define route and mode behavior as prose; platform packages derive artifacts through sync.
- `[verified]` Platform context isolation, route gates, and tool enforcement differ.
- `[inferred]` Explicit task risk is a more stable routing signal than a model price taxonomy that the current directive layer cannot enforce.

## Rollback conditions

Revisit this contract if a platform silently changes an explicit mode, prevents users from selecting `full`, hides the selected route, weakens a preserved hard rule, or shows increased escaped defects without a documented trade-off.

## Related decisions

- ADR-CORE-005 - canonical directive sync
- ADR-CORE-011 - exhaust data, document assumptions, and proceed
- ADR-CORE-012 - blind review, triage, and fail-loud behavior

## Date

2026-08-06
