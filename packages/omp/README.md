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

## Support / Platform Notes

- Relies on OMP's built-in task dispatch and the public OMP extension API; some tool-level enforcement is limited because OMP does not expose tool provenance.
- Unlike `@maestria/pi`, no `@gotgenes/pi-subagents` dependency is required.
- Methodology is advisory prompt guidance; read-only restrictions are advisory where OMP does not structurally enforce them.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/pi-omp/) on the docs site (shared with `@maestria/pi`)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/omp/CHANGELOG.md)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## License

MIT
