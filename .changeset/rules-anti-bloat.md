---
"@maestria/opencode": patch
"@maestria/agent-plugins": patch
"@maestria/pi": patch
---

The shared rules and main loop no longer mention the removed role agents: fail-loud repair now points at the `diagnose` and `architecture-plan` skills, and when a host does not allow direct work the main loop (and `blitz`) report that limit instead of delegating to a specialist that no longer exists.
