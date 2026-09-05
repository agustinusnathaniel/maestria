# ADR-CORE-023: DeepSeek Harness Projection and Native Plugin

## Status

Accepted (2026-09-06)

## Context

DeepSeek Harness (DSH) is DeepSeek's open-source agent harness, currently in developer preview and built on the vendored Cordis plugin framework. Its design maps closely onto Maestria's model: models, tools, skills, sessions, sandboxes, and prompt assembly are all plugins; a named-provider subagent registry supports child-agent delegation with per-child personas and tool filters; the system prompt is assembled from ordered plugin-contributed sections and variables; per-session agent presets compose whole tool/persona/skill sets from `agent.cordis.yml` files.

Maestria already projects its canonical directives onto ten surfaces (ADR-CORE-005 sync pipeline, ADR-CORE-020 hybrid topology). DSH offers a strictly richer native surface than the advisory skills-only projections (codex, agent-plugin): real delegation with personas (`dsh-tool-subagent` config: `provider`, `toolName`, `persona`, `toolFilter`, `maxDepth`), prompt-section ownership (`ctx.systemPrompt.section`/`variable`), and a skills registry with provider registration (`ctx.skills.registerProvider`).

The `effect` catalog entry is `4.0.0-rc.111` and ADR-CORE-017 confines Effect to boundaries with concrete cancellation/concurrency problems.

Evidence reviewed 2026-09-06: DSH landing page; `docs/subsystems/{skills,subagent,commands,system-prompt,agent-team}.md`; `packages/preset/agent-presets` README and shipped `standard` preset; `docs/config-catalog.md` and `docs/tool-catalog.md`; the published `@deepseek-ai/cordis@4.0.2`, `@deepseek-ai/dsh-skill@0.0.1-rc.1`, and `@deepseek-ai/dsh-system-prompt@0.0.1-rc.1` type packages. Details are recorded in `docs/runtime-support-matrix.md`.

## Goals

- One canonical source: DSH artifacts derive from `packages/core/agent-directives/` through the standard sync pipeline.
- Native delegation: specialists reachable as named subagent tools with their canonical prompts as personas, not only as advisory skills.
- Self-contained installation: the staged preset must work without npm resolvability at harness runtime.
- Follow ADR-CORE-014 (support levels) and ADR-CORE-017 (Effect placement) instead of inventing new policy.

## Non-Goals

- No `sync-plugin-versions` target: the DSH preset has no versioned manifest file (`preset.yml` carries display metadata only); `package.json` remains the sole version source.
- No shipped `toolFilter` defaults: denied tool names depend on the host composition (bash vs pwsh, fs editors) and unknown names fail `dsh-tool-subagent` startup; enforcement stays documented, not configured.
- No use of DSH's human-command registry for workflow modes: commands execute against an agent without sending to the model, so `fein`/`sonar`/`blitz` remain Agent Skills, matching the codex projection.
- No Agent Teams usage: `ctx.agentTeams` is experimental and its lead/teammate DAG is a different topology than the orchestrator/specialist pipeline.
- No Effect inside the Cordis plugin: `apply()` is synchronous registration over host DI; per ADR-CORE-017 there is no Effect-shaped problem at this boundary. Effect v4 RC is used where the repo already uses it — the CLI `PlatformHandler`.

## Decision

Add `@maestria/deepseek` as a first-class public package with three layers:

1. **Generated skills** — `sync.config.ts` derives the standard 14 `skills/<name>/SKILL.md` set (Agent-Skills frontmatter `name`/`description`), with advisory read-only notes on `adventurer`/`planner`/`reviewer` and a DeepSeek Harness integration append on `orchestrator`, following the codex projection's degradation pattern.
2. **Cordis plugin** (`src/`, built to `dist/`) — a function plugin exporting `name: 'maestria'`, `inject: ['systemPrompt', 'skills']`, and `apply(ctx, config)`:
   - `maestria:routing` prompt section (order 160) with the compact direct/focused/full routing text; `maestria:global-rules` section (order 150) when `injectGlobalRules` is set;
   - named variables `maestria_<role>` (orchestrator + 7 specialists) carrying the generated skill bodies, consumed by the preset's delegation tools as `persona: '{{maestria_<role>}}'` — canonical content stays single-sourced in the generated skills and never duplicated into YAML;
   - a `ctx.skills` provider (name `maestria`, rank 550 — below every user-editable filesystem root, above bundled) listing and loading the generated skill tree. The plugin imports host packages as types only (`@deepseek-ai/cordis`, `@deepseek-ai/dsh-system-prompt`, `@deepseek-ai/dsh-skill`) and has zero runtime dependencies; it loads all skill bodies synchronously at mount so a damaged tree fails composition loudly, per DSH's broken-plugin rule.
3. **Agent preset** (`preset/maestria/`) — derived from DSH's shipped `standard` preset (BSD-3-Clause, attribution preserved in the file header) with the Maestria persona (`{{maestria_orchestrator}}`), the plugin row, and seven one-shot `maestria_<role>` delegation tools (`provider: spawn`, `maxDepth: 2`) in the delegation group alongside the generic `subagent` tools.

