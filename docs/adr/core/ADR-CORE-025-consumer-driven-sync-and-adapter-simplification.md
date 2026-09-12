# ADR-CORE-025: Consumer-Driven Sync and Adapter Simplification

## Status

Accepted (2026-09-11)

## Context

A simplification pass audited the sync pipeline and the shared adapters for code that had no consumer. The audit found four kinds of accumulation:

- **Unused config surface.** `autoGenComment` let a sync config replace the generated-file notice, but no `sync.config.ts` set it.
- **Uncalled exports.** Shared modules and sync result types carried public symbols that only their own tests imported: `SyncFileResult.content`, `SyncOptions.log`, `recordSubagentStatus`, `setReviewMode`, `validateHandoff`, `HANDOFF_FIELDS`, and `VALID_KEYWORDS`.
- **Lenient failure paths.** A missing `source` directory returned an empty result set, and a configured `files` entry present in neither source location produced a verbose-only log line.
- **Duplicated mechanics.** Pi and OMP carried parallel review-mode adapters, and OpenCode kept local mode constants and a keyword guard that duplicated `@maestria/shared-mode`.

The sync tool and shared packages are private to this repository, so internal consistency and fail-loud behavior matter more than retaining compatibility shims for hypothetical external consumers.

## Goals

- Remove config features with zero consumers and exports with zero callers instead of keeping aliases or speculative surface.
- Make sync configuration failures fail closed instead of silently skipping.
- Keep one resolution plan shared by anchor validation and processing.
- Share CLI batch mechanics and review-mode adapter seams where hosts genuinely match.
- Keep host-specific behavior and proven safety checks intact.

## Non-Goals

- No user-facing behavior change to the published plugins (`@maestria/pi`, `@maestria/omp`, `@maestria/opencode`) or the `maestria` CLI.
- No new sync features, config options, or CLI flags.
- No removal of complexity that encodes a host boundary or has demonstrated failure history.

## Decision

1. **Consumer-driven removal.** A config feature with zero consumers and an export with zero callers is removed rather than kept, aliased, or deprecated. This pass removed:
   - `autoGenComment` from `FileConfig` and `ResolvedFileConfig`; the generated comment is unconditional.
   - `SyncFileResult.content` (no caller read it) and `SyncOptions.log` (no caller injected a logger).
   - `recordSubagentStatus` and `setReviewMode` from the shared state helpers, plus their re-exports from the Pi and OMP state modules.
   - `validateHandoff`, `HANDOFF_FIELDS`, and `HandoffValidation` from `@maestria/shared-pi/subagent-utils`; only their own tests imported them.
   - The `VALID_KEYWORDS` alias in `@maestria/shared-mode` and OpenCode's local keyword list; consumers use `MODE_KEYWORDS` and `isModeKeyword`.
   - The `MODE_KEYWORDS` and `MODE_CLEAR_COMMAND` re-exports from `@maestria/shared-pi/modes-core`; the constants are internal there now.
   - `getBlockedReviewReason` became module-private in `tools-core` (no external caller).
