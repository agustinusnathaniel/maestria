# ADR-CORE-009: CI Quality Gates — Static Analysis, Caching, and Workflow Structure

## Status

Accepted (2026-06-29)

## Context

The maestria CI pipeline, defined in `.github/workflows/release.yml`, ran on every PR push and main merge. Its job was a single sequence: install dependencies, build all packages, run tests, then (on main) let changesets create a release PR or publish.

The pipeline had three problems:

1. **No static analysis in CI.** The `pnpm build` step compiled packages but did not check formatting, run the linter, or typecheck TypeScript. Format and lint violations could merge and only surface as pre-commit hook failures on other developers' machines — or not at all if hooks were bypassed. The project already had `pnpm check` (which is `vp check && vp run build`), covering format check via `vp fmt --check`, type-aware lint via `vp lint` (oxlint with type checking), and `vp run build`. The check and the build commands existed but CI only ran the latter.

2. **Zero test cache hit rate.** The task cache in vp (`node_modules/.vite/task-cache`) is a SQLite database that tracks per-task output hashes. If a task's inputs haven't changed, vp skips re-execution. But the cache is ephemeral — it lives in `node_modules` which is not persisted between CI runs. Every CI run started with a cold cache, running all tests from scratch even when nothing had changed.

3. **Docs build cost was unknown.** The `pnpm check` script runs `vp run build`, which builds every package including `@maestria/docs` — a 28-page Astro site. The question arose whether to exclude docs from the PR build to save time, at the cost of adding a `--filter` flag and coupling CI to the docs package name.

A secondary, pre-existing question was whether the single-workflow layout (one `release.yml` handling both PR checks and main-branch release) should be split into `ci.yml` + `release.yml` for clarity.

## Decision 1: Replace `pnpm build` with `pnpm check`

### Change

Replace the `pnpm build` step with `pnpm check` in `.github/workflows/release.yml`. This adds format checking, type-aware oxlint linting, and TypeScript type checking to every PR run. The build still happens because `pnpm check` expands to `vp check && vp run build`.

### Cost

~2 seconds per run added (measured). `vp check` consists of `vp fmt --check` (~0.3s), `vp lint` with type-aware checks (~0.5s), and the check-sync guard (~0.1s). The remaining time is process overhead.

### Alternatives Considered

| Option | Assessment | Verdict |
| --- | --- | --- |
| **Separate step** (`pnpm check` as a distinct step before build) | Adds no value over the script swap; the script already sequences check before build. Same total time, more YAML. | Rejected |
| **Parallel job** (check in one job, build+test in another) | Wastes ~30s on duplicate checkout, pnpm setup, and dependency install for a 2s check. | Rejected |
| **Pre-merge status check** (require a separate `ci-check` job as required status) | Same cost as parallel job with more config. Also requires repository settings changes to mark the new check as required. | Rejected |

### Rationale

The script swap is the minimal change that brings static analysis into CI. It costs ~2s per run, adds zero maintenance burden, and requires no workflow restructuring. The alternatives add complexity for no meaningful gain.

## Decision 2: Accept Current Docs Build Behavior

### Change

Do NOT exclude `@maestria/docs` from PR builds. Keep the existing `pnpm check` command as-is, building all packages including the documentation site.

### Rationale

The docs build is fast. It is a 28-page Astro site with minimal dependencies. With the vp task cache (see Decision 3), the docs build is essentially free on subsequent runs — Astro's own caching reuses previous output.

The `--filter` approach (`pnpm exec vp run --filter '!@maestria/docs' -r build`) would:

- Couple CI logic to the internal package name `@maestria/docs`
- Add a non-obvious `--filter` negation that future maintainers would need to understand
- Save zero measurable time at the current docs size

### Deferred Trigger

If the docs build becomes slow — 100+ pages, or if caching breaks and the build takes 30s+ — switch to the filtered approach. The one-liner is documented in this ADR for that future maintainer.

## Decision 3: Cache vp Task Cache in CI

### Change

Added `actions/cache@v4` to restore and save `node_modules/.vite/task-cache` in both workflows (`release.yml` and `release-kimi-code.yml`).

### Cache Key

```yaml
- name: Restore vp task cache
  uses: actions/cache@v4
  with:
    path: node_modules/.vite/task-cache
    key: vp-task-cache-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
```

The key uses `hashFiles('pnpm-lock.yaml')` because the task cache is invalidated when dependency versions change (which changes the lockfile hash).

### Impact

Before: every CI run executed all tests from scratch because the cache directory was destroyed between runs. After: unchanged tasks are skipped entirely by vp's hash-based invalidation. The test step time drops to ~0 when no test inputs have changed.

### Rationale

