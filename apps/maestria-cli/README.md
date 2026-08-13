# maestria

A single CLI to manage maestria plugins across all coding agent platforms - OpenCode, Oh My Pi, Kimi Code, Pi, Hermes, Cursor, Claude Code, and Codex CLI.

```bash
npx maestria status
```

> This project is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope.

## Motivation

Each coding agent platform installs maestria differently. OpenCode uses its own plugin manager, Pi and Oh My Pi use package registration, Kimi Code reads an `installed.json` registry, Cursor copies a plugin directory, and Claude Code and Codex CLI use host-native marketplaces. Hunting through each platform's README for the right command is slow and error-prone.

`maestria` wraps all of them behind one interface. Check what's installed, install for a platform, or update everything from a single command - including platforms whose install steps are non-trivial (staging npm packages into local marketplaces, wiring peer dependencies, and navigating plugin registries).

## Goals

- **One command per operation** - `status`, `install`, `update`, `uninstall`, and `check` work the same way across every supported platform.
- **Host-native state** - wherever a platform has its own plugin manager, the CLI delegates to it rather than mutating host configuration directly.
- **Agent and CI friendly** - `--json`, `--compact`, and `--quiet` flags plus documented exit codes make the CLI scriptable.
- **Version-aware** - network-first version lookups and correct semver comparison so updates and status are accurate.

## Non-Goals

- **Does NOT replace a platform's own plugin manager** - for OpenCode, Pi, Oh My Pi, Kimi Code, Cursor, Claude Code, and Codex CLI, the CLI drives the platform's native mechanism; it is not an independent install source.
- **Does NOT add new platforms** - platform support lives in the per-package adapters, not here.
- **Does NOT enforce runtime behavior** - the CLI manages plugin installation only; it does not run agents or enforce methodology.
- **Does NOT pin versions for marketplace-backed hosts** - Claude Code and Codex CLI select the latest staged package; exact version pinning is rejected for those adapters.

## Status / Support Boundary

The CLI is published to npm as the `maestria` package and is the supported convenience path for installing, checking, updating, and removing Maestria plugins. It requires the target platform's CLI on `PATH` (`opencode`, `pi`, `kimi`, `hermes`, `agent`, `claude`, or `codex`), and npm is required for Claude Code and Codex CLI because the CLI stages their published packages into local marketplaces under `~/.cache/maestria/`.

## Usage

### Commands

| Command | What it does |
| --- | --- |
| `maestria` | Show status (default) |
| `maestria status` | Show installed plugins and version info |
| `maestria install` | Interactive platform install (multiselect) |
| `maestria install --all` | Install for all detected platforms |
| `maestria install opencode` | Install for a specific platform |
| `maestria install claude-code` | Install the Claude Code plugin through its native marketplace |
| `maestria install codex` | Install the Codex CLI projection through its native marketplace |
| `maestria install opencode,pi` | Install for multiple comma-separated platforms |
| `maestria update` | Interactive platform update (grouped multiselect with `a` toggle-all) |
| `maestria update --all` | Update all installed platforms |
| `maestria update opencode,pi` | Update multiple comma-separated platforms |
| `maestria update opencode --version 0.5.0` | Update to a specific version |

All commands accept `--json` (machine-readable), `--quiet` (suppress spinners), and `--compact` (machine-friendly text - ideal for AI agents). The root command also accepts `--version` to print the version number and exit. The `update` command additionally accepts `--version`/`-V` to pin a specific version where the host supports it. Claude Code and Codex CLI use latest-only marketplace updates and reject `--version`.

### Examples

```bash
# Check status (no arguments = status)
npx maestria

# Install interactively
npx maestria install

# Install for all platforms
npx maestria install --all

# Install for multiple specific platforms
npx maestria install opencode,pi

# Install the marketplace-backed plugins
npx maestria install claude-code,codex

# Update everything
npx maestria update --all

# Update multiple platforms simultaneously
npx maestria update opencode,pi

# Update to a specific version
npx maestria update opencode --version 0.5.0

# JSON output for CI
npx maestria status --json --quiet

# Compact output (AI agents, token-sensitive pipelines)
npx maestria status --compact

# Check version
npx maestria --version
```

### Input validation

Invalid arguments are caught early:

```bash
$ npx maestria update unknown
Unknown platform 'unknown'. Valid platforms: opencode, omp, pi, kimi-code, hermes, cursor, claude-code, codex

$ npx maestria update opencode --version 2.0
Invalid version '2.0'. Use semver format (e.g., 0.5.0) or 'latest'.

$ npx maestria install opencode --all
Cannot use --all with a specific platform. Choose one.
```

### Exit Codes

| Code  | Meaning                                |
| ----- | -------------------------------------- |
| `0`   | Success                                |
| `1`   | Validation or command error            |
| `130` | User cancelled (interactive mode only) |

Run any command with `--help` to see in-terminal examples and exit code documentation, including a TIP FOR AI AGENTS section with usage guidance for automated environments.

### Version caching

npm version lookups use a **network-first** strategy: the CLI always fetches the latest version from npm, falling back to `~/.cache/maestria/versions.json` only when the network call fails. The cache is updated automatically after every successful fetch. Delete the cache to force a fresh start:

```bash
rm ~/.cache/maestria/versions.json
```

## What It Provides

- **Unified plugin management** - `status`, `install`, `update`, `uninstall`, and `check` for OpenCode, Oh My Pi, Pi, Kimi Code, Hermes, Cursor, Claude Code, and Codex CLI.
- **Interactive and scriptable modes** - interactive multiselect prompts, plus `--all`, comma-separated platforms, and machine-readable output.
- **Host-native delegation** - delegates install/update/uninstall state to each platform's own mechanism (OpenCode plugin, Pi/OMP package registration, Kimi `installed.json`, Cursor plugin directory, Claude Code/Codex marketplace).

## Limitations / Platform Notes

- Requires the platform CLI on `PATH`; the CLI cannot install a platform it cannot detect.
- npm is required for the Claude Code and Codex CLI adapters (they stage published npm packages into local marketplaces).
- Exact version pinning (`update <platform> --version`) is supported only where the host update path allows it; Claude Code and Codex CLI reject it.
- Pi uninstall leaves the shared `@gotgenes/pi-subagents` peer dependency in place unless you remove it separately.

## Development

```bash
# Install dependencies
vp install

# Format, lint, and type-check
vp check

# Build
pnpm build

# Dev (watch mode)
pnpm dev

# Type-check
pnpm typecheck

# Run locally
node dist/index.js status
```

The CLI is built on **Effect v4** (typed errors, structured concurrency), **citty** (CLI routing), **@clack/prompts** (interactive prompts), **picocolors** (output), and **vite-plus** (bundles to a single self-contained `.mjs` file).

## Documentation and Changelog

- [CLI documentation](https://maestria.sznm.dev/cli/) on the docs site
- [Changelog](CHANGELOG.md)

## License

MIT
