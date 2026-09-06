---
'@maestria/agent-plugin': patch
'@maestria/claude-code': patch
'@maestria/codex': patch
'@maestria/core': patch
'@maestria/cursor': patch
'@maestria/hermes': patch
'@maestria/kimi-code': patch
'@maestria/omp': patch
'@maestria/opencode': patch
'@maestria/pi': patch
'@maestria/prime-agent': patch
---

Fix stale skill references so prescribed skills resolve at load time: the Kimi orchestrator skill prescription uses `architecture-decision-framework`, `prd`, and `to-tickets` instead of `architecture-decision-records`, `to-prd`, and `to-issues`, and planner skill guidance no longer names the removed `to-issues` and `to-prd` skills. Clarify in the orchestrator's Role-Based Pipeline that `@diagnose` analyzes the bug, applies the minimal fix, and verifies the repair instead of grouping it with analyze-only thinkers. Correct the canonical agent-directives README index to count 8 pipeline agents (orchestrator + 7 specialists) and list `orchestrator.md`.
