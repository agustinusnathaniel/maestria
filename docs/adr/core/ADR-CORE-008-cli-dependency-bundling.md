# ADR-CORE-008: CLI Dependency Bundling

## Status

Accepted

## Context

The maestria CLI (`apps/maestria-cli/`) is distributed as a single npm package with a `bin` entry point and `files: ["dist"]` — users interact with it via `npx maestria` or `pnpx maestria`. The artifact is a single bundled JS file produced by `vp pack` (vite-plus/tsdown).

Initially, the CLI's `package.json` listed 4 runtime packages under `dependencies`:

| Package | Purpose | Size impact |
| --- | --- | --- |
| `@clack/prompts` | Interactive CLI prompts (select, confirm, spinner) | Minor |
| `citty` | CLI framework (typed arg parsing, subcommands) | <1 KB |
| `effect@4.0.0-beta.92` | Error handling & async orchestration | 8.2 MB download, 47 MB on disk |
| `picocolors` | Terminal ANSI coloring | <1 KB |

The bundler (`vp pack`) treats everything in `dependencies` as external by default — it emits bare `import ... from "effect"` statements in the bundled output instead of inlining the code. This is the correct default for libraries, where consumers need version flexibility, but it is the wrong default for CLIs.

The practical consequence for end users: running `npx maestria` triggered npm to download and install `effect` and all its transitive dependencies, including `msgpackr` which pulls in `msgpackr-extract` (a native addon with build scripts). This produced a confusing `Ignored build scripts: msgpackr-extract` warning during install — alarming to users and unnecessary for a tool that should be self-contained.

