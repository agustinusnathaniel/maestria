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

Fix stale skill references so prescribed skills resolve at load time: planner skill guidance no longer names the removed `to-issues` and `to-prd` skills, and the duplicated Kimi orchestrator skill prescription (which restated canonical skill governance and drifted stale) is removed so `sync.config.ts` only adapts toward the plugin runtime. Clarify in the orchestrator's Role-Based Pipeline that `@diagnose` analyzes the bug, applies the minimal fix, and verifies the repair instead of grouping it with analyze-only thinkers. Correct the canonical agent-directives README index to count 8 pipeline agents (orchestrator + 7 specialists) and list `orchestrator.md`.
