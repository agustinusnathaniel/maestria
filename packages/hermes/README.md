# @maestria/hermes

Maestria's agent methodology - structured specialist delegation, maker/checker review, and mode-based workflows - for [Hermes Agent](https://hermes-agent.nousresearch.com), delivered as a Python plugin.

> This package is part of the Maestria project. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Installation

Install the Hermes plugin directly from this repository:

```bash
hermes plugins install agustinusnathaniel/maestria/packages/hermes --enable
```

This clones the maestria repository and enables the plugin. See the [user-facing docs](https://maestria.sznm.dev/hermes/getting-started/installation/) for details, or the [Hermes docs](https://hermes-agent.nousresearch.com) for how plugin installation works.

## What It Provides

- **12 skills** - 9 methodology skills (7 specialists + orchestrator + global rules) plus 3 command workflow skills (`/fein`, `/sonar`, `/blitz`).
- **`llm_execution` middleware** - opt-in mode footer annotation (enable via `MAESTRIA_MODE_FOOTER=1`).
- **Workflow modes** - `/fein`, `/sonar`, `/blitz`, `/mode`, `/mode-clear` with mode-based tool gating (for example, sonar write-blocking).
- **Mode prompt injection** - the active mode is injected into the model context.
- **7 slash commands** - `/fein`, `/sonar`, `/blitz`, `/mode`, `/mode-clear`, `/review`, `/plan`.
- **OpenCode CLI routing** - an `opencode_route` tool for delegating complex coding tasks.
- **Session and subagent tracking** - pipeline tracking across sessions and subagents.

## Support / Platform Notes

- The plugin installation path is git-based and uses Hermes's plugin manager. The repository also defines a `maestria-hermes` Python distribution, but this package README documents the Hermes plugin path rather than a separate Python installation flow.
- Mode gating and role restrictions are applied at the tool layer; the methodology is otherwise advisory prompt guidance, not a sandbox.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/hermes/) - installation, commands, quick start
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/hermes/CHANGELOG.md)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
