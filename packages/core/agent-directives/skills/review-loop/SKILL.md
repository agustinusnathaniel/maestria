---
description: Brief the independent reviewer, triage its findings, and bound repair and re-review. Use when sending a change to review, when review findings return, or when deciding whether another repair or review pass is allowed.
name: review-loop
---

# Review Loop

## Brief the reviewer

Brief the reviewer with the original goal, acceptance criteria, binding constraints, and the pushed head or commit range, never your own assessment of it, and verify each factual premise in the brief. An empty, malformed, unavailable, or blocked review is not approval: after one recovery attempt, preserve the delta and stop dependent work.

## Triage findings

Triage in order:

1. Boundary-changing or safety findings stop for authorization.
2. Design-level blockers, and review that keeps reopening after two rounds of point fixes, trigger one reshaped design with `architecture-plan` covering every open point, not more patches.
3. In-scope `[fix]` findings get a bounded repair here plus targeted blind re-review. Only `[fix]` blockers are repair work.
4. Out-of-scope, platform, and adjacent findings become follow-ups.

`[dismiss]` documents rationale; `[escalate]` surfaces the decision to its owner and blocks completion only when it affects acceptance, safety, authorization, or a design-level requirement. A later cleanup or trim never undoes an earlier accepted review fix.

## Bound the passes

Before looping, define a verifiable termination condition. Default to one independent review and, only when blockers exist, one repair/re-review pass; allow another pass only when a named blocker remains unresolved or the repair introduced a new material regression. No more than three repair/re-review passes apply to the same user outcome across all delegations; do not reset a review or repair budget by relabelling findings or splitting scope. After targeted validation or re-review shows no blocker, run final verification and stop; do not restart the full review for a small fix.