This fix is a one-time cost: a 5-line cache step. The vp task cache is designed to be persisted between runs — not caching it was an oversight. The `actions/cache@v4` action handles upload at the end of the job automatically; no explicit `save` step is needed.

## Decision 4: Split into CI (`ci.yml`) and Release (`release.yml`) workflows

### Rationale

The single workflow conflated two concerns with different requirements: CI checks on PRs and publishing on main. Every major pnpm+changesets monorepo (chakra-ui, radix-ui, gitify) splits them.

| Workflow | Triggers | Cancel in-progress | Behaviour |
| --- | --- | --- | --- |
| **ci.yml** | PRs (opened, synchronize) | Yes | Run check + test. Fast feedback, no publish. |
| **release.yml** | Push to main (path-filtered), workflow_dispatch | No | Run check + test + changesets publish. Must not cancel mid-publish. |

A composite action (see Decision 5) eliminates setup duplication between the two workflows, removing the main objection to the split.

### Concurrency

The `release.yml` workflow sets `cancel-in-progress: false` to prevent a subsequent push from cancelling an in-progress publish. The `ci.yml` workflow sets `cancel-in-progress: true` so that a new push on the same PR cancels the stale run.

## Consequences

### Positive

- **Static analysis on every PR.** Format, lint, and type errors are caught in CI before merging. Developers get faster feedback than relying on pre-commit hooks alone.
- **Faster CI on repeat runs.** The vp task cache makes test re-runs nearly instant when no test code changed. This matters for PRs where only source or docs changed.
- **Clear separation of concerns.** The `ci.yml` workflow handles PR feedback; the `release.yml` workflow handles publishing. Different policies for concurrency, trigger paths, and cancellation are enforced at the workflow level rather than with inline `if:` guards.
- **Parallel with major monorepo conventions.** The two-workflow layout matches chakra-ui, radix-ui, and gitify — reducing onboarding friction for contributors accustomed to those patterns.
- **Docs build stays included.** PR builders see docs build failures immediately, not after merge.

### Negative

- **~2s added to every CI run** for `vp check` on top of the build time. This is negligible in absolute terms but proportionally large relative to the build time itself.
- **Two workflow files to maintain instead of one.** The split introduces a second file plus the shared composite action. A future maintainer must understand three files (two workflows + one action) instead of one.
- **Cache key tied to lockfile.** If the lockfile changes frequently (dependency bumps), the cache is invalidated more often than strictly needed. In practice this is rare — lockfile changes are infrequent.
- **`--filter '!@maestria/docs'` is deferred, not documented as code.** The deferred approach is in this ADR rather than in a comment in the workflow file. If someone encounters the slow-docs scenario without reading this ADR, they will re-invent the approach. Mitigation: the trigger condition (100+ pages or 30s+ build) is concrete enough that a maintainer investigating docs build time will likely research prior decisions.

### Risks

- **Cache poisoning.** A corrupted local task cache could be uploaded and restored across CI runs. Mitigation: vp's task cache is keyed by content hashes; a corrupted entry produces a cache miss, not a false positive. The risk is limited to wasted compute.
- **Docs build breaks on unrelated PRs.** Including docs in the build means a docs-only build failure (e.g., a broken import in an Astro component) blocks a PR that didn't touch docs. Mitigation: this is by design — docs are part of the monorepo and should not break on any branch.

## Decision 5: Extract shared setup into composite action

Created `.github/actions/setup/action.yml` combining checkout (`actions/checkout@v7`), Node.js setup (`actions/setup-node@v4` with `.node-version`), pnpm install (`pnpm/action-setup@v6`), vp task cache restore (`actions/cache@v4`), and `pnpm install --frozen-lockfile`.

This eliminates the 6-line setup block that was duplicated across `release.yml` and `release-kimi-code.yml`, following the pattern used by chakra-ui, radix-ui, and gitify.

## Related Decisions

- ADR-CORE-005 (Shared Agent Directives via core-sync Bridge) — established the `check-sync` CI guard that runs as part of `vp check`, which is now executed in CI via this ADR.
- ADR-CORE-006 (Project Workflow Protocol) — defined `vp check` as the pre-commit verification gate; this ADR extends that gate to CI.

## References

- `.github/workflows/ci.yml` — PR check workflow (check + test, cancel-in-progress)
- `.github/workflows/release.yml` — release workflow (check + test + changesets publish)
- `.github/actions/setup/action.yml` — shared composite action for checkout + pnpm setup + cache
- `package.json` — defines `"check": "vp check && vp run build"`
- `vite.config.ts` — defines the `vp` tasks (fmt, lint, run) that `vp check` invokes
- [actions/cache documentation](https://github.com/actions/cache) — cache action reference
- [changesets/action documentation](https://github.com/changesets/action) — changesets publishing action
