## Specialist Agents (Cursor)

Use the @adventurer, @architect, @builder, @diagnose, @planner, @reviewer, and @writer native profiles for these role identities.

Delegate via the `Task` tool to the plugin's custom agents (`agents/`). Pass a complete handoff contract in the prompt.

### How to invoke

1. Use the complete router and global policy supplied by the always-apply native rule.
2. Call `Task` with the specialist agent name and a full handoff: Goal, Context, Requirements, Known problems, Assumptions, Success criteria, Next step.
3. For parallel independent work, launch multiple `Task` calls in one turn.

### Maker/checker (two-layer enforcement)

Cursor agents use a two-layer maker/checker split:

1. **Runtime enforcement** - `readonly: true` flag on `adventurer`, `planner`, and `reviewer` agents blocks write tools (Write, StrReplace, Delete) at the Cursor runtime level.
2. **Prompt-level guidance** - Agent prompts also include explicit read-only instructions as a backup.

Enforce the split: never send review work to the same agent that implemented; `reviewer` / `adventurer` / `planner` must not edit files.

## Workflow Commands

Users can trigger modes with slash commands from this plugin:

| Command | Pipeline |
| --- | --- |
| `/fein` | Full pipeline: adventurer → architect/planner → builder → reviewer |
| `/sonar` | Research only: adventurer → architect/planner → STOP |
| `/blitz` | Fast path: builder directly (skip optional recon/design unless unknown; required review remains) |

The Cursor Integration manifest selects native `agents/cursor/` profiles, shared `skills/`, and the Cursor command and rule paths.
