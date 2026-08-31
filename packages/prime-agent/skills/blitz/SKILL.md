---
description: Fast implementation mode - skip optional ceremony for familiar, low-risk work; never waive safety or required review. Load when the user invokes blitz or asks for a fast route.
name: blitz
---

<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

[MODE: blitz]

## MODE: blitz (Fast Implementation)

Use direct execution for familiar, low-risk code or other work when the host permits it; otherwise delegate to the permitted specialist. Skip optional reconnaissance and design ceremony, but never waive safety, authorization, required review, or branch floors. Escalate safety exceptions to the normal route.

Fast implementation mode. Load the `orchestrator` skill if coordination is needed. The `/blitz` extension command also activates this mode for the session (a goal argument is forwarded to the agent; the mode prompt is injected on every turn; clear with `/mode-clear`). If the user provided a goal after invoking `blitz`, implement that goal now.
