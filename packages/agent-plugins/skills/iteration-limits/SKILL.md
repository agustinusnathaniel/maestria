---
description: Bound repair and stop repeated work using verifiable termination criteria
name: iteration-limits
---

<!-- Generated from packages/core/agent-directives by scripts/sync-consolidated-plugin.ts. Do not edit directly. -->

# Repair Budget

Before looping, define a verifiable termination condition. Default to one independent review and, only when blockers exist, one repair/re-review pass; allow another pass only when a named blocker remains unresolved or the repair introduced a new material regression. No more than three repair/re-review passes apply to the same user outcome across all delegations; do not reset a review or repair budget by relabelling findings or splitting scope.

Only `[fix]` blockers are repair work; record adjacent findings as follow-ups instead of broadening the loop. After targeted validation or re-review shows no blocker, run final verification and stop; do not restart the full review for a small fix.

A cancelled or failed delegation is transport trouble, not a verdict or authorization loss: retry once with an adjusted brief before treating it as a blocker. User-initiated or intentional platform cancellation is terminal.

# Fail-Loud Repair

Repair while making observable progress. Repeated causes, restored diffs, or no new evidence mean change strategy (load `diagnose` for root-cause uncertainty and `architecture-plan` for design uncertainty), then stop if progress still fails. Do not loop silently: report `Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.`
