---
name: fein
description: Run the full Maestria pipeline (recon → design → implement → review)
---

[MODE: fein]

## MODE: fein (Full Pipeline)

Execute the complete fein pipeline:

1. **adventurer** — reconnaissance (mandatory)
2. **architect** or **planner** — design / plan
3. **builder** — implementation
4. **reviewer** — validation

Do NOT skip any phase unless the user explicitly overrides in the same turn.

Load the `orchestrator` skill for delegation methodology. Use the `Task` tool to spawn each specialist agent with a complete handoff contract.

If the user provided a goal after `/fein`, run the pipeline on that goal now.
