# ADR-HM-001: `/goal` Is a Core Hermes Feature — Plugin Does Not Wrap It

## Status

Accepted (2026-07-16)

## Context

The `@maestria/hermes` plugin brings the Maestria methodology (7-specialist pipeline, maker/checker split, mode system) to the Hermes Agent platform. Hermes has a built-in `/goal` feature ([documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/goals)) that provides:

- A standing objective that survives across turns
- Automatic continuation after each turn (judge checks if goal is achieved)
- Persistence via `SessionDB.state_meta` (survives `/resume`)
- User messages preempt the loop; `/goal pause`, `/goal resume`, `/goal clear` control lifecycle
- Configurable turn budget (default 20)

The question: should the plugin integrate with `/goal`, provide its own `/goal`-like functionality, or leave it as a core Hermes primitive that users invoke independently?

## Decision

**Do not integrate `/goal` into the plugin. Users invoke `/goal` directly as a core Hermes command alongside the plugin.**

The plugin does not:

- Wrap `/goal` with custom plugin-specific behavior
- Hook into goal lifecycle events (set, pause, resume, clear)
- Provide plugin-scoped `/goal` variants (e.g. `/maestria-goal`)
- Register goal-related slash commands or middleware

## Reasoning

### 1. `/goal` is universally available

Every Hermes session — with or without any plugin — has `/goal`, `/goal status`, `/goal pause`, `/goal resume`, `/goal clear`. There is nothing the plugin needs to "enable" or "add" for goals to work. A user who wants multi-turn autonomous iteration types `/goal Fix every lint error in src/` directly — the plugin has no role in that flow.

### 2. Plugin commands are single-turn by design

The plugin's current and planned slash commands all produce output in one turn:

| Command    | Shape              |
| ---------- | ------------------ |
| `/fein`    | Set mode, respond  |
| `/sonar`   | Set mode, respond  |
| `/blitz`   | Set mode, respond  |
| `/review`  | Review last output |
| `/plan`    | Produce a plan     |
| `/mode`    | Show current mode  |
| `/role`    | Set or show role   |
| `/session` | Show session state |
| `/clear`   | Clear context      |

None of these need a multi-turn "keep going" loop. If a user wants autonomous iteration toward a plan, they type `/goal Execute the plan from your last message` — a core Hermes command, not a plugin concern.

### 3. Wrapping `/goal` would create feature overlap

Attempting plugin-specific goal functionality would:

- **Duplicate lifecycle management** — Hermes already has persistence, judge loop, pause/resume/clear. A plugin implementation would either reimplement all of it (wasteful) or wrap the native API (adds surface area for zero marginal value).
- **Risk race conditions** — Two goal loops (plugin + core) could conflict. A plugin that sets its own continuation loop while `/goal` is active could produce interleaved judge evaluations or ambiguous state.
- **Confuse users** — `/goal` is well-documented core behavior. A plugin-level `/maestria-goal` that behaves similarly but differently erodes the "feels native" design goal.

### 4. Aligns with existing Design Philosophy

This decision is a direct application of **Design Principle #2: Hermes-native first** (from `docs/hermes-maestria-plugin.md`):

> Hermes has built-in features that solve the problems the plugin would otherwise need to reimplement — `delegate_task` for subagent dispatch, `kanban_*` tools for task orchestration, `/goal` for persistent objectives, Mnemosyne for agent memory, SessionDB for state persistence. Use them. Don't reinvent them. The plugin's job is to wire the methodology into these existing subsystems, not duplicate them.

`/goal` is a core primitive. The plugin surfaces methodology concepts (modes, roles, specialists). These are orthogonal concerns:

```
User types:          /goal Port our blog to Astro, tests passing
Hermes runs:         [iterates autonomously, 1..N turns]
User types:          /fein  ← plugin command sets methodology mode
Hermes runs:         [continues within goal loop, now in fein mode]
Goal judge fires:    [checks if blog port is complete — entirely core]
```

### 5. When it _would_ make sense (future signal)

If the plugin ever ships a feature that genuinely requires multi-turn autonomous iteration — something like "scan all files in a directory and categorize every function" where you want Hermes to keep going file-by-file — the right answer is still: **type `/goal` at the Hermes level**, not "add goal integration to the plugin". The plugin's role would be to provide the specialist prompt or routing logic that the goal loop invokes on each turn, not to replace the loop itself.

## Consequences

### Positive

- **No scope creep** — the plugin stays focused on what it uniquely provides: role gating, slash commands, methodology mode injection, and OpenCode routing
- **No race conditions** — no risk of plugin loops conflicting with core goal loop
- **Lower maintenance** — no code to test, debug, or keep compatible with Hermes' internal goal implementation
- **Clear user mental model** — `/goal` is core, `/fein`/`/sonar`/`/blitz` are plugin. Users combine them naturally

### Negative

- **Slightly longer user command** — a combined goal + methodology setup requires two messages (`/goal Do X`, then `/fein`) instead of one hypothetical `/maestria-goal fein Do X`. This is acceptable: the two concerns are genuinely separate, and compounding them into one command would be premature abstraction.

## Related Decisions

- ADR-HM-000 (plugin over skills-only — established the plugin delivery model this ADR constrains)
- Design Principle #2 in `docs/hermes-maestria-plugin.md` (Hermes-native first)
