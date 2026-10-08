'@maestria/opencode-v2': patch
---

chore: migrate opencode-v2 POC to the stable @opencode/plugin 2.x API

Tracks @opencode/plugin 2.0.24 (stable) instead of the @opencode-ai/plugin next-17444 prerelease, with effect pinned to 4.0.0-rc.112 to match the plugin package's own dependency. Commands move to the add-only code-style API (execute prepends the synced mode template and submits a session prompt), skills use the renamed Skill.Info path field with get/update, and references drop the removed description field. Session mode handling stays on the context hook by design.
