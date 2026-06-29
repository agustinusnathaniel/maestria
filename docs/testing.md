# Testing Philosophy

## Test from contracts, not implementation

Design tests from observable behavior, not internal structure. Prefer the highest practical interface: user-facing behavior for public APIs, explicit consumer-facing behavior for stable internal boundaries. Testing private helpers directly through their public consumer is preferred over isolated unit tests.

## Keep regression tests intentional

Do not add a regression test for every fix. Before adding coverage, ask:

- Does this protect a durable contract or meaningful failure mode?
- Is the test likely to catch a plausible future regression?

Skip tests for incidental implementation details, rare edge cases, and fixes whose corrected form is the natural result of the surrounding design. Every test makes a behavior harder to change - add one only when that constraint is valuable.

## Avoid mocks

Prefer testing through real lightweight boundaries, small explicit fakes for injected interfaces, or narrow transport fixtures. If existing design forces broad mocking, treat that as a design smell - record the cleanup opportunity and document the temporary mock in the test.

## Test structure

- Use `describe`/`it` with explicit names: `it("does X when Y")` so the condition and expected behavior are clear from the name alone.
- Prefer explicit, self-contained `it()` blocks. Copy-paste is acceptable when it keeps each behavior readable in isolation.
- Avoid `it.each()` unless the cases are genuinely linear.
- Avoid complex or nested test helpers.
