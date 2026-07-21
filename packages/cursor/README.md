# @maestria/cursor

A [Cursor](https://cursor.com/) plugin that brings Maestria's structured agent orchestration to Cursor IDE and Cursor CLI (`agent`).

## Features

- **7 specialist agents** — adventurer, architect, builder, diagnose, planner, reviewer, writer (Task subagents)
- **Orchestrator skill** — dispatcher methodology, handoff contracts, maker/checker guidance
- **Always-on global rules** — `rules/maestria-global.mdc` with `alwaysApply: true`
- **Workflow commands** — `/fein`, `/sonar`, `/blitz`, `/orchestrate`
- **IDE + CLI parity** — one plugin bundle for both surfaces

## Installation

### Recommended: via maestria CLI

```bash
pnpx maestria@latest install cursor
```

Copies the plugin to `~/.cursor/plugins/local/maestria`. Restart Cursor IDE, or in CLI:

```bash
agent --plugin-dir ~/.cursor/plugins/local/maestria
```

### Alternative: local development

From a checkout of this monorepo:

```bash
agent --plugin-dir ./packages/cursor
```

See [INSTALL.md](./INSTALL.md) for the full checklist.

## Commands

| Command        | Description                                        |
| -------------- | -------------------------------------------------- |
| `/fein`        | Full pipeline: recon → design → implement → review |
| `/sonar`       | Research only: recon → design → stop               |
| `/blitz`       | Fast implementation via builder                    |
| `/orchestrate` | Start orchestration for a goal                     |

## Development

```bash
# Sync agents/skills/rules from core
cd packages/cursor && npx tsx ../core/scripts/sync.ts --verbose

# Test
pnpm --filter @maestria/cursor test

# Format, lint, type-check (repo root)
vp check
```

Canonical prompts live in `packages/core/agent-directives/`. Edit those, then sync. Never edit generated files under `agents/`, `skills/`, or `rules/` directly.

## License

MIT
