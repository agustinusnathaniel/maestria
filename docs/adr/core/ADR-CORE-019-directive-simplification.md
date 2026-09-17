# ADR-CORE-019: Directive Simplification - Terminal-Artifact Delivery and Single-Home Rules

## Status

Accepted (2026-08-22)

## Context

A forensics review of OpenCode sessions surfaced five recurring failure patterns:

- Implementation runs stopped before PR creation despite no `gh`-authentication, tool-permission, or protected-branch errors.
- Review-repair loops treated a cancelled subagent as a verdict.
- Trivial tasks ballooned through repeated stop-condition recitals and approval asks on routine delivery steps.
- Specialist skill catalogs referenced absent skills.
- Directive context bloat was a recurring user complaint.

The old `rules.md` and `orchestrator.md` restated stop conditions in conditional phrasing ("push is conditional", "ask before ..."), and no directive defined the terminal artifact of implementation work. Each pattern maps to a directive defect, not a model defect:

| Observed behavior | Directive defect |
| --- | --- |
| Stalls before PR creation | No terminal-artifact definition; delivery treated as ask-worthy |
| Cancellation treated as verdict | Cancellation conflated with verdicts |
| Ceremony on trivial tasks | No direct-route bias |
| Dead skill references | No liveness check on catalogs |
| Context bloat | One contract restated in many places |

Pre-change state:

- `rules.md` carried overlapping bounded-repair, stop-condition, commit-policy, and skill-policy prose; `orchestrator.md` restated those contracts at procedure level.
- Specialist files carried 4-bucket skill catalogs with dead entries plus inherited per-domain source-repo listings.
- Platform sync configs carried replace ops whose anchors no longer matched canonical text, silently no-oping while appearing load-bearing.

## Goals

1. At least a 20% reduction in always-loaded directive bytes without semantic loss.
2. Delivered state as the default completion of delegated implementation.
3. Transport failure distinguished from authorization boundaries.
4. Eliminate dead references and silently-dead sync anchors.
5. One home per behavioral contract.

## Non-Goals

- No frontmatter or permission changes; the ADR-OC-001 end-state is unchanged and the orchestrator read-only bash allowlist remains a separate authorized decision.
- No specialist methodology redesign; each specialist keeps its role contract.
- No check-sync tooling changes; anchor-liveness validation is a follow-up.
- Not optimizing purely for token count - clarity and single-homing outrank raw compression.

## Decision

1. **Terminal-artifact delivery.** A delegated implementation outcome completes only at its delivered state: reviewed changes on a pushed feature branch with an open PR. Routine delivery steps (commit, push, PR creation) are autonomous mechanics; ceremonial asks for them are prohibited. Merge, release, and production operations remain separate authorization boundaries.
2. **Cancellation semantics.** A failed or cancelled delegation is transport trouble, not a verdict or authorization loss: retry once with an adjusted brief, then report a structured blocker (`Tried X, Y, Z. Blocked by [cause]. Need [input].`). User-initiated cancellation is terminal.
3. **Single-home contracts.** The bounded repair/convergence contract lives once, in `rules.md`. `skills/iteration-limits.md` remains an opt-in operator checklist; the orchestrator carries procedure-level flow only.
4. **Verified skill catalogs.** Canonical catalogs reference only skills verified present; niche-skill discovery relies on host-side skill descriptions instead of hard-coded catalog lines.
5. **Behavioral economics.** Direct-route bias is explicit ("ceremony does not equal rigor"). Binding user constraints are restated in every delegation brief they affect and re-checked at final verification. Milestone reporting replaces transition narration; the explicit review-trigger definition is retained.
6. **Sync-anchor hygiene.** Dead replace-ops were removed or re-anchored across the platform sync configs (including a Cursor delegation-roster insert); projections were regenerated via `scripts/sync-all` and `scripts/check-sync` passes.

## Consequences

### Positive

- Always-loaded directives, canonical files, and generated projections cleared the 20% reduction goal.
- Completion is unambiguous across implementers, reviewers, and users.
- Sync configs no longer carry replace ops whose anchors stopped matching canonical text.
- Core tests pass unmodified.

### Negative

- Some niche heuristics now rely on model judgment: huge-repo sampling, lens exclusivity, persisted-mode clear/reset, and anti-anthropomorphizing.
- The mutation-fallback ban is superseded by the direct-route-permitted model (PR #226 body).

## Assumptions

- Delivery stalls had no authentication or tooling failures behind them; the blockers were directive-shaped. `[verified]` against session logs.
- Several replace-op anchors were already silent no-ops before this change set. `[verified]` by comparing old anchors with pre-change canonical text.
- Flash-tier orchestrator models amplify hedged conditional prose into conservative behavior. `[inferred]` from failure-pattern correlation, not controlled comparison.

## Alternatives Considered

### Option A: Keep-and-patch the existing text

Rejected: duplication and ambiguity were the root causes, not any single sentence. Patching repeated conditional stop conditions would preserve the ambiguity that produced the stalls.

### Option B: Solve autonomy via harness permissions alone

Rejected: permission-boundary changes need separate authorization (here deferred as a non-goal), and directive clarity benefits conservative models most, the population that exhibited the stalls.

### Option C: Rewrite to bare-minimal principles

Rejected: test-pinned contracts encode load-bearing semantics. Incremental consolidation preserved them where a minimal rewrite would have broken them.

## Related Decisions

- [ADR-CORE-003](ADR-CORE-003-agent-conventions.md) - agent conventions; its Check→Use→Suggest skill pattern is retired here.
- [ADR-CORE-004](ADR-CORE-004-agent-prompt-template.md) - agent prompt template; its 4-bucket Skill Prescription is replaced here.
- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) - the sync pipeline whose dead anchors this decision cleans up.
- [ADR-CORE-011](ADR-CORE-011-eliminate-questions-autonomy.md) - eliminate-questions autonomy; delivery mechanics extended here.
- [ADR-CORE-012](ADR-CORE-012-deterministic-review-signals-fail-loud-exit.md) - deterministic review signals and fail-loud exit; source of the blocker format.
- [ADR-OC-001](../opencode/ADR-OC-001-tool-permission-design.md) - tool permission design; unchanged by this decision.
- [ADR-OC-003](../opencode/ADR-OC-003-keyword-triggered-workflow-modes.md) - keyword-triggered workflow modes; mode semantics preserved.
- Implementation: [PR #226](https://github.com/agustinusnathaniel/maestria/pull/226).

## Date

2026-08-22
