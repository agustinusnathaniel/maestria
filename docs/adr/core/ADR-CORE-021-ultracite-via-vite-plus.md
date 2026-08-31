# ADR-CORE-021: Integrate Ultracite Through the Vite+ Root Configuration

## Status

Accepted (2026-08-31) - Strict preset enforced via the vite.config.ts hybrid.

## Context

Maestria is a pnpm monorepo whose root `vite.config.ts` is the authority for formatting, linting, type-aware checks, staged-file checks, and task execution. The repository already uses Vite+ as its unified command runner and currently uses the Vite+ bundled Oxlint and Oxfmt versions:

| Component   | Current version | Relevant constraint                                    |
| ----------- | --------------- | ------------------------------------------------------ |
| `vite-plus` | `0.2.9`         | Bundles Oxlint `1.77.0` and Oxfmt `0.62.0`             |
| Ultracite   | Not installed   | `7.10.7` peers on Oxlint `^1.79.0` and Oxfmt `>=0.1.0` |

Ultracite provides useful Oxlint and Oxfmt presets, plus optional agent rules, skills, and hooks. Its documented Oxlint setup uses `ultracite/oxlint/core` in an `extends` array, and its Oxfmt setup spreads `ultracite/oxfmt`.

Vite+ documents the root `vite.config.ts` as the configuration location for `vp lint`, `vp fmt`, and `vp check`, and explicitly does not recommend standalone `oxlint.config.ts` or `.oxfmtrc.json` files. Vite+ also supports composing configuration through normal JavaScript imports.

The repository has additional boundaries that must remain intact:

- `.vite-hooks/pre-commit` runs `vp staged`, which already uses the root `staged` configuration.
- The root `vite.config.ts` contains the `vite-plus` Oxlint JS plugin, custom rules, type-aware linting, generated-file format exclusions, and the `check-sync` task.
- Agent directives are authored only in `packages/core/agent-directives/` and projected through `scripts/sync-all` and `scripts/check-sync`.
- Generated agent projections must not be overwritten by an external init command.

## Goals

- Adopt Ultracite's maintained Oxlint/Oxfmt presets without creating a second command or configuration authority.
- Preserve Vite+ scripts, task caching, type-aware checks, staged checks, custom rules, generated-file exclusions, and editor integration.
- Keep the agent-directive source and projection boundaries defined by [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md).
- Make adoption incremental and reversible, with no wholesale formatting or unrelated cleanup in the integration change.

## Non-Goals

- Replacing Vite+ with the `ultracite` CLI.
- Migrating to Biome or ESLint.
- Adding a second Git hook manager or a second staged-file runner.
- Enabling optional Ultracite JS plugins or anti-slop rules without a separate compatibility and noise review.
- Overwriting `AGENTS.md`, generated host projections, or canonical directives with output from `ultracite init`.

## Decision

Adopt a controlled hybrid integration: Vite+ remains the command and lifecycle authority, while Ultracite supplies imported Oxlint and Oxfmt presets.

### 1. Align the toolchain before installing the preset

Upgrade the root catalog and dependency from `vite-plus@0.2.9` to `vite-plus@0.3.0`, or to a later release only after checking its bundled versions and release notes. Vite+ `0.3.0` bundles Oxlint `1.79.0` and Oxfmt `0.64.0`, which satisfies Ultracite `7.10.7`'s peer requirements.

Add `ultracite@7.10.7` as a root development dependency through the workspace catalog. Keep any explicit `oxlint` or `oxfmt` peer entries, if pnpm requires them for the installed preset, exactly aligned with Vite+'s bundled versions. Do not use an override that creates a second or divergent toolchain.

### 2. Compose presets in `vite.config.ts`

Import `ultracite/oxlint/core` and `ultracite/oxfmt` from the root config. Extend the existing `lint` block with the Ultracite core preset and compose the existing `fmt` block from the Ultracite formatter preset. Preserve the repository-specific settings after composition:

- `vite-plus/oxlint-plugin` and `vite-plus/prefer-vite-plus-imports`.
- `max-lines`, `max-lines-per-function`, and `curly`.
- Test-file rule overrides.
- `typeAware: true` and `typeCheck: true`.
- `semi: true`, `singleQuote: true`, `sortPackageJson: true`, and the existing Markdown `proseWrap: 'never'` overrides.
- Existing generated-directory and changelog ignore patterns, merged with any required Ultracite ignore patterns rather than replaced.

Project-specific rules and overrides remain later, explicit layers so they continue to win over the shared preset. Strict preset is now enforced: intentional style overrides (singleQuote, trailingComma, printWidth 100, sortImports false) remain, and test-file exceptions are composed from `tooling/lint/test-overrides.ts`. Other preset rules are enforced without deferred suppression layers; new lint failures are reviewed as individual compatibility findings.

