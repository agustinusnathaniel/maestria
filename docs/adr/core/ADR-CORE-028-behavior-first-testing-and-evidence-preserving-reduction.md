# ADR-CORE-028: Behavior-First Testing and Evidence-Preserving Reduction

## Status

Accepted (2026-09-24). Confidence: High. Correction (2026-09-28): [scripts/check-sync](../../../scripts/check-sync) regenerates expected projections and detects content differences, including generated provenance headers, so per-package prose assertions over those headers add no separate contract. Condensed 2026-10-03; the decision remains in force.

## Context

Earlier testing guidance protected observable behavior but did not require selecting evidence before implementation. Parallel guidance left room for post-code unit tests, duplicate bug-fix tests, and prose assertions that could not establish model behavior across hosts.

This decision sets the shared testing policy. It does not add test infrastructure or runtime controls.

## Decision

The binding cross-platform contract lives in [the canonical agent rules](../../../packages/core/agent-directives/rules.md); definitions, procedures, and examples live in [Testing Philosophy](../../testing.md).

- Before production code, state the observable contract and acceptance evidence, select the test boundary, and write selected behavior tests first. Never write unit tests after implementation.
- For a bug fix, run existing behavior tests first. Add a regression test only for a genuine gap; the new test must fail before the fix and catch the same failure if it returns.
- For a complex feature, strongly prefer E2E as the sole feature-testing mechanism. Each E2E test must leave a verifiable, repeatable artifact with a stable location, reproduction steps, and expected signal. Classify UI evidence separately.
- If a system must be tested in isolation, inventory its applicable failure modes before tests or code, including expected behavior, planned check, and evidence for each. Derive tests from that inventory.
- Keep relevant lint, typecheck, build, sync, and existing package checks as repository gates. Host permissions and authorization still govern production access, data changes, and consequential side effects.
- Keep checks for machine-readable contracts, manifests and file layout, safety and authorization boundaries, host-specific adapters, and actual executable behavior.
- Exact wording and heading order are not behavioral evidence. Use sync checks for generated projections, executable tests for runtime contracts, and [directive change review](../../directive-change-review.md) for model behavior. Prose pins do not prove cross-host model outcomes.
- Reject tautological and change-detector tests; they protect implementation shape instead of observable behavior.

## Non-Goals

- No runtime enforcement, test harness, host permission, or sandbox is introduced.
- Simple or deterministic work does not require E2E testing.

## Consequences

Pre-code selection, E2E artifacts, and isolated-system inventories add upfront work while making expected behavior and evidence easier to inspect. Removing prose pins loses a cheap wording-drift signal; representative scenario review remains necessary for model behavior. Host outcomes may vary, and this methodology does not guarantee them.

## Alternatives Considered

- Keep test selection implicit: rejected because it leaves timing and evidence boundaries unclear.
- Require unit tests for every component or coverage target: rejected because it rewards implementation-shaped checks.
- Require E2E for every task: rejected because simple deterministic checks and isolated-system cases need proportionate boundaries.
- Keep exact-wording pins as primary preservation evidence: rejected because harmless edits break them and they cannot prove model behavior.
- Keep the shared policy only in project-local rules: rejected because the contract applies across platform projections.

## Supersession

This decision narrows [ADR-CORE-019](ADR-CORE-019-directive-simplification.md) where its earlier guidance allowed regression tests without a preidentified behavior gap or treated prose pins as general preservation evidence. CORE-019's other decisions remain in force.

## Date

2026-09-24
