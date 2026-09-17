# ADR-CORE-016: Root-Resolved Sync Tooling

## Status

Accepted (2026-08-12). This ADR records the root-pinned `tsx` runner decision for the shared agent-directive sync pipeline ([ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md)), made to make sync checks deterministic in clean CI. The Vite+ toolchain reference in its historical non-goals is now governed by [ADR-CORE-021](ADR-CORE-021-ultracite-via-vite-plus.md).

## Context

The shared sync pipeline (ADR-CORE-005) runs the sync script once per plugin through the root orchestration scripts `scripts/sync-all` (write mode) and `scripts/check-sync` (CI gate, wired into the repository check task). Both change into each package directory and invoke the script with `npx tsx`:

```bash
(cd "$PKG_DIR" && npx tsx "$SYNC_SCRIPT" --check)
```

`tsx` was only declared as a devDependency of the Claude Code package; `omp`, `opencode`, and `pi` never declared it. In a clean CI install there was no local `tsx` binary in those directories, so `npx` fell back to fetching from the registry, which is non-deterministic and fails in clean/offline CI. On PR #189 (`feat/runtime-support-adapters`), `vp run check-sync` failed with per-package `tsx: not found` errors for those three packages.

Two review comments on PR #189 also questioned the Claude package's `sync` script (duplicate of the root `scripts/sync-all`) and its package-local `tsx` devDependency (unnecessary when the runner lives at the root).

### Authorization

The user explicitly authorized (2026-08-12, on branch `feat/runtime-support-adapters`) this fix: add a pinned root `tsx`; update `scripts/check-sync`/`scripts/sync-all` and the package wrappers; remove the Claude package-local `tsx`; update the affected docs/ADRs; regenerate the lockfile; and add this ADR. The authorization is limited to the sync tooling; it does not authorize runtime adapter behavior changes, toolchain upgrades, workflow YAML, CLI/model registry, or unrelated packages.

## Decision

1. **Pin `tsx` at the root** as a root development dependency at the exact version the committed lockfile already resolved for the workspace. Root devDependencies always produce a `node_modules/.bin/tsx` at the workspace root in a clean install, so the runner is guaranteed present regardless of per-package dependency graphs. No range (`^`, `~`, `latest`): upgrades are deliberate policy changes.
2. **Root orchestration scripts invoke the root-resolved runner via pnpm** (`pnpm exec tsx`), which resolves the workspace-root binary even from a package subdirectory. Each package's config path and working-directory behavior is preserved (the subshell still `cd`s into the package directory, keeping `./sync.config.ts` resolution correct), and the sync script path stays absolute.
3. **`npx` is prohibited for sync invocation**: it resolves against the current package's local install (absent for packages without a `tsx` devDependency) and otherwise falls back to registry fetching, which is non-deterministic and fails in clean/offline CI.
4. **The root scripts are the only sync entrypoints**; packages do not expose package-level `sync` wrappers. The root scripts discover each package's `sync.config.ts` and invoke the root runner from that directory.
5. **The Claude package-local `tsx` devDependency is removed**; the root pin is the single source for the runner.

## Consequences

### Positive

- Deterministic sync checks in clean CI: after `pnpm install --frozen-lockfile` the root `node_modules/.bin/tsx` always exists, so `scripts/check-sync` no longer depends on per-package dependency graphs or network availability.
- A single pinned runner version across the workspace, with no per-package range drift; future upgrades are intentional root pin changes.
- The `npx` registry fallback is eliminated from the shared repository gate.
- The PR #189 review comments are resolved: the runner is root-pinned, the root scripts are the only entrypoints, and no package-local `tsx` is required.

### Negative

- `tsx` is now a workspace-level tool dependency: the sync pipeline cannot run from a package in isolation without the workspace root installed. This is consistent with the pipeline being monorepo-internal (ADR-CORE-005: the tool is not published).
- The root `pnpm exec tsx` invocation depends on the project's pinned package manager, which is already the project's requirement.

## Alternatives Considered

### Option A: Keep `npx`, add `tsx` to every sync-enabled package

Rejected. Each package would pin its own range, duplicating the runner and allowing per-package drift, and `npx` would still fall back to registry fetching whenever the local binary is missing.

### Option B: Invoke the root bin path directly (`"$ROOT/node_modules/.bin/tsx"`)

Rejected in favor of `pnpm exec`. A direct path couples the scripts to the internal `node_modules` layout and bypasses package-manager resolution; `pnpm exec` is the documented, layout-independent way to run workspace bins from any subdirectory.

### Option C: Publish `core-sync` as a standalone package

Rejected, already covered by ADR-CORE-005: the tool only runs inside this monorepo, so a publish-consume cycle adds version bumps, changesets, and CI for zero benefit.

## Rollback

To revert:

1. Remove the root `tsx` pin from root `package.json` devDependencies.
2. Regenerate the lockfile with `pnpm install --lockfile-only` (or revert `pnpm-lock.yaml`).
3. Restore the `npx tsx` invocations in `scripts/check-sync`/`scripts/sync-all`, re-adding package-local `tsx` devDependencies only if package-local sync entrypoints are restored.
4. Re-verify with `pnpm install --frozen-lockfile`, `bash scripts/check-sync`, and `pnpm check` before committing.

Rolling back restores the previous resolution behavior (with its clean-CI failure mode); it does not change sync pipeline semantics.

## Verification

- `pnpm install --frozen-lockfile` reproduces the committed lockfile state.
- `pnpm exec tsx --version` resolves the root-pinned runner at the workspace root and from a package subdirectory.
- `bash scripts/check-sync` passes for every package with a `sync.config.ts`, and `bash scripts/sync-all` regenerates outputs with no drift.
- No package-level `sync` scripts are required; every package with a `sync.config.ts` is discovered by the root scripts.
- No `npx tsx` remains in supported sync scripts or docs, and no package-local `tsx` remains where the root runner is intended.

## Non-Goals (Explicit)

- No changes to sync pipeline semantics, transforms, config format, or generated outputs.
- No runtime adapter behavior changes for any package.
- No toolchain upgrades: this does not change the Vite+ toolchain governed by ADR-CORE-021, and no unrelated lockfile drift is introduced.
- No workflow YAML, CLI/model registry, or unrelated package changes.
- `tsx` upgrades beyond the root pin are future deliberate policy changes, not part of this decision.

## Related Decisions

- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) - the sync pipeline this tooling runs; this ADR fixes how its runner is resolved.
- [ADR-CORE-015](ADR-CORE-015-claude-code-package-manager-reproducibility.md) - the prior toolchain reproducibility pin for the Claude batch; this ADR applies the same exact-pin principle to the sync runner.

## References

- PR #189 (`feat/runtime-support-adapters`): clean CI failure in `vp run check-sync` with per-package `tsx: not found` errors for `omp`, `opencode`, and `pi`.
- Controlled pnpm experiment (2026-08-12): with `tsx` declared only at the root, `pnpm exec tsx` from a workspace subpackage resolves the root binary in a clean install.
- Committed lockfile baseline: `tsx` was already resolved for the Claude package; the root importer had no `tsx`.

## Date

2026-08-12
