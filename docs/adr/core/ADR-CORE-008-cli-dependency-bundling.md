# ADR-CORE-008: CLI Dependency Bundling

## Status

Accepted

## Context

The maestria CLI (`apps/maestria-cli/`) is distributed as a single npm package with a `bin` entry point and `files: ["dist"]`; users interact with it via `npx maestria` or `pnpx maestria`. The artifact is a single bundled JS file produced by `vp pack` (vite-plus/tsdown).

Initially, the CLI's `package.json` listed 4 runtime packages under `dependencies`:

| Package          | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| `@clack/prompts` | Interactive CLI prompts (select, confirm, spinner) |
| `citty`          | CLI framework (typed arg parsing, subcommands)     |
| `effect`         | Error handling & async orchestration               |
| `picocolors`     | Terminal ANSI coloring                             |

The bundler (`vp pack`) treats everything in `dependencies` as external by default - correct for libraries, wrong for CLIs. The consequence: `npx maestria` triggered npm to download the Effect beta and its transitive dependencies, including `msgpackr-extract` (a native addon with build scripts), producing a confusing `Ignored build scripts: msgpackr-extract` warning during install.

The [xtarter project](https://github.com/agustinusnathaniel/xtarter) (same author, similar monorepo structure) demonstrated a proven pattern: move runtime dependencies to `devDependencies` and configure `deps.alwaysBundle` in the vite-plus config to inline them, resulting in a single self-contained JS artifact with zero runtime dependencies for end users.

## Goals

1. **Self-contained distribution** - `npx maestria` should install and run without downloading a large set of runtime dependencies at install time.
2. **Eliminate confusing install warnings** - the `Ignored build scripts: msgpackr-extract` warning must not appear for end users.
3. **Match bundler semantics** - CLI packages should inline their runtime dependencies, not externalize them; the `dependencies` field should reflect actual runtime requirements (none).
4. **Align with proven patterns** - follow the convention established by xtarter for CLI bundling in this monorepo.

## Non-Goals

1. **Does NOT change the build tool** - vite-plus and `vp pack` remain the CLI's build tool; only the bundling configuration changes.
2. **Does NOT change the CLI's runtime behavior** - the inlined code produces identical output; this is a packaging change only.
3. **Does NOT eliminate the `effect` dependency from the monorepo** - `effect` remains a dev dependency, still downloaded during CI and local development builds.
4. **Does NOT change how other packages in the monorepo bundle** - this decision applies only to `apps/maestria-cli/`; library packages should continue externalizing their dependencies.

## Decision

Move the 4 runtime packages (`@clack/prompts`, `citty`, `effect`, `picocolors`) from `dependencies` to `devDependencies` in the CLI's `package.json`, and configure `deps.alwaysBundle` in its `vite.config.ts` to tell the bundler to inline them.

### Package.json Changes

The `dependencies` field is removed entirely - the CLI has no runtime dependencies beyond Node.js 22 built-ins (`node:child_process`, `node:path`, etc.) - and the same 4 packages move into `devDependencies`.

### Vite Config Changes

`deps.alwaysBundle` lists the same 4 packages. The rest of the vite-plus config (entry, `node22` target, minification) is unchanged.

### How `alwaysBundle` Works

The `deps.alwaysBundle` array tells vite-plus/tsdown to inline the listed packages into the final bundle: it resolves each package's entry point from `node_modules`, tree-shakes unused exports (only the Effect patterns used by the CLI are included, not the entire Effect ecosystem), and emits a single JS file with no bare `import ... from "effect"` at runtime. End users download only the bundled artifact, not the Effect package and its transitive dependencies.

## Consequences

### Positive

- **Self-contained distribution** - `npx maestria` installs instantly, with no runtime dependency download.
- **Eliminated install warning** - the `Ignored build scripts: msgpackr-extract` warning from `msgpackr-extract`'s native addon no longer appears for end users.
- **Tree-shaking at build time** - only the Effect code actually used by the CLI is inlined; unused modules (large portions of the Effect ecosystem) are dropped during bundling.
- **Consistent with monorepo conventions** - follows the pattern proven by xtarter, reducing cognitive overhead for maintainers working across both projects.
- **Clearer package.json semantics** - an empty `dependencies` field accurately reflects that the CLI has no runtime requirements beyond Node.js.

### Before/After Comparison

The bundled artifact is larger than the pre-inlining build, but runtime dependency install drops to zero and the build-script warning disappears.

### Negative

- **Larger bundle size** - the artifact grows because Effect code is inlined instead of referenced externally; for a CLI invoked once per session, this is negligible.
- **Rebuild required for dependency updates** - updating `effect` (or any bundled dep) requires a rebuild and republish of the CLI package; version resolution at install time no longer applies.
- **Two-step onboarding for new dependencies** - any future runtime dependency must be added to both `devDependencies` (for the build to resolve) and `alwaysBundle` (for the bundler to inline). This is a documentation and review burden.
- **No shared caching** - if multiple CLI tools in the same monorepo used Effect, each would bundle its own copy; in this monorepo there is only one CLI, so this is not a practical concern.

### Caveats

- **`pnpm.overrides.effect` is now vestigial** - the override was originally needed to pin the beta version across the monorepo. Since `effect` is bundled into the CLI artifact and is no longer a runtime dependency, it only affects development and CI builds (where `effect` is installed as a dev dependency for type-checking and testing). It could be removed, but keeping it does no harm; it is a no-op in production installs.

## Alternatives Considered

### Option A: Keep dependencies, suppress the warning

Add a `.npmrc` with `ignore-scripts=true` or suppress the build script warning at the package level. Rejected because: suppressing the warning hides the symptom without fixing the cause. Users would still download megabytes of unused code at install time; the warning exists because `msgpackr-extract` has a native addon build script that pnpm ignores, and the real fix is to not ship that addon at all.

### Option B: Explicit external list

Keep packages in `dependencies` but explicitly configure them as bundled via `deps.alwaysBundle`. Rejected because: this creates a confusing mismatch between `dependencies` (which signals "these are runtime requirements") and bundling behavior (which makes them not runtime requirements). Future maintainers would see packages in `dependencies` and assume they resolve at install time; moving to `devDependencies` makes the intent unambiguous.

### Option C: Single-file distribution via esbuild

Replace vite-plus with a raw esbuild script that produces a single self-contained file and drop the `vp pack` dependency. Rejected because: vite-plus provides TypeScript path resolution, test integration, and monorepo-consistent config; raw esbuild would duplicate this infrastructure and diverge from how every other package builds. The bundling change is a config diff, not a toolchain diff.

## Related Decisions

- ADR-CORE-007 (CLI Package for Plugin Management) - established the CLI's architecture, technology choices, and the bundling context that this ADR refines
- [xtarter](https://github.com/agustinusnathaniel/xtarter) (same author, other monorepo) - the bundling pattern (`devDependencies` + `alwaysBundle`) was adapted from xtarter's CLI configuration

## Date

2026-06-30

## Revision

On 2026-09-08, the CLI stopped publishing generated JavaScript sourcemaps. The maps were substantially larger than the bundled runtime and were not consumed by an error-reporting pipeline. The build continues to use vite-plus/tsdown; its default `sourcemap: false` keeps the published CLI artifact lean.
