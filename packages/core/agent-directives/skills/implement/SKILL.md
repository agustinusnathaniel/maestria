---
description: Write or change code and tests the way the project already does it. Use before writing or changing code or tests, and when reviewing an implementation, for reuse, the smallest change shaped like its siblings, guards sized to evidence, shared-interface migration, behavior-level test choice, and comments.
name: implement
---

# Implement

## Implementation Judgment

Prefer reuse over reinvention: check project code, dependencies, framework capabilities, and mature solutions before building custom infrastructure; add a dependency or layer only when it beats a small local implementation on fit, maintenance, compatibility, and security.

Make the smallest change that satisfies acceptance, shaped like its siblings: read existing files of the same kind and match the majority (naming, placement, imports, tests, error handling, wiring); name minority drift instead of copying it.

Validate and normalize inputs once at trust boundaries, then trust them inside; client or convenience checks never replace authoritative enforcement. Size every guard, fallback, and retry to evidence: an impossible case gets no code (including a guard on a write that already converges), a rare one gets one named guard at the entry point, a real one belongs on the main path, and an unknown one is a question. Report each guard kept or removed with its reason. Deny by default and fail closed on missing or invalid configuration.

When changing a shared interface, trace and migrate every caller and usage mode and verify through the highest practical consumer; give a contract several consumers share one executable source of truth or drift check, and record intentional exceptions instead of duplicating policy. Keep seams local until repetition justifies broadening them.

Keep mechanical chores separate from behavior changes. Flag code that seems unnecessary, with your reasoning, instead of deleting it.

## Testing

- **!!! Test behavior, not implementation shape.** Reuse existing suites and prefer the cheapest check that establishes acceptance (typecheck, lint, runtime or browser checks). Assert observable behavior and mock only genuinely external seams (network, clock, randomness). Tautological and change-detector tests are harmful.
- Choose coverage before implementation instead of backfilling tests to fit finished code: add a test or fixture only for a durable in-scope contract or a meaningful failure mode, and explain its benefit without a separate approval for the file. For complex features, prefer end-to-end coverage that ends in a repeatable artifact over many unit tests.
- Every kept test names the production failure it catches, uses only inputs production can produce, and protects a distinct behavior; remove redundant tests.
- For a bug, `diagnose` holds the reproduce-first procedure.

## Comments

Comment only durable context the code cannot express: non-obvious invariants, intentional trade-offs, external workarounds, and deliberately surprising behavior a maintainer might otherwise "fix". When your comments explain how the code works, simplify the code instead.
