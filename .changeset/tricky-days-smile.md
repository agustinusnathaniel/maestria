---
"@maestria/opencode": patch
---

refactor: restrict orchestrator task permissions to 7 registered subagents

The orchestrator's `task` permission was changed from `"*": allow` to a
deny-by-default pattern that explicitly allows only the 7 registered
subagents (adventurer, architect, builder, diagnose, planner, reviewer,
writer). Built-in `explore` and `general` subagents are removed from the
Task tool description entirely, providing technical enforcement that
prevents the orchestrator from delegating to them.