2. **Fail-closed sync configuration.** `runSync` throws `ConfigError` when `config.source` is missing instead of returning an empty result, and this check runs before any file work. `resolveSyncPlan` throws one `ConfigError` listing every configured `files` entry absent from both the primary source directory and `path.dirname(source)`, before anchor validation and processing, instead of logging a verbose-only skip. Both paths print `Configuration error: <message>` and exit 2.
3. **One resolution plan.** `resolveSyncPlan` in `scripts/lib/plan.ts` resolves one ordered `SyncPlanEntry` list (primary `.md` files in walk order, then secondary config entries in declaration order) and performs missing-entry validation. `validateAnchors` and `runSync` consume the same plan, so validation cannot disagree with processing about which file exists, which config applies, or which ops run.
4. **CLI shared primitives and batch harness.** `apps/maestria-cli/src/lib/primitives.ts` owns shared JSON/record guards, parsers, and path checks. `batch-command.ts` owns the install/update/uninstall skeleton: quiet resolution, result rendering, the concurrency-1 selection runner, and the non-interactive usage guard. Each command keeps its own prompts, filters, and messages.
5. **Shared review adapter.** `createReviewApi` in `@maestria/shared-pi/review-core` binds a host and its model type guard. Pi and OMP pass `isPiModel`/`isOmpModel` and keep thin state wrappers, so host validation stays at the platform seam.
6. **OpenCode mode reuse.** OpenCode imports mode constants, detection, stripping, and section extraction from `@maestria/shared-mode`; its `modeKeywordSchema` is built from `MODE_KEYWORDS`, and the duplicated marker and keyword tables are gone.
7. **Retained complexity.**
   - **Prime Agent self-contained modes.** `packages/prime-agent/src/modes.ts` stays independent: [ADR-CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md) isolates its pinned Prime fork types and fail-closed prompt behavior as a verified extension subset.
   - **Hermes Python implementation.** The plugin, hooks, and permission gating are host-native Python and not portable TypeScript; rewriting them would trade working enforcement for uniformity.
   - **Per-host adapter seams.** Pi and OMP model guards, host types, lazy prompt loading, and session state differ; merging their adapters would couple packages to save a few lines.
   - **Anchor validation and provenance checks.** `validateAnchors` ([ADR-CORE-024](ADR-CORE-024-anchor-liveness-preflight.md)) and `checkProvenance` stay because dead anchors, shadowed replaces, and unreviewed output edits shipped silently before these gates existed.

> Updated 2026-09-11: a further reduction pass refreshed this list. The entries above are preserved as the original decision record; the current list is in the update section below.

## Consequences

- Fewer config fields and exports to document, test, and maintain.
- Misconfiguration fails the run instead of producing partial or empty output.
- Batch and review behavior stays consistent across hosts while host-specific validation remains local.
- Removing the symbols is a breaking change for any out-of-repo consumer; that is acceptable because the sync tool and shared packages are private and the plugin packages do not export these names.

## Assumptions

- [verified] The removed symbols had no production callers; `git grep` over `packages/` and `apps/` found references only in the shared modules, their tests, and changelog history.
- [verified] No workspace `sync.config.ts` set `autoGenComment`.
- [verified] `createReviewApi` is used by `packages/pi/src/state/review.ts` and `packages/omp/src/state/review.ts`; OpenCode imports `@maestria/shared-mode` directly.
- [inferred] The retained seams protect host boundaries or failure history; removing them would require host-specific evidence that does not exist yet.

## Alternatives Considered

- **Deprecate before removal:** rejected because there are no external consumers to migrate; a shim would be dead code with a longer life.
- **Keep the lenient missing-entry skip:** rejected because it produced partial syncs with only a verbose log line, the same silent-loss class that [ADR-CORE-024](ADR-CORE-024-anchor-liveness-preflight.md) rejects for anchors.
- **Merge Prime Agent modes into `shared-mode`:** rejected per ADR-CORE-014; Prime's pinned types and behavior are a verified subset, not a shared surface.
- **Merge Pi and OMP review modules entirely:** rejected; the remaining code is host types and guards, which is exactly what the seam should hold.

## Verification

- `pnpm --filter @maestria/core test` covers sync fail-closed configuration, `--diff` output, and anchor preflight.
- `pnpm --filter maestria test` covers CLI primitives and the batch command skeleton.
- `pnpm --filter @maestria/shared-pi test` and `pnpm --filter @maestria/shared-mode test` cover the review adapter and mode mechanics.
- `bash scripts/check-sync` proves the generated projections are unchanged.

## Rollback

Restore the removed fields, exports, and lenient missing-entry path together with their tests. Restoring an API without consumers recreates the surface this ADR removes; restoring the lenient path alone reopens silent partial syncs.

## Update (2026-09-11): Further Consumer-Driven Removals

A second reduction pass applied the consumer-driven rule to the Pi/OMP adapter layer, the sync configs, and Hermes internals. The decision above is unchanged; Decision item 7 is preserved as the original record, and the current retained list is below.

### What was removed

