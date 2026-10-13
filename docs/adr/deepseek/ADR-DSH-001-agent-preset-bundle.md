# ADR-DSH-001: DeepSeek Harness Agent-Preset Bundle

## Status

Accepted (2026-10-14). Confidence: Medium. DeepSeek Harness is a developer preview; this decision was verified against `0.2.0-rc.2` and its support level is Provisional in the [runtime support matrix](../../runtime-support-matrix.md#deepseek-harness).

## Context

DeepSeek Harness (DSH) composes every agent capability as a Cordis plugin row. Out-of-tree packages ship as **bundles**: a `package.json` declaring `dsh.bundle.patch` names a patch layer that `dsh plugin --profile <name> add` stacks into a profile. Since `0.2.0`, agent presets are ordinary `@deepseek-ai/dsh-agent-preset` rows in such a patch; the earlier `.agent-presets/<name>/` directories are no longer read. Only the shipped `web` profile mounts the preset registry. A patch can insert into a `group: true` row by id but cannot reach another preset's plugin list, so a preset that differs from `standard` must restate its rows.

The host offers what maestria's orchestrator needs: per-row `dsh-tool-subagent` delegation tools with a child `persona`, a host-enforced `toolFilter`, and a `maxDepth` cap; prompt variables with strict `{{name}}` interpolation; ordered system-prompt sections; and `dsh-skill-filesystem` roots. A delegated child joins its parent's preset, so preset-scoped sections and variables reach it.

## Decision

Ship `@maestria/deepseek` as a DSH bundle whose patch declares one `maestria` agent preset. The preset restates the `standard` rows and adds:

- a persona prefix that interpolates `{{maestria_orchestrator}}`;
- a small Cordis plugin row (`@maestria/deepseek`) that registers one `maestria_<role>` prompt variable per persona and the global rules as a literal (`interpolate: false`) system-prompt section, both read at mount from generated `prompts/`;
- the package's generated `skills/` directory as a `customSkillDirs` root of the preset's own `skill-filesystem` row, resolved from the installed package with a Loader `!!js` expression;
- seven one-shot `maestria_<role>` delegation rows whose persona is that role's variable, with `maxDepth: 1` so specialists are leaves, `toolFilter.allow: [read, glob, grep, skill]` for adventurer, planner, and reviewer, and `toolFilter.deny: [edit, write]` for architect and diagnose.

Prompts and skills are generated from canonical core by `packages/deepseek/sync.config.ts`; host prose lives in `integrations/deepseek.md` and is appended to the orchestrator persona. Specialist mentions are rewritten to the delegation tool names. The CLI installs with the host's installer, `dsh plugin --profile web add`, like the Pi and OMP handlers.

## Consequences

- **Positive:** specialist role boundaries are host-enforced rather than advisory, children receive the global rules, and the bundle needs no file staging and no runtime dependency: host packages are type-only imports and skill discovery reuses DSH's own provider.
- **Positive:** `dsh plugin` owns install, update, and removal, including the profile's bundle list, so the CLI handler is configuration.
- **Negative:** the restated `standard` rows drift as DSH evolves and must be re-diffed against the supported release. Users who customize `standard` do not see those changes in `maestria`.
- **Negative:** custom skill roots rank above user skill roots, so a same-named skill in `~/.agents/skills` is shadowed while the preset is active; project roots still win.
- **Negative:** the host adds its own `subagent` tool to every spawned child after the filter, so read-only children see it; `maxDepth: 1` and the host's default depth stop them from delegating.
- **Neutral:** workflow modes are skills rather than commands because DSH human commands do not send to the model.

## Alternatives Considered

- **Stage a preset directory with the CLI (the first draft of this package).** Rejected: DSH `0.2.0` no longer reads preset directories, and staging duplicated the host installer.
- **Register the plugin and skills at the host level for every preset.** Rejected: it would change `standard` and every other preset without the user choosing maestria.
- **A package-owned `ctx.skills` provider.** Rejected: it reimplemented frontmatter parsing, ranking, and watching that `dsh-skill-filesystem` already provides.
- **A hand-written routing section and role skills.** Rejected: both duplicated canonical prose; the orchestrator persona is the router, and roles are delegation personas.
- **Ship no tool filters.** Rejected once the shipped composition fixed the tool names: an allowlist of names present on every platform cannot fail startup, and the deny list names only file-editing tools.

## Verification

`scripts/e2e/deepseek-evidence.ts` installs the packed bundle with `dsh plugin add` into an isolated home, boots `dsh web` against a local fake Messages endpoint, and drives a maestria session that delegates to the reviewer and architect. It records activation, skill resolution, rendered personas and rules, and each child's tool list. `packages/deepseek/tests/preset.test.ts` checks the persona variables and role filters against the real published `SystemPrompt` service in CI.

## Related Decisions

- [CORE-005](../core/ADR-CORE-005-shared-agent-directives-core-sync.md): canonical directives and generated projections.
- [CORE-014](../core/ADR-CORE-014-runtime-support-and-adapter-policy.md): support levels and promotion gates.
- [CORE-020](../core/ADR-CORE-020-hybrid-package-topology.md): host-specific adapter packages.

## Date

2026-10-14
