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

- Define acceptance and a verifiable termination condition before looping.
- One independent review is the default. If it finds blockers, allow one repair/
  re-review pass; allow another only when a named blocker remains unresolved or
  the repair introduces a new material regression.
- No more than three repair/re-review passes apply to the same user outcome.
  Count them across delegations and specialist types; never silently reset the
  bound.
- `[fix]` means blocking/material. Minor, speculative, low-confidence, and
  diminishing-return findings are follow-ups, not repair work.
- After targeted validation/re-review shows no blocker, run final verification
  and stop. Do not restart the full review for a small fix.
- Repeated causes, repeated findings, restored diffs, or no new evidence mean
  non-progress. Change strategy or escalate rather than retrying unchanged.
- Do not broaden the outcome merely because review found adjacent work. Keep
  the accepted slice deliverable and record adjacent findings as follow-ups
  unless they invalidate acceptance or trigger a safety/authorization stop.
- Stop on safety ambiguity, authorization boundaries, or unresolved review
  blockers. Report: `Tried X, Y, Z. Blocked by [cause]. Need [input] to
  proceed.`
