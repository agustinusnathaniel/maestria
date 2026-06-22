# ADR-011: Iterative Think-Verify Cycles — Multi-Turn Quality-Gated Loops

**Status**: Proposed

## Context

The current pipeline is fundamentally linear. The `fein` mode (ADR-008) runs adventurer → architect/planner → builder → reviewer, one pass each. If the reviewer finds issues, the user must manually re-prompt. There is no built-in mechanism for automatic rework, stateful retry across cycles, explicit quality gates with pass/fail criteria, or error-informed re-attempts where the worker receives structured rejection reasons for a better second attempt.

## Decision

Embed a structured think-verify cycle as a directive-driven procedure in the orchestrator's prompt. No plugin TypeScript changes, no new mode keywords. The orchestrator decides when to activate the loop based on task complexity and verification results.

**Cycle structure**: Think (delegate to a Thinker for analysis) → Work (delegate to a Worker for implementation) → Verify (delegate to the Verifier for quality check). If PASS, report results. If FAIL, enter Rework → Re-verify loop. Re-engage the Thinker only if the verifier identifies a design-level flaw, not an implementation bug.

**Loop parameters**: Max 3 iterations. Termination when 0 blocking issues or max iterations reached. Escalation at limit: "Tried N cycles. Blocked by [reason]. Need [input]."

**Rework handoff format** (included in every rework delegation): previous result (verifier's findings with locations), what was tried (summary of previous approach), root cause (why it failed), requirements for this attempt (specific changes needed to pass).

**Trigger conditions**: Complex task, verifier explicitly requests rework (Conventional Comments with `issue:` labels), previous turn failed, or `fein` mode active. Loop is NOT activated for trivial changes, `sonar` mode (research only), or `blitz` mode (speed over quality).

## Consequences

- **Good**: Reduces manual re-prompting — orchestrator handles "fix what the reviewer found" automatically. Structured rework handoffs give the Worker context-rich feedback (not "fix it again"). Thinker re-entry is gated on design-level flaws, avoiding unnecessary re-analysis. Zero plugin code changes. Backward compatible — existing linear pipelines work unchanged. Consistent with max-3 iteration pattern (ADR-004).
- **Bad**: Orchestrator prompt grows ~80-100 lines, increasing token overhead every session. Relies entirely on LLM instruction-following for loop management — no structural enforcement. State tracking depends on conversation history, fragile across session compactions. Three-iteration default may not suit all task complexities. Not visible to subagents — a builder being reworked may not know it's in a cycle.
- **Risks**: Runaway loops (max-3 hard limit + escalation forces user intervention). Stale context across iterations (mitigated: rework handoff re-states previous result and failure reasons). Builder confusion on rework (handoff explicitly describes previous approach and why it failed). Verifier inconsistency across iterations (handoff anchors quality threshold by including original findings).

## Date

2026-06-22
