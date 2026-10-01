# ADR-HM-001: `/goal` Is a Core Hermes Feature - Plugin Does Not Wrap It

## Status

Accepted (2026-07-16)

## Context

The `@maestria/hermes` plugin brings the maestria methodology (7-specialist pipeline, maker/checker split, mode system) to the Hermes Agent platform. Hermes has a built-in `/goal` feature ([documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/goals)) that provides:

- A standing objective that survives across turns
- Automatic continuation after each turn (a judge checks whether the goal is achieved)
- Persistence across `/resume`
- Lifecycle control (`/goal pause`, `/goal resume`, `/goal clear`); user messages preempt the loop
- A configurable turn budget

Should the plugin integrate with `/goal`, provide its own `/goal`-like functionality, or leave it as a core primitive users invoke independently?

## Decision

**Do not integrate `/goal` into the plugin. Users invoke `/goal` directly as a core Hermes command alongside the plugin.**

The plugin does not:

- Wrap `/goal` with custom plugin-specific behavior
- Hook into goal lifecycle events (set, pause, resume, clear)
- Provide plugin-scoped `/goal` variants (e.g. `/maestria-goal`)
- Register goal-related slash commands or middleware

## Reasoning

### 1. `/goal` is universal, and plugin commands are single-turn

Every Hermes session has `/goal`, `/goal status`, `/goal pause`, `/goal resume`, and `/goal clear`, with or without any plugin: nothing needs enabling. The plugin's own slash commands (`/fein`, `/sonar`, `/blitz`, `/mode`, `/review`, `/plan`) each produce output in one turn, and none needs a multi-turn loop. A user who wants autonomous iteration toward a plan types `/goal <task>` at the Hermes level, with no plugin role in the flow.

### 2. Wrapping `/goal` would create feature overlap

- **Duplicate lifecycle management** - Hermes already owns persistence, the judge loop, and pause/resume/clear, so a plugin would either reimplement all of it (wasteful) or wrap the native API (surface area for no marginal value).
- **Race conditions** - two goal loops (plugin plus core) could conflict: a plugin continuation loop running while `/goal` is active could produce interleaved judge evaluations or ambiguous state.
- **Confuse users** - `/goal` is documented core behavior; a plugin-level `/maestria-goal` that behaves differently erodes the "feels native" design goal.

### 3. Aligns with existing Design Philosophy

This applies **Design Principle #2: Hermes-native first + memory-agnostic** (from `docs/hermes-maestria-plugin.md`): use Hermes' built-in features (`delegate_task`, task orchestration tools, `/goal`, memory providers) instead of reimplementing them. The plugin is memory-engine agnostic: it never reads, writes, or cares which memory provider is configured, because memory is a platform concern and the plugin adds no memory layer. `/goal` and memory are orthogonal here: the goal loop and its judge stay core, while plugin commands set methodology context inside the loop.

### 4. When it _would_ make sense (future signal)

If the plugin ever ships a feature that genuinely requires multi-turn autonomous iteration (for example, "scan all files in a directory and categorize every function" and keep going file-by-file), the right answer is still to **type `/goal` at the Hermes level**, not to add goal integration to the plugin. The plugin's role would be to provide the specialist prompt or routing logic that the loop invokes each turn, not to replace the loop.

## Consequences

### Positive

- **No scope creep** - the plugin stays focused on what it uniquely provides: role gating, slash commands, methodology mode injection, and OpenCode routing
- **No race conditions** - plugin loops cannot conflict with the core goal loop
- **Lower maintenance** - no code to test, debug, or keep compatible with Hermes' goal implementation
- **Clear user mental model** - `/goal` is core, `/fein`/`/sonar`/`/blitz` are plugin; users combine them naturally

### Negative

- **Slightly longer user command** - goal plus methodology setup takes two messages (`/goal Do X`, then `/fein`) instead of one hypothetical `/maestria-goal fein Do X`. The concerns are genuinely separate, and compounding them would be premature abstraction.

## Related Decisions

- ADR-HM-000 (plugin over skills-only - established the plugin delivery model this ADR constrains)
- Design Principle #2 in `docs/hermes-maestria-plugin.md` (Hermes-native first)
