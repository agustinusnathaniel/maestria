---
name: fein
description: Run the full Maestria pipeline (recon -> design -> implement -> review)
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

[MODE: fein]

## MODE: fein (Full Pipeline)

Activate the `full` route. Use the dynamic thinker -> worker -> verifier pipeline and required review floors.

Load the `orchestrator` skill for delegation methodology. Use the `Task` tool to spawn each specialist agent with a complete handoff contract.

If the user provided a goal after `/fein`, run the pipeline on that goal now.
