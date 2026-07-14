# maestria

A single CLI to manage maestria plugins across all coding agent platforms - OpenCode, Kimi Code, and Pi.

```bash
npx maestria status
```

## Why

Each coding agent platform installs maestria differently. `maestria` wraps them all behind one interface. Check what's installed, install for a platform, or update everything - no more hunting through READMEs for the right command.

## Commands

| Command | What it does |
| --- | --- |
| `maestria` | Show status (default) |
| `maestria status` | Show installed plugins and version info |
| `maestria install` | Interactive platform install (multiselect) |
| `maestria install --all` | Install for all detected platforms |
| `maestria install opencode` | Install for a specific platform |
| `maestria install opencode,pi` | Install for multiple comma-separated platforms |
| `maestria update` | Interactive platform update (grouped multiselect with `a` toggle-all) |
| `maestria update --all` | Update all installed platforms |
| `maestria update opencode,pi` | Update multiple comma-separated platforms |
| `maestria update opencode --version 0.5.0` | Update to a specific version |

All commands accept `--json` (machine-readable), `--quiet` (suppress spinners), and `--compact` (machine-friendly text - ideal for AI agents). The root command also accepts `--version` to print the version number and exit. The `update` command additionally accepts `--version`/`-V` to pin a specific version.

## Usage

```bash
# Check status (no arguments = status)
npx maestria

# Install interactively
npx maestria install

# Install for all platforms
npx maestria install --all

# Install for multiple specific platforms
npx maestria install opencode,pi

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
Unknown platform 'unknown'. Valid platforms: opencode, pi, kimi-code

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

## Prerequisites

- Node.js 22+
- The platform CLI must be on `$PATH` (`opencode`, `pi`, or `kimi`)

## Supported Platforms

| ID          | Platform  | npm package           |
| ----------- | --------- | --------------------- |
| `opencode`  | OpenCode  | `@maestria/opencode`  |
| `pi`        | Pi        | `@maestria/pi`        |
| `kimi-code` | Kimi Code | `@maestria/kimi-code` |

## Tech Stack

- **Effect v4** - typed errors, structured concurrency, Effect-based platform operations
- **citty** - lightweight CLI routing with typed arg definitions
- **@clack/prompts** - interactive spinners and selection prompts
- **picocolors** - terminal output coloring
- **vite-plus** - bundles to a single self-contained `.mjs` file

## Development

```bash
# Build
pnpm build

# Dev (watch mode)
pnpm dev

# Type-check
pnpm typecheck

# Run locally
node dist/index.js status
```

## Related

- [Maestria CLI documentation](https://maestria.sznm.dev/cli/)
- [ADR-CORE-007](../../docs/adr/core/ADR-CORE-007-cli-package-plugin-management.md) - Architecture decision for this CLI
