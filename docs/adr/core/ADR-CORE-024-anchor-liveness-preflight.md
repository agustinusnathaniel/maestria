# ADR-CORE-024: Scope-Aware Anchor Liveness Preflight

## Status

Accepted (2026-09-10)

## Context

The shared sync pipeline ([ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md)) applies literal split/join `replace` ops to canonical directive text: when `from` stops matching, the op silently no-ops while still appearing load-bearing in review. [ADR-CORE-019](ADR-CORE-019-directive-simplification.md) removed the first generation of dead anchors and recorded anchor-liveness validation as a follow-up.

Two gaps allowed silent anchors:

1. **No liveness check.** The transform discarded match counts, and resolved configs did not record whether an op came from `default` or a `files` entry.
2. **No preflight.** A check must run before any write, and liveness must respect op ordering, scope, and secondary sources to be trustworthy.

An audit found ops that were dead (anchor absent), shadowed (rewritten by an earlier op), or identity (`from` equal to `to`); this change set removes them.

## Goals

- Every resolved replace op is proven live before the engine writes anything.
- Default ops are judged against all files they sweep; file ops against their own file.
- Malformed ops (`from` equal to `to`, empty `from`) fail even when they would match.
- Configuration failures fail loudly and consistently: no writes, `ConfigError`, exit code 2.
- Keep the authoring shape (`ReplaceOp` and all host configs) unchanged.

## Non-Goals

- No re-anchoring or rewriting of ops that survive; the hermes/cursor/claude prose and tool-anchor opportunities are planned follow-ups.
- No changes to `processFile` writes, auto-clean, preserve, or CLI flag behavior.
- No changes to exit codes 0 and 1.

## Decision

1. **Provenance in resolved ops.** Resolved ops carry a `scope` tag (`'default'` or `'file'`) assigned during config merging; the authoring `ReplaceOp` and all host configs are unchanged.
2. **Match counts in the transform.** `applyReplaceOps(content, ops)` counts occurrences of each `from` immediately before that op is applied, using one rewrite loop and one counter; processing consumes only the resulting content.
3. **Validator.** `anchors.ts` exports `AnchorReport` and `validateAnchors(config, sourceFiles)`, mirroring the engine: primary `.md` files from the source walk, filename lookup, optional frontmatter stripping, ordered op application, and secondary `files` entries resolved relative to the source directory. Rules:
   - A `default` op must match at least once across all swept files (aggregated by `from` + `to`).
   - A `file` op must match at least once in the file entry it belongs to.
   - `from` equal to `to`, and empty `from`, are violations on every resolved op regardless of liveness.
   - Each violation records config path, file (or `all files` for defaults), scope, `from`, and match count, in deterministic sweep order.

   > Corrected 2026-09-11: the validator no longer resolves its own target set and no longer skips absent secondary entries. `resolveSyncPlan` produces one ordered primary-then-secondary plan consumed by both `validateAnchors` and processing, and a secondary entry absent from the source directory throws `ConfigError` before validation runs ([ADR-CORE-025](ADR-CORE-025-consumer-driven-sync-and-adapter-simplification.md)).

4. **Preflight in the engine.** `runSync` walks source files once, calls `validateAnchors` before any processing, and throws `ConfigError` listing every offender; no writes, cleanups, or removals occur on throw.

   > Corrected 2026-09-11: the early return that skipped processing when `config.source` did not exist was replaced by fail-closed handling; a missing source directory now throws `ConfigError` before any file work ([ADR-CORE-025](ADR-CORE-025-consumer-driven-sync-and-adapter-simplification.md)).

5. **Exit code 2.** The CLI wraps the `runSync` call; a thrown `ConfigError` prints `Configuration error: <message>` and returns 2, matching existing `loadConfig` handling, in write, dry-run, and check modes. Exit codes 0 and 1 are unchanged.
6. **Cleanup.** Dead, shadowed, and identity replace ops across the sync configs are removed; surviving ops are enforced by the new preflight.

## Consequences

### Positive

- A dead or shadowed anchor fails the run instead of silently shipping untransformed text.
- Scope-aware aggregation avoids false positives: a default op needs one matching file, and a file op is checked only where it applies.
- Failures are deterministic, list every offender, and write nothing.
- CI (`scripts/check-sync`) and local sync (`scripts/sync-all`) both get enforcement with no new flags.

### Negative

- Conditional ops that match zero times now require an explicit config change rather than silently no-oping.
- The validator reads source files a second time per run; the corpus is small, and [ADR-CORE-023](ADR-CORE-023-evidence-led-directives.md) favors proportionate evidence over speculative optimization.

## Assumptions

- [verified] The removed ops were dead, shadowed, or identity, and the remaining corpus passes the preflight (`scripts/check-sync` green).
- [verified] The validator mirrors the engine's file sweep and op order; the shadowed-anchor and ordering tests pin both.
- [inferred] Silent transform loss was the dominant failure mode for these anchors; no measurement quantifies how often a dead op shipped unnoticed.

## Alternatives Considered

- **Warn-only validation:** rejected because a warning can be ignored and the pipeline would still write output based on missing transforms.
- **Count matches in `processFile` and fail there:** rejected because earlier files would already be written when a later anchor fails; preflight guarantees no writes.
- **Validate each default op per file:** rejected as too strict; default ops legitimately match only in files containing the anchor.
- **Require `scope` in the authoring `ReplaceOp`:** rejected; hidden scope tagging keeps all host configs unchanged.

## Verification

- `pnpm --filter @maestria/core test` passes, including anchor validation cases (dead and partial defaults, dead and shadowed file ops, identity and empty `from`, ordering, secondary source, no-write preflight, live write).
- `vp check`: no formatting, lint, or type errors.
- `bash scripts/check-sync`: all packages in sync with enforcement active.
- `bash scripts/sync-all`: 0 files written, working tree unchanged.
- CLI fixture: a dead-anchor config exits 2 with `Configuration error: Anchor validation failed ...` and writes no output; a live config exits 0.

## Rollback

Revert `anchors.ts`, the preflight call in `runSync`, the `ConfigError` handling in the sync CLI, and the resolved-op and apply-op changes together. If the op cleanup stays while enforcement is reverted, silent no-ops return; if the cleanup is reverted too, `scripts/sync-all` must regenerate projections and `scripts/check-sync` must pass.

## Related Decisions

- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): sync config model and exit codes 0/1/2.
- [ADR-CORE-016](ADR-CORE-016-root-resolved-sync-tooling.md): root-resolved `pnpm exec tsx` runner.
- [ADR-CORE-019](ADR-CORE-019-directive-simplification.md): recorded this validation as a follow-up and removed the first generation of dead anchors.
- [ADR-CORE-023](ADR-CORE-023-evidence-led-directives.md): proportionate verification, fail-loud evidence, no warnings in place of enforcement.

## Date

2026-09-10
