# maestria

A single CLI to manage maestria plugins across all coding agent platforms — OpenCode, Kimi Code, and Pi.

```bash
npx maestria status
```

## Why

Each coding agent platform installs maestria differently. `maestria` wraps them all behind one interface. Check what's installed, install for a platform, or update everything — no more hunting through READMEs for the right command.

## Commands

| Command                     | What it does                            |
| --------------------------- | --------------------------------------- |
| `maestria`                  | Show status (default)                   |
| `maestria status`           | Show installed plugins and version info |
| `maestria install`          | Interactive platform install            |
| `maestria install --all`    | Install for all detected platforms      |
| `maestria install opencode` | Install for a specific platform         |
| `maestria update`           | Interactive platform update             |
| `maestria update --all`     | Update all installed platforms          |

All commands accept `--json` (machine-readable) and `--quiet` (suppress spinners).

## Usage

```bash
# Check status (no arguments = status)
npx maestria

# Install interactively
npx maestria install

# Install for all platforms
npx maestria install --all

# Update everything
npx maestria update --all

# JSON output for CI
npx maestria status --json --quiet
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

- **Effect v4** — typed errors, structured concurrency, Effect-based platform operations
- **citty** — lightweight CLI routing with typed arg definitions
- **@clack/prompts** — interactive spinners and selection prompts
- **picocolors** — terminal output coloring
- **vite-plus** — bundles to a single self-contained `.mjs` file

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
- [ADR-CORE-007](../../docs/adr/core/ADR-CORE-007-cli-package-plugin-management.md) — Architecture decision for this CLI
