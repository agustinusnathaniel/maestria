# Iteration Limits

The global `rules.md#bounded-autonomy` contract owns repair budgets and progress-sensitive stopping. This skill is only a concise projection:

- Define a **Verifiable Termination Condition** before looping.
- Count every attempt against the applicable hard limit; default repair budget is 3 rounds and may extend one round at a time to 5 only with observable progress.
- Stop on non-progress, safety ambiguity, or unresolved review floors. Escalate: `Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.`
