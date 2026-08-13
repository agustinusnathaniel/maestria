# @maestria/hermes

Maestria's agent methodology - pipeline composition, maker/checker split, specialist delegation, and mode-based workflows - for [Hermes Agent](https://hermes-agent.nousresearch.com), delivered as a Python plugin.

> This package is part of Maestria. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope. The skills are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md#3-the-sync-pipeline-core-concept).

## Installation

Install as a Hermes plugin directly from this repository (the package is not published to PyPI):

```bash
hermes plugins install agustinusnathaniel/maestria/packages/hermes --enable
```

This clones the maestria repository, extracts `packages/hermes/`, and enables the plugin. See the [user-facing docs](https://maestria.sznm.dev/hermes/getting-started/installation/) for details, or the [Hermes docs](https://hermes-agent.nousresearch.com) for how plugin installation works.

## What It Provides

- **12 skills** - 9 methodology skills (7 specialists + orchestrator + global rules) plus 3 command workflow skills (`/fein`, `/sonar`, `/blitz`), generated from canonical core.
- **`llm_execution` middleware** - opt-in mode footer annotation (enable via `MAESTRIA_MODE_FOOTER=1`).
- **Workflow modes** - `/fein`, `/sonar`, `/blitz`, `/mode`, `/mode-clear` with mode-based tool gating (for example, sonar write-blocking via the `pre_tool_call` hook).
- **Mode prompt injection** - the `pre_llm_call` hook injects the active mode into the user message.
- **7 slash commands** - `/fein`, `/sonar`, `/blitz`, `/mode`, `/mode-clear`, `/review`, `/plan`.
- **OpenCode CLI routing** - an `opencode_route` tool for delegating complex coding tasks.
- **Session and subagent lifecycle hooks** - pipeline tracking across sessions and subagents.

## Support / Platform Notes

- Distributed as a git-based Hermes plugin from this repository; not published to PyPI or npm (the package's `package.json` is version-tracking only).
- Mode gating and role restrictions are implemented through Hermes' hook system; the methodology is otherwise advisory prompt guidance, not a sandbox.
- The skills are generated from the canonical core directives (to change them, edit `packages/core/agent-directives/` and re-run the sync pipeline - never edit the generated files under `src/maestria_hermes/skills/` directly); hooks, tools, middleware, and commands are hand-authored.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/hermes/) - installation, commands, quick start
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/hermes/CHANGELOG.md)

## Development

```bash
pnpm exec tsx ../core/scripts/sync.ts --verbose   # sync skills from core
ruff check src/
pytest
```

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
