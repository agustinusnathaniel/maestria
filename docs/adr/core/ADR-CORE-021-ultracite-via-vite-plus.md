# ADR-CORE-021: Integrate Ultracite Through the Vite+ Root Configuration

## Status

Accepted (2026-08-31) - Strict preset enforced via the vite.config.ts hybrid.

## Context

Maestria is a pnpm monorepo whose root `vite.config.ts` is the authority for formatting, linting, type-aware checks, staged-file checks, and task execution, using Vite+ as its unified command runner with bundled Oxlint and Oxfmt versions. Ultracite offers maintained Oxlint and Oxfmt presets plus optional agent rules, skills, and hooks: its Oxlint setup uses `ultracite/oxlint/core` in an `extends` array and its Oxfmt setup spreads `ultracite/oxfmt`. The preset's Oxlint peer range exceeded the bundled Oxlint version, so adoption required aligning the toolchain first.

Vite+ documents the root `vite.config.ts` as the configuration location for `vp lint`, `vp fmt`, and `vp check`, and does not recommend standalone `oxlint.config.ts` or `.oxfmtrc.json` files. It also supports configuration composition through normal JavaScript imports.

Boundaries that must remain intact: the pre-commit hook runs `vp staged` with the root `staged` configuration; the root `vite.config.ts` holds the `vite-plus` Oxlint JS plugin, custom rules, type-aware linting, generated-file format exclusions, and the `check-sync` task; agent directives are authored only in `packages/core/agent-directives/` and projected through `scripts/sync-all` and `scripts/check-sync` (see [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md)); generated agent projections must not be overwritten by an external init command.

## Goals

Adopt Ultracite's maintained presets without a second command or configuration authority, preserving Vite+ scripts, task caching, type-aware and staged checks, custom rules, generated-file exclusions, and editor integration, within the [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) source and projection boundaries, incrementally and reversibly with no wholesale formatting or unrelated cleanup.

## Non-Goals

Replacing Vite+ with the `ultracite` CLI; migrating to Biome or ESLint; adding a second Git hook manager or staged-file runner; enabling optional Ultracite JS plugins or anti-slop rules without a compatibility and noise review; overwriting `AGENTS.md`, generated host projections, or canonical directives with `ultracite init` output.

## Decision

Controlled hybrid integration: Vite+ remains the command and lifecycle authority, while Ultracite supplies imported Oxlint and Oxfmt presets.

### 1. Align the toolchain before installing the preset

Upgrade the root catalog and dependency to a Vite+ release whose bundled Oxlint and Oxfmt satisfy Ultracite's peer ranges. Add Ultracite as a root development dependency through the workspace catalog. Keep any explicit `oxlint`/`oxfmt` peer entries pnpm requires aligned with Vite+'s bundled versions; do not use an override that creates a second toolchain.

### 2. Compose presets in `vite.config.ts`

Import `ultracite/oxlint/core` and `ultracite/oxfmt`, extend the `lint` block with the Ultracite core preset, and compose the `fmt` block from the Ultracite formatter preset. Preserve repository-specific settings after composition: `vite-plus` Oxlint JS plugin rules, `max-lines`/`max-lines-per-function`/`curly`, test-file overrides, type-aware and type-check settings, formatter options (semi, single quotes, package.json sorting, Markdown prose wrap), and existing generated-directory and changelog ignores merged with required Ultracite ignores.

Project-specific rules and overrides stay later, explicit layers so they keep winning. Strict preset is enforced: intentional style overrides remain, test-file exceptions come from a shared override module, and other preset rules have no deferred suppression layers; new lint failures are reviewed as individual compatibility findings.

The repository uses `overrides` rather than `extends` with a shared base because `overrides` keeps behavior centralized in the single root `vite.config.ts` authority (one file to audit, no extra resolution, and `vp` reads only the root config); `extends` would add a second config file and divergent resolution. See the Vite nested-config monorepo guidance at https://oxc.rs/docs/guide/usage/linter/nested-config.html#monorepo-pattern-share-a-base-config-with-extends.

### 3. Keep Vite+ as the only executable interface

Retain existing `package.json` scripts and call `vp check`, `vp lint`, `vp fmt`, and `vp staged` as before; do not add `ultracite check` or `ultracite fix` scripts, and do not commit standalone `oxlint.config.ts` or `oxfmt.config.ts`.

### 4. Treat AI integration as layered guidance

- Keep the hand-authored root `AGENTS.md`; add only concise repo-specific tooling guidance, never generated Ultracite text.
- Do not copy generic Ultracite rules into `packages/core/agent-directives/rules.md`: that cross-platform directive generates host projections, and Ultracite's repo-local rules have different ownership and scope.
- The reusable Ultracite skill may be installed by contributors as an external skill; it is not a checked-in projection unless a separate decision establishes provenance, update policy, and sync behavior.
- Do not enable Ultracite Git or post-edit hooks now: Vite+ staged hooks already run the authoritative config, and generated hook files can collide with host configuration. A future host hook may invoke `vp check --fix` after lifecycle and ownership review.

### 5. Validate the upgrade as a single toolchain change

Land the dependency upgrade, preset composition, and lockfile update as one reviewed change, running the full gates first (`pnpm install --frozen-lockfile`, `vp toolchain`, `pnpm fmt:check`, `pnpm lint`, `pnpm typecheck`, `pnpm check`, `pnpm check:ci`, `bash scripts/check-sync`). Validation must confirm `vp` loads the imported presets, projections have no unintended drift, and CI and staged commands keep their behavior.

