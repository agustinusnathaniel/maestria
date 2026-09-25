# Testing Philosophy

## Purpose

This guide defines how Maestria selects tests before implementation and verifies observable behavior without turning tests into implementation-shape checks. The canonical always-loaded contract lives in `packages/core/agent-directives/rules.md`; this guide supplies the definitions, workflow, and examples behind that contract.

## Audience

Contributors, builders, diagnosticians, and reviewers who choose or assess tests for a change.

## Test from contracts, not implementation

Design tests from observable behavior, not internal structure. Prefer the highest practical interface: user-facing behavior for public APIs and explicit consumer-facing behavior for stable internal boundaries. Test private helpers through their public consumer, not isolated unit tests.

Treat the tested unit or stack as a black box: pass inputs through its public boundary and assert resulting behavior. A test may inspect an interaction with a genuinely external seam, such as a network, clock, or randomness source, but broad mocks of the project's own logic are a design smell. Prefer real lightweight boundaries or small explicit fakes for injected host APIs.

## Know what makes a test harmful

| Term | Meaning |
| --- | --- |
| Tautological test | A test that repeats the implementation or asserts a result that cannot fail independently of the code it is meant to check. |
| Change-detector test | A test that fails on harmless implementation changes while the observable behavior remains correct. |
| Genuine behavior gap | No existing behavior test fails before a fix or would catch the same failure if it returned. |
| Verifiable, repeatable artifact | An inspectable result with a stable location, a deterministic reproduction procedure, and an expected success or failure signal. |

Tautological and change-detector tests are harmful. They add maintenance cost without protecting the behavior that matters.

## Select tests before implementation

Before writing production code:

1. State the observable contract, failure conditions, and acceptance evidence.
2. Decide whether the feature is complex. For a complex feature, strongly prefer end-to-end (E2E) tests as the sole feature-testing mechanism. Do not add a parallel unit suite after implementation.
3. If the system must be tested in isolation, complete the failure-mode inventory before writing tests or code.
4. For a bug fix, run the existing behavior test first. Add a regression test only when there is a genuine gap in behavior testing, and write it before the fix when a new test is needed.
5. Write the selected behavior tests first, then write the implementation.
6. Run the selected tests and the required repository gates.

**Never write unit tests after writing code.** If a unit test is needed, select it from the pre-code contract or the isolated-system failure-mode inventory and write it before the implementation it exercises.

## Complex features and E2E artifacts

For a complex feature, E2E is the preferred and default feature-testing mechanism. Existing lint, typecheck, build, sync, and package checks remain verification gates, but they are not substitutes for pre-code test selection and do not authorize a post-code unit suite.

At the end of each E2E test, produce a verifiable and repeatable artifact. The artifact can be a fixture, report, screenshot, captured output, or another inspectable result. Record its path, how to regenerate it, and the expected signal. This test artifact is distinct from rendered UI evidence required for a visual change; classify visual evidence separately.

## Bug fixes and regression coverage

Do not create a regression test for every fix. A regression test is justified only when existing behavior testing has a genuine gap. The test must be capable of failing before the fix and catching the same failure if it returns. A test that merely repeats the fix, restates the implementation, or duplicates an existing behavior check is harmful.

## Isolated systems

Isolation is an exception, not a shortcut. If a system must be tested separately, first write every way it could fail, then write the code.

The failure-mode inventory must cover the applicable cases before implementation:

- Invalid, missing, boundary, and malformed inputs.
- State, lifecycle, persistence, and recovery transitions.
- Dependency, transport, serialization, and external-seam failures.
- Concurrency, timing, retries, cancellation, and resource exhaustion.
- Error handling, rollback, partial writes, and idempotence.
- Authorization, security boundaries, and sensitive-data handling.
- Observable output, diagnostics, and the artifact that proves each result.

Add system-specific failure modes to the inventory. For each mode, record the input or state, expected observable behavior, planned test or check, and artifact. Write the tests from that inventory first, then write the code. This exception does not authorize a unit test after implementation.

## Avoid mocks

Prefer testing through real lightweight boundaries, small explicit fakes for injected interfaces, or narrow transport fixtures. If existing design forces broad mocking, record the cleanup opportunity and document the temporary mock in the test.

## Verification gates

Use the cheapest verification that gives meaningful confidence after the behavior test has been selected. Lint, typecheck, build, sync, and existing package checks remain required verification gates for the affected repository. They do not replace the pre-code selection of behavior tests, and they do not justify adding unit tests after code.

Every asynchronous operation started by a test must have an awaitable completion boundary. Avoid fire-and-forget work whose assertions race against unfinished work.

## Test structure

- Use `describe`/`it` with explicit names: `it("does X when Y")` so the condition and expected behavior are clear from the name alone.
- Prefer explicit, self-contained `it()` blocks. Copy-paste is acceptable when it keeps each behavior readable in isolation.
- Avoid `it.each()` unless the cases are genuinely linear.
- Avoid complex or nested test helpers.
- Keep tests isolated and avoid overlapping assertions for the same behavior. Consolidate duplicated setup or assertions only when the resulting test still names and protects a meaningful contract.
- Prefer plain assertions with useful failure context over assertion DSLs or test wrappers that add vocabulary without signal.

## New test files need a preidentified benefit

Prefer an existing suite when it covers the contract. Create a new test file only when a preidentified behavior gap or durable in-scope contract materially needs protection and the existing suite cannot provide it. Explain the benefit. No additional approval is needed solely for the file. Test execution still follows host controls and requires applicable authorization for production access, destructive operations, or other consequential side effects.

## Dated evidence

- 2026-09-24: `[verified]` The canonical testing contract is projected from `packages/core/agent-directives/rules.md`; detailed contributor guidance remains in this file.
- 2026-09-24: `[verified]` The current repository requires sync, build, lint, type, and workspace checks in addition to behavior tests.

## Next step

Use this guide when selecting coverage, reviewing a bug fix, or planning an isolated system. Keep the canonical rule concise and use this guide for the rationale and examples.
