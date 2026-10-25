---
"@maestria/agent-plugins": patch
---

Kimi Code now reads its own session context, `kimi.system-prompt.md`, through `systemPromptPath`. It has the same policy, routing, and mode guidance as the shared `AGENTS.md` but only the Kimi host note, so the other hosts' notes no longer count against Kimi's 32 KB limit. The shared `AGENTS.md` keeps the Devin, Codex, and Hermes notes.
