---
'@maestria/opencode': patch
---

Expand bash allow-lists for all subagents

All 5 subagents (adventurer, architect, planner, reviewer, writer)
received expanded bash allow-lists based on actual command usage data.

Each agent now has read-only file operations (ls, cat, grep, cd, find, etc.)
pre-allowed, plus agent-specific tools based on their role (pnpm, npm,
opensrc, vp, rtk, git extended operations, etc.).

All agents keep the *: ask catch-all for unusual or dangerous commands.
Builder and diagnose were expanded in a previous release.

**Conventional commit prefix reordered.** `refactor` is now the default prefix instead of `feat`. `feat` is scoped to user-facing features only. Explicit decision rule added: if a change doesn't introduce a new user-facing capability, it's `refactor`, not `feat`.
