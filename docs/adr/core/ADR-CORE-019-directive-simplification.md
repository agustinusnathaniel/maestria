# ADR-CORE-019: Directive Simplification - Terminal-Artifact Delivery and Single-Home Rules

## Status

Accepted (2026-08-22)

## Context

A 62-day forensics review of 3,543 OpenCode sessions surfaced five recurring failure patterns in how the directives steered agent behavior:

- Implementation runs stopped before PR creation despite **zero** `gh`-authentication, tool-permission, or protected-branch errors blocking them.
- Multi-day review-repair loops stalled when a delegated subagent was cancelled, treating transport trouble as a verdict.
- Trivial tasks ballooned through ceremony - repeated stop-condition recitals and approval asks on routine delivery mechanics.
- Specialist skill catalogs referenced skills that did not exist in the environment.
- Users flagged directive context bloat as a recurring complaint.

The old `rules.md` and `orchestrator.md` stated stop conditions repeatedly in conditional phrasing ("push is conditional", "ask before ..."), and none of the directives ever defined the terminal artifact of implementation work - what state marks an implementation outcome as complete.

Each pattern maps to a directive defect, not a model defect:

| Observed behavior | Directive defect |
| --- | --- |
| Stalls before PR creation | No terminal-artifact definition; delivery steps phrased as ask-worthy checkpoints |
| Review-repair loops stall on cancellation | Cancellation conflated with verdicts and authorization loss |
| Trivial tasks balloon | Repeated ceremony recitals; no direct-route bias |
| Dead skill references | Catalogs accumulated entries no liveness check guarded |
| Context bloat | One contract restated across rules, orchestrator, and specialists |

The pre-change state:

- `rules.md` (10.7 KB) carried the bounded-repair contract, stop conditions, commit policy, and skill-policy prose with overlapping restatements across sections.
- `orchestrator.md` (9.4 KB) restated several `rules.md` contracts at procedure level and repeated stop-condition phrasing.
- The seven specialist files carried 4-bucket skill catalogs (`Always load` / `Load on trigger` / `Defer to specialist` / `Skip if`) whose entries referenced skills not present in the environment, plus per-domain source-repo listings inherited from earlier conventions.
- Platform sync configs carried replace ops whose `from` anchors had stopped matching canonical text in earlier revisions - split/join never matched, so the transforms silently no-op'd while appearing load-bearing in review.

## Goals

1. At least a 20% reduction in always-loaded directive bytes without semantic loss.
2. Delivered state as the default completion of delegated implementation.
3. Transport failure distinguished from authorization boundaries.
4. Eliminate dead references and silently-dead sync anchors.
5. One home per behavioral contract.

## Non-Goals

- No frontmatter or permission changes. The ADR-OC-001 end-state is unchanged; the orchestrator read-only bash allowlist is explicitly deferred as a separate authorized decision.
- No specialist methodology redesign; each specialist keeps its role contract.
- No check-sync tooling changes; anchor-liveness validation is recorded as a follow-up.
- Not optimizing purely for token count - clarity and single-homing outrank raw compression.

## Decision

1. **Terminal-artifact delivery.** A delegated implementation outcome completes only at its delivered state: reviewed changes on a pushed feature branch with an open PR. Routine delivery steps (commit, push, PR creation) are autonomous mechanics - ceremonial asks for them are prohibited. Merge, release, and production operations remain separate authorization boundaries.

2. **Cancellation semantics.** A failed or cancelled delegation is transport trouble, not a verdict or authorization loss: retry once with an adjusted brief, then report a structured blocker (`Tried X, Y, Z. Blocked by [cause]. Need [input].`). User-initiated or intentional platform cancellation is terminal.

3. **Single-home contracts.** The bounded repair/convergence contract lives once, in `rules.md`. `skills/iteration-limits.md` remains as an opt-in operator checklist; the orchestrator carries procedure-level flow only, not restated contracts.

4. **Verified skill catalogs.** Specialist skill lists were reduced to entries verified present against the environment. Policy going forward: canonical catalogs reference only verifiably-present skills; discovery of niche skills relies on host-side skill descriptions instead of hard-coded catalog lines.

