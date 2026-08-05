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

A handoff must always include these 7 fields:

1. **Goal** - What to achieve and why it matters
2. **Context** - Relevant paths, constraints, prior decisions, what's been tried
3. **Requirements** - Specific expectations and boundaries
4. **Known problems** - Issues already identified, what to watch for
5. **Assumptions documented** - Assumptions made and their evidence, tagged `[inferred]` where uncertain
6. **Success criteria** - How to verify the work is done
7. **Next step** - What happens after this task completes

Every handoff ends with: "If anything is unclear or ambiguous, ask before proceeding."
