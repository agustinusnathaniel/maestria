# @maestria/pi

A [Pi coding agent](https://pi.software/) extension that brings Maestria's structured agent orchestration to Pi.

## Features

- **8 Specialist Prompts** - Orchestrator, Adventurer, Architect, Builder, Diagnose, Planner, Reviewer, Writer
- **3 Workflow Modes** - `fein` (full pipeline), `sonar` (research only), `blitz` (fast implementation)
- **Global Rules Injection** - Automatically injects orchestration rules via `before_agent_start`
- **Compaction Preservation** - Session state survives compaction with structured summaries
- **Subagent Dispatch** - Delegation via `@gotgenes/pi-subagents` with 6-field handoff validation
- **Maker/Checker Split** - Review mode blocks destructive tools. Dangerous bash patterns flagged.
- **2 Methodology Skills** - Handoff contract + iteration limits

## Installation

```bash
pi install npm:@maestria/pi
```

Alternatively, use the [maestria CLI](https://maestria.sznm.dev/cli/) to manage installation across all platforms from a single command.

## Commands

| Command | Description |
| --- | --- |
| `/fein <goal>` | Set workflow mode to full pipeline (recon → design → impl → review) |
| `/sonar <goal>` | Set workflow mode to research only (recon → design → stop) |
| `/blitz <goal>` | Set workflow mode to fast implementation (builder directly) |
| `/orchestrate <goal>` | Start a full pipeline by delegating to the orchestrator |
| `/review <target>` | Enter review mode - blocks destructive tools, sets read-only toolset |
| `/restore-model` | Restore the original model and tools active before review mode |
| `/handoff <goal>` | Generate a structured handoff prompt for a new task context |
| `/review-model <model-id>` | Set which model to use when entering review mode |
| `/maestria-status` | Show current maestria session state including handoff history |

## Development

```bash
# Install dependencies
pnpm install

# Build
vp pack

# Test
vp test

# Format, lint, type-check
vp check
```

## License

MIT
