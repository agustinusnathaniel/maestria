# @maestria/omp

A Maestria extension for the [Oh My Pi](https://omp.sh/) coding agent that deploys the 7 specialist agents and workflow modes on top of OMP's native task dispatch.

> This package is part of the Maestria project. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Installation

```bash
omp install @maestria/omp
```

## What It Provides

- **7 specialist agents** (adventurer, architect, builder, diagnose, planner, reviewer, writer) using OMP's built-in `task` dispatch - no extra subagent package needed.
- **4 maestria skills** - orchestrator dispatcher, global rules, handoff contract, iteration limits.
- **Workflow modes** - `/fein`, `/sonar`, `/blitz`.
- **Review mode** - `/review`, `/restore-model`, `/review-model` with read-only tool restrictions.
- **Session state tracking** - handoff history, file tracking, blockers, preserved across compaction.
- **Native goal observation** - mirrors OMP's native goal mode in Maestria session state; Maestria never activates goal mode itself.
- **Root project customization** - `.maestria/workflow.md` then `.maestria/rules.md` from the session directory, injected every turn as subordinate guidance (never waives safety, authorization, or host permissions).

## Root Project Customization

Place optional `.maestria/workflow.md` (sequencing) and `.maestria/rules.md` (rules) at the root of the directory you open the session in. Scope is root-only: no ancestor scan, no nested inheritance, and the root is the host-selected session cwd read live each turn (never a process-global). Files are re-read in full on every `before_agent_start` turn, so additions, edits, and deletions apply on the next turn with no restart; nothing is persisted to session entries or compaction state, and post-compaction turns pick up the same fresh read. Absent or empty files leave the prompt unchanged. A present-but-unusable file (directory, special file, unreadable, unresolvable, or a symlink escaping the root) surfaces via a UI notification plus a STOP banner appended to the system prompt telling the model to report the error and wait, instead of running with silently absent config. Diagnostics name only the relative file and the failure kind. Whether subagent turns automatically receive the same injection is unverified, so delegation briefs still carry the active constraints. Limitation: the OMP host swallows `before_agent_start` handler exceptions, so a broken file cannot cancel the model call itself; the notification plus banner is the loudest supported signal.

## Support / Platform Notes

- Relies on OMP's built-in task dispatch and the public OMP extension API, which exposes tool names but not tool provenance - so native `goal` calls cannot be exempted from enforcement when provenance is unknown.
- Unlike `@maestria/pi`, no `@gotgenes/pi-subagents` dependency is required.
- Methodology is advisory prompt guidance; read-only restrictions are advisory where OMP does not structurally enforce them.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/pi-omp/) on the docs site (shared with `@maestria/pi`)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/omp/CHANGELOG.md)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
