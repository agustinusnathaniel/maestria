---
"@maestria/agent-plugins": minor
"@maestria/opencode": minor
"@maestria/pi": minor
---

Specialists go from seven to four: `adventurer`, `architect`, `builder`, and `reviewer`. The retired `diagnose`, `planner`, and `writer` agents become methods: the new bundled `diagnose` skill (adventurer runs a read-only diagnosis, builder applies the fix) and `plan` skill (loaded by architect), while builder takes over documentation work with the docs skills. Every package now ships the `diagnose` and `plan` skills. `maestria update` removes retired Codex profiles; on Pi, delete `diagnose.md`, `planner.md`, and `writer.md` from `~/.pi/agent/agents` if you no longer want them listed.
