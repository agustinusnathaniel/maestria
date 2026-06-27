# ADR-CORE-007: CLI Package for Plugin Management

## Status

Accepted

## Context

Maestria ships the same AI engineering methodology to 3 coding agent platforms — OpenCode, Kimi Code, and Pi — each with different installation and update mechanics:

| Platform  | Install method                              | Update method                        |
| --------- | ------------------------------------------- | ------------------------------------ |
| OpenCode  | `opencode plugin @maestria/opencode@latest` | Same command with `--force`          |
| Kimi Code | `kimi plugins install <git-url>`            | Same command (re-install)            |
| Pi        | `pi install npm:@maestria/pi`               | `pi install npm:@maestria/pi@latest` |

Users who work across platforms — or teams that standardize on maestria — must remember these commands, check which platforms they have installed, and manage versions manually. Install knowledge is scattered across README files. There is no single command to see what's installed or update everything at once.

As the platform list grows, the fragmentation compounds. Each new platform adds another install path to document and maintain.

## Decision

Build `maestria` as a single CLI tool in `apps/maestria-cli/` that unifies plugin management across all platforms.

### 1. Architecture overview

```
apps/maestria-cli/
├── src/
│   ├── index.ts            # citty root command, subcommand registration
│   ├── types.ts            # Tagged errors (PlatformError, VersionError), result types
│   ├── commands/
│   │   ├── install.ts      # `maestria install [platform]` — install plugins
│   │   ├── update.ts       # `maestria update [platform]` — update plugins
│   │   └── status.ts       # `maestria status` — show installed state
│   └── lib/
│       ├── platforms.ts    # PlatformHandler definitions + shell execution helpers
│       ├── detect.ts       # Parallel detection across all platforms
│       └── output.ts       # Terminal rendering (picocolors) + JSON output
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 2. Technology choices

| Concern | Choice | Rationale |
| --- | --- | --- |
| Programming model | Effect v4 (beta.70) | Typed errors, structured concurrency, consistent async — same family as maestria |
| CLI routing | citty | Lightweight (< 1KB), typed arg parsing with `defineCommand`, no build step |
| Interactive prompts | @clack/prompts | Declarative spinner, select, confirm — well-maintained, accessible |
| Terminal output | picocolors | Minimal (< 1KB), fast ANSI coloring |
| Build/bundling | vite-plus | Single self-contained `.mjs` via `vp pack` — matches monorepo tooling |
| Shell execution | `child_process.execFile` | Wrapped in `Effect.tryPromise` — no external dependencies needed |

### 3. Effect v4 patterns used

The codebase uses idiomatic Effect patterns:

**Tagged errors for typed failure:**

```typescript
export class CommandError extends Data.TaggedError('CommandError')<{
  readonly command: string;
  readonly message: string;
}> {}

export class PlatformError extends Data.TaggedError('PlatformError')<{
  readonly platformId: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}
```

**Lazy Effects for platform operations:**

```typescript
interface PlatformHandler {
  readonly id: string;
  readonly label: string;
  readonly npmPackage?: string;
  readonly detect: Effect.Effect<boolean, never>;
  readonly isInstalled: Effect.Effect<boolean, never>;
  readonly getInstalledVersion: Effect.Effect<string, CommandError>;
  readonly getLatestVersion: Effect.Effect<string, CommandError>;
  readonly install: Effect.Effect<void, CommandError>;
  readonly update: Effect.Effect<void, CommandError>;
  readonly uninstall: Effect.Effect<void, CommandError>;
}
```

These are lazy Effects — they describe work without executing it. The command handler runs them via `Effect.runPromise` at call time.

**Parallel detection with structured concurrency:**

```typescript
export function detectAll(): Effect.Effect<PlatformStatus[], never> {
  return Effect.all(
    platforms.map((p) => detectOne(p)),
    { concurrency: 'unbounded' },
  );
}
```

Detecting CLI tool availability across 3 platforms happens in parallel, not sequentially.

**Error recovery with catchTag/catchCause:**

```typescript
yield *
  platform.install.pipe(
    Effect.catchTag('CommandError', (error) =>
      Effect.succeed({ ok: false, message: error.message } satisfies PlatformResult),
    ),
  );
