# ADR-CORE-023: Evidence-Led Directives and Proportionate Verification

## Status

Accepted (2026-09-06)

## Context

An audit prompted by [Eric Provencher's article on skills and prompts](https://x.com/pvncher/status/2095991462416490862) found Maestria's direct-route policy conflicting with specialist instructions: builders could select one slice without assigning the remainder, diagnosis demanded Git-history and repository-wide searches regardless of symptom, local policy required permission to create a test file, and delivery and specialist checks overlapped.

The article motivates reassessing accumulated instructions, but Maestria supports multiple models and hosts; removing a constraint requires a clear replacement contract, not an assumption that every model behaves like Astra.

## Goals

- Keep specialists accountable for complete assigned outcomes.
- Match investigation, verification, formatting, and skill loading to the task.
- Allow in-scope coverage and routine dependencies without procedural approval gates.
- Keep downstream global instructions independent of Maestria paths.
- Preserve independent review, bounded repair, host permissions, and PR-based delivery where supported.

## Non-Goals

- No changes to host tool permissions, role authority, mode lifetimes, or protected-branch policy.
- No reduction of repository delivery gates or automatic approval of production, destructive, or security-boundary operations.
- No new skills, runtime components, or claims of measured model-performance improvement.

## Decision

1. Builders complete the assigned outcome and return decomposition with ownership for the remainder; one selected slice cannot represent the whole assignment.
2. Diagnosis follows evidence: history and similar-site searches are conditional aids, and an old line does not establish a failure's origin. Repair remains conditional on the assignment and host authority.
3. Specialists choose checks that establish acceptance; the delivery owner runs repository gates on the integrated result and reuses valid results. Read-only audits and plans end at their artifact with relevant verification, not implementation gates.
4. New regression-test files are allowed when they materially protect an in-scope contract; explain the benefit rather than asking because coverage needs a file. Necessary dependencies are evaluated in scope; material architecture, licensing, cost, security, and scope changes still escalate.
5. Writer formatting and architect comparisons follow the needed information. General reviewers weigh applicable risk categories instead of a verdict per category. Specialist skill loading is conditional on task and availability.
6. Global source-ownership guidance refers to the consuming project's authoritative source and generation workflow; Maestria paths and sync commands stay in repository instructions. Visual PR evidence mechanics live in a conditional orchestrator reference using the delivery tool's current capabilities, not a cached CLI version or syntax.
7. Consolidate root instructions and correct the Pi boundary: core library modules stay browser-safe; the Pi runtime adapter may use Node.js APIs.

This supersedes procedural test-file approval and unconditional multi-command repetition and refines ADR-CORE-019's single-home and low-ceremony policies without changing its PR-delivery or bounded-repair contracts. Constraints repeated in independently loaded specialist prompts stay where standalone reliability requires them.

## Consequences

- Agents stop prematurely or investigate irrelevantly less often.
- Users retain control over consequential changes while routine implementation continues.
- Reference duplication and stale platform-specific instructions are reduced.
- Models must exercise more judgment; weaker models may need targeted guidance if evaluations show regressions.
- Text-contract tests and sync checks protect explicit requirements but cannot establish cross-host model behavior.

## Assumptions

- [verified] The reviewed source and merged documentation PR agree on the affected directives; existing sync configs derive downstream agent and rule files from them.
- [verified] Pi runtime source imports Node.js modules; the old instruction prohibiting them was stale.
- [inferred] Conditional investigation and skill loading will reduce unnecessary work; this is not a measured latency or quality result.

## Alternatives Considered

- **Astra-only instructions:** rejected because the canonical methodology supports other models and hosts.
- **Delete specialist methodology:** rejected because role ownership, acceptance, and handoff contracts remain useful.
- **Add a new delivery skill:** deferred; an in-file conditional reference avoids another globally advertised skill and changes to every projection's resource packaging.

## Verification

Regenerate with `scripts/sync-all`, verify with `scripts/check-sync`, and run the core directive tests and repository quality pipeline. Review generated adapters for preserved host boundaries and live transforms. Before claiming behavioral gains, compare old and new directives across small fixes, uncertain regressions, multi-file assignments, documentation edits, and delivery tasks on representative model tiers, checking completion, unnecessary approvals, investigation scope, and verification effort.

## Rollback

Revert canonical and local-policy changes together, then regenerate projections and run the sync check; reverting generated files alone leaves them inconsistent with their sources.

## Related Decisions

- [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): canonical sync ownership.
- [CORE-019](ADR-CORE-019-directive-simplification.md): terminal-artifact delivery, bounded repair, and single-home contracts.

## Date

2026-09-06
