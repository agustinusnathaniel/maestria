# @maestria/claude-code

A declarative Claude Code plugin that encodes the Maestria engineering methodology - 7 specialist agents, an orchestrator skill, a preloaded global-rules skill, and 3 workflow commands.

> This package is part of the Maestria project. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Status / Support Boundary

`Native candidate` - validates cleanly with the official CLI (`claude plugin validate --strict`) and follows the current documented plugin contract, but runtime behavior is **not yet tested end to end**. Upstream Claude Code docs are moving and unpinned; reverify any material claim before relying on it. Do not treat this package as a production support promise.

## Installation

```bash
# Persistent install via the maestria CLI (requires `claude` and `npm` on PATH)
npx maestria install claude-code
npx maestria status
npx maestria update claude-code
```

The CLI manages installation and updates through Claude Code's native plugin commands. Version pinning is not supported: updates always take the configured marketplace's latest package. See [INSTALL.md](https://github.com/agustinusnathaniel/maestria/blob/main/packages/claude-code/INSTALL.md) for the full checklist, verification, and uninstall.

## What It Provides

- **7 specialist agents** (`maestria:adventurer`, `architect`, `builder`, `diagnose`, `planner`, `reviewer`, `writer`), each preloading the global-rules skill.
- **2 skills** - `maestria:global-rules` (preloaded into every agent) and `maestria:orchestrator` (routing methodology).
- **3 workflow commands** - `/maestria:fein`, `/maestria:sonar`, `/maestria:blitz`.
- **Read-only enforcement** - adventurer, planner, and reviewer deny `Write`/`Edit` via `disallowedTools` (user-authorized; the only runtime enforcement).

## Support / Platform Notes

- Advisory vs enforced: skills, preloaded rules, and role prompts are advisory. The only runtime-enforced control is `disallowedTools: Write, Edit` on the three read-only roles; do not describe prompt rules as security enforcement.
- Ships no hooks or MCP servers, and writes no project or user `CLAUDE.md` files.
- If a preloaded skill cannot be resolved at session start, Claude Code skips it with a warning and the agent still loads.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/claude-code/) on the docs site
- [Installation checklist](https://github.com/agustinusnathaniel/maestria/blob/main/packages/claude-code/INSTALL.md)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/claude-code/CHANGELOG.md)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
