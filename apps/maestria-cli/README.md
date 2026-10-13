# maestria

A single CLI to install, update, and uninstall maestria runtime integrations across coding agent platforms, and to validate or stage portable Agent Plugins.

```bash
npx maestria status
```

> This project is part of maestria. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Usage

| Command | What it does |
| --- | --- |
| `maestria` | Show status (default) |
| `maestria install [--all\|platforms]` | Install for all detected platforms or specific ones (`opencode,pi`) |
| `maestria update [--all\|platforms]` | Update installed platforms; `--version 0.5.0` pins a version where the host supports it |
| `maestria uninstall [platform] [--all]` | Remove a platform installation (or all installed) |
| `maestria check <platform>` | Verify a platform installation |
| `maestria doctor` | Report skill copies left over from earlier CLI versions, without changing anything (read-only) |
| `maestria setup [--ecosystem ...] [--xtarterize-skills] [--skill-source ...]` | Coordinate optional setup across ecosystem tools and skills (nothing runs before confirm) |
| `maestria configure [platform] [--set agent=model,...]` | Choose which model each maestria specialist agent uses (opencode, codex, cursor, pi); `--set` configures non-interactively. Cursor global configuration edits the installed plugin's `agents/<role>.md`, and `maestria update cursor` carries configured models over |
| `maestria plugin validate <path>` | Validate an Agent Plugins v1 directory package without modifying it |
| `maestria plugin install [source]` | Fetch or stage a portable Agent Plugin into the maestria cache or an explicit destination |

### Methodology skills

Every maestria package bundles the `create-pull-request` and `docs-update` methodology skills (canonical source: `packages/core/agent-directives/skills/<skill>/SKILL.md`), so the CLI no longer installs them. Earlier versions installed them through the official `skills` CLI and recorded ownership per platform in `$XDG_CONFIG_HOME/maestria/skills.json` (version 2). `update` and `uninstall` now remove the copies that record lists, through the pinned `skills@1.7.0` CLI, and then drop the record entry; a copy whose path another agent still uses is kept and reported, and copies the record does not list are never removed. The removed `--skills`, `--exclude-skills`, and `--maestria-skills` flags fail before any change.

### Setup

`maestria setup` coordinates optional setup in one place: ecosystem binary detection (`codegraph`, `agent-browser`, `opensrc`) with manual install steps only, project skills via `xtarterize add agent/skills-install --json --cwd <dir>` (gated on the JSON status field, with `.gitignore` changes reported), and external skill sources via the `skills` CLI with per-source `project` or `global` scope. Detection is read-only; interactive mode groups the categories in one multiselect plus a review screen and final confirm, while non-TTY requires full flags plus `--yes` and never prompts. Reports are per action (`ok`/`failed`/`skipped` with resume guidance); reruns skip completed work via detection. Project scope follows `--cwd` (or the current directory). When OpenCode is detected, setup notes manual goal tracking only and never installs a goal plugin. Supports `--json` and `--quiet`.

### Doctor

`maestria doctor` reports leftover skill copies without changing anything: plugin install state from detection, the record entry from `skills.json`, and the tool-observed inventory from `skills list --json`. A recorded copy is a legacy CLI install that `maestria update <platform>` removes; an unrecorded copy duplicates the bundled skill, and doctor prints the manual removal command. Supports `--json` and `--quiet`. A corrupt record fails with a clear error; unknown platforms or agents degrade honestly with a note.

### Output options

- All commands accept `--json`.
- Runtime platform commands also accept `--quiet` and `--compact`; portable `plugin` commands do not.
- `check` requires a platform argument and outputs JSON by default.
- `--help` shows examples, exit codes, and AI-agent usage tips.

The CLI uses each host's installation mechanism and manages native agent/model configuration where supported.

## What It Provides

- **Unified plugin management** - `status`, `install`, `update`, `uninstall`, and `check` work the same way across every supported platform.
- **Interactive and scriptable** - interactive multiselect prompts, plus `--all`, comma-separated platforms, and machine-readable output.
- **Host-native integration** - drives each platform's native mechanism (OpenCode plugin manager, Pi package installer, OMP plugin installer, Kimi Code managed install, Cursor plugin directory, Hermes, Claude Code/Codex marketplaces and native Codex agent files). Devin and ZCode have no `install` target; stage the package with `maestria plugin install` and use the host's own installer.
- **Portable artifact workflow** - validates Agent Plugins v1 manifests, skills, MCP configuration, and path containment, then stages a package for a compatible client's own installer or directory loader.

## Support / Platform Notes

- Requires the target platform's CLI on `PATH`; the CLI cannot install a platform it cannot detect.
- npm is required for the Claude Code and Codex CLI adapters.
- Exact version pinning (`update <platform> --version`) is supported only where the host update path allows it; Claude Code and Codex CLI select the latest available package and reject `--version`.
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
