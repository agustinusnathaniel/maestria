# ADR-DSH-001: DeepSeek Harness Agent-Preset Bundle

## Status

Accepted (2026-11-04). Confidence: Medium. DeepSeek Harness is a developer preview; this decision was verified against `0.2.1-rc.5` and its support level is Provisional in the [runtime support matrix](../../runtime-support-matrix.md#deepseek-harness). Revised before first release: the 2026-10-14 draft targeted `0.2.0-rc.2` and seven specialist delegation tools.

## Context

DeepSeek Harness (DSH) composes every agent capability as a Cordis plugin row. Out-of-tree packages ship as **bundles**: a `package.json` declaring `dsh.bundle.patch` names a patch layer that `dsh plugin --profile <name> add` stacks into a profile. Agent presets are `@deepseek-ai/dsh-agent-preset` rows in such a patch, each listing its own child plugins; only the shipped `web` profile mounts the preset registry. One preset cannot extend another, so a preset that differs from `standard` restates its rows.

maestria now runs as one main loop with one blind reviewer ([CORE-035](../core/ADR-CORE-035-main-loop-with-one-reviewer.md)), an always-on core plus method skills ([CORE-036](../core/ADR-CORE-036-always-on-core-and-skill-map.md)), and host hooks that reinforce, never replace, the rules ([CORE-037](../core/ADR-CORE-037-hooks-as-deterministic-reinforcement.md)). DSH documents what each part needs: ordered system-prompt sections and prompt variables, dynamic prompt context evaluated on every assembly, a `tools/pre-execute` waterfall whose listeners return `allow`, `deny`, `cancel`, or `ask` (an ask goes to the host's approval service and fails closed), per-preset tool rows such as `dsh-tool-fs` with `write` and `edit` switched off, and a `dsh-tool-subagent` row that starts a child on an independent `agentPreset`. In `0.2.1` the subagent row no longer takes the `persona` and `toolFilter` keys the first draft used.

## Decision

**DSH is a native adapter, not a declarative host.** `@maestria/agent-plugins` serves hosts that read manifests, Markdown profiles, and hook scripts from a package. DSH reads none of those: everything it loads is a Cordis plugin row, and the always-on core, project customization, and guards here need plugin code (a prompt section, a context provider, and a waterfall listener). So `@maestria/deepseek` stays its own package beside `@maestria/opencode` and `@maestria/pi` ([CORE-020](../core/ADR-CORE-020-hybrid-package-topology.md)), and reuses the shared `hook-policy` and `project-config` modules rather than the agent-plugins hook scripts.

The bundle patch declares two presets:

- **`maestria`** restates the `standard` rows of `@deepseek-ai/dsh-web-app` `0.2.1-rc.5` and adds: a persona prefix that interpolates `{{maestria_main_loop}}`; the `@maestria/deepseek` plugin row; the package's generated `skills/` as a `customSkillDirs` root, resolved from the installed package with a Loader `!!js` expression; and a `maestria_reviewer` delegation row (`provider: spawn`, `agentPreset: maestria-reviewer`).
- **`maestria-reviewer`** mounts only a persona that interpolates `{{maestria_reviewer}}`, the `@maestria/deepseek/reviewer` plugin, workspace instructions, `dsh-tool-fs` with `write: false` and `edit: false`, `dsh-tool-fs-search`, and the skill provider and tool. With no shell, edit, write, or delegation row, read-only is host-enforced.

The `@maestria/deepseek` plugin registers the main loop as a prompt variable, the whole of `rules.md` as a literal section, project-root `.maestria/workflow.md` then `.maestria/rules.md` as required runtime context re-read on every assembly (an unusable file becomes the shared STOP banner), and a `tools/pre-execute` listener that maps the shared hook policy onto `bash`, `edit`, and `write`: block becomes `deny`, ask becomes `ask`. The reviewer plugin registers the reviewer role (with the `implement` skill body) and the `Every Agent` and `Implementation and Review` rules. The project root is the nearest ancestor of the session directory that holds `.git`, the rule DSH's own skill provider documents.

Prompts and mode skills are generated from canonical core by `packages/deepseek/sync.config.ts`; method skills are copied by `scripts/sync-bundled-skills.ts`; host prose lives in `integrations/deepseek.md`, appended to the main loop. Workflow modes are skills, loaded when a message starts with a mode keyword. The CLI installs with `dsh plugin --profile web add`.

## Consequences

- **Positive:** the reviewer cannot run a shell or change files, enforced by what its preset mounts, not by a filter or prompt; risky git commands and generated-file edits meet a check on every call, with DSH's own approval prompt for asks; project customization reaches every turn without a model reading it.
- **Positive:** `dsh plugin` owns install, update, and removal, and the plugin needs no runtime dependency: host packages are type-only imports and the shared policy is bundled.
- **Negative:** the restated `standard` rows drift as DSH evolves and must be re-diffed against each supported release; customizations of `standard` do not carry over.
- **Negative:** the reviewer preset appears in the preset picker, since DSH documents no way to hide one; it is labelled for use by `maestria_reviewer`.
- **Negative:** the host keeps its global `working_directory` tool in the reviewer, so the reviewer can change its own session directory (not files).
- **Negative:** project files and guards read the local filesystem, so remote or SSH workspaces are not supported. The guard does not cover the Windows `pwsh` tool, whose commands the shared POSIX classifier does not parse.
- **Neutral:** custom skill roots rank above user roots, so a same-named skill in `~/.agents/skills` is shadowed while the preset is active; project roots still win.

## Alternatives Considered

- **A declarative projection through `@maestria/agent-plugins`.** Rejected: DSH loads no manifest, profile, or hook-script format that package emits.
- **Keep the seven specialist rows of the first draft.** Rejected: maestria dispatches only the reviewer now, and `0.2.1` removed the `persona` and `toolFilter` keys those rows needed.
- **A reviewer row that inherits the main preset.** Rejected: a child on the parent's composition keeps `bash`, `edit`, and `write`; only an independent preset can leave them out.
- **Inline the prompts in the patch YAML.** Rejected: the YAML would duplicate generated text; the plugin reads it from `prompts/` at mount.
- **Throw from the project context provider on an unusable file.** Rejected: whether a throwing provider fails the turn or is skipped is undocumented; the STOP banner fails loud either way.

## Verification

`scripts/e2e/deepseek-evidence.ts` installs the packed bundle with `dsh plugin add` into an isolated home, boots `dsh web` against a local fake Messages endpoint, and drives a session in a git repository on `main`. It records preset activation, skill resolution, rendered persona and rules, the `.maestria/rules.md` context, a hook-bypassing commit denied before any of the command runs, and the reviewer's persona, rules, tool list, and returned result. `packages/deepseek/tests/preset.test.ts` runs both plugins on the real published `SystemPrompt` service and Cordis runtime and drives the guard through a real `tools/pre-execute` waterfall in CI. The ask path is unit-tested only.

## Related Decisions

- [CORE-005](../core/ADR-CORE-005-shared-agent-directives-core-sync.md): canonical directives and generated projections.
- [CORE-014](../core/ADR-CORE-014-runtime-support-and-adapter-policy.md): support levels and promotion gates.
- [CORE-020](../core/ADR-CORE-020-hybrid-package-topology.md): host-specific adapter packages.
- [CORE-035](../core/ADR-CORE-035-main-loop-with-one-reviewer.md), [CORE-036](../core/ADR-CORE-036-always-on-core-and-skill-map.md), [CORE-037](../core/ADR-CORE-037-hooks-as-deterministic-reinforcement.md): the main loop, always-on core, and hooks this adapter projects.

## Date

2026-10-14; revised 2026-11-04.
