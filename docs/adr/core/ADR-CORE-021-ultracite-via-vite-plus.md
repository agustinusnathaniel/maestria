# ADR-CORE-021: Integrate Ultracite Through the Vite+ Root Configuration

## Status

Accepted (2026-08-31) - Strict preset enforced via the vite.config.ts hybrid.

## Context

Maestria is a pnpm monorepo whose root `vite.config.ts` is the authority for formatting, linting, type-aware checks, staged-file checks, and task execution. It uses Vite+ as its unified command runner and its bundled Oxlint and Oxfmt versions. Ultracite offers maintained Oxlint and Oxfmt presets plus optional agent rules, skills, and hooks: its Oxlint setup uses `ultracite/oxlint/core` in an `extends` array and its Oxfmt setup spreads `ultracite/oxfmt`. The preset's Oxlint peer range exceeded the bundled Oxlint version, so adoption required aligning the toolchain first.

Vite+ documents the root `vite.config.ts` as the configuration location for `vp lint`, `vp fmt`, and `vp check`, and does not recommend standalone `oxlint.config.ts` or `.oxfmtrc.json` files. It also supports configuration composition through normal JavaScript imports.

Boundaries that must remain intact:

- The pre-commit hook runs `vp staged` with the root `staged` configuration.
- The root `vite.config.ts` holds the `vite-plus` Oxlint JS plugin, custom rules, type-aware linting, generated-file format exclusions, and the `check-sync` task.
- Agent directives are authored only in `packages/core/agent-directives/` and projected through `scripts/sync-all` and `scripts/check-sync`.
- Generated agent projections must not be overwritten by an external init command.

## Goals

- Adopt Ultracite's maintained Oxlint/Oxfmt presets without creating a second command or configuration authority.
- Preserve Vite+ scripts, task caching, type-aware and staged checks, custom rules, generated-file exclusions, and editor integration.
- Keep the agent-directive source and projection boundaries defined by [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md).
- Make adoption incremental and reversible, with no wholesale formatting or unrelated cleanup.

## Non-Goals

- Replacing Vite+ with the `ultracite` CLI.
- Migrating to Biome or ESLint.
- Adding a second Git hook manager or staged-file runner.
- Enabling optional Ultracite JS plugins or anti-slop rules without a compatibility and noise review.
- Overwriting `AGENTS.md`, generated host projections, or canonical directives with output from `ultracite init`.

## Decision

Adopt a controlled hybrid integration: Vite+ remains the command and lifecycle authority, while Ultracite supplies imported Oxlint and Oxfmt presets.

### 1. Align the toolchain before installing the preset

Upgrade the root catalog and dependency to a Vite+ release whose bundled Oxlint and Oxfmt satisfy Ultracite's peer ranges (check later releases against their bundled versions and notes). Add Ultracite as a root development dependency through the workspace catalog. Keep any explicit `oxlint`/`oxfmt` peer entries pnpm requires aligned with Vite+'s bundled versions; do not use an override that creates a second toolchain.

### 2. Compose presets in `vite.config.ts`

Import `ultracite/oxlint/core` and `ultracite/oxfmt`, extend the `lint` block with the Ultracite core preset, and compose the `fmt` block from the Ultracite formatter preset. Preserve repository-specific settings after composition: `vite-plus` Oxlint JS plugin rules, `max-lines`/`max-lines-per-function`/`curly`, test-file overrides, type-aware and type-check settings, formatter options (semi, single quotes, package.json sorting, Markdown prose wrap), and existing generated-directory and changelog ignores merged with required Ultracite ignores.

Project-specific rules and overrides stay later, explicit layers so they keep winning. Strict preset is enforced: intentional style overrides remain, test-file exceptions come from a shared override module, and other preset rules have no deferred suppression layers; new lint failures are reviewed as individual compatibility findings.

The repository uses `overrides` rather than `extends` with a shared base because `overrides` keeps behavior centralized in the single root `vite.config.ts` authority (one file to audit, no extra resolution, and `vp` reads only the root config); `extends` would add a second config file and divergent resolution. See the Vite nested-config monorepo guidance at https://oxc.rs/docs/guide/usage/linter/nested-config.html#monorepo-pattern-share-a-base-config-with-extends.

