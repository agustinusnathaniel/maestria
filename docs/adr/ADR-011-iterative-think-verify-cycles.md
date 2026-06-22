# ADR-011: Iterative Think-Verify Cycles — Multi-Turn Quality-Gated Loops

## Status

Proposed

## Context

The current `@maestria/opencode` pipeline is fundamentally linear. The `fein` mode (ADR-008) runs:

```
@adventurer (recon) → @architect or @planner (design) → @builder (implement) → @reviewer (validate)
```

Each turn is a single pass. If `@reviewer` finds issues, the user must manually re-prompt the orchestrator to fix them, which starts a new linear pipeline. There is no built-in mechanism for:

1. **Automatic rework** — the orchestrator routes failed output back to the appropriate agent for iteration
2. **Stateful retry** — the orchestrator tracks what was tried, what failed, and why
3. **Quality gates** — explicit pass/fail criteria that an agent's output must meet before the pipeline advances
4. **Error-informed re-attempts** — the Worker receives the Verifier's rejection reasons to produce a better second attempt

This gap manifests in practice. A builder fixes a bug; the reviewer finds the fix is incomplete. The orchestrator's only option is to re-delegate to builder with the reviewer's feedback appended. But there's no formal loop mechanism — no iteration counter, no escalation threshold, no structured handoff from reviewer back to builder with "what was tried, what failed, why."

Recent research in evolutionary multi-agent coordination (arXiv:2512.04695) addresses this with structured multi-turn coordination. The TRINITY coordinator dynamically assigns roles across turns, allowing iterative refinement cycles. Building on this, the Conductor model (arXiv:2512.04388) generates coordination strategies that can include recursive topologies — loops where the Verifier's output feeds back into the Worker for another attempt, with a maximum iteration bound.

This ADR proposes formalizing a **Think-Verify Cycle** — a multi-turn loop where the orchestrator routes through Thinker → Worker → Verifier, and loops back to Worker if the Verifier rejects, until quality gates pass or max iterations are reached.

## Decision Drivers

1. **Reduce manual re-prompting** — the orchestrator should handle the "fix what the reviewer found" cycle automatically
2. **Prevent infinite loops** — every loop must have a hard iteration limit and verifiable termination condition
3. **Stateful iteration** — the orchestrator must track what was tried and what failed across cycles
4. **Error inform next attempt** — the Worker must receive the Verifier's rejection reasons as structured input for the next cycle
5. **Backward compatibility** — existing linear pipeline must continue to work; think-verify cycles are opt-in
6. **Prompt-level, not plugin-level** — loop logic lives in orchestrator prompts, not plugin TypeScript

## Considered Options

### Option A: Directive-Driven Loops in Orchestrator Prompt (Recommended)

Embed the think-verify cycle as a structured decision procedure in the orchestrator's prompt. The orchestrator manages iteration state in its own context (conversation history + handoff summaries). No plugin TypeScript changes.

The orchestrator gets a new section:

```
## Think-Verify Cycle

For complex work that needs quality-gated iteration, use this loop:

1. **Think** — delegate to a Thinker (architect/planner/diagnose/adventurer) for analysis
2. **Work** — delegate to a Worker (builder/writer) for implementation
3. **Verify** — delegate to the Verifier (reviewer) for quality check
   - If PASS (verifier reports no blocking issues): cycle complete, report results
   - If FAIL (verifier reports one or more blocking issues): go to step 4
4. **Rework** — delegate back to the Worker with the Verifier's rejection reasons
   - Include: what failed, why, the verifier's findings
   - Do NOT re-run the Think phase unless the failure reveals a design flaw
5. **Re-verify** — delegate back to the Verifier for a second check
   - If PASS: cycle complete
   - If FAIL: repeat from step 4

### Loop Parameters

- **Max iterations**: 3 (Thinker/Worker/Verifier = 1 iteration; rework + re-verify = subsequent iterations)
- **Termination**: verifier reports 0 blocking issues, OR max iterations reached
- **Escalation**: if max iterations reached, report to user: "Tried N cycles. Blocked by [reason]. Need [input]."
- **Thinker re-entry**: re-engage the Thinker only if the verifier identifies a design-level flaw (not an implementation bug)

### State Tracking

After each failed verification, the orchestrator maintains a running summary:

```

