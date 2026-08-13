# @maestria/hermes

Maestria methodology plugin for [Hermes Agent](https://hermes-agent.ai).

Brings maestria's proven agent methodology -- pipeline composition, maker/checker split, specialist delegation, and mode-based workflows -- to the general-purpose Hermes AI agent.

> This package is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope. The skills in this package are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](../../CONTRIBUTING.md#3-the-sync-pipeline-core-concept). See [ADR-HM-000](../../docs/adr/hermes/ADR-HM-000-plugin-over-skills-only.md) for the plugin-vs-skills design rationale.

## Motivation

Hermes Agent is a general-purpose agent with its own plugin, hook, and command system. `@maestria/hermes` brings Maestria's engineering methodology to Hermes as a Python plugin: 7 specialist skills plus an orchestrator, the global rules contract, workflow modes, and mode-based tool gating - implemented against Hermes' native hooks and command surface rather than a bespoke skills-only file.

## Goals

- **Specialist delegation** - 7 specialist skills plus an orchestrator for pipeline composition.
- **Workflow modes** - `/fein`, `/sonar`, `/blitz`, `/mode`, `/mode-clear` with mode-based tool gating (for example, sonar write-blocking).
- **Mode prompt injection** - `pre_llm_call` hook injects the active mode into the user message.
- **Session and subagent lifecycle tracking** - `on_session_start`/`end` and `subagent_start`/`stop` hooks for pipeline tracking.
- **OpenCode CLI routing** - an `opencode_route` tool for delegating complex coding tasks.

## Non-Goals

- **Does NOT replace Hermes' built-in `explore`/`general` agents on focused/full routes** - the synced global rules instruct the orchestrator to use only the 7 maestria specialists and never delegate to Hermes' built-in agents that bypass the pipeline.
- **Does NOT enforce roles as a sandbox** - mode gating and role restrictions are implemented through Hermes hooks; the methodology is otherwise advisory prompt guidance.
- **Does NOT require a specific model** - model selection is Hermes configuration.

## Status / Support Boundary

`@maestria/hermes` is distributed as the `maestria-hermes` Python package (PyPI) and installed as a Hermes plugin. It is generated from the canonical core directives for the skill content, with hand-authored hooks, tools, middleware, and commands for the Hermes runtime. Mode and role behavior is implemented through Hermes' hook system; it is advisory guidance backed by those hooks, not a sandbox.

## Installation

```bash
hermes plugins install agustinusnathaniel/maestria/packages/hermes --enable
```

This clones the maestria monorepo, extracts `packages/hermes/`, and enables the plugin. It can also be installed as a PyPI package (`pip install maestria-hermes`). See the [user-facing docs](https://maestria.sznm.dev/hermes/getting-started/installation/) for details.

## What It Provides

- **9 skills** - 7 specialists + orchestrator + global rules (generated from canonical core).
- **Mode system with file persistence** - `/fein`, `/sonar`, `/blitz`, `/mode`, `/mode-clear`.
- **`pre_llm_call` hook** - mode injection into the user message.
- **`pre_tool_call` hook** - mode-based tool gating (sonar write-block).
- **`llm_execution` middleware** - opt-in mode footer via `MAESTRIA_MODE_FOOTER=1`.
- **7 slash commands** - `/fein`, `/sonar`, `/blitz`, `/mode`, `/mode-clear`, `/review`, `/plan`.
- **OpenCode CLI routing tool** (`opencode_route`) for delegating complex coding tasks.
- **Subagent lifecycle hooks** - `subagent_start`/`stop` for pipeline tracking.
- **Session lifecycle hooks** - `on_session_start`/`end`.

## Limitations / Platform Notes

- The skills are generated from the canonical core directives. To change behavior, edit `packages/core/agent-directives/` and re-run the sync pipeline - never edit the generated skill files under `src/maestria_hermes/skills/` directly.
- Mode-based gating (sonar write-block) is enforced through Hermes' `pre_tool_call` hook; other role guidance is advisory prompt text.
- See [ADR-HM-001](../../docs/adr/hermes/ADR-HM-001-long-lived-goals-scope.md) and [ADR-HM-002](../../docs/adr/hermes/ADR-HM-002-orchestration-policy.md) for the long-lived-goals scope and orchestration policy.

## Development

The package is Python-based (PyPI distribution `maestria-hermes`); `package.json` is version-tracking only and is not published to npm.

```bash
# Sync skills from core
cd packages/hermes && pnpm exec tsx ../core/scripts/sync.ts --verbose

# Lint (ruff)
ruff check src/

# Test (pytest)
pytest
```

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/hermes/) - installation, commands, quick start
- [Design doc](https://github.com/agustinusnathaniel/maestria/blob/main/docs/hermes-maestria-plugin.md) - architecture and implementation plan
- [Changelog](CHANGELOG.md)

## License

MIT
