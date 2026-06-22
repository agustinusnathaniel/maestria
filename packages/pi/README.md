# @maestria/pi

A [Pi coding agent](https://pi.software/) extension that brings Maestria's structured agent orchestration to Pi.

## Features

- **8 Specialist Prompts** — Orchestrator, Adventurer, Architect, Builder, Diagnose, Planner, Reviewer, Writer
- **3 Workflow Modes** — `fein` (full pipeline), `sonar` (research only), `blitz` (fast implementation)
- **Global Rules Injection** — Automatically injects orchestration rules via `before_agent_start`
- **Compaction Preservation** — Session state survives compaction with structured summaries
- **Subagent Dispatch** — Delegation via `@gotgenes/pi-subagents` with 6-field handoff validation
- **Maker/Checker Split** — Review mode blocks destructive tools. Dangerous bash patterns flagged.
- **2 Methodology Skills** — Handoff contract + iteration limits

## Installation

```bash
pi install npm:@maestria/pi
```

## Commands

| Command               | Description                                        |
| --------------------- | -------------------------------------------------- |
| `/fein <goal>`        | Full pipeline: recon → design → implement → review |
| `/sonar <goal>`       | Research only: recon → design → stop               |
| `/blitz <goal>`       | Fast implementation via builder directly           |
| `/orchestrate <goal>` | Delegate to the orchestrator prompt template       |
| `/review <target>`    | Enter review mode (read-only, no edits)            |
| `/maestria-status`    | Show current session state and handoff history     |

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
