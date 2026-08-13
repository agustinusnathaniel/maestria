# maestria

A single CLI to install, update, and uninstall Maestria plugins across coding agent platforms - OpenCode, Oh My Pi, Pi, Kimi Code, Hermes, Cursor, Claude Code, and Codex CLI.

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
| `maestria uninstall <platform>` | Remove a platform installation |
| `maestria check` | Verify a platform installation |

All commands accept `--json`, `--quiet`, and `--compact` for scripting and CI, and `--help` shows in-terminal examples, exit codes, and AI-agent usage tips.

```bash
# Check status
npx maestria

# Install for all detected platforms
npx maestria install --all

# Update everything
npx maestria update --all

# Remove the Pi extension
npx maestria uninstall pi

# Machine-readable output for CI
npx maestria status --json --quiet
```

Wherever a platform has its own plugin manager, the CLI delegates to it rather than mutating host configuration directly.

## What It Provides

- **Unified plugin management** - `status`, `install`, `update`, `uninstall`, and `check` work the same way across every supported platform.
- **Interactive and scriptable** - interactive multiselect prompts, plus `--all`, comma-separated platforms, and machine-readable output.
- **Host-native delegation** - drives each platform's native mechanism (OpenCode plugin manager, Pi/OMP package registration, Kimi Code managed install under `~/.kimi-code/plugins/managed/maestria` copying `rules/AGENTS.md` and reading `kimi.plugin.json`, Cursor plugin directory, Claude Code/Codex marketplaces).

## Support / Platform Notes

- Requires the target platform's CLI on `PATH`; the CLI cannot install a platform it cannot detect.
- npm is required for the Claude Code and Codex CLI adapters (they stage published packages into local marketplaces under `~/.cache/maestria/`).
- Exact version pinning (`update <platform> --version`) is supported only where the host update path allows it; Claude Code and Codex CLI select the latest staged package and reject `--version`.
- Pi uninstall leaves the shared `@gotgenes/pi-subagents` peer dependency in place unless removed separately.
- The CLI manages plugin installation only; it does not run agents or enforce methodology.

## Documentation and Changelog

- [CLI documentation](https://maestria.sznm.dev/cli/) on the docs site
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/apps/maestria-cli/CHANGELOG.md)

## Development

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
