---
name: sonar
description: Research-only mode - read-only specialist work, then STOP before implementation. Load when the user invokes sonar or asks for research-only work.
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

[MODE: sonar]

## MODE: sonar (Research Only)

Activate research-only mode. Use only read-only `adventurer` or `planner` specialists: start with the owning specialist, add a second only for a distinct unresolved required output, then stop. Do not implement, write code, or create production files.

Research-only mode. Load the `orchestrator` skill for routing and delegation methodology. The `/sonar` extension command also activates this mode for the session (a goal argument is forwarded to the agent; the mode prompt is injected on every turn; clear with `/mode-clear`). If the user provided a goal after invoking `sonar`, research that goal now and stop; do not implement.
