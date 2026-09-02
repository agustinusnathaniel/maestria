# maestria

A single CLI to install, update, and uninstall Maestria runtime integrations across coding agent platforms, and to validate or stage portable Agent Plugins.

```bash
npx maestria status
```

> This project is part of Maestria. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Usage

| Command | What it does |
| --- | --- |
| `maestria` | Show status (default) |
| `maestria install [--all\|platforms]` | Install for all detected platforms or specific ones (`opencode,pi`) |
| `maestria update [--all\|platforms]` | Update installed platforms; `--version 0.5.0` pins a version where the host supports it |
| `maestria uninstall [platform] [--all]` | Remove a platform installation (or all installed) |
| `maestria check <platform>` | Verify a platform installation |
| `maestria configure [platform] [--set agent=model,...]` | Choose which model each Maestria specialist agent uses (opencode, codex, cursor, pi, omp); `--set` configures non-interactively |
| `maestria plugin validate <path>` | Validate an Agent Plugins v1 directory package without modifying it |
| `maestria plugin install [source]` | Fetch or stage a portable Agent Plugin into the Maestria cache or an explicit destination |

All commands accept `--json`. Runtime platform commands also accept `--quiet` and `--compact`; `check` requires a platform argument and outputs JSON by default. The portable `plugin` commands support `--json` but not the runtime output flags. `--help` shows in-terminal examples, exit codes, and AI-agent usage tips. Wherever a platform has its own plugin manager, the CLI delegates to it rather than mutating host configuration directly.

## What It Provides

- **Unified plugin management** - `status`, `install`, `update`, `uninstall`, and `check` work the same way across every supported platform.
- **Interactive and scriptable** - interactive multiselect prompts, plus `--all`, comma-separated platforms, and machine-readable output.
- **Host-native integration** - drives each platform's native mechanism (OpenCode plugin manager, Pi/OMP package registration, Kimi Code managed install, Cursor plugin directory, Prime Agent package manager, Claude Code/Codex marketplaces and native Codex agent files).
- **Portable artifact workflow** - validates Agent Plugins v1 manifests, skills, MCP configuration, and path containment, then stages a package for a compatible client's own installer or directory loader.

## Support / Platform Notes

- Requires the target platform's CLI on `PATH`; the CLI cannot install a platform it cannot detect.
- npm is required for the Claude Code and Codex CLI adapters.
- Exact version pinning (`update <platform> --version`) is supported only where the host update path allows it; Claude Code, Codex CLI, and Prime Agent select the latest available package and reject `--version`.
- Prime Agent support is deliberately global (user scope only): project registrations are never scanned or modified. A version-pinned user registration is reported as an error rather than silently skipped.
- Pi uninstall leaves the shared `@gotgenes/pi-subagents` peer dependency in place unless removed separately.
- The CLI manages plugin installation and native agent/model configuration where the host exposes a stable file format; it does not run agents or enforce methodology.
- `maestria plugin install` stages a portable package but does not activate it in every client. Client activation, permissions, trust, and session behavior remain client-owned.

## Documentation and Changelog

- [CLI documentation](https://maestria.sznm.dev/cli/) on the docs site
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/apps/maestria-cli/CHANGELOG.md)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
