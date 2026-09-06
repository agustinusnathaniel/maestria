# ADR-CORE-023: Evidence-Led Directives and Proportionate Verification

## Status

Accepted (2026-09-06)

## Context

An audit prompted by [Eric Provencher's article on skills and prompts](https://x.com/pvncher/status/2095991462416490862) found that Maestria's direct-route policy conflicted with several specialist instructions. Builders could select one slice without assigning the remainder, diagnosis required Git-history and repository-wide searches regardless of the symptom, and local policy required permission solely to create a test file. Delivery and specialist checks also overlapped.

The article motivates reassessing accumulated instructions, but Maestria supports multiple models and hosts. Removing a constraint requires a clear replacement contract, not an assumption that every model behaves like Astra.

## Goals

- Keep specialists accountable for complete assigned outcomes.
- Match investigation, verification, formatting, and skill loading to the task.
- Permit necessary in-scope coverage and routine dependency choices without procedural approval gates.
- Keep downstream global instructions independent of Maestria's repository paths.
- Preserve independent review, bounded repair, host permissions, and implementation delivery through PR creation where supported.

## Non-Goals

- No changes to host tool permissions, role authority, mode lifetimes, or protected-branch policy.
- No reduction of repository delivery gates or automatic approval of production, destructive, or security-boundary operations.
- No new skills, runtime components, or claims of measured model-performance improvement.

## Decision

1. Builders complete their assigned outcome and return decomposition with ownership for remaining work; a selected slice cannot stand in for the full assignment.
2. Diagnosis follows evidence. History and similar-site searches are conditional aids. An old source line does not establish the origin of a failure. Repair remains conditional on the assignment and host authority.
3. Specialists choose checks that establish acceptance. The delivery owner runs repository gates on the integrated result and reuses valid results. Read-only audits and plans terminate at their requested artifact, with relevant verification rather than implementation gates.
4. New regression-test files are allowed when they materially protect an in-scope contract. Explain the benefit; do not ask merely because coverage needs a new file. Necessary dependencies are evaluated within scope; material architecture, licensing, cost, security, and scope changes still require escalation.
5. Writer formatting and architect comparisons follow the information needed. General reviewers consider applicable risk categories rather than emitting a verdict for each category. Specialist skill loading is conditional on task and availability.
6. Global source-ownership guidance refers to the consuming project's authoritative source and generation workflow. Maestria paths and sync commands remain in repository instructions. Visual PR evidence mechanics live in a conditional orchestrator reference, using the delivery tool's current capabilities rather than a cached CLI version or syntax.
7. Consolidate root instructions and correct the Pi boundary: core library modules stay browser-safe; the Pi runtime adapter may use Node.js APIs.

This supersedes procedural test-file approval and unconditional multi-command repetition in local guidance. It refines ADR-CORE-019's single-home and low-ceremony policies without changing its PR-delivery or bounded-repair contracts. Shared constraints repeated in independently loaded specialist prompts remain where needed for reliable standalone use.

## Consequences

- Agents have fewer reasons to stop prematurely or perform irrelevant investigation.
- Users retain control over consequential changes while routine implementation can continue.
- Reference duplication and stale platform-specific instructions are reduced.
- Models must exercise more judgment about relevant evidence and output structure; weaker models may need targeted guidance if behavioral evaluations show regressions.
- Text-contract tests and sync checks protect explicit requirements, but cannot establish model behavior across hosts.

## Assumptions

- [verified] The reviewed source and merged documentation PR agree on the affected directives. Existing sync configs produce downstream agent/rule files from these sources.
- [verified] Pi runtime source imports Node.js modules; the old repository instruction prohibiting them was stale.
- [inferred] Conditional investigation and skill loading will reduce unnecessary work. This is not a measured latency or quality result.

## Alternatives Considered

- **Astra-only instructions:** rejected because canonical methodology supports other models and hosts.
- **Delete specialist methodology:** rejected because role ownership, acceptance, and handoff contracts remain useful.
- **Add a new delivery skill:** deferred; an in-file conditional reference avoids another globally advertised skill and changes to every projection's resource packaging.

## Verification

Regenerate with `scripts/sync-all`, verify with `scripts/check-sync`, and run the existing core directive tests and repository quality pipeline. Review generated adapters for preserved host boundaries and live text transforms. Before claiming behavioral gains, compare old and new directives on small fixes, uncertain regressions, multi-file assignments, documentation edits, and delivery tasks across representative model tiers. Check completion, unnecessary approvals, investigation scope, and verification effort.

## Rollback

Revert canonical and local-policy changes together, then regenerate projections and run the sync check. Reverting generated files alone would leave them inconsistent with their sources.

## Related Decisions

- [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): canonical sync ownership.
- [CORE-019](ADR-CORE-019-directive-simplification.md): terminal-artifact delivery, bounded repair, and single-home contracts.

## Date

2026-09-06
