# ADR-PI-001: Pi Rules and Agent Injection

## Status

Accepted (2026-06-18). Amended 2026-11-03: listing the rules as skills did not keep them always-on, so `before_agent_start` now injects the always-on core on every run ([CORE-036](../core/ADR-CORE-036-always-on-core-and-skill-map.md), [CORE-037](../core/ADR-CORE-037-hooks-as-deterministic-reinforcement.md)). Absorbed the tool-list rule from PI-005 on 2026-11-27.

## Context

maestria's always-on rules must be in the system prompt on every Pi turn, and its reviewer must be a registered subagent. Pi offered four ways to carry the rules:

| Choice | Pros | Cons |
| --- | --- | --- |
| `before_agent_start` injection | Always present, versioned with the package | Adds to every system prompt |
| `AGENTS.md` auto-discovery | Project-controlled, no extension | Project content, may drift from the package |
| Skill loaded on demand | Smaller system prompt | The model may not load it |
| Per-project `SYSTEM.md` | Project-controlled | Needs setup in every project |

## Decision

The extension's `before_agent_start` handler injects the always-on core (the `maestria` and `global-rules` skill bodies) on every run, followed by the active workflow mode's prompt when one is set and the project's `.maestria/` files ([CORE-006](../core/ADR-CORE-006-project-workflow-protocol.md)). The skills also ship through the `pi.skills` manifest field so Pi lists them.

The reviewer ships as a Markdown agent file with YAML frontmatter and is copied to `~/.pi/agent/agents/` at startup, where pi-subagents discovers it. Existing files are never overwritten, so user customizations survive and retired agent files stay until the user removes them.

The frontmatter `tools:` line is the reviewer's tool allowlist, so it names only tools Pi registers. Pi silently ignores an unknown name, which loses the capability with no error. Drop an unknown name rather than mapping it to a similar tool: substituting `find` for `glob` would run a tool under a name the operator never granted. `packages/core/tests/roster.test.ts` checks the list against Pi's own registered tool names.

## Consequences

- The rules are present on every turn and match the installed package version.
- Every system prompt carries the core, which is why the always-on text has a word budget.
- Skills and agent files add to the npm package, and pi-subagents must be installed for the reviewer to dispatch.

## Alternatives Considered

- **`AGENTS.md` auto-discovery:** rejected because the rules are package methodology, not project context.
- **Skills on demand, or skill listing alone:** rejected after the 2026-11-03 finding that Pi lists skills by name and loads a body only when asked.
- **`SYSTEM.md`:** rejected because the rules should be identical across projects without per-project setup.

## Date

2026-06-18; amended 2026-11-03.
