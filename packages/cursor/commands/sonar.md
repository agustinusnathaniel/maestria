---
name: sonar
description: Research-only Maestria mode (recon -> design, no implementation)
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

[MODE: sonar]

## MODE: sonar (Research Only)

Research mode: research only. Start with the specialist that owns the research question. Add a second specialist only for a distinct unresolved required output. STOP after the required research output is delivered. Do NOT implement, write code, or create any production files.

Load the `orchestrator` skill for delegation methodology. Use the `Task` tool to spawn specialists with a complete handoff contract.

If the user provided a goal after `/sonar`, research that goal now.
