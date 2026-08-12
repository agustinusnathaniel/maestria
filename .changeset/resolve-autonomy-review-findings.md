---
'@maestria/core': patch
'@maestria/claude-code': patch
'@maestria/cursor': patch
'@maestria/hermes': patch
'@maestria/kimi-code': patch
'@maestria/omp': patch
'@maestria/opencode': patch
'@maestria/pi': patch
---

fix: make default route budgets explicit and dispatch recovery finite

Canonical directive repair: every default route now has an explicit finite shape
(`direct` zero dispatches, `focused` one owning specialist plus its required
reviewer, `full` one thinker, one integrated worker batch, one general reviewer,
`sonar` one owning read-only specialist plus at most one distinct read-only
specialist) with one initial dispatch and at most one recovery dispatch per
planned child, counted internally without numeric budget fields.

- A failed delegation is recorded as terminal `blocked` or `failed` before any
  recovery; recovery is a new attempt for the same child, not dependent work,
  and shares the child's single recovery allowance with the changed-brief rule.
  If recovery fails, preserve the terminal delta and stop dependent work while
  independent read-only work continues.
- Transient handling is finite and cancellation-safe: provider overload, header
  timeouts, transport failures, and runtime-classified infrastructure
  cancellations get at most one bounded retry with backoff or reduced
  concurrency; user-requested or platform-intentional cancellation is terminal
  and never retried or continued. Transient attempts consume no repair/review
  budget but still count against dispatch-attempt accounting.
- Repair rounds (3 default, hard cap 5 with observable progress) stay separate
  from dispatch recovery; orchestrator session flow and the iteration-limits and
  composition summaries mirror the same semantics.
