# ADR-CORE-009: CI Quality Gates - Static Analysis, Caching, and Workflow Structure

## Status

Accepted (2026-06-29)

## Context

The maestria CI pipeline, defined in `.github/workflows/release.yml`, ran on every PR push and main merge. Its job was a single sequence: install dependencies, build all packages, run tests, then (on main) let changesets create a release PR or publish.

The pipeline had three problems:

1. **No static analysis in CI.** The `pnpm build` step compiled packages but did not check formatting, run the linter, or typecheck TypeScript. Format and lint violations could merge and only surface as pre-commit hook failures on other developers' machines - or not at all if hooks were bypassed. The project already had `pnpm check` (which is `vp check && vp run build && vp run test`), covering format check via `vp fmt --check`, type-aware lint via `vp lint` (oxlint with type checking), and `vp run build`. The check and the build commands existed but CI only ran the latter.

2. **Zero test cache hit rate.** The task cache in vp (`node_modules/.vite/task-cache`) is a SQLite database that tracks per-task output hashes. If a task's inputs haven't changed, vp skips re-execution. But the cache is ephemeral - it lives in `node_modules` which is not persisted between CI runs. Every CI run started with a cold cache, running all tests from scratch even when nothing had changed.

3. **Docs build cost was unknown.** The `pnpm check` script runs `vp run build`, which builds every package including `@maestria/docs` - a 28-page Astro site. The question arose whether to exclude docs from the PR build to save time, at the cost of adding a `--filter` flag and coupling CI to the docs package name.

A secondary, pre-existing question was whether the single-workflow layout (one `release.yml` handling both PR checks and main-branch release) should be split into `ci.yml` + `release.yml` for clarity.

## Decision 1: Use `pnpm check:ci` for CI Verification

### Change

Use `pnpm check:ci` in `.github/workflows/ci.yml`. This adds format checking, type-aware oxlint linting, TypeScript type checking, package builds, and tests to every CI run. The package build uses `pnpm build:ci`, which excludes the docs static build while retaining the sync guard through `prebuild:ci`.

### Cost

~2 seconds per run added (measured). `vp check` consists of `vp fmt --check` (~0.3s), `vp lint` with type-aware checks (~0.5s), and the check-sync guard (~0.1s). The remaining time is process overhead.

### Alternatives Considered

| Option | Assessment | Verdict |
| --- | --- | --- |
| **Separate step** (`pnpm check` as a distinct step before build) | Adds no value over the script swap; the script already sequences check before package build. Same total time, more YAML. | Rejected |
| **Parallel job** (check in one job, build+test in another) | Wastes ~30s on duplicate checkout, pnpm setup, and dependency install for a 2s check. | Rejected |
| **Pre-merge status check** (require a separate `ci-check` job as required status) | Same cost as parallel job with more config. Also requires repository settings changes to mark the new check as required. | Rejected |

### Rationale

The script swap is the minimal change that brings static analysis into CI. It costs ~2s per run, adds zero maintenance burden, and keeps the workflow readable. The alternatives add complexity for no meaningful gain.

## Decision 2: Exclude Docs Build from CI/Release Package Builds

### Change

Add a dedicated `pnpm build:ci` script that builds all packages except `@maestria/docs`, plus a matching `prebuild:ci` lifecycle hook for the sync guard:

```json
"prebuild:ci": "vp run check-sync",
"build:ci": "vp run --filter './packages/*' --filter ./apps/maestria-cli build"
```

`pnpm build --filter "!@maestria/docs"` was tested and rejected: pnpm appends the filter after the `build` task name, so `vp run` forwards it to each package script instead of treating it as a workspace selector. The result still built `@maestria/docs`.

`vp run --filter "!@maestria/docs" build` was also rejected: the negated filter includes the workspace root, whose `build` script recursively builds all packages, including docs. The final script selects package directories directly and includes the CLI app explicitly.

This matches Vite+ documentation and source behavior: `vp run --filter <selector> build` is the documented filtered form, arguments after the task name are passed through to the task command, and Vite Task rejects combining `--filter` with `--recursive`.

Use `build:ci` from `pnpm check:ci` and from `release.yml`.

### Rationale

The docs app is still checked by `vp check` after the `Generate Astro types` step, so TypeScript and lint coverage remain in CI. The expensive part for the release path is the Astro static build, which does not produce publishable npm artifacts and is not needed before `changeset publish`.

