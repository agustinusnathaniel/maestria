# @maestria/prime-agent

A skills-first package that encodes the Maestria engineering methodology for [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent): 7 specialist roles, an orchestrator, the global-rules contract, handoff and iteration-limits aids, and the fein/sonar/blitz workflow modes - all delivered as standard [Agent Skills](https://agentskills.io/specification) (`skills/<name>/SKILL.md`), generated from the canonical directives in `packages/core/agent-directives/`.

> This package is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope. Runtime support status and evidence are tracked in [ADR-CORE-014](../../docs/adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md) and the [runtime support matrix](../../docs/runtime-support-matrix.md).

## Status

`Native candidate` - Skills-first delivery. Prime Agent evidence (Agent Skills standard, discovery paths, frontmatter requirements, execution boundary) was re-verified on 2026-08-13 at the immutable upstream commit [`7787f07415d843b9a800f6a4720e0c739bd608e5`](https://github.com/PrimeIntellect-ai/prime-agent/tree/7787f07415d843b9a800f6a4720e0c739bd608e5). The generated skills match the documented contract, but runtime behavior is **not yet tested end to end**. The executable extension (JSON/RPC headless modes, recursive-subagent dispatch) is **deferred** per ADR-CORE-014 and is not part of this package. Do not treat this package as a production support promise.

## Install

See [INSTALL.md](INSTALL.md) for installation and consumption options.

## What's inside

All skills live under `skills/<name>/SKILL.md` with the required Agent Skills frontmatter (`name` matching the directory, and `description`).

### Specialist roles

| Skill        | Purpose                                                             |
| ------------ | ------------------------------------------------------------------- |
| `adventurer` | Codebase reconnaissance - read-only exploration, structured reports |
| `architect`  | Architecture decisions, trade-off analysis, ADRs                    |
| `builder`    | Focused implementation - atomic tasks, run tests                    |
| `diagnose`   | Root-cause analysis - 6-step regression tracing                     |
| `planner`    | Multi-phase implementation plans, success criteria, rollback        |
| `reviewer`   | Code review with quality gates - read-only, structured verdicts     |
| `writer`     | Documentation - READMEs, API docs, changelogs, ADRs                 |

### Orchestration and rules

| Skill | Purpose |
| --- | --- |
| `orchestrator` | Router methodology: direct/focused/full routes, delegation, maker/checker split, mode precedence |
| `global-rules` | Universal rules contract: floors, delegation, handoff, review, budgets, authorization, commit safety |
| `handoff` | Inter-specialist handoff contract |
| `iteration-limits` | Verifiable termination and escalation pattern |

### Workflow modes

| Skill   | Mode                                                                     |
| ------- | ------------------------------------------------------------------------ |
| `fein`  | Full pipeline: recon/design -> implement -> review                       |
| `sonar` | Research only: read-only specialist work -> STOP                         |
| `blitz` | Fast path: skip optional ceremony; never waive safety or required review |

Modes are loaded on demand by description matching, or invoked explicitly as `/skill:fein`, `/skill:sonar`, `/skill:blitz` (when skill commands are enabled).

## Platform notes and limitations

- **Skills-first, advisory, not executable:** specialist roles are methodology skills loaded on demand. There is **no** recursive-subagent dispatch, **no** JSON/RPC headless mode, and **no** agent tool in this package - Prime's executable extension is deferred (ADR-CORE-014). "Delegate to a specialist" means load the relevant skill and apply its methodology, not spawn a child agent.
- **Not a sandbox:** Prime Agent executes model-generated Python and project commands with your user permissions; worker and kernel processes are lifecycle isolation, not security sandboxing. Restrict use to trusted repositories, skills, and instructions. Review skill content before use.
- **Advisory vs enforced:** skills, rules, and role prompts are advisory guidance, not security enforcement. Prime Agent has no skill-level tool-denial mechanism (the Agent Skills `allowed-tools` field is experimental and only pre-approves tools), so the read-only roles (`adventurer`, `planner`, `reviewer`) state their role intent without claiming a runtime boundary.
- **Agent Skills frontmatter:** Prime requires `name` and `description`; unknown frontmatter fields are ignored; skills with a missing description are not loaded; validation is otherwise lenient (warnings). The package ships only the required fields.
- **No runtime code.** This is a declarative package: `skills/`, docs, and metadata only. No postinstall, no installer, no CLI or model registration.

## Design

The package is generated by the core sync pipeline (ADR-CORE-005). Platform-specific derivation - skill names, descriptions, and Prime-specific notes - lives in `sync.config.ts`. The canonical content stays in `packages/core/agent-directives/`; never edit generated output directly.

Every skill is emitted as `skills/<name>/SKILL.md` (directories containing `SKILL.md`) because that is the layout Prime discovers in **all** documented skill locations - project/global `.prime/agent/skills/`, `.agents/skills/`, package `skills/` directories or `pi.skills` entries, and settings `skills` arrays. (Root `.md` files are only discovered in the prime-specific paths and are ignored under `.agents/skills/`, so the directory layout is the safest projection.)

## Development

```bash
pnpm test              # generated-skill assertions
pnpm sync              # regenerate generated skills from canonical sources
pnpm validate          # validate skills/<name>/SKILL.md frontmatter and layout
```

See the [contributing guide](../../CONTRIBUTING.md) for repository conventions.

## License

MIT
