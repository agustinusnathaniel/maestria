---
"@maestria/opencode": minor
"@maestria/agent-plugins": minor
"@maestria/pi": minor
"maestria": minor
---

**Breaking:** `@adventurer`, `@architect`, and `@builder` are removed on every host. The main session now works as one main loop: it does recon, design, and implementation itself, loads the new `recon` and `architecture-plan` method skills when a task needs them, and dispatches only `@reviewer` for an independent check of meaningful changes. The builder's implementation judgment now lives in the always-on rules. On OpenCode the orchestrator can read, search, edit, and run the same shell commands the builder could. On Pi, modes no longer block main-session edits, and `sonar` blocks edits and subagent dispatch. `maestria configure` lists only `reviewer`, and stored model settings for the removed roles are ignored.