Think-Verify Cycle — Iteration 2/3
Previous failure: [short description of what was wrong]
What was tried: [what the worker changed in the last attempt]
Current state: [what remains to be fixed]

```

This summary is included in every rework delegation so the Worker has full context.
```

#### Pros

- Zero plugin code changes — purely prompt engineering
- Full backward compatibility — the loop is a new section, not a modification of existing flow
- State is naturally tracked in conversation history and delegations
- Flexible: loop parameters (max iterations, escalation format) can be tuned without rebuilding the plugin
- Consistent with ADR-004's iteration limit pattern (max-N + termination condition + escalation format)

#### Cons

- No programmatic enforcement — depends on the LLM following the procedure
- Token overhead: loop state tracking adds context to every delegation within a cycle
- No structural handoff between verifier failure-and-worker-rework — the orchestrator must synthesize feedback manually
- Not visible to subagents — a builder being reworked may not know it's in a loop cycle unless told explicitly

### Option B: Plugin-Level Loop Engine with TypeScript State

Implement the loop mechanism in the plugin's TypeScript. Add a `session.compacting` state field that tracks active cycles, iteration counts, and failure history. The orchestrator delegates normally, and the plugin intercepts results to detect pass/fail and auto-re-route.

```typescript
interface CycleState {
  id: string;
  type: 'think-verify';
  iteration: number;
  maxIterations: number;
  history: Array<{
    agent: string;
    result: 'pass' | 'fail';
    findings: string;
  }>;
  currentPhase: 'think' | 'work' | 'verify';
}
```

The `chat.message` hook would detect cycle markers and auto-route rework delegations, bypassing the orchestrator's normal trigger-phrase matching.

#### Pros

- Programmatic enforcement: loop limits and routing are guaranteed by code
- State persists across session compactions via `session.compacting`
- Subagents don't need to know about cycles — the plugin handles routing transparently

#### Cons

- Major plugin complexity increase: state machine, cycle detection, auto-routing logic
- ADR-002 principle violation: policy (routing logic) would live in TypeScript, not in directives
- Brittle: OpenCode's plugin API may not support the interception patterns needed (intercepting delegation results)
- Over-engineered: the current volume of complex multi-turn work doesn't justify infrastructure-level support
- Harder to audit: loop behavior is opaque to the user without plugin logging

### Option C: New `thinkverify` Mode Keyword

Extend the mode system (ADR-008) with a new keyword `thinkverify` that activates the think-verify cycle. The hook detects `\bthinkverify\b`, strips it, and injects a mode prompt that describes the loop procedure.

```
## MODE: thinkverify (Iterative Think-Verify Cycle)

Execute the think-verify cycle: Thinker (analysis) → Worker
(implementation) → Verifier (check). If the Verifier reports
blocking issues, loop back to Worker for rework and re-verify.
Max 3 iterations. Escalate if unresolved.
```

This is a subset of Option A — the loop procedure is the same, but triggered by a keyword instead of the orchestrator's discretion.

#### Pros

- Explicit user intent: the user opts into iterative cycles with a keyword
- Composability: can be combined with `fein` pipeline (fein is the default; thinkverify is an explicit override)
- Visible to the user: the mode marker `[MODE: thinkverify]` communicates the behavior

#### Cons

- Overlap with `fein`: `fein` already implies review after implementation. Adding `thinkverify` creates confusion about which mode to use when.
- The mode system is per-turn (ADR-008). A think-verify cycle spans multiple turns, which the per-turn mode model doesn't cleanly support.
- Yet another keyword to learn — less is more.
- Not all think-verify usage is user-initiated; the orchestrator should decide when iteration is needed.

## Decision

**Accept Option A: Directive-Driven Loops in Orchestrator Prompt.**

The think-verify cycle is encoded as a structured decision procedure in the orchestrator's prompt. No plugin TypeScript changes, no new mode keywords. The orchestrator decides when to activate the loop based on task complexity and verification results.

