---
"@maestria/opencode": minor
"@maestria/pi": minor
"@maestria/kimi-code": minor
"@maestria/core": minor
---

Introduce @maestria/core as canonical source for agent directives with config-driven sync tool

- Add packages/core/agent-directives/ with canonical specialist, orchestrator, and rules files
- Add packages/core/scripts/sync.ts transform pipeline (replace, prepend, append, frontmatter)
- Add per-plugin sync.config.ts for opencode, pi, and kimi-code
- Add scripts/sync-all and scripts/check-sync with auto-discovery via glob
- Wire sync check into vp check via vite.config.ts run.tasks
- Document architecture decision in ADR-CORE-005
