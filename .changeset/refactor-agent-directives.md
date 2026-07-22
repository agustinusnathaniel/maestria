---
'@maestria/core': patch
'@maestria/cursor': patch
'@maestria/hermes': patch
'@maestria/kimi-code': patch
'@maestria/omp': patch
'@maestria/opencode': patch
'@maestria/pi': patch
---

'refactor': compact, restore nuance, and platform-independence refactor of agent directives across all packages

Complete rework from original pre-PR #94 state:
- 41/41 critical checks pass (cognitive hygiene escapes, reviewer questions,
  builder-specific rules, planner guard rails, writer principles as bullets)
- Platform-agnostic canonical source with sync config injection
- All improvements preserved (parallelization table, handoff checklists,
  multi-lens review swarm, before-reporting-done verification)
- 436 tests pass, check-sync clean on all 6 platforms
