---
"@maestria/agent-plugins": minor
"maestria": minor
---

Per-host session files: each host that reads a plain session file now gets its own, holding the always-on core and only its own host note, and the build fails if one exceeds that host's cap. The root `AGENTS.md` is Devin's (under Devin's 16 KiB always-on limit, so its tail is no longer cut off), and Devin's three modes ship as skills it selects from `devin/skills/` (`/maestria:fein <task>` in the CLI or Desktop, `@skills:fein <task>` in the web app). `maestria install codex` now installs `codex.agents.md` (core and modes) into the managed block, and Hermes users add `hermes.context.md` as project context. Host notes and docs now record that Codex no longer applies a reviewer role's `sandbox_mode`, that Devin and OMP tool allowlists can enforce read-only, and the hook support of Claude Code, Codex, Cursor, Devin, Kimi Code, ZCode, and OMP.
