# ADR-CORE-009: CI Quality Gates - Static Analysis, Caching, and Workflow Structure

## Status

Accepted (2026-06-29); amended (2026-07-10, 2026-08-24)

## Context

The maestria CI pipeline, defined in `.github/workflows/release.yml`, ran on every PR push and main merge as a single sequence: install dependencies, build all packages, run tests, then (on main) let changesets create a release PR or publish.

The pipeline had three problems:

1. **No static analysis in CI.** `pnpm build` compiled packages but did not check formatting, lint, or types, so violations could merge and surface only as pre-commit hook failures on other machines (or not at all if hooks were bypassed). The project already had `pnpm check` (format check, type-aware lint, builds, and tests) but CI only ran the build.
2. **Zero test cache hit rate.** The vp task cache (`node_modules/.vite/task-cache`) tracks per-task output hashes and skips re-execution when inputs haven't changed, but it lives in `node_modules`, which is not persisted between CI runs; every run started cold even when nothing had changed.
3. **Docs build cost was unknown.** `pnpm check` runs `vp run build`, which builds every package including `@maestria/docs`, a large Astro site. Excluding docs from the PR build could save time, at the cost of a `--filter` flag and coupling CI to the docs package name.

A secondary, pre-existing question was whether the single-workflow layout (one `release.yml` handling both PR checks and main-branch release) should be split into `ci.yml` + `release.yml` for clarity.

## Decision 1: Use `pnpm check:ci` for CI Verification

### Change

Use `pnpm check:ci` in `.github/workflows/ci.yml`. This adds format checking, type-aware oxlint linting, TypeScript type checking, package builds, and tests to every CI run. The package build uses `pnpm build:ci`, which excludes the docs static build while retaining the sync guard through `prebuild:ci`.

### Cost

Roughly 2 seconds per run added (measured); the bulk of it is process overhead around the format check, type-aware lint, and the check-sync guard.

### Alternatives Considered

| Option | Assessment | Verdict |
| --- | --- | --- |
| **Separate step** (`pnpm check` as a distinct step before build) | Adds no value over the script swap; the script already sequences check before package build. Same total time, more YAML. | Rejected |
| **Parallel job** (check in one job, build+test in another) | Duplicate checkout, pnpm setup, and dependency install cost far more than the check itself. | Rejected |
| **Pre-merge status check** (require a separate `ci-check` job as required status) | Same cost as parallel job with more config, plus repository settings changes to mark the new check as required. | Rejected |

### Rationale

The script swap is the minimal change that brings static analysis into CI. It adds near-zero maintenance burden and keeps the workflow readable; the alternatives add complexity for no meaningful gain.

## Decision 2: Exclude Docs Build from CI/Release Package Builds

### Change

Add a dedicated `pnpm build:ci` script that builds all packages except `@maestria/docs`, plus a matching `prebuild:ci` lifecycle hook for the sync guard:

```json
"prebuild:ci": "vp run check-sync",
"build:ci": "vp run --filter './packages/*' --filter ./apps/maestria-cli build"
```

`pnpm build --filter "!@maestria/docs"` was tested and rejected: pnpm appends the filter after the `build` task name, so `vp run` forwards it to each package script instead of treating it as a workspace selector.

`vp run --filter "!@maestria/docs" build` was also rejected: the negated filter includes the workspace root, whose `build` script recursively builds all packages, including docs. The final script selects package directories directly and includes the CLI app explicitly, matching Vite+ behavior: `vp run --filter <selector> build` is the documented filtered form, arguments after the task name are passed through to the task command, and combining `--filter` with `--recursive` is rejected.

Use `build:ci` from `pnpm check:ci` and from `release.yml`.

### Rationale

Docs are still checked by `vp check` after the `Generate Astro types` step, so TypeScript and lint coverage remain in CI. The expensive Astro static build produces no publishable npm artifacts and is not needed before `changeset publish`; release builds only need to prove that publishable packages can produce fresh dist output. A named script avoids repeating a non-obvious negated filter in workflow YAML.

### Trade-off

