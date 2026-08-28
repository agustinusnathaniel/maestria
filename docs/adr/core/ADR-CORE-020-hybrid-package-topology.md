# ADR-CORE-020: Hybrid Package Topology - Canonical Core with Explicit Host Projections

## Status

Accepted (2026-08-27)

## Context

Maestria ships a canonical methodology (`packages/core/agent-directives/`, ADR-CORE-005) that must run on multiple hosts. The monorepo currently distributes that methodology through separately published host adapters, plus a management CLI (`apps/maestria-cli`) and two runtime-specific transports (Kimi, Pi, OMP, Claude Code, Cursor, Codex, Hermes). Three tensions have accumulated:

1. **Canonical vs projection drift.** The sync pipeline (ADR-CORE-005, ADR-CORE-016) is the single source of truth, but helper logic has begun to duplicate across hosts. The workflow-mode mechanics (`fein`/`sonar`/`blitz`, ADR-OC-003) exist byte-identically in `packages/opencode/src/modes/index.ts` and `packages/shared/pi/src/modes-core.ts` (keyword constants, markers, priority `fein > sonar > blitz`, word-boundary case-insensitive detection, disabled-keyword support, code-block/inline-code exclusion via `/```[\s\S]*?```|`[^`]*`/g`, keyword stripping with trailing-colon cleanup, and `## MODE:` section extraction from command files). Those files diverged in API shape only; the pure logic is identical.

2. **Pi-family divergence.** `@maestria/pi` and `@maestria/omp` share `packages/shared/pi` (`@maestria/shared-pi`) for state, compaction, review, commands, tools, and mode mechanics. Their skill validators (`packages/pi/scripts/validate-skills.ts` and `packages/omp/scripts/validate-skills.ts`) are byte-identical copies of the filesystem/frontmatter routine (`existsSync`, `readFileSync`, `---` frontmatter match, `name:`/`description:` checks, empty-body guard). The duplication is 1:1 and has no platform divergence. Separately, Prime Agent (`packages/prime-agent`) is intentionally isolated by ADR-CORE-014: its local `pi-api.ts` (pinned Prime fork types) and fail-closed skill prompt behavior are a verified extension subset, not to be merged with Pi/OMP shared code.

3. **CLI contract drift.** `apps/maestria-cli/src/lib/validation.ts` lists valid platform IDs as a hand-maintained `VALID_PLATFORMS` array, while `apps/maestria-cli/src/lib/platforms.ts` maintains the authoritative registry (`platforms: readonly PlatformHandler[]` with ids `opencode`, `pi`, `prime-agent`, `kimi-code`, `hermes`, `cursor`, `omp`, `claude-code`, `codex`). The two sources can drift without a test failure if a handler is added or removed.

4. **Distribution shape.** External references inspected for guidance include the Ponytail distribution pattern (single shared core plus per-host thin adapters with a unified CLI) and the oh-my-openagent pattern (one-command plugin install per host, no plugin footprint until installed). Both favor explicit per-host adapters over a universal runtime bundle when hosts differ in marketplace manifests, install paths, peer dependencies, and runtime contracts.

Evidence:

- Duplicated mode logic verified by diffing `packages/opencode/src/modes/index.ts` (140 lines) against `packages/shared/pi/src/modes-core.ts` (170 lines of mode section) - same priority map, same code-span regex, same stripping logic, same unclosed-fence exclusion documented in ADR-OC-003.
- Byte-identical skill validators verified by `diff packages/pi/scripts/validate-skills.ts packages/omp/scripts/validate-skills.ts` (zero delta).
- CLI drift verified by comparing `VALID_PLATFORMS` (9 entries, ordering `opencode, omp, pi, prime-agent, kimi-code, hermes, cursor, claude-code, codex`) against `platforms` registry ids (same 9, ordering `opencode, pi, prime-agent, kimi-code, hermes, cursor, omp, claude-code, codex`) - same set, different ordering, no derivation.
- Ponytail/oh-my-openagent patterns inspected as external evidence for hybrid vs universal trade-offs (single-bundle runtime would conflate Node vs Python vs marketplace manifests).

## Goals

- Eliminate duplication of pure, host-neutral mechanics without blurring package boundaries.
- Keep canonical directive content single-sourced in `packages/core` and generated projections explicit per host (ADR-CORE-005 invariant).
- Preserve existing public APIs, install paths, peer dependencies, and runtime contracts for all public packages (`@maestria/*`, `maestria` CLI, Hermes Python distribution).
- Make CLI platform validation derivable from the handler registry so it cannot drift.
- Avoid a universal runtime package that would couple Node, Python, and host SDKs.

## Non-Goals

- No change to published package names, host manifests, peer dependencies, install paths, or runtime contracts.
- No refactor of Prime Agent's `pi-api.ts` or fail-closed skill prompt behavior - intentionally isolated by ADR-CORE-014.
- No claim of a universal runtime package (`@maestria/core` remains content and sync tooling only, not a runtime).
- No hand editing of generated projections under `packages/opencode/agents/`, `packages/pi/skills/`, etc. - all continue to flow through `scripts/sync-all` / `scripts/check-sync`.
- No new public API surface on `@maestria/shared-pi` beyond delegation to a shared neutral module.

## Decision

Adopt a **pragmatic hybrid topology** with the following layers:

| Layer | Package(s) | Visibility | Runtime | Content |
| --- | --- | --- | --- | --- |
| Canonical directives and sync | `@maestria/core` | private (monorepo) | neutral (TypeScript, no host SDK) | `packages/core/agent-directives/` content, `packages/core/scripts/` sync pipeline |
| Generated host projections | `@maestria/opencode`, `@maestria/pi`, `@maestria/omp`, `@maestria/claude-code`, `@maestria/cursor`, `@maestria/codex`, `@maestria/kimi-code` | public, per-host | host-specific (OpenCode SDK, Pi SDK, etc.) | declarative `sync.config.ts` derivations of canonical content plus thin adapter code |
| Private runtime-neutral shared modules | `@maestria/shared-mode` (new) | private, workspace-only | neutral (pure TypeScript, no host SDK, no filesystem APIs) | neutral constants/types and pure functions for mode keywords/priority, code-block exclusion, detection with optional disabled keywords, keyword stripping, and `## MODE:` section extraction |
| Private Pi-family shared code | `@maestria/shared-pi` | private, workspace-only | Pi runtime family (Pi/OMP) | state, compaction, review, commands, tools, plus delegation to `@maestria/shared-mode` for pure mode mechanics |
| Private core script helpers | `packages/core/scripts/lib/skill-validator.ts` (new) | private, monorepo-only | Node filesystem/frontmatter validation, no host SDK | reusable filesystem/frontmatter validation routine shared by Pi/OMP (and optionally other hosts) |
| Separate public host adapters | each `@maestria/*` host package | public, per-host | host-specific | plugin entry, host-specific hooks, lazy prompt loading, install/update/uninstall handlers |
| Separate Hermes Python distribution | `@maestria/hermes` (Python) | public, Python | Python | Hermes-specific bridge (not bundled with Node runtime) |
| Separate management CLI | `maestria` (`apps/maestria-cli`) | public, Node | Node (Effect, citty) | platform handler registry (`platforms`), version/install orchestration, validation derived from registry |

And explicitly **no universal runtime package**: no single `@maestria/runtime` or `@maestria/sdk` that bundles all hosts, both runtimes, or all adapters.

### Implementation binding for this ADR

1. **Shared neutral mode mechanics.** Extract the duplicated pure workflow-mode mechanics from `packages/opencode/src/modes/index.ts` and `packages/shared/pi/src/modes-core.ts` into a new private, platform-neutral workspace package under `packages/shared/` (named `@maestria/shared-mode`). The module contains only neutral constants/types and pure functions: mode keywords (`fein`, `sonar`, `blitz`), markers (`[MODE: fein]` etc.), priority map (`fein:3 > sonar:2 > blitz:1`), code-block exclusion regex, detection with optional disabled keywords (case-insensitive, word-boundary, priority wins), keyword stripping (trailing-colon and double-space collapse, trim), and extracting the `## MODE:` section from content. It does not import host SDKs or filesystem APIs. Package metadata and tests follow the existing `@maestria/shared-pi` private pattern. Both OpenCode and `shared-pi` depend on it as a workspace build-time dependency and delegate to it while preserving existing public/local APIs, lazy prompt loading, disabled keyword support, markers, priority, case-insensitivity, code-span behavior, and result shapes. Prime Agent's local `pi-api.ts` and fail-closed skill prompt behavior remain isolated. The accepted unclosed-fence behavior (fenced block without closing ``` is not excluded) is preserved per ADR-OC-003.

2. **Skill-validator consolidation.** Move the common filesystem/frontmatter validation routine (missing file, `---` frontmatter guard, `name:`/`description:` presence, empty-body guard) to a reusable core script helper under `packages/core/scripts/lib/` exposed via an explicit private export `@maestria/core/skill-validator` (`"./skill-validator"` with `types`/`import` pointing to the `.ts` helper, no root `"."` export). Keep `packages/pi/scripts/validate-skills.ts` and `packages/omp/scripts/validate-skills.ts` as thin platform wrappers that import `validateSkillsAndLog` from `@maestria/core/skill-validator` via `workspace:*` devDependencies, supplying their skill lists and delegating while preserving output, exit status, and validation strictness. Do not silently change Prime's stricter validator (`packages/prime-agent/scripts/skill-validation.ts`) - its name grammar (`^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`, length 1-64, no `--`), length caps (`NAME_MAX=64`, `DESCRIPTION_MAX=1024`), and quoted-scalar normalization remain distinct.

3. **CLI platform-ID single source.** Make `apps/maestria-cli/src/lib/validation.ts` derive `VALID_PLATFORMS` from the canonical `platforms` handler registry in `apps/maestria-cli/src/lib/platforms.ts`, preserving the existing normalized validation API, messages, ordering, and types, without introducing an import cycle or changing platform handler behavior. Add focused tests proving the validation list equals the handler IDs.

## Consequences

### Positive

- Pure mechanics have one implementation with one test suite - mode behavior is test-equivalent in OpenCode and Pi-family while the strictness surface stays in each adapter (lazy loading, disabled keywords, prompt file layout).
- Pi/OMP validator duplication is removed without changing their contract - the helper is a shared filesystem routine, not a shared policy.
- CLI valid-platform set is statically derivable - adding or removing a handler automatically updates validation; no ordering or message regression.
- No universal bundle is introduced - Node and Python runtimes, host SDKs, and marketplace manifests remain decoupled; install footprint stays per-host (oh-my-openagent pattern).
- Canonical source invariant is strengthened - generated projections remain derivations, not hand edits; `scripts/check-sync` continues to gate.

### Negative

- One more private workspace package to version and build (`@maestria/shared-mode`) - adds a workspace edge (`opencode -> shared-mode`, `shared-pi -> shared-mode`) that must stay acyclic and not import filesystem/host APIs.
- Pi and OMP validators now share a file under `packages/core/scripts/lib/` via the private `@maestria/core/skill-validator` export - a host-specific leniency change must be modeled as an option on the helper, not as a wrapper fork, or the helper's strictness would drift.
- CLI derivation adds an indirection: `validation.ts` must import handler ids without importing handler runtime effects - requires a pure id registry or careful barrel split to avoid a cycle (`validation.ts <-> platforms.ts`).

## Alternatives Considered

### Option A: Current multi-package (status quo)

Each host keeps its own mode logic and validators; CLI maintains a manual platform list. Rejected because the pure mode duplication is 1:1 and byte-identical, the Pi/OMP validator is byte-identical, and the CLI list already drifts in ordering. Long-tail drift is the failure mode, not immediate breakage.

### Option B: Shared core plus packages (Ponytail-leaning)

One shared `@maestria/core` runtime that all hosts import at runtime for every mechanic. Rejected as over-coupling: mode mechanics are pure but other shared concerns (state, compaction, subagent dispatch) are Pi-family specific; making every host depend on a single shared runtime would couple OpenCode's minimal hook to Pi's extension APIs and future Python needs. The hybrid keeps the shared layer to the verified pure subset.

### Option C: Universal single bundle

A single `@maestria/runtime` or `@maestria/sdk` that bundles canonical content, all adapters, and both runtimes. Rejected because it would conflate Node vs Python distributions, host marketplace manifests (`plugin.json`, `kime.plugin.json`, `plugin.yaml`, `package.json` files arrays), peer dependencies (`@opencode-ai/plugin`, `effect`), and install paths (`~/.pi`, `~/.omp`, `~/.codex`, `~/.cursor`, `~/.hermes`). It would also violate the explicit per-host footprint pattern demonstrated by oh-my-openagent.

### Option D: Pragmatic hybrid (chosen)

Private canonical core, explicit generated host projections, narrow private neutral shared modules for verified pure duplication, Pi-family shared code stays private, separate public host adapters, separate Hermes Python distribution, separate management CLI, no universal runtime package. Chosen because it removes the 1:1 duplication that exists today, isolates the verified pure subset without generalizing speculative sharing, preserves all public contracts, and matches the Ponytail (shared core plus thin per-host adapters with unified CLI) and oh-my-openagent (explicit per-host install, no universal footprint) patterns without copying a universal bundle.

## Assumptions

- Mode keyword set `fein, sonar, blitz` is stable per ADR-OC-003; adding a keyword would update the neutral module and both adapters, not diverge them. `[inferred]`
- Unclosed fenced code blocks are intentionally not excluded (accepted false-positive) per ADR-OC-003 and preserved. `[verified]` against current `CODE_BLOCK_RE` and ADR text.
- Hermes remains Python-only and is not a candidate for the Node shared layer. `[verified]` against `packages/hermes/pyproject.toml`.
- The `maestria` CLI remains the single management surface (ADR-CORE-007); platform handlers are not being unified into a universal runtime. `[verified]` against `apps/maestria-cli/src/lib/platforms.ts` registry.

## Implementation Notes

- `@maestria/shared-mode` is private (`"private": true`), not published, consumed as `workspace:*`. Exports are stable pure interfaces; prompts remain lazily loaded per host from `packages/core/agent-directives/commands/fein.md` etc. via `COMMANDS_DIR` or `commandsDir` argument.
- Host adapters remain thin: OpenCode keeps `MODE_PROMPTS` Proxy with `loadModePrompt` (filesystem) that calls `extractModeSection` from shared-mode; `detectMode` and `stripKeyword` delegate; Pi-family's `detectModeInText`, `buildModeText`, and prompt caching delegate to shared-mode's pure detection and extraction while preserving the `commandsDir` threading and session-state side effects in `installModeAutoDetect`/`installModeCommands`.
- Core script helper is under `packages/core/scripts/lib/` (preferred per task) to avoid a new top-level package for a build-time script, exposed as private `@maestria/core/skill-validator` (`"./skill-validator"` export only, `private: true`, no publishable root). Pi/OMP wrappers import via that subpath as `workspace:*` devDependencies (repo-only, no published runtime dependency) and preserve skill lists (`orchestrator, global-rules, handoff, iteration-limits`) and `✅`/`❌` output with correct exit codes; Prime's validator stays stricter and separate.
- CLI derivation: `validation.ts` must derive from handler ids without importing effectful handlers. The cleanest binding is a pure `platform-ids.ts` or re-export of the `id` literal union from `platforms.ts` that has no runtime import. If that requires a temporary duplication guard test (`expect(VALID_PLATFORMS).toEqual(platforms.map(p => p.id).sort(...))`), the test is explicit about drift prevention.

## Related Decisions

- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) - canonical directive/content core and sync pipeline; this ADR preserves and extends it with neutral shared modules.
- [ADR-CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md) - runtime support and adapter policy; Prime Agent isolation is preserved, no new runtime promotion is claimed.
- [ADR-OC-003](../opencode/ADR-OC-003-keyword-triggered-workflow-modes.md) - keyword-triggered workflow modes; unclosed-fence behavior and priority are preserved.
- [ADR-CORE-002](ADR-CORE-002-plugin-architecture.md) - pure plugin architecture; hybrid keeps per-host adapters thin.
- [ADR-CORE-007](ADR-CORE-007-cli-package-plugin-management.md) - CLI package/plugin management; derivation keeps the CLI registry single-sourced.

## References

- `packages/opencode/src/modes/index.ts` and `packages/shared/pi/src/modes-core.ts` - duplicated pure mode mechanics (see Decision).
- `packages/pi/scripts/validate-skills.ts` and `packages/omp/scripts/validate-skills.ts` - byte-identical validators.
- `apps/maestria-cli/src/lib/validation.ts` and `apps/maestria-cli/src/lib/platforms.ts` - platform ID drift surface.
- Ponytail hybrid distribution pattern (shared core plus thin per-host adapters with unified CLI).
- oh-my-openagent one-command per-host install pattern (no universal plugin footprint).

## Date

2026-08-27
