---
description: Research only - recon and architecture-plan in the main loop, STOP before implementation
name: sonar
---

<!-- Generated from packages/core/agent-directives by scripts/sync-consolidated-plugin.ts. Do not edit directly. -->

[MODE: sonar]

## MODE: sonar (Research Only)

Investigate in the main loop with the `recon` skill, and use `architecture-plan` when the request is a design or plan. Change no files and dispatch no subagents: do not implement, write code, or create production files.

Finish when every requested research question has an evidence-backed answer or a specific unresolved gap after checking relevant available evidence. Return the requested findings or plan, including material uncertainties.

Preserve the user's goal, constraints, and arguments. Apply this workflow to the following request:

$ARGUMENTS
