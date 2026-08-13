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

- Define a verifiable termination condition before looping.
- Set a practical repair bound, normally three rounds. Extend only when the
  latest attempt shows observable progress; never silently reset the bound.
- The bound applies to the same user outcome, even when work is split across
  more delegations or specialist types. Start a new bound only after recording
  a genuinely new outcome with new acceptance criteria.
- Repeated causes, repeated findings, restored diffs, or no new evidence mean
  non-progress. Change strategy or escalate rather than retrying unchanged.
- Do not broaden the outcome merely because review found adjacent work. Keep
  the accepted slice deliverable and record adjacent findings as follow-ups
  unless they invalidate acceptance or trigger a safety/authorization stop.
- Stop on safety ambiguity, authorization boundaries, or unresolved review
  blockers. Report: `Tried X, Y, Z. Blocked by [cause]. Need [input] to
  proceed.`
