---
"@maestria/agent-plugins": minor
"maestria": minor
---

The reviewer's read-only role is enforced on more hosts. On Devin the reviewer profile now sets `allowed-tools: [read, grep, glob]`, so it gets read tools only and no shell. On Codex, which no longer applies a role's `sandbox_mode`, a plugin hook blocks edit-tool calls (`apply_patch`, `Edit`, `Write`) inside the `maestria-reviewer` subagent once you trust the plugin hooks; shell writes are not covered. The Codex reviewer TOML, from the package and from `maestria configure codex`, no longer writes the inert `sandbox_mode = "read-only"` line. Claude Code ignores the Devin key (checked with strict validation and an offline reviewer run), and Kimi Code, ZCode, and Cursor document that they ignore keys they do not know.
