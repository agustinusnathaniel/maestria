---
"@maestria/opencode": minor
"@maestria/pi": minor
---

**Breaking:** the main agent is renamed from `orchestrator` to `maestria`, since it now does the work itself instead of coordinating role agents. On OpenCode, select or mention `maestria` instead of `orchestrator`, and move any `agents.orchestrator` model setting to `agents.maestria`. Pi's auto-injected main-loop skill is now `maestria`. Codex installs are unaffected: the managed block in `AGENTS.md` keeps its existing markers.
