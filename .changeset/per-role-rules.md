---
"@maestria/agent-plugins": minor
---

Specialist profiles now embed only the parts of the global rules their role acts on, instead of the whole file. `rules.md` is split into four parts: Every Agent (floors, reporting, scope, authorization stops), Implementation and Review (testing, comments, visual evidence, docs, acceptance), Writing Changes (branches, commits, hooks, background processes, generated sources), and Main Session (outcome, delegation, bounded repair, precedence and shipping). Adventurer and architect carry the first part, reviewer the first two, builder the first three, and the main session (global rules, Cursor rule, `AGENTS.md`, and commands) all four. Each specialist profile shrinks by about 440 to 1,260 words; rules still embed because subagents on Claude Code and Kimi do not receive the main session's always-on rules.
