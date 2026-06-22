# ADR-012: Recursive Orchestration — Self-Delegation for Multi-Level Task Decomposition

> **Superseded:** The OpenCode runtime does not support recursive `task()` calls.
> Spawned subagents only receive read-only tools (Glob, Grep, Ls, View, Sourcegraph)
> and cannot delegate to other agents. Self-delegation is not viable with the
> current OpenCode architecture. See `internal/llm/agent/tools.go` in the
> opencode-ai/opencode repository.

## Status

Superseded

## Prerequisites

Before implementation, the following must be verified:

- **OpenCode `task()` API:** Does the `task()` function support self-delegation — i.e., can the orchestrator call `task(orchestrator, ...)` to delegate to itself? This is the core mechanism of this ADR and must be confirmed.
- **Concurrent orchestrator sessions:** Can a recursive `task()` call create a sub-orchestrator that runs its own specialist pipeline within the same session?
- **Permission allowlist:** If the plugin validates `task()` targets against an allowlist, does it allow the orchestrator to appear as a target?

If any of these cannot be verified, this ADR's recommended approach must be re-evaluated.

## Context

The `@maestria/opencode` orchestrator currently delegates work to specialists using a **flat delegation model**: one turn, one `task()` call, one specialist. The orchestrator can fan out multiple parallel `task()` calls (ADR-008's Parallel Fan-Out pattern), but each delegation is a single-level assignment — the orchestrator breaks the problem down in its own mind, delegates each piece, and assembles the results.

This flat model has three limitations:

1. **Decomposition depth**: for complex tasks (e.g., "implement user authentication"), the orchestrator must decompose into sub-tasks itself and track all sub-results in its own context. There is no way to say "sub-delegate the database schema to @architect, the implementation to @builder, and the migration plan to @planner" as a structured hierarchy.

2. **Sub-problem nesting**: some sub-problems are themselves complex enough to benefit from orchestration. For example, a sub-task like "design the auth API" might need its own reconnaissance (@adventurer), design (@architect), and verification (@reviewer) cycle. In the flat model, the orchestrator must sequence these manually across turns.

3. **Synthesis overhead**: when the orchestrator fans out 3-5 parallel sub-tasks, it must hold all results in context and synthesize them itself. For cross-cutting tasks (e.g., "refactor the payment module"), the synthesis work is comparable to the sub-task work — the orchestrator becomes a bottleneck.

Recent research in learned agent orchestration (arXiv:2512.04388) introduces the Conductor model, which generates **recursive coordination topologies**. A coordinator can delegate a sub-problem to a nested coordinator instance, which manages its own specialists and returns a synthesized result. This mirrors human team structures where a lead architect breaks a system into modules, assigns module leads, and each module lead manages their own implementation team.

This ADR proposes allowing the orchestrator to delegate sub-problems to _itself_ — a `task(orchestrator, ...)` call that spawns a nested orchestrator instance for a scoped sub-problem, collects its synthesized result, and integrates it into the parent orchestrator's output.

## Decision Drivers

1. **Minimal plugin code changes** — recursive orchestration must be achievable primarily at the prompt level, with only a one-line TypeScript change for the allowlist
2. **Safety first** — depth limits, termination conditions, and cost guards must prevent runaway recursion
3. **Scoped context** — sub-orchestrator instances should receive a narrow briefing, not the full parent context
4. **Synthesized results** — sub-orchestrators return a complete handoff, not raw specialist output
5. **Backward compatibility** — existing flat delegation must continue to work unchanged
6. **Opt-in complexity** — recursion is an advanced pattern, not the default

## Considered Options

### Option A: Self-Delegation via `task(orchestrator, ...)` with Prompt-Level Guards (Recommended)

The orchestrator delegates sub-problems to itself by calling `task(orchestrator, ...)`. The nested orchestrator instance receives a scoped briefing, runs its own specialist pipeline, and returns a synthesized handoff. Guards are encoded in the orchestrator's prompt — depth limits, recursion triggers, and termination conditions are instructions, not code.

#### Mechanism

The orchestrator's `task()` permission model (in frontmatter) already allows delegation to the 7 specialists. To enable self-delegation, add `orchestrator` to the allowed list:

```yaml
task:
  'adventurer': allow
  'architect': allow
  'builder': allow
  'diagnose': allow
  'orchestrator': allow # NEW — enables self-delegation
  'planner': allow
  'reviewer': allow
  'writer': allow
```

The prompt gains a "Recursive Orchestration" section:

```
## Recursive Orchestration

For complex tasks with independently orchestratable sub-problems,
you may delegate to yourself via `task(orchestrator, ...)`.

### When to Use Self-Delegation

Self-delegation is appropriate when a sub-problem has ALL of:
1. Its own clear scope boundary (can be described in 2-3 sentences)
2. Multiple sub-steps needing different specialists (not just one agent)
3. An independent success criterion unrelated to the parent task
4. Low coupling to other sub-problems (minimal cross-referencing)

Self-delegation is NOT appropriate when:
- The sub-problem needs 1 specialist call — just delegate directly
- The sub-problem depends on results from other sub-tasks in-flight
- The sub-problem is smaller than ~5 minutes of specialist work
- The parent context is needed for decision-making

### Depth Limit

- **Max recursion depth**: 2 (parent → child → grandchild)
- **Depth tracking**: prefix each sub-delegation with `[RECURSION DEPTH: N]`
  so the nested instance knows its allowed depth
- **At depth 2**: the sub-orchestrator must NOT self-delegate further —
  it uses flat delegation only. This prevents infinite descent.

### Briefing Format

When self-delegating, the briefing must follow this strict format:

```

## Recursive Delegation — [sub-problem name]

### Scope

[2-3 sentence description of what this sub-orchestrator owns]

### Boundary

[What is explicitly NOT in scope — prevents boundary creep]

### Success Criteria

[Verifiable conditions that define completion]

### Constraints

[Known constraints from the parent context that affect this sub-problem]

### Parent Context (DO NOT propagate)

[Do NOT include the full parent conversation — only what's needed]

### Recursion Level

[RECURSION DEPTH: N] — N starts at 1 for child of parent

```

The sub-orchestrator returns a standard 5-section handoff (ADR-004):
1. What was done
2. What was found
3. What was NOT found / is unclear
4. Verification (how the sub-problem's output was validated)
5. Next step (what the parent orchestrator should do with this result)

### Synthesis

The parent orchestrator does NOT blindly trust sub-orchestrator results.
It must verify the handoff against the sub-problem's success criteria
before integrating. If the handoff fails validation:

- Attempt 1: Return to sub-orchestrator with specific feedback
- Attempt 2: Delegate directly to specialists for the gap
- Escalation: Surface to the user with what was attempted and what is missing

### Cost Guard

Before self-delegating, estimate the cost:
- 1 self-delegation ≈ 3-5 specialist calls + overhead
- If the same work can be done with 2-3 direct specialist calls,
  prefer flat delegation
- If cost is unclear, ask the user via `question()` before proceeding
```

#### Pros

- Minimal plugin code change — the frontmatter schema requires adding `orchestrator` to the `task()` target allowlist, which is a one-line addition. No logic changes are needed.
- Backward compatible: self-delegation is an opt-in pattern; flat delegation is unchanged
- Scoped context: the sub-orchestrator receives a narrow briefing, not the full parent context
- Synthesis model: sub-orchestrators return complete handoffs, reducing the parent's synthesis overhead
- Safety built in: depth limit of 2, cost guard, escalation path

#### Cons

- No programmatic depth enforcement — depends on the prompt's `[RECURSION DEPTH: N]` marker being followed
- Token cost: each self-delegation spawns a full orchestrator instance with its own context window
- Handoff overhead: sub-orchestrator output must be complete enough for the parent to use without re-entering the sub-problem
- LLM behavior risk: a sub-orchestrator may try to self-delegate further despite the depth limit

### Option B: Flat Delegation with Planner Decomposition (Status Quo)

Keep the current flat model. For complex tasks, delegate to `@planner` first. The planner breaks the task into phases, and the orchestrator executes each phase via flat delegation. Sub-problems are handled by the orchestrator's context management, not by nested orchestrator instances.

The rationale: if a sub-problem is complex enough for orchestration, the planner should have identified it during decomposition. The orchestrator can then execute that phase as a sequence of flat delegations.

#### Pros

- No changes needed — works today
- Proven pattern: the planner already handles decomposition
- Lower token cost: no nested orchestrator instances
- Less complexity: no depth limits, no context boundaries to manage

#### Cons

- No structured sub-problem isolation: all context lives in the orchestrator's single session
- Planner-phase boundary: the planner decomposes once; dynamic sub-problems that emerge during execution don't trigger re-decomposition
- Orchestrator bottleneck: the parent holds all sub-results in context, even when sub-problems are independent
- No parallelization of decomposition: sub-problems are sequenced, not nested
- No results verification at sub-problem boundaries: the orchestrator integrates all output without intermediate validation

### Option C: Task Queue with Depth-Limited Dispatch

Introduce a lightweight task queue mechanism in the plugin TypeScript. When the orchestrator calls `task(orchestrator, ...)`, the plugin intercepts the call and enqueues it with a depth counter. The plugin enforces depth limits programmatically.

```typescript
// Plugin hook pseudo-code
const recursionDepth = new Map<string, number>();

onTaskDispatch: (agent, prompt) => {
  if (agent === 'orchestrator') {
    const parentDepth = recursionDepth.get(parentSessionId) ?? 0;
    if (parentDepth >= 2) {
      throw new Error('Max recursion depth exceeded');
    }
    recursionDepth.set(newSessionId, parentDepth + 1);
  }
};
```

#### Pros

- Programmatic depth enforcement: no dependency on LLM instruction-following
- Visible to the plugin: depth tracking can integrate with session compaction
- Error surface: invalid self-delegations produce clear errors rather than silent failures

#### Cons

- Major plugin complexity: requires intercepting `task()` dispatch, managing session depth state, and maintaining depth maps across compaction cycles
- OpenCode plugin API may not support `task()` interception — the `task()` permission model is declarative, not event-driven
- ADR-002 principle violation: routing logic moves from prompts to TypeScript
- Over-engineered for the current volume of tasks that would benefit from recursive orchestration

## Decision

**Accept Option A: Self-Delegation via `task(orchestrator, ...)` with Prompt-Level Guards.**

The orchestrator is permitted to delegate to itself with a depth limit of 2, strict briefing/scoping rules, and a cost guard. All enforcement is prompt-level: depth tracking via `[RECURSION DEPTH: N]` markers, scope via briefing format, and termination via handoff verification.

### Rationale

1. **Prompt-level recursion is sufficient for the current complexity tier.** The orchestrator manages complex multi-step work approximately 20-30% of the time. Of that, only a fraction benefits from recursive decomposition. Infrastructure-level support (Option C) is premature for today's usage pattern.

2. **The planner gap is real.** Option B assumes the planner can decompose everything up front. In practice, emergent complexity during execution (a sub-problem that reveals unexpected difficulty, a cross-cutting concern that only surfaces during implementation) requires dynamic re-decomposition. Recursion handles this naturally — the parent orchestrator can recognize "this sub-problem needs its own orchestration" mid-flight.

3. **ADR-008's Parallel Fan-Out pattern is complementary.** Fan-out handles independent sub-tasks at the same level (database schema + API endpoints + migration script). Recursion handles nested sub-tasks (auth module → auth API design → auth middleware implementation). Both are needed; they address different coupling levels.

4. **Depth limit of 2 is a natural ceiling.** In practice, parent → child covers most real scenarios: the parent decomposes the system into modules, and the child decomposes the module into tasks. Grandchild (depth 3) is rare and signals that the parent should be decomposed differently. The limit of 2 prevents the infinite-regress failure mode while covering the common case.

5. **Context scoping is the primary benefit.** The briefing format's "Parent Context (DO NOT propagate)" section is the key innovation — it forces the parent to distill only the essential context for the sub-problem. This prevents context pollution across sub-problems and keeps sub-orchestrator sessions lean.

### How Recursion Differs from Parallel Fan-Out

| Aspect             | Parallel Fan-Out (Existing)       | Recursive Orchestration (New)         |
| ------------------ | --------------------------------- | ------------------------------------- |
| Structure          | Siblings — all at same level      | Parent-child — nested                 |
| Dependencies       | Independent — no ordering         | Parent waits for child result         |
| Context            | Shared — all specialists see same | Scoped — child gets narrow briefing   |
| Result handling    | Parent synthesizes all outputs    | Child returns synthesized handoff     |
| When to use        | "Do these 3 things in parallel"   | "This sub-problem needs its own plan" |
| Complexity profile | Horizontal decomposition          | Vertical decomposition                |

### Interaction with Mode System

| Mode  | Recursive Behavior                                                   |
| ----- | -------------------------------------------------------------------- |
| fein  | Encouraged for complex sub-problems that pass the "when to use" test |
| sonar | Discouraged — research tasks rarely need sub-orchestration           |
| blitz | Forbidden — recursion adds overhead; flat delegation is faster       |

### How the Sub-Orchestrator Knows Its Depth

The depth must be communicated in the `task()` call, not derived from the environment. The briefing format includes `[RECURSION DEPTH: N]` as the first line after the briefing header. The sub-orchestrator checks this value before deciding whether to self-delegate further.

At depth 1 (child of parent), the sub-orchestrator can self-delegate to depth 2. At depth 2 (grandchild), the sub-orchestrator's prompt says "You are at maximum recursion depth. Do NOT self-delegate — use flat delegation only."

This is purely prompt-level. There is no plugin code that reads or enforces the depth counter.

### Safety and Escalation

| Failure Mode         | Guard                                       |
| -------------------- | ------------------------------------------- |
| Depth limit exceeded | Prompt rule: "At depth 2, do NOT delegate"  |
| Runaway sub-problem  | Iteration limits per sub-agent (ADR-004)    |
| Cost overrun         | Cost guard: ask user if >3 specialist calls |
| Stale sub-result     | Parent verifies handoff against criteria    |
| Context leak         | Briefing format scopes context explicitly   |

## Consequences

### Positive

- Complex tasks can be decomposed into independently orchestrated sub-problems
- Sub-results are synthesized at the child level, reducing parent context burden
- Depth limit of 2 safely covers parent → child decomposition without infinite regression
- Context scoping via briefing format prevents pollution across sub-problems
- Existing flat delegation is undisturbed — recursion is opt-in, not the default
- Complements parallel fan-out: sibling fan-out for independent work, recursion for nested work
- Minimal plugin code change — only the one-line allowlist addition in frontmatter

### Negative

- No programmatic depth enforcement — depends on prompt marker `[RECURSION DEPTH: N]` being followed
- Token cost per self-delegation is significant (sub-orchestrator session + specialist calls)
- Briefing format adds overhead: the parent must distill context, not just forward it
- Handoff verification requires the parent to re-check sub-problem results, adding synthesis work
- LLM may self-delegate when flat delegation would suffice (false positives)

### Risks

- **Sub-orchestrator ignores depth limit**: the model may self-delegate despite the "depth 2: do not delegate" rule. Mitigation: the prompt rule is marked `!!!` for criticality; the cost guard includes `question()` for unclear cases; at worst the sub-orchestrator attempts a depth-3 delegation and the user catches it in the escalated output.

- **Context distillation loss**: the parent may omit critical context when scoping the briefing, causing the sub-orchestrator to make wrong decisions. Mitigation: the handoff verification step catches mismatches between the sub-result and the parent's success criteria.

- **Orchestrator as bottleneck**: if the parent must verify every sub-handoff, recursion adds verification overhead instead of reducing it. Mitigation: the parent verifies against success criteria only — it doesn't re-run the sub-problem's work. Verification is a quick boundary check.

- **Sub-problem scope creep**: a sub-orchestrator may expand its scope beyond the briefing's boundary. Mitigation: the briefing format has an explicit "Boundary" section. The sub-orchestrator's prompt includes "Stay within your scoped boundary — do not expand."

- **Cumulative LLM instruction-following risk**: ADR-010, ADR-011, and ADR-012 all rely on LLM instruction-following without structural enforcement. Each individually is a reasonable trade-off, but collectively they increase the orchestrator's prompt size and may create rule-conflict fatigue. Mitigation: prompt rules are cross-referenced and use consistent formatting (`!!!` markers, standard escalation patterns); periodic prompt audits should review for redundancy and conflict.

### What We Avoid

- **Unlimited recursion depth** — depth limit of 2 is enforced by prompt instruction.
- **Shared context across recursion levels** — the sub-orchestrator receives a scoped briefing, not the full parent context.
- **No handoff verification** — the parent verifies the sub-orchestrator's handoff against success criteria before accepting the result.

## References

- [Learning to Orchestrate Agents in Natural Language with Reinforcement Learning](https://arxiv.org/abs/2512.04388) — Conductor: RL-trained orchestrator with recursive topologies (ICLR 2026)
- ADR-002: Plugin Architecture — Pure Plugin, Markdown Agents, 2 Hooks
- ADR-004: Agent Prompt Template — 4-Bucket Skills, 5-Section Handoff, Iteration Limits, Rules Bullets
- ADR-008: Keyword-Triggered Workflow Modes — Hybrid Hook + Prompt, Denylist Config (Parallel Fan-Out pattern)
- ADR-011: Iterative Think-Verify Cycles (complementary multi-turn pattern for sub-problem quality gating)

## Date

2026-06-22
