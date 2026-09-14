# ADR-CORE-020: Hybrid Package Topology - Canonical Core with Explicit Host Projections

## Status

Accepted (2026-08-27)

## Context

Maestria ships a canonical methodology (`packages/core/agent-directives/`, ADR-CORE-005) that must run on multiple hosts. It is distributed through separately published host adapters, a management CLI, and separate runtime transports (Kimi, Pi, OMP, Claude Code, Cursor, Codex, Hermes). Three tensions accumulated:

1. **Canonical vs projection drift.** The sync pipeline (ADR-CORE-005, ADR-CORE-016) is the single source of truth, but helper logic began duplicating across hosts. The workflow-mode mechanics (`fein`/`sonar`/`blitz`, ADR-OC-003) were byte-identical in the OpenCode and Pi-family implementations - same keyword constants, markers, priority (`fein > sonar > blitz`), word-boundary case-insensitive detection, disabled-keyword support, code-block/inline-code exclusion, keyword stripping with trailing-colon cleanup, and `## MODE:` extraction - diverging in API shape only.
2. **Pi-family divergence.** `@maestria/pi` and `@maestria/omp` share `@maestria/shared-pi` for state, compaction, review, commands, tools, and mode mechanics; their skill validators were byte-identical filesystem/frontmatter routines with no platform divergence. Prime Agent stays intentionally isolated by ADR-CORE-014: its pinned Prime fork types and fail-closed skill prompt behavior are a verified extension subset.
3. **CLI contract drift.** The CLI validation module hand-maintains valid platform IDs while the platform handler registry is authoritative; the two can drift without a test failure.
4. **Distribution shape.** The Ponytail pattern (shared core plus thin per-host adapters with a unified CLI) and the oh-my-openagent pattern (one-command per-host install, no plugin footprint until installed) both favor explicit per-host adapters over a universal runtime bundle when marketplace manifests, install paths, peer dependencies, and runtime contracts differ.

Evidence:

- Duplicated mode logic verified by diffing the two implementations: same priority map, code-span exclusion, stripping, and unclosed-fence behavior per ADR-OC-003.
- Byte-identical skill validators verified by diff (zero delta).
- CLI drift verified by comparing the hand-maintained list against registry ids: same set, different ordering, no derivation.
- Ponytail and oh-my-openagent patterns inspected for hybrid vs universal trade-offs.

## Goals

- Eliminate duplication of pure, host-neutral mechanics without blurring package boundaries.
- Keep canonical directive content single-sourced and generated projections explicit per host (ADR-CORE-005).
- Preserve existing public APIs, install paths, peer dependencies, and runtime contracts.
- Make CLI platform validation derivable from the handler registry so it cannot drift.
- Avoid a universal runtime package coupling Node, Python, and host SDKs.

## Non-Goals

- No change to published package names, host manifests, peer dependencies, install paths, or runtime contracts.
- No refactor of Prime Agent's pinned fork types or fail-closed prompt behavior (ADR-CORE-014).
- No universal runtime package (`@maestria/core` remains content and sync tooling only).
- No hand editing of generated projections; all flow through `scripts/sync-all` / `scripts/check-sync`.
- No new public API surface on `@maestria/shared-pi` beyond delegation to a neutral module.

## Decision

Adopt a **pragmatic hybrid topology** with these layers:

| Layer | Package(s) | Visibility | Runtime | Content |
| --- | --- | --- | --- | --- |
| Canonical directives and sync | `@maestria/core` | private (monorepo) | neutral TypeScript, no host SDK | canonical directive content and sync pipeline |
| Generated host projections | host adapter packages | public, per-host | host-specific | declarative `sync.config.ts` derivations plus thin adapter code |
| Neutral shared modules | `@maestria/shared-mode` (new) | private, workspace-only | pure TypeScript, no host SDK or filesystem APIs | mode keywords/priority, code-block exclusion, detection, keyword stripping, `## MODE:` extraction |
| Pi-family shared code | `@maestria/shared-pi` | private, workspace-only | Pi runtime family (Pi/OMP) | state, compaction, review, commands, tools, plus delegation to shared-mode |
| Core script helpers | validation helper (new) | private, monorepo-only | Node filesystem/frontmatter, no host SDK | reusable validation routine shared by Pi/OMP and optionally other hosts |
| Host adapters | each `@maestria/*` host package | public, per-host | host-specific | plugin entry, hooks, lazy prompt loading, install/update/uninstall |
| Hermes distribution | `@maestria/hermes` (Python) | public, Python | Python | Hermes-specific bridge, not bundled with the Node runtime |
| Management CLI | `maestria` (`apps/maestria-cli`) | public, Node | Node (Effect, citty) | platform handler registry, version/install orchestration, registry-derived validation |

And explicitly **no universal runtime package**: no `@maestria/runtime` or `@maestria/sdk` bundling all hosts, both runtimes, or all adapters.

### Implementation binding for this ADR

