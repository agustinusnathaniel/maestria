# @maestria/prime-agent

A package that encodes the Maestria engineering methodology for [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent): 7 specialist roles, an orchestrator, the global-rules contract, handoff and iteration-limits aids, and the fein/sonar/blitz workflow modes - delivered as standard [Agent Skills](https://agentskills.io/specification) (`skills/<name>/SKILL.md`), generated from the canonical directives in `packages/core/agent-directives/` - plus a small, verified Prime/Pi extension (`dist/extension.mjs`) for workflow-mode commands and mode prompt injection.

> This package is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope. The skills in this package are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](../../CONTRIBUTING.md#3-the-sync-pipeline-core-concept). Runtime support status and evidence are tracked in [ADR-CORE-014](../../docs/adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md) and the [runtime support matrix](../../docs/runtime-support-matrix.md).

## Motivation

Prime Agent executes code directly and loads methodology from standard Agent Skills. `@maestria/prime-agent` brings Maestria's engineering discipline to Prime in the form Prime already consumes: skills for the 7 specialist roles, orchestrator, global rules, handoff and iteration limits, and the fein/sonar/blitz workflow modes - plus a small extension that turns those modes into session-level commands and prompt injection. Skills are advisory guidance; they are not a sandbox and do not claim runtime enforcement.

## Goals

- **Skills-first delivery** - ship the Maestria methodology as standard Agent Skills (`skills/<name>/SKILL.md`) with the required `name`/`description` frontmatter.
- **A verified executable subset** - a small, self-contained Prime/Pi extension (`dist/extension.mjs`) covering workflow-mode slash commands and mode prompt injection, using only the public extension API of the pinned Prime fork.
- **Session-scoped mode state** - mode state rides on host session custom entries, restored across session start/reload/resume/fork and preserved across compaction, with no filesystem writes.
- **Single source of truth** - skills are generated from the canonical core directives; the extension loads its mode content from the generated `skills/` so there is one source for mode text.

## Non-Goals

- **Does NOT provide native `rlm` recursive-subagent dispatch** - the pinned fork's `rlm(...)` call is an IPython-side tool with **no public JS extension bridge**, so this package cannot spawn child agents from the extension. "Delegate to a specialist" means load the relevant skill and apply its methodology.
- **Does NOT support JSON/RPC headless-mode integration** - deferred (ADR-CORE-014).
- **Does NOT enforce roles as a sandbox** - Prime Agent has no skill-level tool-denial mechanism (the Agent Skills `allowed-tools` field is experimental and only pre-approves tools), so read-only roles state their role intent without claiming a runtime boundary.
- **Does NOT declare a runtime dependency on pi packages** - the Prime-compatible fork of `@earendil-works/pi-coding-agent` is not published to npm and Prime bundles the pi API into its runtime, so the extension consumes the API through the runtime-provided `pi` object with type-only local declarations.

## Status / Support Boundary

`Native candidate` - Skills-first delivery plus a verified executable extension subset. Prime Agent evidence (Agent Skills standard, discovery paths, frontmatter requirements, extension API, execution boundary) was re-verified on 2026-08-13 at the immutable upstream commit [`7787f07415d843b9a800f6a4720e0c739bd608e5`](https://github.com/PrimeIntellect-ai/prime-agent/tree/7787f07415d843b9a800f6a4720e0c739bd608e5). The generated skills match the documented contract, the compiled extension is verified against the pinned fork's public extension API (source inspection) and exercised by tests, but runtime behavior in a live Prime session is **not yet tested end to end**. Native recursive-subagent (`rlm`) dispatch and JSON/RPC headless-mode integration remain **deferred** (see below). Do not treat this package as a production support promise.

## Installation

See [INSTALL.md](INSTALL.md) for installation and consumption options. The preferred path registers the published npm package with Prime, which enables both the skills and the extension:

```bash
prime-agent package install npm:@maestria/prime-agent
```

For skills-only installs, point Prime at the package's `skills/` directory in settings, or copy/symlink the skill directories into a project or global skill location.

## What It Provides

### Agent Skills

All skills live under `skills/<name>/SKILL.md` with the required Agent Skills frontmatter (`name` matching the directory, and `description`).

#### Specialist roles

| Skill        | Purpose                                                             |
| ------------ | ------------------------------------------------------------------- |
| `adventurer` | Codebase reconnaissance - read-only exploration, structured reports |
| `architect`  | Architecture decisions, trade-off analysis, ADRs                    |
| `builder`    | Focused implementation - atomic tasks, run tests                    |
| `diagnose`   | Root-cause analysis - 6-step regression tracing                     |
| `planner`    | Multi-phase implementation plans, success criteria, rollback        |
| `reviewer`   | Code review with quality gates - read-only, structured verdicts     |
| `writer`     | Documentation - READMEs, API docs, changelogs, ADRs                 |

#### Orchestration and rules

| Skill | Purpose |
| --- | --- |
| `orchestrator` | Router methodology: direct/focused/full routes, delegation, maker/checker split, mode precedence |
| `global-rules` | Universal rules contract: floors, delegation, handoff, review, budgets, authorization, commit safety |
| `handoff` | Inter-specialist handoff contract |
| `iteration-limits` | Verifiable termination and escalation pattern |

#### Workflow modes

| Skill   | Mode                                                                     |
| ------- | ------------------------------------------------------------------------ |
| `fein`  | Full pipeline: recon/design -> implement -> review                       |
| `sonar` | Research only: read-only specialist work -> STOP                         |
| `blitz` | Fast path: skip optional ceremony; never waive safety or required review |

Modes are loaded on demand by description matching, or invoked explicitly as `/skill:fein`, `/skill:sonar`, `/skill:blitz` (when skill commands are enabled). The extension commands below activate the same modes for the session.

### Executable extension (verified subset)

The package ships a compiled Prime/Pi extension (`dist/extension.mjs`, declared under `pi.extensions` in `package.json`) that covers a small, verified subset of the public Prime/Pi extension API (pinned fork `7787f074...`, `packages/coding-agent/src/core/extensions/types.ts`):

| Command | Behavior |
| --- | --- |
| `/fein`, `/sonar`, `/blitz` | Set the session workflow mode, persist it as a session custom entry, and forward an optional goal argument to the agent (`/fein implement the pipeline`) |
| `/mode-clear` | Clear the active mode and return to neutral routing |
| `/maestria-status` | Show the current mode and the verified/deferred subset |

In addition, while a mode is active the extension appends the mode's prompt (loaded from the generated `skills/<mode>/SKILL.md`, so the injected text is exactly the sync-projected mode skill) to the system prompt on every agent turn via the `before_agent_start` event. Mode state is session-scoped (host session custom entries via `pi.appendEntry`), restored on session start/reload/resume/fork and on session-tree navigation, and persists across compaction by design (custom entries are session entries).

## Limitations / Platform Notes

- **Verified subset only, not native `rlm` dispatch:** the extension covers mode commands and mode prompt injection. There is **no** recursive-subagent dispatch: the pinned fork's `rlm(...)` call is an IPython-side tool with **no public JS extension bridge**, so this package does not and cannot spawn child agents from the extension. "Delegate to a specialist" means load the relevant skill and apply its methodology, not spawn a child agent. JSON/RPC headless-mode integration is likewise deferred (ADR-CORE-014). The `/maestria-status` command states this explicitly.
- **Advisory, not enforced:** skills, rules, role prompts, and the extension are advisory guidance, not security enforcement. The extension performs **no tool interception** (it does not claim any control over Prime's Python/command execution path). Prime Agent has no skill-level tool-denial mechanism (the Agent Skills `allowed-tools` field is experimental and only pre-approves tools), so the read-only roles (`adventurer`, `planner`, `reviewer`) state their role intent without claiming a runtime boundary.
- **Not a sandbox:** Prime Agent executes model-generated Python and project commands with your user permissions; worker and kernel processes are lifecycle isolation, not security sandboxing. Restrict use to trusted repositories, skills, and instructions. Review skill and extension content before use.
- **No filesystem writes:** the extension writes nothing (no `~/.pi`, no `.prime/agent` writes); mode state rides on host session entries. Mode content is read from the package's own generated `skills/` directory.
- **No runtime dependency on pi packages:** the Prime-compatible fork of `@earendil-works/pi-coding-agent` (`0.7.2`) is not published to npm (the registry carries only the original Pi line), and Prime bundles the pi API into its runtime. The extension consumes the API exclusively through the runtime-provided `pi` object with type-only local declarations (`src/pi-api.ts`, mirroring the pinned fork); the built `dist/extension.mjs` has zero imports of any pi package. Declaring a runtime/peer dependency on an unpublished or mismatched version would be a false claim, so none is declared.
- **Agent Skills frontmatter:** Prime requires `name` and `description`; unknown frontmatter fields are ignored; skills with a missing description are not loaded; validation is otherwise lenient (warnings). The package ships only the required fields.

## Design

The skills are generated by the core sync pipeline (ADR-CORE-005). Platform-specific derivation - skill names, descriptions, and Prime-specific notes - lives in `sync.config.ts`. The canonical content stays in `packages/core/agent-directives/`; never edit generated output directly. The extension (`src/`) is hand-authored: it is a Prime-local thin extension modeled on `@maestria/pi`'s mode behavior but self-contained (it does not import `@maestria/pi` or `@maestria/shared-pi`), uses only the public extension API, and loads its mode content from the generated skills so there is a single source of truth for mode text.

Every skill is emitted as `skills/<name>/SKILL.md` (directories containing `SKILL.md`) because that is the layout Prime discovers in **all** documented skill locations - project/global `.prime/agent/skills/`, `.agents/skills/`, package `skills/` directories or `pi.skills` entries, and settings `skills` arrays. (Root `.md` files are only discovered in the prime-specific paths and are ignored under `.agents/skills/`, so the directory layout is the safest projection.)

## Development

```bash
pnpm build            # compile dist/extension.mjs (vp pack)
pnpm test             # generated-skill + extension + package tests
pnpm validate         # validate skills/<name>/SKILL.md frontmatter and layout
bash scripts/sync-all # regenerate generated skills for all plugins (incl. this one)
```

See the [contributing guide](../../CONTRIBUTING.md) for repository conventions.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/prime-agent/) on the docs site
- [Installation guide](INSTALL.md)
- [Changelog](CHANGELOG.md)

## License

MIT
