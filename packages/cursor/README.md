# @maestria/cursor

A [Cursor](https://cursor.com/) plugin that brings Maestria's structured agent orchestration to Cursor IDE and Cursor CLI (`agent`).

> This package is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope. The agents, skills, and rules in this package are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](../../CONTRIBUTING.md#3-the-sync-pipeline-core-concept). Runtime support status is tracked in [ADR-CORE-014](../../docs/adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md) and the [runtime support matrix](../../docs/runtime-support-matrix.md).

## Motivation

Cursor gives you agents and a plugin system, but not an encoded engineering methodology. `@maestria/cursor` ships the Maestria methodology as a declarative Cursor plugin: 7 specialist Task agents, an orchestrator skill, always-on global rules, and `fein`/`sonar`/`blitz` workflow commands - in one bundle that works in both the Cursor IDE and Cursor CLI. Same harness, two surfaces.

## Goals

- **7 specialist agents** - adventurer, architect, builder, diagnose, planner, reviewer, writer as Task subagents.
- **Orchestrator skill** - dispatcher methodology, handoff contracts, maker/checker guidance.
- **Always-on global rules** - `rules/maestria-global.mdc` with `alwaysApply: true`.
- **Workflow commands** - `/fein`, `/sonar`, `/blitz`.
- **IDE + CLI parity** - one plugin bundle for both surfaces.

## Non-Goals

- **Does NOT include a build step** - this is a declarative Cursor plugin (manifest + agents + skills + rules + commands); no runtime code.
- **Does NOT enforce roles as a sandbox** - the read-only roles use Cursor's `readonly: true` runtime flag where supported, but the methodology is otherwise advisory prompt guidance.
- **Does NOT require an LLM provider** - model selection is Cursor configuration.

## Status / Support Boundary

`@maestria/cursor` is a declarative Cursor plugin published to npm. It is installed by copying the plugin bundle to `~/.cursor/plugins/local/maestria` (via the maestria CLI or manually) and is loaded by both Cursor IDE and Cursor CLI. The `readonly: true` flag on the read-only roles is Cursor's native runtime enforcement; the methodology itself is advisory.

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

See [INSTALL.md](./INSTALL.md) for the full checklist, including manual setup, verification, and uninstall.

## What It Provides

- **7 specialist agents** - adventurer, architect, builder, diagnose, planner, reviewer, writer (Task subagents)
- **Orchestrator skill** - dispatcher methodology, handoff contracts, maker/checker guidance
- **Always-on global rules** - `rules/maestria-global.mdc` with `alwaysApply: true`
- **Workflow commands** - `/fein`, `/sonar`, `/blitz`

### Commands

| Command  | Description                                        |
| -------- | -------------------------------------------------- |
| `/fein`  | Full pipeline: recon → design → implement → review |
| `/sonar` | Research only: recon → design → stop               |
| `/blitz` | Fast implementation via builder                    |

## Limitations / Platform Notes

- The plugin is declarative; there is no build step or runtime code, so enforcement beyond Cursor's `readonly: true` flag is advisory.
- The generated agents, skills, and rules are projections of the canonical core directives. To change behavior, edit `packages/core/agent-directives/` and re-run the sync pipeline - never edit the generated files under `agents/`, `skills/`, or `rules/` directly.

## Development

```bash
# Sync agents/skills/rules from core
cd packages/cursor && pnpm exec tsx ../core/scripts/sync.ts --verbose

# Test
pnpm --filter @maestria/cursor test

# Format, lint, type-check (repo root)
vp check
```

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/cursor/) on the docs site
- [Installation checklist](INSTALL.md)
- [Changelog](CHANGELOG.md)

## License

MIT
