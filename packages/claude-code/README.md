# @maestria/claude-code

A declarative Claude Code plugin that encodes the Maestria engineering methodology - 7 specialist agents, an orchestrator skill, a preloaded global-rules skill, and 3 workflow commands.

> This package is part of Maestria. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope. The agents, skills, and commands are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md#3-the-sync-pipeline-core-concept).

## Status / Support Boundary

`Native candidate` - the plugin validates cleanly with the official CLI (`claude plugin validate --strict`) and follows the current documented plugin contract, but runtime behavior is **not yet tested end to end**. Upstream Claude Code docs are moving and unpinned; reverify any material claim before relying on it. Do not treat this package as a production support promise.

## Installation

```bash
# Persistent install via the maestria CLI (requires `claude` and `npm` on PATH)
npx maestria install claude-code
npx maestria status
npx maestria update claude-code
```

The CLI stages the published package into a local Claude Code marketplace cache, then delegates installation and updates to Claude Code's native plugin commands. Version pinning is not supported: Claude Code updates from the configured marketplace's latest package. For a session-local run without installing, use `claude --plugin-dir ./packages/claude-code`. See [INSTALL.md](https://github.com/agustinusnathaniel/maestria/blob/main/packages/claude-code/INSTALL.md) for the full checklist, verification, and uninstall.

## What It Provides

- **7 specialist agents** (`maestria:adventurer`, `architect`, `builder`, `diagnose`, `planner`, `reviewer`, `writer`), each preloading the global-rules skill.
- **2 skills** - `maestria:global-rules` (preloaded into every agent) and `maestria:orchestrator` (routing methodology).
- **3 workflow commands** - `/maestria:fein`, `/maestria:sonar`, `/maestria:blitz`.
- **Read-only enforcement** - adventurer, planner, and reviewer deny `Write`/`Edit` via `disallowedTools` (user-authorized; the only runtime enforcement).

## Support / Platform Notes

- Advisory vs enforced: skills, preloaded rules, and role prompts are advisory. The only runtime-enforced control is `disallowedTools: Write, Edit` on the three read-only roles; do not describe prompt rules as security enforcement.
- No hooks, MCP servers, or runtime code; no `rules/` directory, and no project or user `CLAUDE.md` files are written.
- Runtime resolution of the plugin-scoped skill preload is not yet verified against a live session; if a preloaded skill cannot be resolved, Claude Code skips it with a warning and the agent still loads.
- The generated components are projections of the canonical core directives. To change behavior, edit `packages/core/agent-directives/` and re-run the sync pipeline - never hand-edit generated files.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/claude-code/) on the docs site
- [Installation checklist](https://github.com/agustinusnathaniel/maestria/blob/main/packages/claude-code/INSTALL.md)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/claude-code/CHANGELOG.md)

## Development

```bash
pnpm test        # manifest and generated-file assertions
pnpm validate    # claude plugin validate . --strict (requires the Claude CLI)
```

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
