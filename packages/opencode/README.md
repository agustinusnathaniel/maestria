# @maestria/opencode

An OpenCode plugin that encodes Maestria's AI-engineering methodology as agents, rules, and workflows - a harness that makes model output consistent and reliable (`Agent = Model + Harness`).

> This package is part of the Maestria project. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Installation

```bash
# Global install (recommended)
opencode plugin @maestria/opencode@latest -g

# Project-level install
opencode plugin @maestria/opencode@latest
```

OpenCode does not auto-update plugins; re-run the install command with `--force` to update. To uninstall, remove the `@maestria/opencode` entry from the `plugin` array in `~/.config/opencode/opencode.jsonc` (global) or `.opencode/opencode.jsonc` (project). Alternatively, use the [maestria CLI](https://maestria.sznm.dev/cli/) to manage installation across all platforms.

## What It Provides

- **8 agents** - `@orchestrator` (delegates to the 7 specialists) plus `@adventurer`, `@architect`, `@builder`, `@diagnose`, `@planner`, `@reviewer`, and `@writer`.
- **Global rules** - rules injected into every session encoding the universal floors: evidence, safety, delegation, review, and bounded repair.
- **Zero telemetry** - no data leaves your machine; the plugin makes no network calls of its own.

## Support / Platform Notes

- OpenCode-specific; Kimi Code, Hermes, Cursor, and other adaptations ship as separate `@maestria` packages.
- Does not bundle skills; domain skills are installed separately via the skills CLI.
- Rules are advisory prompt guidance, not a sandbox. The only structural enforcement is OpenCode's `permission` frontmatter (for example, the orchestrator cannot edit).

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/opencode/) on the docs site
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/opencode/CHANGELOG.md)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