### Rationale

1. **Prompt-level iteration is the right fit for this scope.** ADR-004 established the pattern: iteration limits with verifiable termination conditions. The think-verify cycle extends this pattern from single-agent iteration (e.g., builder fixing a test failure) to multi-agent orchestration loops. The pattern is proven.

2. **Plugin-level enforcement (Option B) violates ADR-002's principle.** Policy belongs in prompts, not in TypeScript. The loop mechanism is a routing decision, not an infrastructure concern. Engaging the plugin for auto-routing would require intercepting delegation results, which the current plugin API does not cleanly support.

3. **A new mode keyword (Option C) is redundant with existing mode mechanics.** The `fein` mode already implies a review gate. Adding `thinkverify` would create an ambiguous choice between "full pipeline with one review pass" and "full pipeline with iterative review." The orchestrator should decide based on context, not a keyword.

4. **The orchestrator already has the context needed to manage iteration.** Conversation history tracks what agents have been called and what they produced. The orchestrator's handoff format (ADR-004's 5-section contract) already includes "What was found" and "What was NOT found / is unclear." These sections naturally form the state that feeds rework delegations.

5. **Three iterations is a safe default.** Based on the existing max-3 pattern across agents (ADR-004's iteration limits), 3 loops balances quality improvement against token cost. Escalation at 3 avoids agent ping-pong while giving sufficient room for genuine iteration.

### Loop Structure in Detail

#### Trigger Conditions

The orchestrator activates think-verify mode when:

- The task is complex and the verifier's failure is likely (new feature, cross-module change)
- The verifier explicitly requests rework (the reviewer's Conventional Comments include `issue:` labels)
- A previous turn already failed verification and the user did not override
- The `fein` mode is active (quality-gated work implies possible iteration)

The orchestrator does NOT activate the loop for:

- Trivial changes (typo fix, single-line refactor) — one-shot verified is sufficient
- Research-only work (`sonar` mode) — no implementation to iterate
- Blitz mode — explicit user request for speed over quality

#### Rework Handoff Format

When rework is needed, the orchestrator constructs a delegation with:

```
## Rework Cycle (Iteration N/3)

### Previous Result
Verifier found the following issues:
- [issue 1 with location]
- [issue 2 with location]

### What Was Tried
[Short summary of the approach taken in the previous attempt]

### Root Cause
[Verifier's analysis of why the approach failed]

### Requirements for This Attempt
[Specific changes needed to pass verification]
```

This ensures the Worker receives context-rich feedback, not a generic "fix the issues."

#### Thinker Re-Entry Criteria

Re-engaging the Thinker (returning to step 1) is reserved for cases where:

- The Verifier identifies a **design flaw** (not an implementation bug)
- Two consecutive Worker attempts fail on the same requirement
- The user explicitly asks for a redesign

Otherwise, the loop stays in Work → Verify → Rework → Re-verify. Re-engaging the Thinker unnecessarily multiplies token cost without proportional quality improvement.

### Interaction with Mode System

| Mode          | Think-Verify Cycle Behavior                                   |
| ------------- | ------------------------------------------------------------- |
| No mode       | Orchestrator discretion — activates for complex tasks         |
| `fein`        | Active by default — non-negotiable review gate with iteration |
| `sonar`       | Inactive — no implementation to iterate                       |
| `blitz`       | Suppressed — user explicitly opted out of quality gates       |
| `thinkverify` | Not a real mode — this document does not propose adding it    |

### State Tracking in `session.compacting`

While Option B's full plugin state machine is rejected, a lightweight state hint should be added to the `session.compacting` handler (ADR-002). When a think-verify cycle is in progress, the plugin pushes a summary:

```typescript
experimental.session.compacting: async (_input, output) => {
  // ...existing context push...
  output.context.push(
    'Active think-verify cycle: [brief state, iteration N/3, current phase]',
  );
};
```

This requires no TypeScript state machine — the orchestrator generates the summary text, and the compacting hook preserves it. The orchestrator reads it back after compaction to resume the cycle. This is a minimal prompt-level concern, not a plugin-level concern.

### File Changes

The following files are modified:

- **`agents/orchestrator.md`** gains a new `## Think-Verify Cycle` section after the existing specialist delegation table, before the `## Anti-Patterns` section.

Approximate structure to be inserted:

```
## Think-Verify Cycle

For complex work that needs quality-gated iteration, use this loop:

1. **Think** — delegate to a Thinker for analysis
2. **Work** — delegate to a Worker for implementation
3. **Verify** — delegate to the Verifier for quality check
   - If PASS: cycle complete, report results
   - If FAIL: go to step 4
4. **Rework** — delegate back to the Worker with the Verifier's findings
5. **Re-verify** — delegate back to the Verifier for a second check

### Loop Parameters
- Max iterations: 3
- Termination: 0 blocking issues OR max iterations reached
- Escalation: report to user at max iterations
```

This mirrors the structure described in Option A's directive-driven loop prompt.

## Consequences

### Positive

- Reduces manual re-prompting: the orchestrator handles "fix what the reviewer found" automatically
- Structured rework handoffs ensure the Worker receives context-rich feedback (not "fix it again")
- Thinker re-entry is gated on design-level flaws, avoiding unnecessary re-analysis
- Zero plugin code changes — purely prompt engineering
- Backward compatible: existing linear pipelines continue to work unchanged
- Consistent with established max-3 iteration pattern (ADR-004)

### Negative

- Orchestrator prompt grows by ~80-100 lines, increasing token overhead every session
- Relying on LLM instruction-following for loop management — no structural enforcement
- State tracking depends on conversation history, which is fragile across session compactions
- Three-iteration default may be too few for complex cross-module changes, too many for simple fixes
- Not visible to subagents — a builder being reworked may not know it's in an iteration cycle

### Risks

- **Runaway loops**: even with max-3 enforcement, each iteration consumes delegation tokens. Three iterations of a complex feature could cost 30-50K tokens. Mitigation: max-3 is a hard limit; the escalation format forces user intervention.

- **Stale context across iterations**: as context windows fill across cycles, the orchestrator may lose sight of earlier findings. Mitigation: the rework handoff format explicitly includes "what was tried" and "previous result" — these are re-stated every delegation, not left to conversation history.

- **Builder confusion on rework**: a builder delegated a rework task may not know this is the second attempt and may repeat the same approach. Mitigation: the "What Was Tried" section in the rework handoff explicitly describes the previous approach and why it failed.

- **Verifier inconsistency**: the same verifier may apply different standards across iterations (first review is strict, second is lenient). Mitigation: the rework handoff includes the verifier's original findings — subsequent verification cycles reference the same failure criteria, anchoring the quality threshold across iterations.

### What We Avoid

- **Auto-apply verifier fixes** — the verifier identifies issues but does not automatically modify code. The worker agent applies fixes.
- **User-triggered cycling** — think-verify cycles run automatically within a single delegation. The user does not need to explicitly request rework.
- **Infinite retry without cap** — max 3 iterations enforced by prompt instruction and escalation path.

## References

- [Evolved Orchestrator for Multi-Agent Code Generation](https://arxiv.org/abs/2512.04695) — TRINITY: lightweight coordinator with Thinker/Worker/Verifier roles, optimized via CMA-ES (ICLR 2026)
- [Learning to Orchestrate Agents in Natural Language with Reinforcement Learning](https://arxiv.org/abs/2512.04388) — Conductor: RL-trained orchestrator with recursive topologies (ICLR 2026)
- ADR-002: Plugin Architecture — Pure Plugin, Markdown Agents, 2 Hooks
- ADR-004: Agent Prompt Template — 4-Bucket Skills, 5-Section Handoff, Iteration Limits, Rules Bullets
- ADR-008: Keyword-Triggered Workflow Modes — Hybrid Hook + Prompt, Denylist Config
- ADR-003: Agent Conventions — `!!!` Markers, Cross-References, Skill Pattern (Conventional Comments)

## Date

2026-06-22
