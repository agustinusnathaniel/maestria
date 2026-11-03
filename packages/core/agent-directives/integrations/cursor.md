## Specialist Agents (Cursor)

Use the @reviewer native profile for independent review.

Delegate review via the `Task` tool to the plugin's `reviewer` agent (`agents/`). Pass a complete handoff contract in the prompt.

### How to invoke

1. Use the complete router and global policy supplied by the always-apply native rule.
2. Call `Task` with the `reviewer` agent and a brief per the global Delegation and Context rules.

### Maker/checker

`reviewer` declares `readonly: true` and carry explicit read-only instructions. Cursor CLI 2026.10.01 enforced `readonly` for project `.cursor/agents/` profiles but not for plugin-supplied profiles, so treat the plugin flag as intent and the prompt instructions as the operative control. A project-level profile written by `maestria configure cursor` carries the flag into `.cursor/agents/`, where Cursor enforces it.

Enforce the split: never send review work to the same agent that implemented; `reviewer` must not edit files.

## Workflow Commands

Users can trigger modes with slash commands from this plugin:

| Command | Pipeline |
| --- | --- |
| `/fein` | Full method: recon and architecture-plan skills → implement in the main loop → reviewer |
| `/sonar` | Research only: recon or architecture-plan in the main loop → STOP |
| `/blitz` | Fast path: implement directly (skip optional recon/design unless unknown; required review remains) |

The Cursor Integration manifest selects the shared root `agents/` profiles and `commands/`, shared `skills/`, and the Cursor rule under `rules/cursor/`. Profile keys meant for other hosts (`disallowedTools`, `subagents`) do not affect Cursor loading.