```

### 4. Platform definitions as data, not abstractions

Platforms are defined as an array of handler objects, not a class hierarchy or interface with implementations. Each platform declares its commands inline:

```typescript
const opencode: PlatformHandler = {
  id: 'opencode',
  label: 'OpenCode',
  npmPackage: '@maestria/opencode',
  detect: commandExists('opencode'),
  isInstalled: run('opencode', ['config', 'get', 'plugins']).pipe(
    Effect.map((out) => out.includes('@maestria/opencode')),
    Effect.catchCause(() => Effect.succeed(false)),
  ),
  install: run('opencode', ['plugin', '@maestria/opencode@latest']).pipe(Effect.as(void 0)),
  // ...
};
```

A new platform is added by appending one object to the `platforms` array. No base class, no registration step, no interface to implement globally.

### 5. Shell execution strategy

`@effect/platform/Command` was considered but requires a `CommandExecutor` layer that is not easily provided in the Effect v4 beta API surface. Instead, we wrap Node's `child_process.execFile` in `Effect.tryPromise`:

```typescript
function run(cmd: string, args: string[]): Effect.Effect<string, CommandError> {
  return Effect.tryPromise({
    try: async () => {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);
      const { stdout } = await execFileAsync(cmd, args);
      return stdout.trim();
    },
    catch: (error) =>
      new CommandError({
        command: `${cmd} ${args.join(' ')}`,
        message: error instanceof Error ? error.message : String(error),
      }),
  });
}
```

Dynamic imports keep the module tree-shakeable. The `CommandError` type preserves the full command string for error messages, which matters when failures span multiple platforms.

### 6. Build and distribution

The package bundles to a single self-contained `.mjs` file via vite-plus:

```typescript
// vite.config.ts
export default defineConfig({
  pack: {
    entry: ['src/index.ts'],
    target: 'node22',
    sourcemap: true,
    minify: true,
    fixedExtension: false,
  },
  resolve: { tsconfigPaths: true },
});
```

The `bin` field in `package.json` points to the bundled output:

```json
{
  "bin": { "maestria": "./dist/index.js" }
}
```

Users can run it directly with `npx maestria` or install it globally.

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

- **Unified cross-platform experience** — one CLI to install, update, and check status across all platforms. No more remembering per-platform commands.
- **Effect provides typed errors and structured concurrency** — platform detection runs in parallel with bounded error handling. No untyped throw, no unhandled rejections.
- **citty keeps the CLI shell minimal** — subcommand registration and arg parsing in ~20 lines. The framework is small enough to audit entirely.
- **Platform definitions are additive** — adding a new platform (e.g. Cursor) is one new object in the `platforms` array. No glue code, no switch statements.
- **Self-contained distribution** — `npx maestria` works without install. The single `.mjs` bundle has zero runtime dependencies beyond Node.js 22.
- **JSON output** — `--json` on all commands enables script consumption (CI checks, dashboards, editor integrations).

### Negative

- **Effect v4 beta dependency** — Effect 4.0.0 is still in beta. We pin to `beta.70`. An upgrade to stable is expected but may require migration work.
- **No `@effect/platform/Command`** — we use `child_process.execFile` wrapped in `Effect.tryPromise` instead. This is a manual shell execution path that bypasses Effect's resource management (no `Scope`-managed process lifecycle). For short-lived commands (install, update, version check) this is acceptable, but long-running processes would need a different approach.
- **Another package to maintain** — the CLI is a new npm package with its own build, versioning, and changelog. It adds surface area to the monorepo.
- **Platform detection is heuristic** — we detect a platform by checking whether its CLI binary is on `$PATH`. This can give false negatives (installed but not on `$PATH`) and false positives (binary exists but platform is broken). Mitigation: the status command also verifies that maestria is actually installed for each detected platform.

## Alternatives Considered

### Option A: Shell Script Per Platform

One shell script per platform (e.g., `install-opencode.sh`, `install-pi.sh`) in the repo root. Users run the relevant script.

Rejected because: shell scripts are not portable (macOS vs Linux sed/awk differences), have no typed error handling, cannot do interactive prompts cleanly, and spread install knowledge across N files instead of consolidating it. The whole point is unification — N scripts is the current problem.

### Option B: Per-Platform Plugin Registry

Each platform plugin (`@maestria/opencode`, `@maestria/pi`, etc.) exposes an `install` script or CLI subcommand. A meta-tool orchestrates them.

Rejected because: it duplicates the discovery concern — installing `@maestria/opencode` would need to know about `@maestria/pi`, creating a circular or cross-package dependency. The CLI package is the right place for cross-platform orchestration; individual plugins should not know about each other.

### Option C: @effect/cli as CLI Framework

Use `@effect/cli` (Effect's own CLI framework) instead of citty.

Rejected because: `@effect/cli` has tighter coupling to the `@effect/platform` ecosystem, which is in flux during the v4 beta. citty is stable, well-typed, and has zero Effect dependencies. The CLI is a thin shell — Effect is used for the business logic (platform detection, error handling), not for parsing args. citty handles arg parsing with half the API surface.

### Option D: Make Each Platform Plugin Self-Managing

Add install/update/status CLI to each platform plugin (e.g., `npx @maestria/opencode install`). No cross-platform CLI.

Rejected because: it shifts the unification burden to the user. A user who works with both OpenCode and Pi would still need to run two commands and remember two package names. The cross-platform view (what's installed, what's outdated) requires running N commands. The whole value of a CLI is the single entry point.

### Option E: Rust / Go CLI for Performance

Build the CLI in Rust or Go for instant startup and static binary distribution.

Rejected because: the CLI's work is I/O-bound (shelling out to platform CLIs, querying npm). Startup time is negligible compared to the platform commands it invokes. A Rust CLI would add a separate build toolchain, cross-compilation complexity, and a language boundary in a TypeScript monorepo. Node.js via `npx` is fast enough and matches everything else.

## Related Decisions

- ADR-CORE-002 (plugin architecture) — the platform plugins that this CLI manages were defined there
- ADR-CORE-005 (shared agent directives core sync) — established the multi-platform pattern that creates the need for cross-platform management
- ADR-OC-001 (tool permission design) — install commands for OpenCode use the plugin command; permission model is managed by OpenCode
- ADR-PI-001 (rules injection) — Pi install/update mechanics that the CLI wraps
- ADR-KC-001 (kimi-code architecture) — Kimi Code's plugin installation path that the CLI wraps

## Date

2026-06-28