- **Host adapter layers were deleted, not retained.** Pi and OMP carried `createCompactionApi`/`CompactionApi`, `createModeCommandsApi`/`ModeCommandsApi`/`ModeCommandContext`, and `createToolApi` wrappers whose only job was to re-wrap `ExtensionAPI` before calling a shared installer. The forwarders are gone; hosts pass the extension object directly to installers that declare only the surface they use (`Pick<ExtensionAPI, ...>`, the local `ToolApi`, or `ExtensionAPI`). OMP lost its unused `CommandsApi`/`CommandsContext` types, and Pi lost the `installCommands` pass-through from `commands.ts` (`extension.ts` calls the shared installer directly). `packages/shared/pi/src/compaction-core.ts` declares `CompactionPi.on` with host-style overloads so both hosts satisfy it structurally.
- **State re-export barrels.** `packages/pi/src/state.ts` and `packages/omp/src/state.ts` only re-exported `@maestria/shared-pi/state-core`. They were deleted; consumers import `state-core` directly, and `restoreOriginalState` stays in each package's `state/review.js`.
- **Pi/OMP sync config consolidation.** The shared directive mapping moved to `packages/core/scripts/lib/agent-directive-sync.ts`. `packages/pi/sync.config.ts` and `packages/omp/sync.config.ts` are parameterized wrappers over it; the command prefix and agent-family name are parameters instead of duplicated tables.
- **Duplicate orchestrator guidance.** The Kimi Code, Cursor, Codex, and Claude Code orchestrator appends repeated specialist tables, agent lists, and explanatory prose that restated the canonical directives. The duplicates were deleted and the four generated `orchestrator/SKILL.md` projections were regenerated.
- **Hermes duplication.** `_refresh_tombstone_position` was deleted; `revoke_all_trust` now refreshes the FIFO position through `_set_trust_state`. `create_session_hooks` was removed in favor of registering the `SessionManager` bound methods directly in `register()`.
- **Orphaned exports.** Pi's `POLL_TIMEOUT_MS`, `POLL_INTERVAL_MS`, and `MAX_PARALLEL_TASKS` constants and the `PiModel` type became module-private.

### Retained complexity (current)

- **CLI Effect model.** The `maestria` CLI stays on Effect v4 per [ADR-CORE-007](ADR-CORE-007-cli-package-plugin-management.md) and [ADR-CORE-017](ADR-CORE-017-selective-effect-v4-adoption.md).
- **Prime Agent self-contained modes.** `packages/prime-agent/src/modes.ts` stays independent per [ADR-CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md); its pinned Prime fork types and fail-closed prompt behavior are a verified extension subset.
- **Hermes Python implementation.** The plugin, hooks, and permission gating remain host-native Python.
- **OMP goal `on` seam.** `createGoalApi` stays because the host gives `goal_updated`, `session_switch`, `session_branch`, and `session_tree` distinct payload types that a shared string-keyed `on` signature would erase.
- **Subagent contract differences.** Pi's subagent tool uses Typebox `SUBAGENT_PARAMETERS`, polling, and update callbacks; OMP validates raw params and hands off to its native `task` tool. Merging them would couple two different tool contracts.
- **Host-required wrappers.** Pi's `createCommandsApi` (model guard), Pi's `createSubagentToolApi` (`defineTool` wrapping), and OMP's `installCommands` (model guard and host signature narrowing) remain because the host API requires adaptation the shared core cannot express.
- **Anchor validation and provenance checks.** `validateAnchors` ([ADR-CORE-024](ADR-CORE-024-anchor-liveness-preflight.md)) and `checkProvenance` remain.

## Related Decisions

- [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): sync config model, CLI flags, and exit codes.
- [CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md): runtime support and adapter policy, Prime Agent isolation.
- [CORE-020](ADR-CORE-020-hybrid-package-topology.md): shared-mode extraction and shared-pi ownership.
- [CORE-023](ADR-CORE-023-evidence-led-directives.md): proportionate verification and fail-loud evidence.
- [CORE-024](ADR-CORE-024-anchor-liveness-preflight.md): anchor liveness and no-write preflight.

## Date

2026-09-11
