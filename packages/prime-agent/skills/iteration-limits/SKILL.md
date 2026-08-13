---
name: iteration-limits
description: |-
  The iteration-limit pattern with verifiable termination
  and escalation format.
  Load when defining termination conditions for a loop, or when a loop is at risk
  of running too long.
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

# Iteration Limits

- Define a verifiable termination condition before looping.
- Set a practical repair bound, normally three rounds. Extend only when the
  latest attempt shows observable progress; never silently reset the bound.
- Repeated causes, repeated findings, restored diffs, or no new evidence mean
  non-progress. Change strategy or escalate rather than retrying unchanged.
- Stop on safety ambiguity, authorization boundaries, or unresolved review
  blockers. Report: `Tried X, Y, Z. Blocked by [cause]. Need [input] to
  proceed.`
