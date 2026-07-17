---
"@maestria/hermes": patch
---

Wire maestria specialist roles into Hermes plugin hook system for permission enforcement

Three fixes to make the maestria methodology actually work at runtime:

- **pre_gateway_dispatch hook**: Intercepts `/fein`, `/sonar`, `/blitz`, `/mode`, `/review`, `/plan` commands before the agent-busy check, so they dispatch even when the agent is processing a turn. Uses fire-and-forget async send to reply directly.

- **Role-based permission enforcement**: Orchestrator now passes `[MAESTRIA_ROLE: <specialist>]` in `delegate_task` context. Subagent's `pre_llm_call` hook parses it and registers in a `session_id → role` map. `pre_tool_call` hook enforces tool restrictions per specialist role (builder=full access, reviewer=read-only, etc.). Sonar mode write-block remains the reliable primary gate.

- **Transform hook annotates results**: Write operations in fein/blitz mode append a methodology annotation to tool results instead of being a silent no-op.