The [xtarter project](https://github.com/agustinusnathaniel/xtarter) (same author, similar monorepo structure) demonstrated a proven pattern: move runtime dependencies to `devDependencies` and configure `deps.alwaysBundle` in the vite-plus config to tell the bundler to inline them. This results in a single self-contained JS artifact with zero runtime dependencies for end users.

## Goals

1. **Self-contained distribution** — `npx maestria` should install and run without downloading 8+ MB of runtime dependencies at install time.
2. **Eliminate confusing install warnings** — the `Ignored build scripts: msgpackr-extract` warning must not appear for end users.
3. **Match bundler semantics** — CLI packages should inline their runtime dependencies, not externalize them. The `dependencies` field should reflect actual runtime requirements (none).
4. **Align with proven patterns** — follow the convention established by xtarter for CLI bundling in this monorepo.

## Non-Goals

1. **Does NOT change the build tool** — vite-plus and `vp pack` remain the CLI's build tool. Only the bundling configuration changes.
2. **Does NOT change the CLI's runtime behavior** — the inlined code produces identical output. This is a packaging change only.
3. **Does NOT eliminate the `effect` dependency from the monorepo** — `effect` remains as a dev dependency. It is still downloaded during CI and local development builds.
4. **Does NOT change how other packages in the monorepo bundle** — this decision applies only to `apps/maestria-cli/`. Library packages (`packages/core/`, `packages/opencode/`, etc.) should continue externalizing their dependencies.

## Decision

Move the 4 runtime packages (`@clack/prompts`, `citty`, `effect`, `picocolors`) from `dependencies` to `devDependencies` in `apps/maestria-cli/package.json`, and configure `deps.alwaysBundle` in `apps/maestria-cli/vite.config.ts` to tell the bundler to inline them.

### Package.json Changes

```diff
 {
   "devDependencies": {
+    "@clack/prompts": "^0.10.1",
+    "citty": "^0.2.2",
+    "effect": "4.0.0-beta.92",
+    "picocolors": "^1.1.1",
     ...
   },
-  "dependencies": {
-    "@clack/prompts": "^0.10.1",
-    "citty": "^0.2.2",
-    "effect": "4.0.0-beta.92",
-    "picocolors": "^1.1.1"
-  }
 }
```

The `dependencies` field is removed entirely — the CLI has no runtime dependencies beyond Node.js 22 built-ins (`node:child_process`, `node:path`, etc.).

### Vite Config Changes

```diff
 // vite.config.ts
 export default defineConfig({
   pack: {
     entry: ['src/index.ts'],
     target: 'node22',
     sourcemap: true,
     minify: true,
     fixedExtension: false,
+    deps: {
+      alwaysBundle: ['@clack/prompts', 'citty', 'effect', 'picocolors'],
+    },
   },
   resolve: { tsconfigPaths: true },
 });
```

### How `alwaysBundle` Works

The `deps.alwaysBundle` array tells vite-plus/tsdown to inline the listed packages into the final bundle. The bundler:

1. Resolves each package's entry point from `node_modules`
2. Tree-shakes unused exports (e.g., only the Effect patterns used by the CLI are included, not the entire Effect ecosystem)
3. Emits a single JS file with all inlined code — no `import ... from "effect"` at runtime

The result is that end users download only the bundled artifact (93 KB), not the full 8.2 MB `effect` package plus its transitive dependencies.

## Consequences

### Positive

- **Self-contained distribution** — `npx maestria` installs instantly. No runtime dependency download.
- **Eliminated install warning** — the `Ignored build scripts: msgpackr-extract` warning from `msgpackr-extract`'s native addon no longer appears for end users.
- **Tree-shaking at build time** — only the Effect code actually used by the CLI is inlined. Unused modules (large portions of the Effect ecosystem) are dropped during bundling.
- **Consistent with monorepo conventions** — follows the pattern proven by xtarter, reducing cognitive overhead for maintainers working across both projects.
- **Clearer package.json semantics** — `dependencies` is now empty, accurately reflecting that the CLI has no runtime requirements beyond Node.js.

### Before/After Comparison

| Metric                     | Before                       | After |
| -------------------------- | ---------------------------- | ----- |
| Bundle size                | ~20 KB                       | 93 KB |
| Runtime dep install        | 8.2 MB (effect + transitive) | 0     |
| `msgpackr-extract` warning | Yes                          | No    |

### Negative

- **Larger bundle size** — the bundled artifact grows from ~20 kB to 93 kB because Effect code is inlined instead of referenced externally. For a CLI invoked once per session, this is negligible.
- **Rebuild required for dependency updates** — updating `effect` (or any bundled dep) requires a rebuild and republish of the CLI package. Version resolution at install time no longer applies.
- **Two-step onboarding for new dependencies** — any future runtime dependency must be added to both `devDependencies` (for the build to resolve) and `alwaysBundle` (for the bundler to inline). This is a documentation and review burden.
- **No shared caching** — if multiple CLI tools in the same monorepo used Effect, each would bundle its own copy. In this monorepo, there is only one CLI, so this is not a practical concern.

### Caveats

- **`pnpm.overrides.effect` is now vestigial** — the `pnpm.overrides` entry for `effect` was originally needed to pin the beta version across the monorepo. Since `effect` is now bundled into the CLI artifact and is no longer a runtime dependency, this override only affects development and CI builds (where `effect` is installed as a dev dependency for type-checking and testing). It could be removed, but keeping it does no harm — it's a no-op in production installs.

## Alternatives Considered

### Option A: Keep dependencies, suppress the warning

Add a `.npmrc` with `ignore-scripts=true` or suppress the build script warning at the package level.

Rejected because: suppressing the warning hides the symptom without fixing the cause. Users would still download 8.2 MB of unused code at install time. The warning exists because `msgpackr-extract` has a native addon build script that pnpm ignores — the real fix is to not ship that addon at all.

### Option B: Explicit external list

Keep packages in `dependencies` but explicitly configure them as bundled via `deps.alwaysBundle` (same bundling approach, no `devDependencies` move).

Rejected because: this creates a confusing mismatch between `dependencies` (which signals "these are runtime requirements") and bundling behavior (which makes them not runtime requirements). Future maintainers would see packages in `dependencies` and assume they resolve at install time. Moving to `devDependencies` makes the intent unambiguous.

### Option C: Single-file distribution via esbuild

Replace vite-plus with a raw esbuild script that produces a single self-contained file. Drop the `vp pack` dependency.

Rejected because: vite-plus provides sourcemaps, TypeScript path resolution, test integration, and monorepo-consistent config. Using raw esbuild would duplicate this infrastructure and create an inconsistency with how every other package builds. The bundling change is a config diff, not a toolchain diff.

## Related Decisions

- ADR-CORE-007 (CLI Package for Plugin Management) — established the CLI's architecture, technology choices, and the bundling context that this ADR refines
- [xtarter](https://github.com/agustinusnathaniel/xtarter) (same author, other monorepo) — the bundling pattern (`devDependencies` + `alwaysBundle`) was adapted from xtarter's CLI configuration

## Date

2026-06-30