Docs static rendering failures are no longer caught by `pnpm check:ci`. They are still caught by local `pnpm build`, and a docs-specific workflow can be added later if docs deployment becomes part of CI.

## Decision 3: Cache vp Task Cache in CI

### Change

Added `actions/cache` to restore and save `node_modules/.vite/task-cache` in both workflows (`release.yml` and `release-kimi-code.yml`).

### Cache Key

The key hashes `pnpm-lock.yaml` (`vp-task-cache-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}`) so the cache is reused across all runs that share the same dependency lock file. A `restore-keys` fallback matches the most recent cache for the same OS when the exact key misses (e.g., after a dependency update).

### Impact

Before, every CI run executed all tests from scratch because the cache directory was destroyed between runs. After, unchanged tasks are skipped entirely by vp's hash-based invalidation, and the test step time drops to near zero when no test inputs have changed.

Amended (2026-07-10): the original SHA-based key (committed as part of this ADR) was replaced with the lockfile-hash key above. The SHA key produced a unique cache per commit, achieving near-zero hit rate; the lockfile key persists across commits that share the same dependency lock. The original ADR rejected lockfile-only caching because GitHub Actions does not save a cache entry when the primary key already hits, risking stale task metadata. In practice that proved less impactful: vp's content-addressed invalidation detects stale entries per task and re-runs only affected tasks, so occasional re-verification is far cheaper than a cold start every run.

### Rationale

This fix is a one-time cost (a short cache step). The vp task cache is designed to be persisted between runs; not caching it was an oversight. The cache action handles upload at the end of the job automatically, so no explicit `save` step is needed.

## Decision 4: Split into CI (`ci.yml`) and Release (`release.yml`) workflows

### Rationale

The single workflow conflated two concerns with different requirements: CI checks on PRs and publishing on main. Every major pnpm+changesets monorepo (chakra-ui, radix-ui, gitify) splits them.

| Workflow | Triggers | Cancel in-progress | Behaviour |
| --- | --- | --- | --- |
| **ci.yml** | PRs and pushes to main | Yes | Run check + package build + test. Fast feedback, no publish. |
| **release.yml** | Push to main (path-filtered), workflow_dispatch | No | Run fresh package build + changesets publish. Must not cancel mid-publish. |

A composite action (see Decision 5) eliminates setup duplication between the two workflows, removing the main objection to the split.

### Concurrency

`release.yml` sets `cancel-in-progress: false` to prevent a subsequent push from cancelling an in-progress publish. `ci.yml` sets `cancel-in-progress: true` so a new push on the same PR cancels the stale run.

### Notes

- **`workflow_dispatch` inputs:** the trigger accepts no inputs. Version bump type inputs (major/minor/patch) were intentionally removed to simplify the manual trigger; changesets determines the version bump from changeset files.
- **Timeout increase:** `release.yml` uses a longer timeout than `ci.yml` to accommodate fresh package builds before the publish step.
- **Main-push CI retained:** `ci.yml` still runs on `main` pushes because `release.yml` is path-filtered to release-related files; without it, non-release main pushes would lose post-merge validation.

## Decision 6: Generate Astro Types Before Typecheck

### Context

`pnpm check` includes TypeScript type checking. The `apps/docs` Astro project references `.astro/types.d.ts` in its `tsconfig.json` - a file generated by `astro sync` or `astro build`. On fresh CI environments (and fresh clones) this file does not exist, causing TS6053: "File '.astro/types.d.ts' not found."

Before Decision 1 (when CI ran `pnpm build` instead of `pnpm check`), this was invisible because `astro build` generates the types as a side effect. The typecheck step in `vp check` runs before `vp run build`, so the types don't exist yet.

### Change

1. Added a `sync` script (`astro sync`) to the docs app's `package.json`.
2. Added a `Generate Astro types` step in `ci.yml`, running `pnpm exec vp run --filter @maestria/docs sync` between the setup step and the check step.

### Cost

Negligible per run; it generates the Astro type declarations once, and the cache step saves more time on repeat runs than this costs.

### Alternatives Considered

