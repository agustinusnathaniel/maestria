# @maestria/codex

A Codex CLI package that ships Maestria's agent methodology as namespaced `$maestria:*` skills.

> This package is part of the Maestria project. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Status / Support Boundary

Verified against Codex CLI 0.145.0 on 2026-08-26. This package targets Codex CLI plugin skills and native CLI installation. Codex desktop parity and runtime tool enforcement remain outside this package.

## Installation

```bash
# Supported convenience path (requires Codex CLI and npm on PATH)
npx maestria install codex
npx maestria status
npx maestria update codex
npx maestria uninstall codex
```

The CLI installs and updates the plugin through Codex's `plugin add` flow. Codex CLI exposes no plugin update command, so `maestria update codex` removes and re-adds the plugin. Exact version pinning is not available. See [INSTALL.md](https://github.com/agustinusnathaniel/maestria/blob/main/packages/codex/INSTALL.md) for the full checklist and verification.

## What It Provides

- **14 namespaced skills** - `$maestria:global-rules`, `$maestria:orchestrator`, the 7 specialists (adventurer, architect, builder, diagnose, planner, reviewer, writer), `$maestria:handoff`, `$maestria:iteration-limits`, and the workflow modes `$maestria:fein`, `$maestria:sonar`, `$maestria:blitz`.
- **7 native custom agents** - the Maestria CLI installs `maestria-*` agent TOMLs into Codex's native `$CODEX_HOME/agents/` directory, with read-only sandbox settings for reconnaissance, architecture, planning, and review roles.
- **Maestria CLI compatibility** - install, status, check, update, and uninstall through the CLI.
- **Native model configuration** - `maestria configure codex` can create or update Codex custom-agent TOML files without overwriting unrelated agent settings.

## Support / Platform Notes

- Workflow modes ship as skills, not slash commands.
- Read-only specialist boundaries are documented guidance, not tool enforcement; Codex's own sandbox, approvals, and hook trust controls remain the host boundary.
- The plugin manifest ships skills; the companion CLI installs native agent TOMLs, preserves model/reasoning/service-tier settings across updates, and writes no `AGENTS.md` file.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/codex/) on the docs site
- [Installation checklist](https://github.com/agustinusnathaniel/maestria/blob/main/packages/codex/INSTALL.md)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/codex/CHANGELOG.md)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
