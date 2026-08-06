# ADR-OC-006: Runtime Route Gates for the Root Orchestrator

## Status

Accepted

## Context

The keyword modes established in ADR-OC-003 changed the orchestrator prompt, but they did not constrain the tools available during a turn. The root agent could still bypass the intended dispatcher boundary through MCP, custom tools, skills, or native tools that were not appropriate for the selected mode. Frontmatter permissions also cannot express a per-turn state machine and are not a generic deny mechanism for dynamically registered tools.

The required boundary is specific: only the root Maestria `orchestrator` session is gated. Specialist child sessions and unrelated OpenCode agents must keep their normal tool behavior.

## Decision

Implement a runtime route gate in the OpenCode plugin using the `tool.execute.before` hook and a per-plugin-instance, per-session registry.

### State machine

```text
unknown session
    │ chat.message(agent=orchestrator)
    ▼
unselected ── maestria_route(route) ──► direct | focused | full
    │                                      │
    └──── next user turn ──────────────────┘
                   │
                   ▼
               unselected

Landing-review approval and shipping are specified in ADR-OC-007. The route
gate only arms that state; it does not treat reviewer dispatch as approval.

session.idle or session.deleted ──► removed
```

- Unknown sessions are not gated. This is how specialist children and non-Maestria agents remain outside the policy.
- A root orchestrator session is reset to `unselected` at the start of every user turn. The unselected state is fail-closed and permits only `maestria_route`.
- The selector is idempotent for the current route, but a conflicting route selection in the same turn throws and leaves the original route unchanged.
- Idle and deleted session events remove state to prevent stale session IDs from retaining policy state.

### Route policy

| State | Allowed tools |
| --- | --- |
| Unselected | `maestria_route` only |
| Direct | OpenCode native tools except `task`, `batch`, and commit/push/PR shipping commands |
| Focused | `maestria_route`, `task`, `question`, `todowrite` |
| Full | `maestria_route`, `task`, `question`, `todowrite` |
| Landing review | `maestria_landing_review` while armed; approved safe shipping only after ADR-OC-007 |

Direct mode uses a bounded native-tool name set. Unknown names, including MCP and other custom tools, are not considered native. Focused and full therefore block all other tools, including MCP, custom tools, and `skill`.

### Mode selection

ADR-OC-003 keyword detection remains unchanged, including word boundaries, code-span exclusion, disabled keywords, stripping, marker injection, and most-restrictive-wins behavior. The runtime mapping is:

| Keyword | Route     |
| ------- | --------- |
| `blitz` | `direct`  |
| `sonar` | `focused` |
| `fein`  | `full`    |

The `chat.message` hook selects the mapped route before the model can execute a tool. If no keyword is present, the model must call `maestria_route`.

### Tool availability and enforcement

The generated orchestrator frontmatter receives broad native-tool availability through `packages/opencode/sync.config.ts`. This makes route-dependent tools visible to OpenCode, while the runtime hook performs the actual per-turn enforcement. The orchestrator remains the root `orchestrator` agent; no specialist prompt or generated agent file is changed.

## Consequences

### Positive

- Direct mode has zero child-session dispatch through `task` or `batch`, and cannot run commit, push, or PR shipping commands.
- Focused and full modes remain pure dispatchers at runtime, even when MCP or custom tools are configured.
- Mode selection is explicit, per-turn, and cannot become stale across turns.
- The policy is testable independently from OpenCode agent markdown and applies only to identified root orchestrator sessions.

### Negative and risks

- The policy depends on OpenCode 1.18.4 hook and tool-context contracts.
- The native-tool allowlist must be updated if OpenCode renames or adds native tools.
- Plugin process memory holds session IDs until idle/deleted cleanup. A missed lifecycle event could retain a small amount of state until plugin shutdown.
- Runtime enforcement is narrower than a complete audit of every agent rule; prose directives remain non-programmatic guidance.

## Date

2026-08-06