| Option | Assessment | Verdict |
| --- | --- | --- |
| **Run `astro sync` directly** (`npx astro sync`) | Works but couples the CI command to the Astro CLI location; using `vp run --filter` is consistent with how other package scripts are invoked. | Equivalent - chose for consistency |
| **Skip typecheck for docs** (exclude from tsconfig) | Defeats the purpose of adding type checking; docs type errors would go undetected. | Rejected |
| **Reorder `vp check`** to run build first | Build takes longer than typecheck, delaying type-error feedback. | Rejected |

### Rationale

The sync step is the minimal addition required to make the existing typecheck pipeline work for Astro projects. It adds negligible time and follows the existing `vp run --filter` pattern used elsewhere in the monorepo.

## Decision 7: Align Changesets v3 with `changesets/action@v2`

Changesets v3 and `changesets/action` v2 use a different release metadata contract than the v1 action. The old pairing allowed npm publishing without reliably creating the corresponding GitHub Release.

Pair Changesets v3 with `changesets/action` v2, using its v2 input names and default tag/release behavior. The existing `contents: write` permission remains required. Existing npm-only releases require a one-time manual backfill; the routine workflow does not retroactively discover them.

## Consequences

### Positive

- **Static analysis on every PR.** Format, lint, and type errors are caught in CI before merging; developers get faster feedback than relying on pre-commit hooks alone.
- **Faster CI on repeat runs.** The vp task cache makes test re-runs nearly instant when no test code changed, which matters for PRs where only source or docs changed.
- **Release package builds skip docs.** Publishable packages are still built from scratch before publish without paying the Astro static-site cost.
- **Clear separation of concerns.** `ci.yml` handles PR feedback; `release.yml` handles publishing, with different concurrency, trigger-path, and cancellation policies enforced at the workflow level instead of inline `if:` guards.
- **Parallel with major monorepo conventions.** The two-workflow layout matches chakra-ui, radix-ui, and gitify, reducing onboarding friction for contributors accustomed to those patterns.
- **Docs checks stay included.** PR builders see docs type and lint failures immediately after Astro types are generated.

### Negative

- **Added time on every CI run** for `vp check` on top of the build time. This is negligible in absolute terms but proportionally large relative to the build time itself.
- **Two workflow files plus a shared composite action to maintain** instead of one workflow; a future maintainer must understand three files instead of one.
- **Cache storage is minimal.** The lockfile-hash key means only one cache entry exists per lockfile change.
- **Docs static build is not part of CI.** A broken static docs render can pass `pnpm check:ci`. Mitigation: local `pnpm build` still builds docs, and docs-specific CI can be added when docs deployment becomes a gated workflow.

### Risks

- **Cache poisoning.** A corrupted local task cache could be uploaded and restored across CI runs. Mitigation: vp's task cache is keyed by content hashes, so a corrupted entry produces a cache miss, not a false positive; the risk is limited to wasted compute.
- **Docs build drift.** Excluding docs from `build:ci` can let a docs-only static-rendering issue reach `main`. Mitigation: docs type/lint checks still run, and docs build remains covered by local `pnpm build`.

## Decision 5: Extract shared setup into composite action

Created `.github/actions/setup/action.yml` combining Node.js setup (from `.node-version`), pnpm setup (which handles install automatically), and vp task cache restore. Checkout remains in the calling workflow.

This eliminates the duplicated setup block across `release.yml` and `release-kimi-code.yml`, following the pattern used by chakra-ui, radix-ui, and gitify.

## Related Decisions

- ADR-CORE-005 (Shared Agent Directives via core-sync Bridge) - established the `check-sync` CI guard that runs as part of `vp check`, which is now executed in CI via this ADR.
- ADR-CORE-006 (Project Workflow Protocol) - defined `vp check` as the pre-commit verification gate; this ADR extends that gate to CI.

## References

- [actions/cache documentation](https://github.com/actions/cache) - cache action reference
- [changesets/action documentation](https://github.com/changesets/action) - changesets publishing action
- [Changesets CLI command options](https://github.com/changesets/changesets/blob/main/docs/command-line-options.md) - `git-tag` and `publish` behavior
