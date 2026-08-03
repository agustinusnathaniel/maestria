---
name: fein
description: Run the full Maestria pipeline (recon -> design -> implement -> review)
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

[MODE: fein]

## MODE: fein (Full Pipeline)

Explicit selection of the `full` route. Default role-based pipeline: thinker (recon/design/plan) -> worker (implementation) -> verifier (review). Verifier acceptance terminates the pipeline for that unit of work. Roles and order may adapt to task needs - this is the default, not a fixed requirement. Do NOT skip any phase unless the user explicitly overrides in the same turn.

Load the `orchestrator` skill for delegation methodology. Use the `Task` tool to spawn each specialist agent with a complete handoff contract.

If the user provided a goal after `/fein`, run the pipeline on that goal now.