### 3. Keep Vite+ as the only executable interface

Retain existing `package.json` scripts and call `vp check`, `vp lint`, `vp fmt`, and `vp staged` as before; do not add `ultracite check` or `ultracite fix` scripts. Ultracite supplies presets and guidance, not a competing runner.

Do not commit standalone `oxlint.config.ts` or `oxfmt.config.ts`; this follows Vite+'s configuration model and keeps the commands, editor, and hooks on one configuration.

### 4. Treat AI integration as layered guidance

- Keep the hand-authored root `AGENTS.md`; add only concise repo-specific tooling guidance, never generated Ultracite text.
- Do not copy generic Ultracite rules into `packages/core/agent-directives/rules.md`: that cross-platform directive generates host projections, and Ultracite's repo-local rules have different ownership and scope.
- The reusable Ultracite skill may be installed by contributors as an external skill; it is not a checked-in projection unless a separate decision establishes provenance, update policy, and sync behavior.
- Do not enable Ultracite Git or post-edit hooks now: Vite+ staged hooks already run the authoritative config, and generated hook files can collide with host configuration. A future host hook may invoke `vp check --fix` after lifecycle and ownership review.

### 5. Validate the upgrade as a single toolchain change

Land the dependency upgrade, preset composition, and lockfile update as one reviewed change, running the full gates first:

```bash
pnpm install --frozen-lockfile
vp toolchain
pnpm fmt:check
pnpm lint
pnpm typecheck
pnpm check
pnpm check:ci
bash scripts/check-sync
```

Validation must confirm `vp` loads the imported presets, projections have no unintended drift, and CI and staged commands keep their behavior.

## Consequences

### Positive

- Ultracite's maintained rule set is adopted without abandoning Vite+'s unified workflow.
- The root config remains the single source for commands, editor formatting, staged checks, and task execution.
- The Vite+ upgrade resolves the verified Oxlint peer mismatch without an unsafe package override.
- Custom rules, type checking, sync tasks, and generated-file protections remain explicit and reviewable.
- The integration is reversible: a root dev dependency and preset composition, not a runtime or package-boundary change.

### Negative

- The Vite+ upgrade changes the bundled toolchain and needs full validation; it also changes the default global install layout, so hard-coded global paths must stay absent or be updated separately.
- Ultracite's opt-out rules may surface new findings and an initial remediation queue.
- Ultracite's default Oxfmt style is double-quoted while this repository uses single quotes; the local override must remain explicit.
- No automatic Ultracite post-edit fixing; contributors rely on the Vite+ hook and check commands.

## Alternatives Considered

### Option A: Add standalone Ultracite configuration files

Run `ultracite init --linter oxlint` and commit `oxlint.config.ts`, `oxfmt.config.ts`, and Ultracite scripts alongside Vite+.

Rejected: Vite+ recommends its root config over standalone files, which would create competing command paths, duplicate staged behavior, and tool-dependent editor and hook behavior.

### Option B: Import Ultracite presets into the existing Vite+ config

Use the documented preset modules directly in `vite.config.ts` while keeping Vite+ commands and repository rules.

Viable and the mechanical basis of the chosen approach, but alone it defines neither the version gate nor AI content ownership.

### Option C: Migrate completely to the Ultracite CLI

Replace Vite+ lint/format scripts, staged configuration, and editor authority with Ultracite's generated setup.

Rejected: it discards the Vite+ task graph, type-checking contract, JS plugin, and hooks in a larger, less reversible change with no demonstrated benefit.

### Option D: Controlled hybrid integration (chosen)

Use Option B after aligning Vite+ with Ultracite's peers, keep Vite+ as the only executable interface, and handle AI content within existing ownership boundaries.

Chosen for the smallest blast radius and to avoid configuration and directive drift.

## Assumptions

