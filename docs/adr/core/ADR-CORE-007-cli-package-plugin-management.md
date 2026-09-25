# ADR-CORE-007: CLI Package for Plugin Management

## Status

Accepted

## Context

Maestria ships the same AI engineering methodology to multiple coding agent platforms, each with different installation and update mechanics:

| Platform | Install method | Update method |
| --- | --- | --- |
| OpenCode | Host plugin command | Same command with `--force` |
| Kimi Code | npm pack + file extract | Direct file install |
| Pi | `pi install npm:@maestria/pi` | `pi install npm:@maestria/pi@latest` |
| Claude Code | npm package staged into a local Claude marketplace, then `claude plugin install` | Refresh staged package, uninstall, and install through Claude Code |
| Codex CLI | npm package staged into a local Codex marketplace, then `codex plugin add` | Refresh staged package, remove, and add through Codex CLI |
| Prime Agent | Native package install command (global scope) | Native package update command (global scope) |

> **Note:** A Kimi Code release removed the `kimi plugins` CLI subcommand. The CLI now installs via `npm pack @maestria/kimi-code@latest` and extracts the tarball into the managed plugins directory, matching the approach used internally by Kimi Code's own plugin system.

Users who work across platforms - or teams that standardize on maestria - must remember these commands and manage versions manually, with install knowledge scattered across README files and no single command to see what is installed or update everything at once. The fragmentation compounds as the platform list grows.

## Decision

Build `maestria` as a single CLI tool in `apps/maestria-cli/` that unifies plugin management across all platforms.

### 1. Architecture overview

A citty root command registers the `install`, `update`, and `status` subcommands, with library modules for platform handler definitions and shell execution, parallel detection, and terminal/JSON output.

### 2. Technology choices

| Concern | Choice | Rationale |
| --- | --- | --- |
| Programming model | Effect v4 (beta) | Typed errors, structured concurrency, consistent async - same family as maestria |
| CLI routing | citty | Lightweight, typed arg parsing with `defineCommand`, no build step |
| Interactive prompts | @clack/prompts | Declarative spinner, select, confirm - well-maintained, accessible |
| Terminal output | picocolors | Minimal, fast ANSI coloring |
| Build/bundling | vite-plus | Single self-contained `.mjs` via `vp pack` - matches monorepo tooling |
| Shell execution | `child_process.execFile` | Wrapped in `Effect.tryPromise` - no external dependencies needed |

### 3. Effect v4 patterns used

- **Tagged errors for typed failure** - `CommandError` and `PlatformError` carry structured context.
- **Lazy Effects for platform operations** - `PlatformHandler` fields are `Effect.Effect` values describing work; command handlers execute them with `Effect.runPromise`.
- **Parallel detection with structured concurrency** - `detectAll` runs per-platform detection with unbounded concurrency.
- **Error recovery with catchTag/catchCause** - per-platform failures are converted to result values.

### 4. Platform definitions as data, not abstractions

Platforms are an array of handler objects, not a class hierarchy: each declares its commands inline, and a new platform is added by appending one object to the `platforms` array. No base class, no registration step, no interface to implement globally.

### 5. Shell execution strategy

`@effect/platform/Command` was considered but requires a `CommandExecutor` layer that is not easily provided in the Effect v4 beta API. Instead, Node's `child_process.execFile` is wrapped in `Effect.tryPromise`; dynamic imports keep the module tree-shakeable, and the error type preserves the full command string for diagnostics.

### 6. Build and distribution

The package bundles to a single self-contained `.mjs` via vite-plus, with the `bin` field pointing at the bundled output so users can run `npx maestria` or install it globally.

### 7. CLI surface

| Command                     | Behavior                                |
| --------------------------- | --------------------------------------- |
| `maestria`                  | Default: show status                    |
| `maestria status`           | Show installed plugins and version info |
| `maestria status --json`    | Same, as JSON                           |
| `maestria install`          | Interactive: pick a platform to install |
| `maestria install --all`    | Install for all detected platforms      |
| `maestria install opencode` | Install for a specific platform         |
| `maestria update`           | Interactive: pick a platform to update  |
| `maestria update --all`     | Update all installed platforms          |
| `maestria update opencode`  | Update a specific platform              |

All commands accept `--json` for machine-readable output and `--quiet` to suppress spinner animations.

## Consequences

### Positive

- **Unified cross-platform experience** - one CLI to install, update, and check status across all platforms.
- **Effect provides typed errors and structured concurrency** - platform detection runs in parallel with bounded error handling, with no untyped throws or unhandled rejections.
- **citty keeps the CLI shell minimal** - subcommand registration and arg parsing are small enough to audit entirely.
- **Platform definitions are additive** - adding a platform (e.g. Cursor) is one new object in the `platforms` array; no glue code or switch statements.
- **Self-contained distribution** - `npx maestria` works without install, with zero runtime dependencies beyond Node.js 22.
- **JSON output** - `--json` on all commands enables script consumption (CI checks, dashboards, editor integrations).

### Negative

