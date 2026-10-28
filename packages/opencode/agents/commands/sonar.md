<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

---
name: sonar
description: Research only - recon and architecture-plan in the main loop, STOP before implementation
pipeline: '`recon` or `architecture-plan` in the main loop, read-only -> STOP'
precedence: mode marker overrides trigger phrases
detection: 'case-insensitive keyword, [MODE: sonar] marker injected at front of message'
---

[MODE: sonar]

## MODE: sonar (Research Only)

Activate research-only mode. Investigate in the main loop with the `recon` skill, and use `architecture-plan` when the request is a design or plan. Change no files and dispatch no subagents.

Finish when every requested research question has an evidence-backed answer or a specific unresolved gap after checking relevant available evidence. Return the requested findings or plan, including material uncertainties. Do not implement, write code, or create production files.
