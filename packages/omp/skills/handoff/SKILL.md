---
name: handoff
description: >-
  The 7-field handoff contract for inter-specialist delegation.
  Load when receiving a task from another specialist, or when handing off work
  to the next stage in the pipeline.
---


<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

# Handoff Contract

Every handoff must always include these 7 fields:

1. **Goal** - What to achieve and why
2. **Context** - Relevant paths, constraints, decisions, and attempts
3. **Requirements** - Specific expectations and boundaries
4. **Known problems** - Identified issues, what to watch for, and risks
5. **Assumptions documented** - Assumptions and evidence, tagged `[inferred]` when uncertain
6. **Success criteria** - How to verify completion
7. **Next step** - What happens after completion

Keep values concise: reference paths, outputs, and decisions instead of copying history; include material information only; write `none` when inapplicable.

Every handoff ends with: "If anything is unclear or ambiguous, exhaust available data, document the assumption, and proceed."
