
<!-- Generated from packages/core/agent-directives by scripts/sync-consolidated-plugin.ts. Do not edit directly. -->

## Specialist Agents (Cursor)

Use the @adventurer, @architect, @builder, @diagnose, @planner, @reviewer, and @writer native profiles for these role identities.

Delegate via the `Task` tool to the plugin's custom agents (`agents/`). Pass a complete handoff contract in the prompt.

### How to invoke

1. Use the complete router and global policy supplied by the always-apply native rule.
2. Call `Task` with the specialist agent name and a full handoff: Goal, Context, Requirements, Known problems, Assumptions, Success criteria, Next step.
3. For parallel independent work, launch multiple `Task` calls in one turn.

### Maker/checker

`adventurer`, `architect`, `planner`, and `reviewer` declare `readonly: true` and carry explicit read-only instructions. Cursor CLI 2026.10.01 enforced `readonly` for project `.cursor/agents/` profiles but not for plugin-supplied profiles, so treat the plugin flag as intent and the prompt instructions as the operative control. A project-level profile written by `maestria configure cursor` carries the flag into `.cursor/agents/`, where Cursor enforces it.

Enforce the split: never send review work to the same agent that implemented; `reviewer` / `adventurer` / `architect` / `planner` must not edit files.

## Workflow Commands

Users can trigger modes with slash commands from this plugin:

| Command | Pipeline |
| --- | --- |
| `/fein` | Full pipeline: adventurer → architect/planner → builder → reviewer |
| `/sonar` | Research only: adventurer → architect/planner → STOP |
| `/blitz` | Fast path: builder directly (skip optional recon/design unless unknown; required review remains) |

The Cursor Integration manifest selects the shared root `agents/` profiles and `commands/`, shared `skills/`, and the Cursor rule under `rules/cursor/`. Profile keys meant for other hosts (`disallowedTools`, `subagents`) do not affect Cursor loading.
