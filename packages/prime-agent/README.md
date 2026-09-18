# @maestria/prime-agent

Maestria's engineering methodology for [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent), delivered as standard [Agent Skills](https://agentskills.io/specification) plus a small, verified Prime/Pi extension for workflow-mode commands.

> This package is part of the Maestria project. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Status / Support Boundary

`Native candidate` - skills and extension contract were reverified on 2026-08-13 against the current pinned Prime Agent reference, but runtime behavior in a live Prime session is **not yet tested end to end**. Native recursive-subagent (`rlm`) dispatch and JSON/RPC headless-mode integration are deferred (see below). Do not treat this package as a production support promise.

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
- **Executable extension** - `/fein`, `/sonar`, `/blitz`, `/mode-clear`, and `/maestria-status` commands with session-scoped mode state.
- **Root project customization** - `.maestria/workflow.md` then `.maestria/rules.md` from the session directory, injected every turn as subordinate guidance (never waives safety, authorization, or host permissions).

## Root Project Customization

Place optional `.maestria/workflow.md` (sequencing) and `.maestria/rules.md` (rules) at the root of the directory you open the session in. Scope is root-only: no ancestor scan, no nested inheritance, and the root is the host-selected session cwd (`ctx.cwd`) read live each turn (never a process-global). Files are re-read in full on every `before_agent_start` turn, so additions, edits, and deletions apply on the next turn with no restart; nothing is persisted to session entries or compaction state, and post-compaction turns pick up the same fresh read. Absent or empty files leave the prompt unchanged. A present-but-unusable file (directory, special file, unreadable, unresolvable, or a symlink escaping the root) surfaces via a UI notification plus a STOP banner in the system prompt telling the model to report the error and wait, instead of running with silently absent config. Diagnostics name only the relative file and the failure kind. Whether subagent turns automatically receive the same injection is unverified, so delegation briefs still carry the active constraints. Limitation [inferred from Pi-lineage behavior, no pinned Prime source verified in this change]: the host is expected to swallow `before_agent_start` handler exceptions, so a broken file cannot cancel the model call itself; the notification plus banner is the loudest supported signal. Project loading is a small Prime-local module with no `shared-pi` runtime import, per the Prime isolation policy.

## Support / Platform Notes

- **Verified subset only:** the extension covers mode commands and mode prompt injection. There is no recursive-subagent dispatch - "delegate to a specialist" loads the relevant skill and applies its methodology. JSON/RPC headless-mode integration is deferred.
- **Advisory, not enforced:** skills, rules, and role prompts are guidance, not security enforcement. Prime has no skill-level tool-denial mechanism, so read-only roles state their role intent without claiming a runtime boundary.
- **Not a sandbox:** Prime executes model-generated Python and project commands with your user permissions. Restrict use to trusted repositories, skills, and instructions.
- **Extension has no filesystem writes:** the compiled extension does not write to `~/.pi` or `.prime/agent`; Prime's package manager still manages its own registration files.
- **No extra dependencies:** the extension uses only the Prime-bundled API; no pi package dependency is required.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/prime-agent/) on the docs site
- [Installation guide](https://github.com/agustinusnathaniel/maestria/blob/main/packages/prime-agent/INSTALL.md)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/prime-agent/CHANGELOG.md)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
