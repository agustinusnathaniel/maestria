# @maestria/hermes

## 0.1.6

### Patch Changes

- [#103](https://github.com/agustinusnathaniel/maestria/pull/103) [`886dbd0`](https://github.com/agustinusnathaniel/maestria/commit/886dbd0b92256110d89f1549d7a96849950a2e82) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Sync workflow mode commands (fein/sonar/blitz) through canonical source pipeline, including Hermes

## 0.1.5

### Patch Changes

- [#94](https://github.com/agustinusnathaniel/maestria/pull/94) [`6a0243f`](https://github.com/agustinusnathaniel/maestria/commit/6a0243f3d969f4721c07ff2ebec6676f322c0486) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Compact agent directives to cut context usage (~38% on the orchestrator prompt) without removing rules or intent. The orchestrator consolidates 15 critical rules into 11 and merges the commit, review, and routing guidance into single sections. Shared specialist rules (maker/checker split, handoff validation, ambiguity handling, escalation format, tool routing) now live once in the global rules instead of being repeated per specialist. Also fixes duplicate skill prescriptions in diagnose and architect, a formatting bug in the global rules, and stale cross-references.

## 0.1.4

### Patch Changes

- [#89](https://github.com/agustinusnathaniel/maestria/pull/89) [`837a529`](https://github.com/agustinusnathaniel/maestria/commit/837a529be3d65bb826df052d64cd8d4febe2cf7b) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Orchestrator now defaults to single-thread execution for simple changes instead of always routing work through subagents. Complex tasks (multi-file, cross-domain, risky) still get delegated to specialists. Routine fixes and small features are faster with less context overhead — no change in how you use the plugin.

## 0.1.3

### Patch Changes

- [#87](https://github.com/agustinusnathaniel/maestria/pull/87) [`09e69d8`](https://github.com/agustinusnathaniel/maestria/commit/09e69d83df432da49f82c71d69ce6f9610c50d50) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Wire maestria specialist roles into Hermes plugin hook system for permission enforcement

  Three fixes to make the maestria methodology actually work at runtime:

  - **pre_gateway_dispatch hook**: Intercepts `/fein`, `/sonar`, `/blitz`, `/mode`, `/review`, `/plan` commands before the agent-busy check, so they dispatch even when the agent is processing a turn. Uses fire-and-forget async send to reply directly. **Fixed: now passes `message_thread_id` in metadata so Telegram forum topic responses route to the correct thread instead of General.**
  - **Role-based permission enforcement**: Orchestrator now passes `[MAESTRIA_ROLE: <specialist>]` in `delegate_task` context. Subagent's `pre_llm_call` hook parses it and registers in a `session_id → role` map. `pre_tool_call` hook enforces tool restrictions per specialist role (builder=full access, reviewer=read-only, etc.). Sonar mode write-block remains the reliable primary gate.
  - **Transform hook annotates results**: Write operations in fein/blitz mode append a methodology annotation to tool results instead of being a silent no-op.

## 0.1.2

### Patch Changes

- [`72f6628`](https://github.com/agustinusnathaniel/maestria/commit/72f6628b1e02a8ddea20200b18ba26087109da27) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Fix plugin loading failure due to src/ layout

  Hermes plugin discovery expects `__init__.py` at the plugin root directory,
  but the package uses a `src/` layout (code under `src/maestria_hermes/`).
  Added a root-level `__init__.py` shim that adds `src/` to `sys.path` and
  re-exports `register` from the actual package.

  Without this, `hermes plugins install` silently fails to load the plugin
  — none of its slash commands (`/fein`, `/sonar`, `/blitz`, etc.), hooks,
  or skills are available.

## 0.1.1

### Patch Changes

- [#9](https://github.com/agustinusnathaniel/maestria/pull/9) [`17c6816`](https://github.com/agustinusnathaniel/maestria/commit/17c6816c602c9c40b96b28a1a574fc2c387cca56) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Initial release of @maestria/hermes — maestria methodology adapter for Hermes Agent.

  Features:

  - Mode system: fein (full pipeline), sonar (read-only), blitz (fast execution)
  - OpenCode CLI routing tool
  - Pipeline lifecycle hooks (pre-LLM, pre-tool, transform)
  - 9 specialist skill files
  - Slash commands: /fein, /sonar, /blitz, /mode, /review, /plan
