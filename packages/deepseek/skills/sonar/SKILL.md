---
description: Research only - recon and architecture-plan in the main loop, STOP before implementation. Load when a message starts with the sonar keyword.
name: sonar
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

[MODE: sonar]

## MODE: sonar (Research Only)

Investigate in the main loop with the `recon` skill, and use `architecture-plan` when the request is a design or plan. Change no files and dispatch no subagents: do not implement, write code, or create production files.

Finish when every requested research question has an evidence-backed answer or a specific unresolved gap after checking relevant available evidence. Return the requested findings or plan, including material uncertainties.
