---
'@maestria/core': minor
'@maestria/opencode': minor
'@maestria/kimi-code': minor
'@maestria/pi': minor
---

Eliminate questions — autonomous philosophy across all layers

Shift from "ask when unsure" to "exhaust data, document assumptions, proceed — reviewer catches mistakes". Based on analysis of 1,133 real question() calls across 5,675 sessions.

**Mid-phase questions eliminated** — architect, planner, diagnose no longer ask design/permission questions. They exhaust data sources and document assumptions instead.

**Autonomous commit protocol** — agent reads git log for past corrections, composes correct conventional commit message, commits autonomously. Push is automatic on feature branches, asks only on main/master.

**OpenCode permission alignment** — builder shell permissions expanded to comprehensive allow-list (read-only file ops, git, pnpm, build/test tools). Both builder and diagnose keep `*: ask` catch-all for unusual commands.

**Work result summary** — orchestrator presents completed work as structured file/signature table, not verbatim handoff dump.

See ADR-CORE-011 for full decision record.
