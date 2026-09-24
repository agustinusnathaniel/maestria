# ADR-CORE-028: Behavior-First Testing and Evidence-Preserving Reduction

## Status

Accepted (2026-09-24)

## Context

Maestria's existing testing guidance protects observable behavior, intentional regression coverage, real boundaries, and host authorization. It also leaves several loopholes:

- The global testing rule allows a new test file when it materially protects a contract, but does not require test selection before implementation.
- `docs/testing.md` recommends the cheapest meaningful verification and rejects a blanket end-to-end requirement, which leaves complex features open to parallel post-code unit suites.
- The contributor workflow says to add tests for new behavior without stating when the test is selected or written.
- The directive review guide describes exact wording and order pins as preservation evidence, even though prose pins can fail on harmless rewrites and cannot establish cross-host model behavior.
- A platform-specific Kimi routing table says that diagnosis means writing a regression test, without requiring a genuine behavior gap.

These gaps conflict with the desired policy: tautological and change-detector tests are harmful, bug fixes do not need duplicate regression tests, unit tests must not be written after code, complex features should use E2E as the sole feature-testing mechanism, and isolated systems need a failure-mode inventory before implementation.

This decision changes methodology guidance. It does not change host permissions, runtime enforcement, or the safety and review floors.

## Goals

- Put the binding testing principles in one concise, always-loaded canonical source.
- Select behavior tests before production code and make complex-feature E2E evidence explicit.
- Preserve genuine behavior-gap coverage for bug fixes.
- Require a complete failure-mode inventory before isolated-system implementation.
- Keep lint, typecheck, build, sync, and existing package checks as verification gates.
- Retire prose-only text pins that maintain implementation wording instead of durable behavior.
- Preserve safety, authorization, host controls, independent review, visual-evidence classification, and canonical sync.

## Non-Goals

- No new runtime test harness, host permission, sandbox, or enforcement mechanism.
- No removal of existing package checks, build checks, or deterministic sync checks. The integrated reduction retires only pure prose, heading/order, and change-detector assertions; durable pre-existing contract cases are restored in the focused directive suite.
- No universal E2E requirement for simple or deterministic work.
- No claim that directive text guarantees model behavior on every host.
- No change to the canonical sync pipeline or generated-output ownership model.

## Decision

### 1. One canonical testing contract

`packages/core/agent-directives/rules.md` is the single always-loaded source for cross-platform testing behavior. The rule is concise and states that:

- Tautological and change-detector tests are harmful.
- Bug-fix regression tests require a genuine gap in behavior testing.
- Unit tests must not be written after code.
- E2E is strongly preferred as the sole feature-testing mechanism for complex features.
- Every E2E test ends with a verifiable and repeatable artifact.
- An isolated system requires every failure mode to be written before the code.

`docs/testing.md` supplies definitions, workflow, and examples. Root instructions and contributor guidance point to these sources instead of maintaining separate behavioral contracts.

### 2. Pre-code selection and bug-fix discipline

Before writing production code, state the observable contract, select the test boundary, and identify the acceptance evidence. A new unit test must come from the pre-code contract or a failure-mode inventory. It is never an after-the-fact coverage task.

For a bug fix, run the existing behavior test first. Add a regression test only when the existing behavior suite has a genuine gap and the new test would fail before the fix and catch the same failure if it returned. Do not add a test that repeats the fix or duplicates an existing behavior check.

### 3. Complex features and E2E artifacts

For a complex feature, strongly prefer E2E tests as the sole feature-testing mechanism. Do not add a parallel unit suite after implementation. Lint, typecheck, build, sync, and existing package checks remain verification gates, but they do not select the feature test and do not authorize post-code unit tests.

At the end of each E2E test, produce an inspectable artifact with a stable location, deterministic reproduction procedure, and expected signal. A test artifact is distinct from rendered UI evidence, but visual evidence classification remains mandatory for rendered changes.

### 4. Isolated-system failure-mode inventory

Isolation is an explicit exception, not a coverage shortcut. Before writing tests or code for an isolated system, write every way it could fail. The inventory must cover the applicable cases:

| Failure-mode class | Questions to answer |
| --- | --- |
| Inputs | What happens for missing, invalid, malformed, and boundary inputs? |
| State and lifecycle | Which transitions, persistence failures, recovery paths, and partial writes matter? |
| Dependencies and boundaries | How do transport, serialization, and external services fail? |
| Concurrency and time | How do retries, cancellation, races, timeouts, and resource exhaustion behave? |
| Errors and recovery | Does the system fail closed, roll back, and leave an observable diagnostic? |
| Authorization and security | Which permission and sensitive-data boundaries must remain protected? |
| Evidence | What result and artifact prove each expected behavior? |

Add system-specific failure modes. For each mode, record the input or state, expected observable behavior, planned test or check, and artifact. Write the tests from the inventory first, then write the code. This exception never permits a unit test after implementation.

### 5. Verification gates remain gates

The policy does not replace repository verification. Lint, typecheck, build, sync, and existing package checks continue to run when relevant. They are evidence about the boundaries they exercise, not substitutes for pre-code test selection. Host authorization and approval controls still apply to tests that access production, mutate data, or create consequential side effects.

### 6. Retire prose-only text pins

Exact wording, heading-order, and repeated-phrase assertions are not acceptance evidence for behavior guidance. A prose-only text pin can fail after a harmless rewrite and can encourage duplication across generated projections.

