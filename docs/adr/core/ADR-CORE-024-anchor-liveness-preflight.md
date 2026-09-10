# ADR-CORE-024: Scope-Aware Anchor Liveness Preflight

## Status

Accepted (2026-09-10)

## Context

The shared sync pipeline ([ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md)) applies `replace` operations to canonical directive text. Each op is a literal split/join: when `from` stops matching, the op silently no-ops while still appearing load-bearing in review. [ADR-CORE-019](ADR-CORE-019-directive-simplification.md) removed the first generation of dead anchors and explicitly recorded this work as a follow-up: "No check-sync tooling changes; anchor-liveness validation is recorded as a follow-up."

Two gaps made silent anchors possible:

1. **No liveness check.** The transform discarded match counts, and resolved configs carried no record of whether an op came from `default` or a `files` entry.
2. **No preflight.** A check must run before any write, and liveness must respect op ordering, scope, and secondary sources for the result to be trustworthy.

An audit found 63 replace ops across 8 sync configs that were dead (anchor absent from canonical text), shadowed (an earlier op already rewrote the anchor), or identity (`from` equal to `to`). Those ops are removed in this change set.

## Goals

- Every resolved replace op is proven live before the engine writes anything.
- Default ops are judged against all files they sweep; file ops are judged against their own file.
- Malformed ops (`from` equal to `to`, empty `from`) fail even when they would match.
- Configuration failures fail loudly and consistently: no writes, `ConfigError`, exit code 2.
- Keep the authoring shape (`ReplaceOp` and all host configs) unchanged.

## Non-Goals

- No re-anchoring or rewriting of ops that survive; the hermes/cursor/claude prose and tool-anchor opportunities are deliberate follow-ups.
- No changes to `processFile` writes, auto-clean, preserve, or CLI flag behavior.
- No changes to exit codes 0 and 1.

## Decision

1. **Provenance in resolved ops.** `ResolvedReplaceOp = ReplaceOp & { scope: 'default' | 'file' }`. `mergeFileConfig` tags default ops `'default'` and file ops `'file'`; `ResolvedFileConfig.replace` is `ResolvedReplaceOp[]`. The authoring `ReplaceOp` and all host configs are unchanged.
2. **Match counts in the transform.** `findAndReplace` becomes `applyReplaceOps(content, ops): { content: string; matches: number[] }`. Each entry counts occurrences of `op.from` in the content immediately before that op is applied, using one rewrite loop and one counter. `process-file.ts` consumes only `.content`.
3. **Validator.** New `packages/core/scripts/lib/anchors.ts` exports a typed `AnchorReport` and `validateAnchors(config, sourceFiles)`. It mirrors the engine: primary `.md` files from `walkDir`, filename lookup via `resolveSourceFile`, optional `stripFrontmatter`, ops applied in order via `applyReplaceOps`; secondary `config.files` entries not matched by a primary file resolve against `path.dirname(config.source)` and are skipped silently when absent. Rules:
   - A `default` op must match at least once across all files it sweeps (aggregated by `from` + `to`).
   - A `file` op must match at least once in the file entry it belongs to.
   - `from` equal to `to`, and empty `from`, are violations on every resolved op regardless of liveness.
   - Every violation records config path, file (or `all files` for defaults), scope, `from`, and match count, in deterministic sweep order.
4. **Preflight in the engine.** `runSync` walks source files once, calls `validateAnchors` before any processing, and throws `ConfigError` listing every offender. No writes, cleanups, or removals occur when it throws. The early return when `config.source` does not exist is preserved.
5. **Exit code 2.** The CLI wraps the `runSync` call; a thrown `ConfigError` prints `Configuration error: <message>` and returns 2, matching the existing `loadConfig` handling. This applies in write, dry-run, and check modes. Exit codes 0 and 1 are unchanged.
6. **Cleanup.** 63 replace ops across 8 sync configs (agent-plugin, claude-code, codex, cursor, hermes, omp, pi, prime-agent) that were dead, shadowed, or identity are removed. Surviving ops are enforced by the new preflight.

## Consequences

### Positive

- A dead or shadowed anchor fails the run instead of silently shipping untransformed text.
- Scope-aware aggregation avoids false positives: a default op needs one matching file, not every file, and a file op is checked only where it applies.
- Failures are deterministic, list every offender, and write nothing.
- CI (`scripts/check-sync`) and local sync (`scripts/sync-all`) both get the enforcement with no new flags.

### Negative

- Legitimately conditional ops that now match zero times require an explicit config change rather than silently no-oping.
- The validator reads every source file a second time per run (preflight plus processing). The directive corpus is small, and [ADR-CORE-023](ADR-CORE-023-evidence-led-directives.md) favors proportionate evidence over speculative optimization.

## Assumptions

- [verified] 63 removed ops were dead, shadowed, or identity across the 8 configs, and the remaining corpus passes the preflight (`scripts/check-sync` green).
- [verified] The validator mirrors the engine's file sweep and op order; the shadowed-anchor and ordering tests pin both.
- [inferred] Silent transform loss was the dominant failure mode for these anchors; no measurement quantifies how often a dead op shipped unnoticed.

## Alternatives Considered

- **Warn-only validation:** rejected because a warning can be ignored and the pipeline would still write output based on missing transforms.
- **Count matches in `processFile` and fail there:** rejected because writes happen per file and earlier files would already be written when a later anchor fails. Preflight guarantees no writes.
- **Validate each default op per file:** rejected as too strict; default ops legitimately match only in files that contain the anchor.
- **Require `scope` in the authoring `ReplaceOp`:** rejected; hidden scope tagging keeps all host configs unchanged.

## Verification

- `pnpm --filter @maestria/core test`: 92 tests pass, including new anchor validation cases (dead default across all files, partial default match, dead file op, shadowed file op, identity and empty `from`, creating-anchor ordering, secondary source, preflight no-write in write and check modes, live write).
- `vp check`: no formatting, lint, or type errors.
- `bash scripts/check-sync`: all 10 packages in sync with enforcement active.
- `bash scripts/sync-all`: 0 files written, working tree unchanged.
- CLI fixture: a dead-anchor config exits 2 with `Configuration error: Anchor validation failed ...` and writes no output; a live config exits 0.

## Rollback

Revert `anchors.ts`, the preflight call in `runSync`, the `ConfigError` handling in `scripts/sync.ts`, and the `ResolvedReplaceOp`/`applyReplaceOps` changes together. If the 63-op cleanup stays while enforcement is reverted, silent no-ops return; if the cleanup is reverted too, `scripts/sync-all` must regenerate projections and `scripts/check-sync` must pass.

## Related Decisions

- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): sync config model and exit codes 0/1/2.
- [ADR-CORE-016](ADR-CORE-016-root-resolved-sync-tooling.md): root-resolved `pnpm exec tsx` runner used by the orchestration scripts.
- [ADR-CORE-019](ADR-CORE-019-directive-simplification.md): recorded this validation as a follow-up and removed the first generation of dead anchors.
- [ADR-CORE-023](ADR-CORE-023-evidence-led-directives.md): proportionate verification, fail-loud evidence, and no warnings in place of enforcement.

## Date

2026-09-10
