---
name: iteration-limits
description: >-
  The iteration-limit pattern with verifiable termination and escalation format.
  Load when defining termination conditions for a loop, or when a loop is at risk of
  running too long.
---


<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

# Iteration Limits

The global `rules.md#bounded-autonomy` contract owns repair budgets and progress-sensitive stopping. This skill is only a concise projection:

- Define a **Verifiable Termination Condition** before looping.
- Count every attempt against the applicable hard limit; default repair budget is 3 rounds and may extend one round at a time to 5 only with observable progress.
- Stop on non-progress, safety ambiguity, or unresolved review floors. Escalate: `Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.`
- Declare and decrement finite route and child-task budgets before dispatch; never silently reset them.
- Empty or blocked output is non-progress: allow at most one changed-brief recovery, then trip the circuit breaker and escalate with the structured delta.