For monorepo sharing alternatives, see https://oxc.rs/docs/guide/usage/linter/nested-config.html#monorepo-pattern-share-a-base-config-with-extends - the repository uses `overrides` composition rather than `extends` with a shared base file because `overrides` keeps all behavior centralized in the single root `vite.config.ts` authority (single file to audit, no extra `extends` resolution, and VitePlus's `vp` commands read only the root config). Using `extends` would introduce a second config file and divergent resolution; `overrides` preserves the single-authority model documented in VitePlus.

### 3. Keep Vite+ as the only executable interface

Retain the existing `package.json` scripts and call `vp check`, `vp lint`, `vp fmt`, and `vp staged` as before. Do not add `ultracite check` or `ultracite fix` scripts. The Ultracite package is used for presets and guidance, not as a competing runner.

Do not create committed standalone `oxlint.config.ts` or `oxfmt.config.ts` files. This follows Vite+'s documented configuration model and prevents the commands, editor, and hooks from reading different configurations.

### 4. Treat AI integration as layered guidance

- Keep the hand-authored root `AGENTS.md` as the maestria-specific instruction file. Add only concise, repo-specific tooling guidance if needed; do not replace it with generated Ultracite text.
- Do not copy generic Ultracite rules into `packages/core/agent-directives/rules.md`. That file is a cross-platform product directive and its changes generate host projections. Ultracite's repo-local rules and Maestria's shipped agent methodology have different ownership and scope.
- The reusable Ultracite skill may be installed by individual contributors as an external skill. It is not a checked-in generated projection unless a separate decision establishes its provenance, update policy, and sync behavior.
- Do not enable Ultracite's Git or post-edit hooks during this integration. Existing Vite+ staged hooks already run the authoritative root config, and Ultracite's generated agent hook files can collide with existing host configuration. A future host-specific hook can invoke `vp check --fix` only after its lifecycle and ownership have been reviewed.

### 5. Validate the upgrade as a single toolchain change

The dependency upgrade, preset composition, and lockfile update should land as one reviewed change. Run the full repository gates before accepting the ADR:

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

The validation must confirm that `vp` loads the imported presets, generated agent projections have no unintended drift, and the existing CI and staged commands retain their behavior.

## Consequences

### Positive

- Ultracite's maintained Oxlint/Oxfmt rule set is adopted without abandoning Vite+'s unified workflow.
- The root config remains the single source for commands, editor formatting, staged checks, and task execution.
- The Vite+ version upgrade resolves the verified Ultracite Oxlint peer mismatch instead of relying on an unsafe package override.
- Existing custom rules, type checking, sync tasks, and generated-file protections remain explicit and reviewable.
- The integration is reversible because Ultracite is a root dev dependency and preset composition, not a runtime or package-boundary change.

### Negative

- Upgrading Vite+ from `0.2.9` to `0.3.0` changes the bundled Vite+ toolchain and requires a full repository validation. The release also changes the default global Vite+ install layout, so hard-coded global paths must remain absent or be updated separately.
- Ultracite's opt-out rules may expose new findings and create an initial remediation queue.
- Ultracite's default Oxfmt style uses double quotes, while this repository intentionally uses single quotes. The local override must remain explicit.
- The repository does not get automatic Ultracite post-edit fixing; contributors rely on the existing Vite+ hook and check commands.

## Alternatives Considered

### Option A: Add standalone Ultracite configuration files

Run `ultracite init --linter oxlint` and commit `oxlint.config.ts`, `oxfmt.config.ts`, and Ultracite scripts alongside Vite+.

Rejected because Vite+ explicitly recommends its root config instead of standalone Oxlint/Oxfmt configs. It would create competing command paths, duplicate staged behavior, and make editor or hook behavior dependent on which tool was invoked.

### Option B: Import Ultracite presets into the existing Vite+ config

Use the documented preset modules directly in `vite.config.ts`, while keeping Vite+ commands and the existing repository-specific rules.

Viable and forms the mechanical basis of the chosen approach. On its own, however, it does not define the required version gate or the ownership policy for AI rules, skills, and hooks.

### Option C: Migrate completely to the Ultracite CLI

Replace Vite+ lint/format scripts, staged configuration, and editor authority with Ultracite's generated configuration and scripts.

Rejected because it discards the repository's existing Vite+ task graph, type-checking contract, `vite-plus` JS plugin, and hook setup. It would be a larger, less reversible change with no demonstrated benefit for this monorepo.

### Option D: Controlled hybrid integration (chosen)

Use Option B after aligning Vite+ with Ultracite's peer requirements, retain Vite+ as the only executable interface, and handle AI rules, skills, and hooks according to the existing Maestria ownership boundaries.

Chosen because it achieves the requested preset adoption with the smallest blast radius, preserves the current workflow, and avoids configuration and directive drift.

## Assumptions