1. **Shared neutral mode mechanics.** Extract the duplicated pure mode mechanics into a new private, platform-neutral workspace package under `packages/shared/` (`@maestria/shared-mode`), containing only neutral constants/types and pure functions: keywords (`fein`, `sonar`, `blitz`), markers, priority map (`fein:3 > sonar:2 > blitz:1`), code-block exclusion, detection with optional disabled keywords (case-insensitive, word-boundary, priority wins), keyword stripping, and `## MODE:` section extraction. It imports no host SDKs or filesystem APIs. OpenCode and `shared-pi` depend on it as a workspace build-time dependency and delegate while preserving existing APIs and behavior, including the accepted unclosed-fence behavior per ADR-OC-003.
2. **Skill-validator consolidation.** Move the common filesystem/frontmatter validation routine (missing file, frontmatter guard, `name:`/`description:` presence, empty-body guard) to a reusable private core script helper. Pi and OMP validate-skills scripts become thin wrappers importing it via `workspace:*` devDependencies while preserving output, exit status, and strictness. Prime's stricter validator (distinct name grammar, length caps, quoted-scalar normalization) is unchanged.
3. **CLI platform-ID single source.** Derive `VALID_PLATFORMS` from the canonical handler registry, preserving the normalized validation API, messages, ordering, and types, without an import cycle or handler behavior change; add focused tests proving the list equals the handler IDs.

## Consequences

### Positive

- Pure mechanics get one implementation and test suite; mode behavior is test-equivalent across hosts while adapter strictness (lazy loading, disabled keywords, prompt layout) stays local.
- Pi/OMP validator duplication is removed without a contract change - a shared filesystem routine, not shared policy.
- The CLI valid-platform set is statically derivable; handler additions and removals update validation automatically.
- No universal bundle: Node and Python runtimes, host SDKs, and marketplace manifests stay decoupled, keeping install footprint per-host.
- Generated projections stay derivations, gated by `scripts/check-sync`.

### Negative

- One more private workspace package (`@maestria/shared-mode`) with workspace edges that must stay acyclic and free of host or filesystem imports.
- Pi/OMP leniency changes must be modeled as helper options, not wrapper forks, or helper strictness would drift.
- CLI derivation must import handler ids without handler runtime effects, requiring a pure id registry or careful barrel split to avoid a cycle.

## Alternatives Considered

### Option A: Current multi-package (status quo)

Rejected: the pure mode logic and validators are byte-identical copies and the CLI list already drifts in ordering; long-tail drift, not immediate breakage, is the failure mode.

### Option B: Shared core plus packages (Ponytail-leaning)

One shared `@maestria/core` runtime imported by every host for every mechanic. Rejected as over-coupling: only mode mechanics are verified pure; state, compaction, and subagent dispatch are Pi-family specific, and a single runtime would couple OpenCode's minimal hook to Pi extension APIs and future Python needs.

### Option C: Universal single bundle

A single runtime package bundling canonical content, all adapters, and both runtimes. Rejected: it would conflate Node vs Python distributions, marketplace manifests, peer dependencies, and install paths, and violate the per-host footprint pattern.

### Option D: Pragmatic hybrid (chosen)

Private canonical core, generated host projections, narrow neutral shared modules for verified pure duplication, private Pi-family shared code, separate public host adapters, separate Hermes Python distribution, separate CLI, no universal runtime. Chosen because it removes the verified duplication, isolates the verified pure subset without generalizing speculative sharing, preserves public contracts, and matches the Ponytail and oh-my-openagent patterns.

## Assumptions

- Mode keyword set `fein, sonar, blitz` is stable per ADR-OC-003; adding a keyword updates the neutral module and both adapters rather than diverging them. `[inferred]`
- Unclosed fenced code blocks are intentionally not excluded (accepted false-positive) per ADR-OC-003. `[verified]`
- Hermes remains Python-only and is not a candidate for the Node shared layer. `[verified]`
- The `maestria` CLI remains the single management surface (ADR-CORE-007); platform handlers are not unified into a universal runtime. `[verified]`

## Implementation Notes

- `@maestria/shared-mode` is private and consumed as `workspace:*`; prompts remain lazily loaded per host from the canonical command files, and filesystem loading plus session-state side effects stay in each adapter.
- The core script helper lives under the core scripts directory (avoiding a new package for a build-time script) and is exposed as a private subpath; Prime's validator stays separate.
- CLI derivation reads handler ids without importing effectful handlers; a pure id module or drift-guard test keeps validation equal to the handler ids.

## Related Decisions

- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) - canonical content core and sync pipeline; extended here with neutral shared modules.
- [ADR-CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md) - runtime support and adapter policy; Prime Agent isolation preserved.
- [ADR-OC-003](../opencode/ADR-OC-003-keyword-triggered-workflow-modes.md) - keyword-triggered workflow modes; unclosed-fence behavior and priority preserved.
- [ADR-CORE-002](ADR-CORE-002-plugin-architecture.md) - pure plugin architecture; hybrid keeps per-host adapters thin.
- [ADR-CORE-007](ADR-CORE-007-cli-package-plugin-management.md) - CLI package/plugin management; derivation keeps the registry single-sourced.

## References

- Duplicated pure mode mechanics in the OpenCode and Pi-family implementations (see Decision).
- Byte-identical Pi/OMP skill validators.
- CLI platform-ID drift between validation and the handler registry.
- Ponytail hybrid distribution pattern.
- oh-my-openagent one-command per-host install pattern.

## Date

2026-08-27