Release builds only need to prove that publishable packages can produce fresh dist output. Keeping this as a named script avoids repeating a non-obvious negated filter in workflow YAML.

### Trade-off

Docs static rendering failures are no longer caught by `pnpm check:ci`. They are still caught by local `pnpm build`, and a docs-specific workflow can be added later if docs deployment becomes part of CI.

## Decision 3: Cache vp Task Cache in CI

### Change

Added `actions/cache@v6` to restore and save `node_modules/.vite/task-cache` in both workflows (`release.yml` and `release-kimi-code.yml`).

### Cache Key

```yaml
- name: Restore vp task cache
  uses: actions/cache@v6
  with:
    path: node_modules/.vite/task-cache
    key: vp-task-cache-${{ runner.os }}-${{ github.sha }}
    restore-keys: |
      vp-task-cache-${{ runner.os }}-
```

The key uses the commit SHA so every run can save an updated task cache. `restore-keys` lets later runs restore the most recent cache for the same OS.

### Impact

Before: every CI run executed all tests from scratch because the cache directory was destroyed between runs. After: unchanged tasks are skipped entirely by vp's hash-based invalidation. The test step time drops to ~0 when no test inputs have changed.

An earlier lockfile-only key produced cache hits but prevented cache updates: GitHub Actions does not save a cache when the primary key already hit. In practice that left stale task metadata restored across runs, followed by avoidable task misses when workspace files changed.

### Rationale

This fix is a one-time cost: a 5-line cache step. The vp task cache is designed to be persisted between runs - not caching it was an oversight. The `actions/cache@v6` action handles upload at the end of the job automatically; no explicit `save` step is needed.

## Decision 4: Split into CI (`ci.yml`) and Release (`release.yml`) workflows

### Rationale

The single workflow conflated two concerns with different requirements: CI checks on PRs and publishing on main. Every major pnpm+changesets monorepo (chakra-ui, radix-ui, gitify) splits them.

| Workflow | Triggers | Cancel in-progress | Behaviour |
| --- | --- | --- | --- |
| **ci.yml** | PRs and pushes to main | Yes | Run check + package build + test. Fast feedback, no publish. |
| **release.yml** | Push to main (path-filtered), workflow_dispatch | No | Run fresh package build + changesets publish. Must not cancel mid-publish. |

A composite action (see Decision 5) eliminates setup duplication between the two workflows, removing the main objection to the split.

### Concurrency

The `release.yml` workflow sets `cancel-in-progress: false` to prevent a subsequent push from cancelling an in-progress publish. The `ci.yml` workflow sets `cancel-in-progress: true` so that a new push on the same PR cancels the stale run.

### Notes

- **`workflow_dispatch` inputs:** The `workflow_dispatch` trigger accepts no inputs. Version bump type inputs (major/minor/patch) were intentionally removed to simplify the manual trigger. Changesets determines the version bump from changeset files.
- **Timeout increase:** `release.yml` uses a 15-minute timeout (up from 10 minutes in `ci.yml`) to accommodate fresh package builds before the publish step.
- **Main-push CI retained:** `ci.yml` still runs on `main` pushes because `release.yml` is path-filtered to release-related files. Removing main-push CI would make non-release main pushes lose their post-merge validation.

## Decision 6: Generate Astro Types Before Typecheck

### Context

The `pnpm check` command includes TypeScript type checking. The `apps/docs` Astro project references `.astro/types.d.ts` in its `tsconfig.json` - a file generated by `astro sync` or `astro build`. On fresh CI environments (and fresh clones), this file does not exist, causing TS6053: "File '.astro/types.d.ts' not found."

Before Decision 1 (when CI ran `pnpm build` instead of `pnpm check`), this was invisible because `astro build` generates the types as a side effect of building. The typecheck step in `vp check` runs before `vp run build`, so the types don't exist yet.

### Change

1. Added `"sync": "astro sync"` to `apps/docs/package.json` scripts.
2. Added a `Generate Astro types` step in `ci.yml`, running `pnpm exec vp run --filter @maestria/docs sync` between the setup step and the check step.

### Cost

~1 second per CI run (generates `.astro/types.d.ts` and `.astro/icon.d.ts`). This is a one-time cost per run - the cache step already saves time on repeat runs.