- `[verified]` The root workspace currently pins `vite-plus` to `0.2.9`, whose local package bundles Oxlint `1.77.0` and Oxfmt `0.62.0`, confirmed with `vp toolchain` and the installed package metadata.
- `[verified]` Ultracite `7.10.7` declares Oxlint `^1.79.0` and Oxfmt `>=0.1.0` as peer dependencies, confirmed with npm registry metadata.
- `[verified]` Vite+ `0.3.0` bundles Oxlint `1.79.0` and Oxfmt `0.64.0`, confirmed by its published package metadata and release notes.
- `[verified]` Vite+ documents `vite.config.ts` as the configuration source for `vp lint`, `vp fmt`, and `vp check`, and recommends against standalone Oxlint/Oxfmt config files.
- `[verified]` The existing pre-commit path is `.vite-hooks/pre-commit` running `vp staged`, and the staged command is configured in the root `vite.config.ts`.
- `[verified]` Agent directive content is canonical under `packages/core/agent-directives/` and generated projections are checked by `scripts/check-sync`.
- `[inferred]` The repository should preserve Vite+ as its developer-facing workflow because all root scripts, CI checks, editor settings, and hooks currently use it; replacing that workflow is outside the stated integration need.
- `[inferred]` Ultracite's generic agent content should remain repo-local or contributor-local because copying it into the canonical cross-platform directives would distribute maestria-specific tooling guidance to hosts that may not use this repository's toolchain.
- `[inferred]` A Vite+ `0.3.0` local upgrade is acceptable if the listed full validation passes; the release's global install-layout change is not itself a repository migration requirement.

## Rollback

Revert the root catalog and dependency changes, restore the previous lockfile, remove the Ultracite imports from `vite.config.ts`, and remove any optional repo-local AI guidance added by the implementation. Do not restore standalone Ultracite configs or generated agent projections.

## Related Decisions

- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) - canonical agent directives and generated host projections.
- [ADR-CORE-009](ADR-CORE-009-ci-quality-gates.md) - repository quality gates.
- [ADR-CORE-016](ADR-CORE-016-root-resolved-sync-tooling.md) - deterministic root-resolved tooling.
- [ADR-CORE-020](ADR-CORE-020-hybrid-package-topology.md) - explicit boundaries and pragmatic hybrid topology.

## Appendix A: Contributor-local AI rules, skills, and hooks

This appendix records the deliberate non-integration for AI rules, skills, and hooks. Section 4 defines the policy, this appendix gives contributor-local opt-in instructions without committing generated files.

### Rules

Do not run `ultracite init --agents` (including `--agents universal`) in this repository. That command would overwrite the hand-authored root `AGENTS.md` or create `.cursor/rules/`, `.claude/settings.json`, `.agents/` content, and other generated agent files. Those files would collide with the canonical directives in `packages/core/agent-directives/` and the `scripts/sync-all` pipeline defined in ADR-CORE-005. The root `AGENTS.md` Tooling section is the only repo-specific AI guidance that is committed; generic Ultracite rules remain uncommitted. Contributors who want repo-local rules for a specific tool should generate them locally and add the path to `.git/info/exclude` rather than committing.

### Skills

Ultracite ships a reusable skill at `node_modules/ultracite/skills/ultracite/SKILL.md`. The skill is contributor-local by design - do not copy it into `.agents/skills/`, `packages/*/skills/`, or any checked-in skill directory unless a separate ADR defines provenance, update policy, and sync behavior. Do not run `ultracite init` inside this repository - that command performs full setup including creating `oxlint.config.ts` and other files that conflict with the Vite+ single-authority model (see Decision section 3). To install only the skill without touching repo config, use the standalone skill installer:

```bash
npx skills add haydenbleasel/ultracite
```

The skill is portable across repos and leaves formatting decisions to the repository's own `vite.config.ts` (Ultracite Oxlint/Oxfmt presets). No code or config change is required in maestria to use the skill.

### Hooks

Do not enable Ultracite Git hooks (`--integrations husky,lefthook,lint-staged,pre-commit`) or agent post-edit hooks (`--hooks claude,codex,cursor,copilot,windsurf,codebuddy`) in the committed repository. Maestria already runs `vp staged` via `.vite-hooks/pre-commit` and editor `formatOnSave` via `oxc.oxc-vscode` reading `vite.config.ts`. Adding a second staged runner or a post-edit `ultracite fix` hook would be redundant and could create divergent formatting. Do not run `ultracite init --hooks` inside this repository - that command also performs full setup and can overwrite config. Contributors who want a local post-edit hook should configure their host manually or run setup outside the repository and copy only the hook file. For example, add a host post-edit hook that invokes the authoritative repository formatter:

```bash
# Example Claude Code host hook (manual config) - runs repo formatter, not ultracite fix
vp check --fix
```

Alternatively, run `ultracite init --hooks <host>` in an empty temporary directory outside the repo and copy only the generated hook file (for example, `.claude/settings.json` or `.cursor/hooks.json`) into your local checkout. Verify the hook file is not staged before committing and that it invokes `vp check --fix` rather than `ultracite fix`. Prefer the existing workflow `vp check --fix` and pre-commit `vp staged` for authoritative formatting.

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
- [Vite+ `0.3.0` release notes](https://github.com/voidzero-dev/vite-plus/releases/tag/v0.3.0)

## Date

2026-08-31
