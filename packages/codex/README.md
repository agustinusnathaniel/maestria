# @maestria/codex

A Codex CLI package that ships Maestria's agent methodology as namespaced `$maestria:*` skills and native custom-agent roles.

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

The published package is also available through the repository's native Codex marketplace:

```bash
codex plugin marketplace add agustinusnathaniel/maestria
codex plugin add maestria@maestria
```

That direct path installs the plugin and skills. Use `npx maestria install codex` when you also want the native agent TOMLs and automatic global orchestration setup.

## What It Provides

- **14 namespaced skills** - `$maestria:global-rules`, `$maestria:orchestrator`, the 7 specialists (adventurer, architect, builder, diagnose, planner, reviewer, writer), `$maestria:handoff`, `$maestria:iteration-limits`, and the workflow modes `$maestria:fein`, `$maestria:sonar`, `$maestria:blitz`.
- **7 native custom agents** - the Maestria CLI installs `maestria-*` agent TOMLs into Codex's native `$CODEX_HOME/agents/` directory, with read-only sandbox settings for reconnaissance, architecture, planning, and review roles.
- **Automatic orchestration** - the Maestria CLI installs a marked global Codex instruction block that activates the orchestrator workflow in the primary session and routes specialist work to the native roles.
- **Maestria CLI compatibility** - install, status, check, update, and uninstall through the CLI.
- **Native model configuration** - `maestria configure codex` can create or update Codex custom-agent TOML files without overwriting unrelated agent settings.

## Support / Platform Notes

- Workflow modes ship as skills, not slash commands.
- Read-only specialist boundaries are documented guidance, not tool enforcement; Codex's own sandbox, approvals, and hook trust controls remain the host boundary.
- The plugin manifest declares skills; the companion CLI installs native agent TOMLs and a marked global instruction block, preserves model/reasoning/service-tier settings across updates, and removes only Maestria-owned content on uninstall.
- `maestria install codex` provides automatic routing for normal sessions. Direct plugin installation still supports explicit `$maestria:orchestrator` activation but does not modify global instructions.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/codex/) on the docs site
- [Installation checklist](https://github.com/agustinusnathaniel/maestria/blob/main/packages/codex/INSTALL.md)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/codex/CHANGELOG.md)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
