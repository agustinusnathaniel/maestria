# @maestria/omp

Maestria extension for the [Oh My Pi](https://omp.sh/) coding agent.

## Installation

```bash
omp install @maestria/omp
```

## What's Included

- **7 specialist agents** (adventurer, architect, builder, diagnose, planner, reviewer, writer) - deployed to `~/.omp/agent/agents/` for omp task dispatch
- **4 maestria skills** - orchestrator dispatcher, global rules, handoff contract, iteration limits
- **Workflow mode commands** - `/fein`, `/sonar`, `/blitz`
- **Review mode** - `/review`, `/restore-model`, `/review-model` with read-only tool restrictions and dangerous pattern protection
- **Session state tracking** - handoff history, file tracking, blockers, persistence across compaction
- **Native goal integration** - observes OMP's native goal mode and reflects goal objective/status in Maestria session state
- **Structured handoff** - `/handoff` with 7-field contract

## Usage

After installation, the extension loads automatically on omp session start:

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

## How It Works

This package follows the same sync-based architecture as all maestria plugins:

1. Agent methodology is authored in `packages/core/agent-directives/`
2. The sync pipeline transforms canonical sources with omp-appropriate frontmatter
3. On session start, the extension deploys agent `.md` files to `~/.omp/agent/agents/`
4. omp's built-in `task` tool discovers and dispatches to these agents

## Native Goal State

When OMP's native goal mode is active, Maestria observes `goal_updated` and mirrors active, paused, and budget-limited goals in its own session state (visible via `/maestria-status` and preserved across compaction). Non-null `complete` and `dropped` events clear the current-goal mirror after recording the transition. Session start, switch, fork, branch, handoff, and tree-navigation transitions restore the target session's Maestria state and use a valid public native goal entry when available. If no public target goal state is available, the mirror remains unknown until a future public goal event.

Observation only: Maestria never activates goal mode or invokes native goal commands. User-issued OMP `/goal` commands for pause, resume, and drop remain OMP-owned and available. The public OMP extension API exposes tool names but not tool provenance, so Maestria does not exempt the name `goal` from pure-dispatcher enforcement; model `goal` calls remain blocked when provenance cannot be established.

## Differences from Pi Plugin

Compared to `@maestria/pi`, this plugin:

- Uses `@oh-my-pi/pi-coding-agent` SDK (not `@earendil-works/pi-coding-agent`)
- Relies on omp's built-in task dispatch (no `@gotgenes/pi-subagents` needed)
- Deploys agents to `~/.omp/agent/agents/` (not `~/.pi/agent/agents/`)
- Uses bare agent names (`adventurer`, not `/adventurer`)
- Retains a `"pi"` fallback block in `package.json` - omp's runtime accepts `pkg.pi` as a fallback when `pkg.omp` is absent, so the dual block ensures compatibility

## License

MIT
