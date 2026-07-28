---
'@maestria/core': minor
'@maestria/opencode': patch
'@maestria/pi': patch
'@maestria/kimi-code': patch
'@maestria/hermes': patch
'@maestria/omp': patch
---

refactor: harden review protocol with access list rules and fail-loud exit

ADR CORE-012 introduces two changes to the orchestrator's review protocol:

1. **Hardened access list for verifiers** - REQUIRED (diff, spec, acceptance criteria) and FORBIDDEN (builder's handoff, self-assessment) items are now explicit, preventing reviewer bias from builder narrative. Adds blind review practice as a separate rule.

2. **Fail-loud iteration limit exit** - Replaces "ambiguous -> document and proceed" with a structured fail-loud exit. At max 3 cycles with unresolved [fix] items, commit is blocked, auto-escalation with structured delta, user override required.