Registration follows the standard recipe: the `sync.config.ts` is auto-discovered by `scripts/sync-all`/`scripts/check-sync`; `deepseek` is added to `PLATFORM_IDS`, the handler registry, and the derived `VALID_PLATFORMS` in the CLI; docs update (root `AGENTS.md`, root `README.md`, runtime support matrix). No `vite.config.ts` root changes are needed: the `packages/**/skills/**` output globs already cover the projection.

CLI handler (`deepseek`): `detect` via the `dsh` binary or a staged preset; `install`/`update` pack the npm tarball into the Maestria cache, then copy `preset/maestria` plus `dist` (as `plugin/`) into `$DSH_HOME/.agent-presets/maestria` (default `~/.dsh`), keeping the preset self-contained via the relative `./plugin/index.js` row; `uninstall` removes the staged preset directory. The handler is written in Effect per the existing `PlatformHandler` contract.

## Consequences

### Positive

- DSH becomes the first projection with native persona-carrying subagent delegation plus prompt-section ownership, while keeping the advisory skills layer usable without any plugin.
- Canonical single-sourcing is preserved end to end: prompts, personas, and skills all read from the generated tree; the only hand-authored DSH prose is the routing section and integration appends.
- The staged preset is self-contained (`./plugin/index.js`), so installation does not depend on npm module resolution inside the harness.

### Negative

- Developer-preview churn: the RC `@deepseek-ai/*` type packages and the preset composition format can move; the projection pins RC devDependencies and must be reverified per `dsh` release.
- The relative-path resolution base for preset composition rows is inferred from DSH's preset health-check description ("a file that exists"), not verified against a live loader; the npm-resolvable row name is the documented fallback.
- Seven delegation tools add fixed schema cost per request when the preset is active — the same trade-off other subagent-based projections accept.
- One more published package and one more CLI handler to version and maintain.

## Alternatives Considered

- **Skills-only projection (Tier 1 alone).** Rejected as the end state: DSH exposes the primitives maestria's orchestrator needs (personas, delegation, prompt sections), and an advisory-only projection would underuse them; the skills layer ships anyway as the plugin-free fallback.
- **Registering a custom `SubagentProvider`.** Rejected: providers are child-agent transports (spawn/fork/ACP/…), not personas; the persona/tool-filter/depth composition belongs to `dsh-tool-subagent` config, and a custom provider would duplicate the in-process backends.
- **Human commands for workflow modes.** Rejected (see Non-Goals): commands cannot inject into the model stream.
- **Effect inside the plugin.** Rejected per ADR-CORE-017; no cancellation or structured-concurrency surface exists in `apply()`.

## Assumptions

- DSH preset compositions resolve relative module specifiers against the composition file's directory, so the staged `./plugin/index.js` loads. `[inferred from preset health-check docs]`
- Prompt-variable interpolation in persona templates covers variables registered by other plugins in the same standing mount (the `standard` preset already interpolates `{{model}}`/`{{cwd}}` this way). `[inferred from shipped preset]`
- The generated skill bodies never contain `{{` sequences, keeping them safe under strict prompt interpolation. `[verified]` against canonical directives and gated by package tests.
- `$DSH_HOME` (default `~/.dsh`) is the harness home used for `.agent-presets`. `[inferred]`

## Implementation Notes

- Tests (`packages/deepseek/tests/plugin.test.ts`) gate: the exact 14-skill surface with provenance, no `{{` in bodies (strict-interpolation safety), the plugin contract against explicit fake contexts (sections, variables, provider, loud failures, config validation), provider list/get contracts against the published `dsh-skill` types, and the preset/plugin persona cross-reference (every `{{maestria_*}}` referenced by the preset is registered by the plugin).
- No `sync-plugin-versions.ts` target and no `check-manifest-versions` input glob: the package ships no separate versioned manifest.
- The `dist` bundle is type-only in its host imports, so the staged `plugin/index.js` carries no dependency on `@deepseek-ai/*` at runtime.

## Related Decisions

- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) — canonical source and sync bridge; this projection is one more data-only `sync.config.ts`.
- [ADR-CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md) — support-level vocabulary; DSH enters the matrix as Provisional with evidence.
- [ADR-CORE-017](ADR-CORE-017-selective-effect-v4-adoption.md) — Effect v4 RC placement; applied to the CLI handler, not the plugin.
- [ADR-CORE-020](ADR-CORE-020-hybrid-package-topology.md) — hybrid topology; a per-host adapter package with thin runtime code follows the omp precedent.
- [ADR-CORE-022](ADR-CORE-022-agent-plugins-portable-projection.md) — portable projection; unchanged and still the host-neutral surface.

## References

- DeepSeek Harness repository and docs: `deepseek-ai/deepseek-harness` (`docs/subsystems/*`, `docs/cordis-primer.md`, `docs/cordis-tutorial/*`, `packages/preset/agent-presets`).
- `packages/deepseek/` — projection, plugin, preset, tests.
- `docs/runtime-support-matrix.md` — DeepSeek Harness evidence ledger entry.

## Date

2026-09-06
