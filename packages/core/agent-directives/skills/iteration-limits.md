# Iteration Limits

- Define a verifiable termination condition before looping.
- Set a practical repair bound, normally three rounds. Extend only when the
  latest attempt shows observable progress; never silently reset the bound.
- Repeated causes, repeated findings, restored diffs, or no new evidence mean
  non-progress. Change strategy or escalate rather than retrying unchanged.
- Stop on safety ambiguity, authorization boundaries, or unresolved review
  blockers. Report: `Tried X, Y, Z. Blocked by [cause]. Need [input] to
  proceed.`
