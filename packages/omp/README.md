# @maestria/omp

Maestria extension for the [Oh My Pi](https://omp.sh/) coding agent.

> This package is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope. The agents and skills in this package are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](../../CONTRIBUTING.md#3-the-sync-pipeline-core-concept). Runtime support status is tracked in [ADR-CORE-014](../../docs/adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md) and the [runtime support matrix](../../docs/runtime-support-matrix.md).

## Motivation

Oh My Pi is a full coding agent with its own task dispatch, goal mode, and session model. `@maestria/omp` brings Maestria's structured orchestration to OMP by leveraging OMP's native capabilities: the 7 specialist agents are deployed to OMP's agent directory and dispatched through OMP's built-in `task` tool, so the methodology rides on the host rather than reinventing it. This keeps the plugin light and consistent with the rest of the Maestria ecosystem.

## Goals

- **7 specialist agents** - deployed to `~/.omp/agent/agents/` for OMP task dispatch.
- **4 maestria skills** - orchestrator dispatcher, global rules, handoff contract, iteration limits.
- **Workflow mode commands** - `/fein`, `/sonar`, `/blitz`.
- **Review mode** - `/review`, `/restore-model`, `/review-model` with read-only tool restrictions and dangerous-pattern protection.
- **Session state tracking** - handoff history, file tracking, blockers, persistence across compaction.
- **Native goal integration** - observes OMP's native goal mode and reflects goal objective/status in Maestria session state.

## Non-Goals

- **Does NOT replace OMP's native `task` dispatch** - the plugin deploys agents and relies on OMP's built-in `task()` tool; it does not ship its own subagent package.
- **Does NOT activate goal mode** - Maestria observes OMP's native goal state; it never invokes native goal commands.
- **Does NOT require `@gotgenes/pi-subagents`** - unlike `@maestria/pi`, OMP's built-in dispatch removes that dependency.

## Status / Support Boundary

`@maestria/omp` is a native Oh My Pi extension published to npm and installed through OMP's package mechanism (or the maestria CLI). It uses OMP's built-in task dispatch and observes OMP's native goal mode; the methodology itself is advisory prompt guidance.

## Installation

```bash
omp install @maestria/omp
```

## What It Provides

After installation, the extension loads automatically on omp session start:

- **7 specialist agents** (adventurer, architect, builder, diagnose, planner, reviewer, writer) - deployed to `~/.omp/agent/agents/` for omp task dispatch
- **4 maestria skills** - orchestrator dispatcher, global rules, handoff contract, iteration limits
- **Workflow mode commands** - `/fein`, `/sonar`, `/blitz`
- **Review mode** - `/review`, `/restore-model`, `/review-model` with read-only tool restrictions and dangerous pattern protection
- **Session state tracking** - handoff history, file tracking, blockers, persistence across compaction
- **Native goal integration** - observes OMP's native goal mode and reflects goal objective/status in Maestria session state
- **Structured handoff** - `/handoff` with 7-field contract

### Usage

- Use `/fein`, `/sonar`, `/blitz` to set workflow modes
- Use `/review <target>` to enter code review mode (blocks destructive tools)
- Use `/handoff <goal>` to generate structured handoff prompts
- Use `/maestria-status` to view current session state
- Use `/review-model <model-id>` to set a specific model for review mode

The 7 specialist agents are available via omp's built-in `task` tool:

```
task(agent: "adventurer", task: "Explore the codebase and report structure")
task(agent: "builder", task: "Implement the feature")
```

### Native Goal State

When OMP's native goal mode is active, Maestria observes `goal_updated` and mirrors active, paused, and budget-limited goals in its own session state (visible via `/maestria-status` and preserved across compaction). Non-null `complete` and `dropped` events clear the current-goal mirror after recording the transition. Session start, switch, fork, branch, handoff, and tree-navigation transitions restore the target session's Maestria state and use a valid public native goal entry when available. If no public target goal state is available, the mirror remains unknown until a future public goal event.

Observation only: Maestria never activates goal mode or invokes native goal commands. User-issued OMP `/goal` commands for pause, resume, and drop remain OMP-owned and available. The public OMP extension API exposes tool names but not tool provenance, so Maestria does not exempt the name `goal` from pure-dispatcher enforcement; model `goal` calls remain blocked when provenance cannot be established.

## Limitations / Platform Notes

- The plugin relies on OMP's built-in task dispatch and the public OMP extension API, which exposes tool names but not tool provenance - so `goal` calls cannot be exempted from pure-dispatcher enforcement when provenance is unknown.
- The package retains a `"pi"` fallback block in `package.json` - OMP's runtime accepts `pkg.pi` as a fallback when `pkg.omp` is absent, so the dual block ensures compatibility.
- The agents and skills are projections of the canonical core directives. To change behavior, edit `packages/core/agent-directives/` and re-run the sync pipeline - never edit the generated files under `agents/` or `skills/` directly.

### Differences from the Pi Plugin

Compared to `@maestria/pi`, this plugin:

- Uses `@oh-my-pi/pi-coding-agent` SDK (not `@earendil-works/pi-coding-agent`)
- Relies on omp's built-in task dispatch (no `@gotgenes/pi-subagents` needed)
- Deploys agents to `~/.omp/agent/agents/` (not `~/.pi/agent/agents/`)
- Uses bare agent names (`adventurer`, not `/adventurer`)

## Development

```bash
# Sync agents/skills from core
cd packages/omp && pnpm exec tsx ../core/scripts/sync.ts --verbose

# Test
pnpm --filter @maestria/omp test

# Build
vp pack

# Format, lint, type-check (repo root)
vp check
```

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/pi-omp/) on the docs site (shared with `@maestria/pi`)
- [Changelog](CHANGELOG.md)

## License

MIT
