# Testing Philosophy

## Test from contracts, not implementation

Design tests from observable behavior, not internal structure. Prefer the highest practical interface: user-facing behavior for public APIs, explicit consumer-facing behavior for stable internal boundaries. Testing private helpers directly through their public consumer is preferred over isolated unit tests.

Treat the tested unit or stack as a black box. Pass inputs through its public boundary and assert the resulting behavior. A test may inspect an interaction with a genuinely external seam, such as a network, clock, or randomness source, but broad mocks of the project's own logic are a design smell. Prefer real lightweight boundaries or small explicit fakes for injected host APIs.

## Keep regression tests intentional

Do not add a regression test for every fix. Before adding coverage, ask:

- Does this protect a durable contract or meaningful failure mode?
- Is the test likely to catch a plausible future regression?

Skip tests for incidental implementation details, rare edge cases, and fixes whose corrected form is the natural result of the surrounding design. Every test makes a behavior harder to change - add one only when that constraint is valuable.

## Avoid mocks

Prefer testing through real lightweight boundaries, small explicit fakes for injected interfaces, or narrow transport fixtures. If existing design forces broad mocking, treat that as a design smell - record the cleanup opportunity and document the temporary mock in the test.

## Match verification to risk

Use the cheapest verification that gives meaningful confidence. Extend an existing unit or integration suite when it covers the contract; use direct runtime or browser checks when those better represent the acceptance boundary. Do not add a blanket end-to-end requirement when a deterministic package or handler check is stronger and easier to maintain.

Every asynchronous operation started by a test must have an awaitable completion boundary. Avoid fire-and-forget work whose assertions race against unfinished work.

## Test structure

- Use `describe`/`it` with explicit names: `it("does X when Y")` so the condition and expected behavior are clear from the name alone.
- Prefer explicit, self-contained `it()` blocks. Copy-paste is acceptable when it keeps each behavior readable in isolation.
- Avoid `it.each()` unless the cases are genuinely linear.
- Avoid complex or nested test helpers.
- Keep tests isolated and avoid overlapping assertions for the same behavior. Consolidate duplicated setup or assertions only when the resulting test still names and protects a meaningful contract.
- Prefer plain assertions with useful failure context over assertion DSLs or test wrappers that add vocabulary without signal.

## New test files are opt-in

Do not create a new test file by default when implementing, fixing, refactoring, verifying, or testing something. First consider an existing suite, direct runtime or browser verification, and whether the behavior is a durable contract. If a new file would materially improve regression protection, explain the concrete benefit and ask for approval before creating it.