- `[verified]` The prior root Vite+ release bundled Oxlint/Oxfmt versions predating Ultracite's peer ranges (`vp toolchain`, installed metadata).
- `[verified]` Ultracite declares Oxlint and Oxfmt peer ranges (npm registry metadata).
- `[verified]` The aligned Vite+ release's bundles satisfy those peers (published metadata and release notes).
- `[verified]` Vite+ documents `vite.config.ts` as the source for `vp lint`, `vp fmt`, and `vp check` and recommends against standalone config files.
- `[verified]` The pre-commit path runs `vp staged` with the root `staged` configuration.
- `[verified]` Directives are canonical under `packages/core/agent-directives/`; projections are checked by `scripts/check-sync`.
- `[inferred]` Keep Vite+ as the developer workflow: root scripts, CI, editor, and hooks all use it, and replacing it is outside the integration need.
- `[inferred]` Keep Ultracite's generic agent content repo-local or contributor-local; copying it into canonical directives would send repository-specific guidance to hosts on other toolchains.
- `[inferred]` A Vite+ upgrade is acceptable if the listed validation passes; the global install-layout change is not a repository migration requirement.

## Rollback

Revert the root catalog and dependency changes, restore the previous lockfile, remove the Ultracite imports from `vite.config.ts`, and remove any optional repo-local AI guidance. Do not restore standalone Ultracite configs or generated agent projections.

## Related Decisions

- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) - canonical agent directives and generated host projections.
- [ADR-CORE-009](ADR-CORE-009-ci-quality-gates.md) - repository quality gates.
- [ADR-CORE-016](ADR-CORE-016-root-resolved-sync-tooling.md) - deterministic root-resolved tooling.
- [ADR-CORE-020](ADR-CORE-020-hybrid-package-topology.md) - explicit boundaries and pragmatic hybrid topology.

## Appendix A: Contributor-local AI rules, skills, and hooks

This appendix records why AI rules, skills, and hooks were left out; Section 4 defines the policy, and this appendix adds contributor-local opt-in instructions without committing generated files.

### Rules

Do not run `ultracite init --agents` (including `--agents universal`) here: it would overwrite the hand-authored root `AGENTS.md` or create generated agent files (`.cursor/rules/`, `.claude/settings.json`, `.agents/`) that collide with the canonical directives and the `scripts/sync-all` pipeline (ADR-CORE-005). The root `AGENTS.md` Tooling section is the only committed repo-specific AI guidance; generic Ultracite rules stay uncommitted. Generate tool-specific rules locally and exclude them via `.git/info/exclude` instead of committing.

### Skills

Ultracite's reusable skill is contributor-local by design; do not copy it into a checked-in skill directory (`.agents/skills/`, `packages/*/skills/`, or similar) unless a separate ADR defines provenance, update policy, and sync behavior. Do not run `ultracite init` here: full setup creates `oxlint.config.ts` and other files conflicting with the Vite+ single-authority model (see Decision section 3). Install only the skill with:

```bash
npx skills add haydenbleasel/ultracite
```

The skill is portable and defers formatting to this repository's `vite.config.ts` presets; no code or config change is required here.

### Hooks

Do not enable Ultracite Git hooks (`--integrations husky,lefthook,lint-staged,pre-commit`) or agent post-edit hooks (`--hooks claude,codex,cursor,copilot,windsurf,codebuddy`) in the committed repository: Maestria already runs `vp staged` in its pre-commit hook and editor `formatOnSave` via `oxc.oxc-vscode` reading `vite.config.ts`, so a second staged runner or post-edit `ultracite fix` hook would be redundant and could diverge. Do not run `ultracite init --hooks` here; full setup can overwrite config. For a local post-edit hook, configure the host manually, or run setup outside the repository and copy only the hook file, for example:

```bash
# Example Claude Code host hook (manual config) - runs repo formatter, not ultracite fix
vp check --fix
```

Run `ultracite init --hooks <host>` in an empty temporary directory outside the repo, copy the generated hook file into the local checkout, verify it is not staged before committing, and confirm it invokes `vp check --fix`, not `ultracite fix`. Prefer `vp check --fix` and pre-commit `vp staged` for authoritative formatting.

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
