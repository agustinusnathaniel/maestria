---
'@maestria/opencode': patch
---

Fix orchestrator bash permission pattern to allow prefixed commands (e.g., via rtk tool)

Command-rewriting tools (like `rtk`) prefix bash commands with their own
invocation, breaking the exact-match permission pattern. Changed the permission
pattern to a leading wildcard so any prefix is tolerated.
