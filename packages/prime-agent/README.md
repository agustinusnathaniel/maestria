# @maestria/prime-agent

Maestria's engineering methodology for [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent), delivered as standard [Agent Skills](https://agentskills.io/specification) (`skills/<name>/SKILL.md`) plus a small, verified Prime/Pi extension for workflow-mode commands.

> This package is part of Maestria. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope. The skills are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md#3-the-sync-pipeline-core-concept).

## Status / Support Boundary

`Native candidate` - skills-first delivery plus a verified executable extension subset. Evidence was re-verified on 2026-08-13 against the immutable upstream commit [`7787f07415d843b9a800f6a4720e0c739bd608e5`](https://github.com/PrimeIntellect-ai/prime-agent/tree/7787f07415d843b9a800f6a4720e0c739bd608e5). The generated skills match the documented contract and the compiled extension is exercised by tests, but runtime behavior in a live Prime session is **not yet tested end to end**. Native recursive-subagent (`rlm`) dispatch and JSON/RPC headless-mode integration are **deferred** (see below). Do not treat this package as a production support promise.

## Installation

```bash
# Preferred: registers the published package with Prime (skills + extension)
prime-agent package install npm:@maestria/prime-agent
```

For skills-only installs, point Prime at the package's `skills/` directory in settings, or copy/symlink the skill directories into a project or global skill location. See [INSTALL.md](https://github.com/agustinusnathaniel/maestria/blob/main/packages/prime-agent/INSTALL.md) for all installation and consumption options.

## What It Provides

- **7 specialist skills** - adventurer, architect, builder, diagnose, planner, reviewer, writer.
- **Orchestration and rules skills** - `orchestrator`, `global-rules`, `handoff`, `iteration-limits`.
- **Workflow mode skills** - `fein`, `sonar`, `blitz`, loaded on demand by description matching or invoked explicitly as `/skill:fein` etc.
- **Executable extension** (`dist/extension.mjs`) - `/fein`, `/sonar`, `/blitz`, `/mode-clear`, and `/maestria-status` commands with session-scoped mode state and mode prompt injection via `before_agent_start`, using only the public extension API of the pinned Prime fork.

## Support / Platform Notes

- **Verified subset only:** the extension covers mode commands and mode prompt injection. There is no recursive-subagent dispatch - the pinned fork's `rlm(...)` call has no public JS extension bridge - so "delegate to a specialist" means load the relevant skill and apply its methodology. JSON/RPC headless-mode integration is deferred (ADR-CORE-014).
- **Advisory, not enforced:** skills, rules, and role prompts are guidance, not security enforcement. Prime has no skill-level tool-denial mechanism, so read-only roles state their role intent without claiming a runtime boundary; the extension performs no tool interception.
- **Not a sandbox:** Prime executes model-generated Python and project commands with your user permissions. Restrict use to trusted repositories, skills, and instructions.
- **No filesystem writes:** mode state rides on host session entries; nothing is written to `~/.pi` or `.prime/agent`.
- **No runtime dependency on pi packages:** the extension consumes the Prime-bundled pi API through the runtime-provided `pi` object; no pi package dependency is declared.
- The skills are generated from the canonical core directives; the extension is hand-authored. Edit `packages/core/agent-directives/` and re-run the sync pipeline to change skill content - never edit generated files.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/prime-agent/) on the docs site
- [Installation guide](https://github.com/agustinusnathaniel/maestria/blob/main/packages/prime-agent/INSTALL.md)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/prime-agent/CHANGELOG.md)

## Development

```bash
pnpm build      # compile dist/extension.mjs
pnpm test       # generated-skill + extension + package tests
pnpm validate   # validate skills/<name>/SKILL.md frontmatter and layout
```

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
