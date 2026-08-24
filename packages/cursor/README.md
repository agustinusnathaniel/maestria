# @maestria/cursor

A declarative [Cursor](https://cursor.com/) plugin that brings Maestria's structured agent orchestration to Cursor IDE and Cursor CLI (`agent`) - 7 specialist Task agents, an orchestrator skill, always-on global rules, and workflow commands.

> This package is part of the Maestria project. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Installation

```bash
# Recommended: via the maestria CLI (installs the plugin to ~/.cursor/plugins/local/maestria)
pnpx maestria@latest install cursor
```

Restart Cursor IDE, or load the plugin in Cursor CLI with `agent --plugin-dir ~/.cursor/plugins/local/maestria`. See [INSTALL.md](https://github.com/agustinusnathaniel/maestria/blob/main/packages/cursor/INSTALL.md) for the full checklist, manual setup, verification, and uninstall.

## What It Provides

- **7 specialist Task agents** - adventurer, architect, builder, diagnose, planner, reviewer, writer.
- **Orchestrator skill** - dispatcher methodology, handoff contracts, maker/checker guidance.
- **Always-on global rules** - `rules/maestria-global.mdc` with `alwaysApply: true`.
- **Workflow commands** - `/fein` (full pipeline), `/sonar` (research only), `/blitz` (fast implementation).

## Support / Platform Notes

- Read-only roles use Cursor's `readonly: true` runtime flag where supported; everything else is advisory prompt guidance, not a sandbox.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/cursor/) on the docs site
- [Installation checklist](https://github.com/agustinusnathaniel/maestria/blob/main/packages/cursor/INSTALL.md)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/cursor/CHANGELOG.md)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
