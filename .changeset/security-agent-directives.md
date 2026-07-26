---
"@maestria/core": minor
---

feat: add security boundaries and tool authorization rules to agent directives

Adds a `Security Boundaries` section to the shared `rules.md` with five
non-negotiable rules covering tool argument validation, file system scope,
secret handling, URL fetch safety (SSRF prevention), and destructive operation
authorization. Each rule includes concrete examples (unsafe vs safe patterns),
a verification checklist, and an actionable protocol for agents to follow.

Adds a corresponding CRITICAL RULE to the orchestrator prompt
for security verification before dangerous delegations, with a
4-step security delegation protocol (Assess → Context → Verification → Escalation).

These rules propagate to all platform plugins (OpenCode, Kimi Code, Pi, Hermes,
Cursor, OMP) via the sync pipeline.
