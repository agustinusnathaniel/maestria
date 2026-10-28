---
"@maestria/opencode": minor
"@maestria/agent-plugins": minor
"@maestria/pi": minor
---

On OpenCode the orchestrator now works as a main loop: it can read, search, edit, and run the same shell commands as `@builder`, does recon, design, and implementation itself, and dispatches only `@reviewer` for an independent check of meaningful changes. Two new method skills, `recon` and `architecture-plan`, ship with every package. Other hosts keep their existing routing, and `@adventurer`, `@architect`, and `@builder` stay installed everywhere.