- **Effect v4 beta dependency** - an upgrade to stable is expected but may require migration work; the CLI pins the beta already resolved in the lockfile.
- **No `@effect/platform/Command`** - the manual `child_process.execFile` path bypasses Effect's resource management (no `Scope`-managed process lifecycle). Acceptable for short-lived install, update, and version-check commands; long-running processes would need a different approach.
- **Another package to maintain** - the CLI is a new npm package with its own build, versioning, and changelog.
- **Platform detection is heuristic** - detection checks whether a CLI binary is on `$PATH`, which can produce false negatives (installed but not on `$PATH`) and false positives (binary exists but platform is broken). Mitigation: the status command also verifies that maestria is installed per detected platform.

## Alternatives Considered

### Option A: Shell Script Per Platform

One `install-<platform>.sh` script per platform in the repo root. Rejected because: shell scripts are not portable (macOS vs Linux differences), have no typed error handling, cannot do interactive prompts cleanly, and spread install knowledge across N files - the current problem, not a solution.

### Option B: Per-Platform Plugin Registry

Each platform plugin exposes an `install` script or CLI subcommand, with a meta-tool orchestrating them. Rejected because: it duplicates the discovery concern - installing one plugin would need to know about the others, creating a circular or cross-package dependency. The CLI package is the right place for cross-platform orchestration; individual plugins should not know about each other.

### Option C: @effect/cli as CLI Framework

Use Effect's own CLI framework instead of citty. Rejected because: `@effect/cli` has tighter coupling to the `@effect/platform` ecosystem, which is in flux during the v4 beta; citty is stable, well-typed, and has zero Effect dependencies. Effect is used for business logic (platform detection, error handling), not for parsing args.

### Option D: Make Each Platform Plugin Self-Managing

Add install/update/status commands to each platform plugin, with no cross-platform CLI. Rejected because: it shifts the unification burden to the user, who would still need to run two commands and remember two package names; the cross-platform view requires running N commands. The value of a CLI is the single entry point.

### Option E: Rust / Go CLI for Performance

Build the CLI in Rust or Go for instant startup and static binaries. Rejected because: the CLI's work is I/O-bound (shelling out to platform CLIs, querying npm), so startup time is negligible; a Rust CLI would add a separate build toolchain, cross-compilation complexity, and a language boundary in a TypeScript monorepo.

## Related Decisions

- ADR-CORE-002 (plugin architecture) - the platform plugins that this CLI manages were defined there
- ADR-CORE-005 (shared agent directives core sync) - established the multi-platform pattern that creates the need for cross-platform management
- ADR-OC-001 (tool permission design) - install commands for OpenCode use the plugin command; permission model is managed by OpenCode
- ADR-PI-001 (rules injection) - Pi install/update mechanics that the CLI wraps
- ADR-KC-001 (kimi-code architecture) - Kimi Code's plugin installation path that the CLI wraps

## Revisions

### 2026-06-29

Post-acceptance changes:

| Change | Description |
| --- | --- |
| Version caching | `npm view` results are cached on disk with a 1-hour TTL, invalidated after a successful update. |
| Input validation | Platform and version inputs are validated with typed errors for early return on bad input. |
| `--version`/`-V` flag | The `update` command accepts `--version`/`-V` to pin a specific version. |
| Shell glob support | A shell helper wraps command execution via `sh -c`, enabling glob patterns, pipes, and redirects. |
| Spinner UX | All commands show a spinner while working; the wrapper respects `--quiet`. |
| Pi detection | Pi's installed check uses a local file check instead of an HTTP call - faster and more reliable. |
| OpenCode config | The installed check reads `opencode.jsonc` first, falling back to `opencode.json`. |
| Process lifecycle | `SIGINT`/`SIGTERM` handlers and explicit exits ensure clean termination. |
| Module layout | Shell, validation, and install helpers were split into their own modules; the shared types module now holds interface definitions only, with tagged errors colocated with their defining concerns. |

### 2026-08-13

The CLI now recognizes three plugin packages:

| Platform | CLI identifier | Host integration |
| --- | --- | --- |
| Claude Code | `claude-code` | Stages `@maestria/claude-code` under `~/.cache/maestria/`, registers a local marketplace with `claude plugin marketplace add`, and installs at user scope with `claude plugin install`. |
| Codex CLI | `codex` | Stages `@maestria/codex` under `~/.cache/maestria/`, registers a local marketplace with `codex plugin marketplace add`, and installs with `codex plugin add`. |
| Prime Agent | `prime-agent` | Delegates to Prime's native package install/update/remove commands in the default global scope; every command runs from a freshly created empty temporary directory so project settings are never scanned or modified (Prime resolves project settings from cwd). Registration state comes from `prime-agent package list` (user scope only). |

These adapters use the host runtime as the source of installed state and version reporting, and they do not write host configuration directly. Exact version pinning is rejected for these adapters: Claude Code and Codex CLI updates select the latest staged package, and Prime skips `package update` for version-pinned registrations - the CLI detects a pinned user registration up front (via a per-update registration snapshot, before the "Already up to date" short-circuit) and reports an accurate error instead of claiming a successful update or silently skipping it.

### 2026-09-11

The round-1 architecture audit re-measured a plain-async replacement for Effect and retained Effect: the conversion would save only a modest fraction of production code, require rewriting the test suite whose surface is the Effect interface, and the typed error channel is already largely flattened. Boundary: adding new Effect-only capabilities to the CLI (retry, schedule, interruption, resource scopes) requires its own decision, and a wholesale conversion belongs in a dedicated ADR-backed PR.

## Date

2026-06-28
