# @maestria/opencode

An OpenCode plugin that encodes Maestria's AI-engineering methodology as agents, rules, and workflows - a harness that makes model output consistent and reliable (`Agent = Model + Harness`).

> This package is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope. The agents and rules are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](../../CONTRIBUTING.md#3-the-sync-pipeline-core-concept).

## Installation

```bash
# Global install (recommended)
opencode plugin @maestria/opencode@latest -g

# Project-level install
opencode plugin @maestria/opencode@latest
```

OpenCode does not auto-update plugins; re-run the install command with `--force` to update. To uninstall, remove the `@maestria/opencode` entry from the `plugin` array in `~/.config/opencode/opencode.jsonc` (global) or `.opencode/opencode.jsonc` (project), then optionally delete the cached package under `~/.cache/opencode/packages/`. Alternatively, use the [maestria CLI](https://maestria.sznm.dev/cli/) to manage installation across all platforms.

## What It Provides

- **8 agents** - `@orchestrator` (delegates to the 7 specialists) plus `@adventurer`, `@architect`, `@builder`, `@diagnose`, `@planner`, `@reviewer`, and `@writer`, each a readable, editable markdown file with YAML frontmatter.
- **Global rules** - a rules file injected into every session (`rules/AGENTS.md`) encoding the universal floors: evidence, safety, delegation, review, and bounded repair.
- **Zero telemetry** - no data leaves your machine; the plugin makes no network calls of its own.

## Support / Platform Notes

- OpenCode-specific; Kimi Code, Hermes, Cursor, and other adaptations ship as separate `@maestria` packages.
- Does not bundle skills; domain skills are installed separately via the skills CLI.
- Rules are advisory prompt guidance, not a sandbox. The only structural enforcement is OpenCode's `permission` frontmatter (for example, the orchestrator cannot edit).
- The generated agents are projections of the canonical core directives. To change behavior, edit `packages/core/agent-directives/` and re-run the sync pipeline - never edit the generated files under `agents/` directly.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/opencode/) on the docs site
- [Changelog](CHANGELOG.md)

## Development

See the [contributing guide](../../CONTRIBUTING.md) for repository conventions.

## License

MIT