5. **Behavioral economics.** Direct-route bias is explicit ("ceremony does not equal rigor"). Binding user constraints are restated inside every delegation brief they affect and re-checked at final verification. Milestone reporting replaces transition narration. The explicit review-trigger definition is retained.

6. **Sync-anchor hygiene.** Dead replace-ops were removed or re-anchored across platform sync configs, and all platform projections were regenerated via `scripts/sync-all`:

   - `packages/opencode/sync.config.ts`: 12 body replace-ops deleted (7 orchestrator, 5 rules vocabulary) - several anchored to canonical sentences removed by earlier directive revisions, i.e. pre-existing dead.
   - `packages/kimi-code/sync.config.ts`: the built-in-agent delegation guard re-anchored from the dead `'## Delegation\n'` anchor to the live `## Delegation and Context` heading, now naming the seven personas explicitly.
   - `packages/cursor/sync.config.ts`: a delegation roster insert added so Cursor's rules file stays self-contained after the canonical roster line moved.
   - `packages/hermes/sync.config.ts`: the diagnose environment generalization re-anchored to a live sentence; dead planner/rules generalization ops removed.

   `scripts/check-sync` passes on the regenerated projections.

## Consequences

### Positive

- Roughly 26% fewer bytes across the changed canonical files (rules.md −34%), clearing the ≥20% goal on every measured scope (canonical files ~24%, generated platform projections ~21%).
- Completion is unambiguous: implementers, reviewers, and users share one definition of "done".
- Fewer silent no-op transforms - sync configs no longer carry replace ops whose anchors stopped matching canonical text.
- Zero test-semantics edits (58/58 core tests pass unmodified).

### Negative

- Some niche heuristics now rely on model judgment rather than written rules: huge-repo sampling specifics, lens-exclusivity explicitness, the persisted-mode clear/reset requirement, and the anti-anthropomorphizing line.
- The explicit mutation-fallback ban is superseded by the direct-route-permitted model; this tradeoff is documented in the PR #226 body.

## Assumptions

- The observed delivery stalls had zero authentication/tooling failures behind them - the blockers were directive-shaped, not capability-shaped. `[verified]` against session logs.
- Several replace-op anchors were already silent no-ops before this change set. `[verified]` by matching old anchors against pre-change canonical text.
- Flash-tier orchestrator models amplify hedged conditional prose into conservative behavior. `[inferred]` from failure-pattern correlation, not controlled comparison.

## Alternatives Considered

### Option A: Keep-and-patch the existing text

Rejected because duplication and ambiguity were the root causes, not any single sentence. Patching repeated conditional stop conditions would preserve the ambiguity surface that produced the observed stalls.

### Option B: Solve autonomy via harness permissions alone

Rejected because permission-boundary changes require separate authorization (and are deferred here as a non-goal), while directive-level clarity benefits conservative models most - the population that exhibited the stalls.

### Option C: Rewrite to bare-minimal principles

Rejected because test-pinned contracts encode load-bearing semantics. Incremental consolidation preserved those contracts (all 58 core tests unmodified) where a minimal rewrite would have broken them.

## Related Decisions

- [ADR-CORE-003](ADR-CORE-003-agent-conventions.md) - agent conventions (`!!!` markers, cross-references); its Check→Use→Suggest skill pattern is retired here.
- [ADR-CORE-004](ADR-CORE-004-agent-prompt-template.md) - agent prompt template; its 4-bucket Skill Prescription is replaced here.
- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) - the sync pipeline whose dead anchors this decision cleans up.
- [ADR-CORE-011](ADR-CORE-011-eliminate-questions-autonomy.md) - eliminate-questions autonomy; terminal-artifact delivery extends it to delivery mechanics.
- [ADR-CORE-012](ADR-CORE-012-deterministic-review-signals-fail-loud-exit.md) - deterministic review signals and fail-loud exit; cancellation semantics build on its structured blocker format.
- [ADR-OC-001](../opencode/ADR-OC-001-tool-permission-design.md) - tool permission design; unchanged by this decision.
- [ADR-OC-003](../opencode/ADR-OC-003-keyword-triggered-workflow-modes.md) - keyword-triggered workflow modes; mode semantics preserved.
- Implementation: [PR #226](https://github.com/agustinusnathaniel/maestria/pull/226).

## Date

2026-08-22