### Alternatives Considered

| Option | Assessment | Verdict |
| --- | --- | --- |
| **Run `astro sync` directly** (`npx astro sync`) | Works but couples the CI command to the Astro CLI location. Using `vp run --filter` is consistent with how other package scripts are invoked. | Equivalent - chose for consistency |
| **Skip typecheck for docs** (exclude from tsconfig) | Defeats the purpose of adding type checking. Docs type errors would go undetected. | Rejected |
| **Reorder `vp check`** to run build first | Build takes longer than typecheck. Would delay type error feedback. Type errors caught must be emitted before build artifacts are generated. | Rejected |

### Rationale

The sync step is the minimal addition required to make the existing typecheck pipeline work for Astro projects. It adds negligible time and follows the existing `vp run --filter` pattern used elsewhere in the monorepo.

## Consequences

### Positive

- **Static analysis on every PR.** Format, lint, and type errors are caught in CI before merging. Developers get faster feedback than relying on pre-commit hooks alone.
- **Faster CI on repeat runs.** The vp task cache makes test re-runs nearly instant when no test code changed. This matters for PRs where only source or docs changed.
- **Release package builds skip docs.** Publishable packages are still built from scratch before publish without paying the Astro static-site cost.
- **Clear separation of concerns.** The `ci.yml` workflow handles PR feedback; the `release.yml` workflow handles publishing. Different policies for concurrency, trigger paths, and cancellation are enforced at the workflow level rather than with inline `if:` guards.
- **Parallel with major monorepo conventions.** The two-workflow layout matches chakra-ui, radix-ui, and gitify - reducing onboarding friction for contributors accustomed to those patterns.
- **Docs checks stay included.** PR builders see docs type and lint failures immediately after Astro types are generated.

### Negative

- **~2s added to every CI run** for `vp check` on top of the build time. This is negligible in absolute terms but proportionally large relative to the build time itself.
- **Two workflow files to maintain instead of one.** The split introduces a second file plus the shared composite action. A future maintainer must understand three files (two workflows + one action) instead of one.
- **Cache storage increases.** The vp task cache now saves per commit instead of per lockfile. The cache is small (~1 MB in measured runs), so the storage trade-off is acceptable.
- **Docs static build is not part of CI.** A broken static docs render can pass `pnpm check:ci`. Mitigation: local `pnpm build` still builds docs, and docs-specific CI can be added when docs deployment becomes a gated workflow.

### Risks

- **Cache poisoning.** A corrupted local task cache could be uploaded and restored across CI runs. Mitigation: vp's task cache is keyed by content hashes; a corrupted entry produces a cache miss, not a false positive. The risk is limited to wasted compute.
- **Docs build drift.** Excluding docs from `build:ci` can let a docs-only static-rendering issue reach `main`. Mitigation: docs type/lint checks still run, and docs build remains covered by local `pnpm build`.

## Decision 5: Extract shared setup into composite action

Created `.github/actions/setup/action.yml` combining Node.js setup (`actions/setup-node@v4` with `.node-version`), `pnpm/setup@v1` (handles install automatically), and vp task cache restore (`actions/cache@v6`). Checkout remains in the calling workflow.

This eliminates the 6-line setup block that was duplicated across `release.yml` and `release-kimi-code.yml`, following the pattern used by chakra-ui, radix-ui, and gitify.

## Related Decisions

- ADR-CORE-005 (Shared Agent Directives via core-sync Bridge) - established the `check-sync` CI guard that runs as part of `vp check`, which is now executed in CI via this ADR.
- ADR-CORE-006 (Project Workflow Protocol) - defined `vp check` as the pre-commit verification gate; this ADR extends that gate to CI.

## References

- `.github/workflows/ci.yml` - PR and main check workflow (check + package build + test, cancel-in-progress)
- `.github/workflows/release.yml` - release workflow (fresh package build + changesets publish)
- `.github/actions/setup/action.yml` - shared composite action for checkout + pnpm setup + cache
- `package.json` - defines `"check": "vp check && vp run build && vp run test"`
- `vite.config.ts` - defines the `vp` tasks (fmt, lint, run) that `vp check` invokes
- [actions/cache documentation](https://github.com/actions/cache) - cache action reference
- [changesets/action documentation](https://github.com/changesets/action) - changesets publishing action
