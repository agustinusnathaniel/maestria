# @maestria/omp

A Maestria extension for the [Oh My Pi](https://omp.sh/) coding agent that deploys the 7 specialist agents and workflow modes on top of OMP's native task dispatch.

> This package is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope. The agents and skills are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](../../CONTRIBUTING.md#3-the-sync-pipeline-core-concept).

## Installation

```bash
omp install @maestria/omp
```

## What It Provides

- **7 specialist agents** (adventurer, architect, builder, diagnose, planner, reviewer, writer) deployed to `~/.omp/agent/agents/` for OMP's built-in `task` dispatch - no extra subagent package needed.
- **4 maestria skills** - orchestrator dispatcher, global rules, handoff contract, iteration limits.
- **Workflow modes** - `/fein`, `/sonar`, `/blitz`.
- **Review mode** - `/review`, `/restore-model`, `/review-model` with read-only tool restrictions.
- **Session state tracking** - handoff history, file tracking, blockers, preserved across compaction.
- **Native goal observation** - mirrors OMP's native goal mode in Maestria session state; Maestria never activates goal mode itself.

## Support / Platform Notes

- Relies on OMP's built-in task dispatch and the public OMP extension API, which exposes tool names but not tool provenance - so `goal` calls cannot be exempted from pure-dispatcher enforcement when provenance is unknown.
- Unlike `@maestria/pi`, no `@gotgenes/pi-subagents` dependency is required.
- The package retains a `"pi"` fallback block in `package.json` for OMP runtimes that fall back to `pkg.pi` when `pkg.omp` is absent.
- Methodology is advisory prompt guidance; read-only restrictions are advisory where OMP does not structurally enforce them.
- The agents and skills are projections of the canonical core directives. To change behavior, edit `packages/core/agent-directives/` and re-run the sync pipeline - never edit the generated files under `agents/` or `skills/` directly.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/pi-omp/) on the docs site (shared with `@maestria/pi`)
- [Changelog](CHANGELOG.md)

## License

MIT
