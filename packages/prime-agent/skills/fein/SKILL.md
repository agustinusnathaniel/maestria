---
name: fein
description: Full pipeline mode - reconnaissance or design, implementation, and independent review. Load when the user invokes fein or asks for the complete maestria pipeline.
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

[MODE: fein]

## MODE: fein (Full Pipeline)

Activate the `full` route. Use the dynamic thinker -> worker -> verifier pipeline and required review floors.

Load the `orchestrator` skill for routing and delegation methodology. The `/fein` extension command also activates this mode for the session (a goal argument is forwarded to the agent; the mode prompt is injected on every turn; clear with `/mode-clear`). If the user provided a goal after invoking `fein`, run the full pipeline on that goal now.