## Consequences

Ultracite's maintained rule set is adopted without abandoning Vite+'s unified workflow: the root config stays the single source for commands, editor formatting, staged checks, and task execution, the Vite+ upgrade resolves the verified Oxlint peer mismatch without an unsafe override, and custom rules, type checking, sync tasks, and generated-file protections remain explicit and reviewable. The integration is reversible (a root dev dependency and preset composition, not a runtime or package-boundary change). Costs: the Vite+ upgrade needs full validation (bundled toolchain change; hard-coded global paths must stay absent or be updated separately); Ultracite's opt-out rules may surface an initial remediation queue; the local single-quote override over Ultracite's double-quoted default must remain explicit; no automatic post-edit fixing (contributors rely on the Vite+ hook and check commands).

## Alternatives Considered

- **Standalone Ultracite configuration files** (`oxlint.config.ts`, `oxfmt.config.ts`, Ultracite scripts alongside Vite+). Rejected: competing command paths, duplicate staged behavior, tool-dependent editor and hook behavior.
- **Import Ultracite presets into the existing Vite+ config without the version gate or AI ownership rules.** Viable as the mechanical basis of the chosen approach, but alone it defines neither the version gate nor AI content ownership.
- **Migrate completely to the Ultracite CLI.** Rejected: discards the Vite+ task graph, type-checking contract, JS plugin, and hooks in a larger, less reversible change with no demonstrated benefit.
- **Controlled hybrid integration (chosen).** The import approach after aligning Vite+ with Ultracite's peers, keeping Vite+ as the only executable interface and AI content within existing ownership boundaries: smallest blast radius, no configuration or directive drift.

## Assumptions

- `[verified]` The prior root Vite+ release bundled Oxlint/Oxfmt versions predating Ultracite's peer ranges (`vp toolchain`, installed metadata).
- `[verified]` Ultracite declares Oxlint and Oxfmt peer ranges (npm registry metadata), satisfied by the aligned Vite+ release's bundles (published metadata and release notes).
- `[verified]` Vite+ documents `vite.config.ts` as the source for `vp lint`, `vp fmt`, and `vp check` and recommends against standalone config files; the pre-commit path runs `vp staged` with the root `staged` configuration.
- `[verified]` Directives are canonical under `packages/core/agent-directives/`; projections are checked by `scripts/check-sync`.
- `[inferred]` Keep Vite+ as the developer workflow (root scripts, CI, editor, and hooks all use it); keep Ultracite's generic agent content repo-local or contributor-local (copying it into canonical directives would send repository-specific guidance to hosts on other toolchains); a Vite+ upgrade is acceptable if the listed validation passes.

## Rollback

Revert the root catalog and dependency changes, restore the previous lockfile, remove the Ultracite imports from `vite.config.ts`, and remove any optional repo-local AI guidance. Do not restore standalone Ultracite configs or generated agent projections.

## Related Decisions

- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) - canonical agent directives and generated host projections.
- [ADR-CORE-009](ADR-CORE-009-ci-quality-gates.md) - repository quality gates.
- [ADR-CORE-016](ADR-CORE-016-root-resolved-sync-tooling.md) - deterministic root-resolved tooling.
- [ADR-CORE-020](ADR-CORE-020-hybrid-package-topology.md) - explicit boundaries and pragmatic hybrid topology.

## Appendix A: Contributor-local AI rules, skills, and hooks

Why AI rules, skills, and hooks were left out; Section 4 defines the policy, and this appendix adds contributor-local opt-in instructions without committing generated files. Do not run `ultracite init --agents` here (it would overwrite the hand-authored root `AGENTS.md` or create generated agent files colliding with the canonical directives and `scripts/sync-all` pipeline); generate tool-specific rules locally and exclude them via `.git/info/exclude`. Do not copy the reusable skill into a checked-in skill directory unless a separate ADR defines provenance, update policy, and sync behavior; install only the skill with `npx skills add haydenbleasel/ultracite`. Do not enable Ultracite Git or post-edit hooks in the committed repository (redundant with `vp staged` and `formatOnSave` via `oxc.oxc-vscode` reading `vite.config.ts`); for a local post-edit hook, configure the host manually to invoke `vp check --fix`, not `ultracite fix`, keeping it unstaged.

## References

- [Ultracite setup](https://www.ultracite.ai/docs/setup)
- [Ultracite configuration](https://www.ultracite.ai/docs/configuration)
- [Ultracite Oxlint provider](https://www.ultracite.ai/docs/provider/oxlint)
- [Ultracite monorepos](https://www.ultracite.ai/docs/monorepos)
- [Ultracite agent rules](https://www.ultracite.ai/docs/ai/rules)
- [Ultracite agent skills](https://www.ultracite.ai/docs/ai/skills)
- [Ultracite agent hooks](https://www.ultracite.ai/docs/ai/hooks)
- [Ultracite Git hooks](https://www.ultracite.ai/docs/git-hooks)
- [Vite+ lint guide](https://viteplus.dev/guide/lint)
- [Vite+ format guide](https://viteplus.dev/guide/fmt)
- [Vite+ check guide](https://viteplus.dev/guide/check)
- [Vite+ commit hooks guide](https://viteplus.dev/guide/commit-hooks)
- [Vite+ monorepo guide](https://viteplus.dev/guide/monorepo)
- [Vite+ release notes](https://github.com/voidzero-dev/vite-plus/releases/tag/v0.3.0)

## Date

2026-08-31
