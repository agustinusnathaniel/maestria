---
"@maestria/agent-plugins": minor
---

The reviewer's read-only role is enforced on more hosts. On Devin the reviewer profile now sets `allowed-tools: [read, grep, glob]`, so it gets read tools only and no shell. On Codex, which no longer applies a role's `sandbox_mode`, a plugin hook blocks file edits inside the `maestria-reviewer` subagent once you trust the plugin hooks. Other hosts ignore the Devin key.
