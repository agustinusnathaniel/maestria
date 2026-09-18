# @maestria/opencode

An OpenCode plugin that provides Maestria's specialist agents, shared engineering rules, and review workflows.

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
- **Global rules** - shared requirements injected into every session for evidence, safety, delegation, review, and bounded repair.
- **Project customization** - when the project root contains `.maestria/workflow.md` or `.maestria/rules.md`, the full content of each file that exists is injected fresh on every model call in deterministic order (workflow first, then rules). Projects without these files see no behavior change.
- **Zero plugin telemetry** - the plugin makes no network calls of its own.

## Project Customization Details

The project root resolves from the SDK project worktree, then the worktree path, then the session directory; a `/` sentinel is skipped so a non-git open directory still resolves. Only the project root is read; no nested or ancestor lookup applies. Files are read fresh on every model call through `experimental.chat.system.transform`, so edits apply on the next call with no restart and no stale snapshot. The same pipeline covers primary and subagent calls, including calls after compaction; a compaction note also asks the summary to preserve active project constraints. This path is separate from `config.instructions`: the pinned host file loader swallows read failures to empty and plugin init/config errors are swallowed, while a transform error here propagates as a failed model call instead of running with silently absent config (verified against pinned host v1.18.31 by source inspection plus package tests, no live model run). A project file that exists but cannot be used (directory, special file, unreadable, unresolvable, or a link resolving outside the root) fails the call loudly instead of being skipped. Diagnostics name only the relative file and the failure kind; symlink targets are canonicalized against the root and the resolved target must be a regular file. Checks observe the filesystem at call time and are not an atomic snapshot. Loaded project guidance stays subordinate: it may replace configurable workflows but never waives safety, authorization, or host permissions.

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