The integrated reduction retires the prose-only, pure heading/order, and change-detector assertions in `packages/core/tests/directives.test.ts` and restores nine durable pre-existing cases in the focused suite, including the project-workflow contract folded into the host-authority case. It does not add a new test case or testing mechanism.

Retain tests that protect durable machine-readable contracts, sync byte identity, generated provenance, file layout, manifests, safety and authorization boundaries, host-specific adapters, and actual executable behavior. Retain scenario review for model behavior. Text tests must not be used to claim that a directive produces a particular model outcome on every host.

### 7. Preserve the existing floors

This ADR does not weaken:

- Safety and authorization precedence.
- Host tool permissions and runtime boundaries.
- Independent maker and checker review.
- Required visual evidence for rendered changes.
- Required repository and sync checks.
- Canonical source ownership and generated-projection verification.

The Kimi platform-specific routing append must be corrected at its hand-authored sync config. The generated Kimi orchestrator file is regenerated, never edited directly.

### 8. Partial supersession of earlier decisions

This ADR supersedes ADR-CORE-023 in part. Its evidence-led routing and proportionate verification decisions remain, but its allowance for new regression-test files without a preidentified behavior gap is narrowed by the pre-code and genuine-gap rules.

This ADR also narrows ADR-CORE-019's use of text-pinned contracts as a general preservation strategy. Its single-home, bounded-repair, terminal-artifact, and independent-review decisions remain in force.

## Consequences

### Positive

- Less time and maintenance is spent on tautological, duplicate, and implementation-shape tests.
- Complex features receive behavior-level evidence instead of parallel post-code unit suites.
- Bug fixes add coverage only when an existing behavior suite has a real gap.
- Isolated systems receive an explicit failure-mode contract before implementation.
- E2E tests leave inspectable, repeatable evidence.
- Sync, safety, authorization, host-boundary, and independent-review checks remain protected.
- Generated projections have one concise canonical source.

### Negative

- Complex features require more deliberate E2E setup before implementation.
- Isolated-system work requires an upfront failure-mode inventory.
- Existing deterministic checks remain in the pipeline even when they are not the sole feature-test mechanism.
- Removing prose pins reduces a cheap wording signal and requires scenario review for behavior changes.
- The policy is guidance, not runtime enforcement, so hosts can still diverge.

## Assumptions

- `[verified]` The canonical rules file is projected to the global-rule outputs listed in the repository sync configurations.
- `[verified]` The base core directive suite contains prose, heading-order, and change-detector assertions distinct from sync, provenance, manifest, and executable contract checks. The integrated focused suite retains nine durable pre-existing cases, including the project-workflow contract, and retires only pure prose, heading/order, and change-detector pins.
- `[verified]` The repository requires sync, build, lint, type, and workspace checks in addition to behavior tests.
- `[inferred]` E2E artifacts and pre-code failure-mode inventories will improve the practical evidence quality of complex work across supported hosts. This ADR does not claim measured model-performance improvement.

## Alternatives Considered

### Keep the current proportionate policy with a short caveat

Rejected. A caveat would leave post-code unit tests and unconditioned regression-test wording available, and would not define the E2E artifact contract.

### Put the strict policy only in project-local `.maestria/rules.md`

Rejected for this cross-platform methodology change. That file is appropriate for repository-specific overrides, but it cannot provide the canonical behavior projected into published platform packages.

### Require unit tests for every component or coverage target

Rejected. This recreates the harmful tests this ADR removes and rewards implementation-shaped coverage.

### Keep exact wording and order tests as the primary preservation evidence

Rejected. Such tests maintain prose rather than behavior, fail on harmless edits, and cannot establish cross-host model behavior.

### Require E2E tests for every task

Rejected. Deterministic package checks and pre-code isolated-system tests remain necessary for simple work and for systems that cannot be observed through a user-facing E2E boundary.

## Verification

Run the following after the source changes:

```bash
bash scripts/sync-all
bash scripts/sync-all
bash scripts/check-sync
pnpm --filter @maestria/core exec vitest run tests/directives.test.ts
pnpm --filter @maestria/core exec vitest run tests/sync.test.ts tests/roster.test.ts
pnpm --filter @maestria/docs test
pnpm --filter @maestria/docs build
git diff --check
```

Confirm that the second sync run produces no additional diff. Inspect every listed global-rule projection and the Kimi orchestrator projection. Use the resulting focused directive contract suite for durable contract verification; do not rely on the retired pure-prose cases or a wholesale base-revision suite.

For behavior validation, compare baseline and candidate directives under controlled conditions using the scenarios in `docs/directive-change-review.md`. Report machine-readable check results separately from scenario outcomes. Visual evidence is not applicable because the changed surface contains no rendered UI or publication flow.

## Rollback

Revert the canonical rules, aligned hand-authored guidance, Kimi sync config, ADR implementation changes, and changeset together. Then run `bash scripts/sync-all` and `bash scripts/check-sync`. Never revert generated outputs alone. Keep this ADR as the historical record of the decision, and remove the changeset if no published behavior change remains.

## Related Decisions

- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): canonical source and generated projections.
- [ADR-CORE-019](ADR-CORE-019-directive-simplification.md): single-home contracts, bounded repair, and terminal artifacts.
- [ADR-CORE-023](ADR-CORE-023-evidence-led-directives.md): evidence-led routing and proportionate verification.
- [ADR-CORE-003](ADR-CORE-003-agent-conventions.md): `!!!` markers and directive conventions.
- [ADR-CORE-022](ADR-CORE-022-agent-plugins-portable-projection.md): portable global-rules projection.

## Date

2026-09-24
