---
"@maestria/opencode": patch
---

fix: explicitly deny orchestrator read-side tools

The orchestrator's `read`, `glob`, `grep`, `lsp`, and `webfetch` permissions are now explicitly set to `deny`. The previous refactor relied on a missing-key default that the opencode framework does not honor, so the orchestrator was still able to use these tools. The new explicit denials make the strict-dispatcher role effective.

The 7 specialist subagents retain full read-side tool access for the work they pick up.
