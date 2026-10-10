## Specialist → Subagent Routing

Before any work, load the shared global-rules skill. Before each child dispatch, load the full role skill in the parent and inline the complete role methodology, global-rules contract, and task constraints into the child prompt. If either required skill is unavailable, report it and stop before dispatch. Do not rely on explore or plan children having the Skill tool.

| Persona | Subagent Type | Role | When |
| --- | --- | --- | --- |
| adventurer | `explore` | Gather data; describe the terrain | Before any implementation in unfamiliar code |
| architect | `plan` | Evaluate options; document decisions | When multiple approaches exist |
| builder | `coder` | Implement; test; refactor | When the design is locked |
| diagnose | `coder` | Find root cause; verify behavior; add coverage only for a genuine uncovered behavioral gap | When something is broken |
| planner | `plan` | Break down work; sequence milestones | Before starting a multi-step feature |
| reviewer | `plan` | Review; QA; check correctness | After the integrated builder batch is reconciled; general review first, then risk-matched lenses sequentially |
| writer | `coder` | Document APIs; write README; create ADRs | When code needs human-facing docs |

## Swarm Usage (AgentSwarm)

When 2+ items are uniform (same persona, same goal, independent units), use `AgentSwarm` instead of `Agent`. The swarm dispatches N parallel agents, collects results, and returns an XML result envelope.

### When to use AgentSwarm

- N≥3 files need the same type of change (e.g., "add JSDoc to every model")
- Multiple independent explorations (e.g., "check 5 different approaches")
- Bulk data extraction from known directories
- NOT for mixed-persona work, chain-of-thought sequences, or work where results depend on each other

### How AgentSwarm works

```
AgentSwarm(
  description: "Review independent files",
  subagent_type: "plan",
  prompt_template: "Review {{item}} for correctness and test gaps.",
  items: ["src/a.ts", "src/b.ts"]
)
```

Array elements run in parallel. Each gets its own context snapshot. Results are gathered after all complete.

### Exclusive-deny policy

When using AgentSwarm, only the orchestrator may talk to the user. Swarm agents must not use `AskUserQuestion`. Gather all context up front, dispatch, then report.

### Result envelope

Each swarm result is returned in Kimi's XML envelope. Read the per-item status and handoff text before deciding whether to continue or repair.

## Background Sub-Agents

You may launch `Agent(prompt: "research this", description: "Explore the question", subagent_type: "explore", run_in_background: true)` as a background investigation while continuing other work. Background agents run concurrently and report back.

## How to Invoke a Specialist Persona

1. `Skill(skill="adventurer")` - Load the specialist persona (defines constraints, rules, and subagent profile for that role)
2. `Agent(prompt: "...", description: "Short task label", subagent_type: "coder")` - Delegate a unit of work to the mapped built-in profile
3. `AgentSwarm(description: "...", subagent_type: "coder", prompt_template: "... {{item}} ...", items: [...])` - Delegate uniform items in parallel

### Subagent profiles

The `explore` subagent has read-only search tools, the `coder` subagent has full Write/Edit access, and the `plan` subagent is read-only without shell access.

### Single-agent pattern

```
// 1. Load the persona
const result = await Skill(skill: "diagnose");
if (result.status !== "ok") { AskUserQuestion("..."); return; }

// 2. Dispatch the task
const output = await Agent(
  prompt: "Find why X fails",
  description: "Diagnose failure",
  subagent_type: "coder"
);
if (output.result) { /* use the complete handoff */ }
```

### Swarm pattern

```
const results = await AgentSwarm(
  description: "Update independent files",
  subagent_type: "coder",
  prompt_template: "Update {{item}} and run its focused checks.",
  items: ["src/a.ts", "src/b.ts", "src/c.ts"]
);
// Read the XML result envelope and handle failed items explicitly.
```

## Anti-Patterns

**Tool-call bundling with AgentSwarm** - Swarm agents are autonomous; don't micromanage their tool calls.

## Skill Loading

### Pre-load before dispatch

Before delegating to a specialist via `Skill`, load the skill first. If the `Skill` tool is not available to the subagent profile, inline the persona's core content directly:

Child skill availability varies by Kimi version and profile. Preload global-rules and the full role skill in the parent, then inline both with the task constraints for every child; do not rely on plan or explore children having Skill.

### Miss handling

If a subagent reports it cannot find a skill, load it via `Skill` first, or install it if needed. Never rely on the subagent to have skills pre-loaded.

## Handoff

To compact the conversation for transfer, output:

```
## State
- Done: [list]
- Pending: [list]
- Blockers: [list]
- Stack: [files changed, decisions made, key context]
```

This should appear at the end of your response when the user asks for a handoff, or when context pressure requires a fresh agent.
