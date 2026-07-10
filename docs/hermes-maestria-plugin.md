# @maestria/hermes - Hermes Plugin for Maestria Methodology

## Purpose

Bring the maestria methodology (7-specialist pipeline, maker/checker split, mode system) to the Hermes AI agent (github.com/NousResearch/hermes-agent). Unlike `@maestria/opencode` which is domain-locked to software engineering, this plugin generalizes specialists to work across any domain - research, content, analysis, strategy, and coding.

Coding-specific work routes to the OpenCode CLI as an optional power-up, not a hard dependency.

## Architecture Model: Hybrid

The plugin is a full maestria methodology implementation. All 7 specialists are present and generalized for a general-purpose agent. OpenCode CLI is an optional tool available to the Builder and Diagnose specialists.


```
User request
  - Hermes orchestrator (classify, route, pipeline)
    - Specialists: adventurer, architect, builder, diagnose,
      planner, reviewer, writer
    - All specialists work at a general-purpose level
    - Builder can code directly (Hermes edit/write/bash) or route
      to OpenCode CLI for complex coding tasks
    - Diagnose can debug directly or route to OpenCode for
      complex debugging sessions
  - Synthesize results
  - Present to user
```

## Key Difference from @maestria/opencode

The difference is domain scope, not architecture. Both plugins use the same pipeline composition, mode system, and maker/checker split patterns.

| Aspect         | @maestria/opencode        | @maestria/hermes                                   |
| -------------- | ------------------------- | -------------------------------------------------- |
| Primary domain | Software engineering      | Any domain                                         |
| Adventurer     | Explores codebases        | Explores anything - web, docs, data, code, systems |
| Architect      | Designs software          | Designs any solution - systems, processes, content |
| Builder        | Edits code files          | Creates in any medium. Can route to OpenCode       |
| Diagnose       | Debugs code bugs          | Finds root causes for any problem type             |
| Planner        | Plans coding work         | Plans any multi-step work                          |
| Reviewer       | Reviews code              | Validates any output - code, docs, plans           |
| Writer         | Writes docs               | Same - already general-purpose                     |
| Modes          | fein/sonar/blitz (coding) | fein/sonar/blitz (work style, domain-agnostic)     |
| Tooling        | OpenCode tools only       | Hermes tools + optional OpenCode CLI               |

## Hermes Platform Capabilities

| Capability | Usage in Plugin |
| --- | --- |
| `ctx.llm` | Host-owned LLM facade. Specialists use this for independent reasoning, analysis, and content generation |
| `ctx.dispatch_tool()` | Programmatic tool invocation from within specialists |
| `ctx.inject_message()` | Inject specialist output into the conversation |
| `transform_llm_output` hook | Rewrite final LLM response for synthesis across multiple specialists |
| `pre_tool_call` / `post_tool_call` hooks | Permission gating and tool dispatch auditing |
| `pre_llm_call` hook | Mode directive injection into the system message |
| Middleware | Wrap tool and LLM calls for cross-cutting concerns (timing, logging) |
| Skill system | YAML-frontmatter markdown files for each specialist prompt |
| 40+ built-in tools | read, write, edit, bash, grep, glob, webfetch, web_search, browser, python, process, and more |
| Slash commands | Quick user-triggered actions (mode switches, reviews, plans) |

## Specialist Roster

All 7 maestria specialists, generalized to work across any domain. Each specialist is defined by its role, not its domain.

### Adventurer

Explore, research, and gather information from any source.

| Aspect | Detail                                                           |
| ------ | ---------------------------------------------------------------- |
| Tools  | webfetch, web_search, browser_navigate, grep, glob, read, python |
| Output | Structured findings report with sources and confidence levels    |
| Domain | Any - codebases, documentation, web, data, systems               |
| Guard  | May not make decisions or produce final artifacts                |

### Architect

Design solutions, evaluate options, and make decisions.

| Aspect | Detail                                                  |
| ------ | ------------------------------------------------------- |
| Tools  | `ctx.llm` for structured reasoning, decision frameworks |
| Output | Architecture decisions, ADRs, design documents          |
| Domain | Any - software, processes, content structure, strategy  |
| Guard  | May not implement; hands off to Builder                 |

### Builder

Create output and implement solutions.

| Aspect | Detail |
| --- | --- |
| Tools | Hermes tools (edit, write, bash) for direct creation. OpenCode CLI for complex coding |
| Output | Code, documents, data, configurations |
| Domain | Any - code, documentation, data processing |
| OpenCode routing | Complex/multi-file coding tasks delegate to OpenCode CLI with `@maestria/opencode` loaded |
| Guard | Output is reviewed by Reviewer before delivery |

### Diagnose

Find root causes and investigate problems.

| Aspect           | Detail                                                              |
| ---------------- | ------------------------------------------------------------------- |
| Tools            | grep, read, bash, data analysis. OpenCode CLI for complex debugging |
| Output           | Root cause analysis with fix recommendations                        |
| Domain           | Any - software bugs, process issues, data quality                   |
| OpenCode routing | Complex debugging sessions delegate to OpenCode CLI                 |

### Planner

Plan multi-step work, order tasks, and identify dependencies.

| Aspect | Detail                                                 |
| ------ | ------------------------------------------------------ |
| Tools  | `ctx.llm` for structured planning, dependency analysis |
| Output | Implementation plans with phased milestones            |
| Domain | Any - project plans, migration plans, content roadmaps |
| Guard  | Plans are reviewed by Reviewer before execution        |

### Reviewer

Validate output quality and check for issues.

| Aspect | Detail                                                 |
| ------ | ------------------------------------------------------ |
| Tools  | read, diff, checklist methodology                      |
| Output | Review findings with [fix]/[dismiss]/[escalate] labels |
| Domain | Any - code review, document review, plan validation    |
| Guard  | Never reviews own work (maker/checker split)           |

### Writer

Create clear, structured documentation and content.

| Aspect | Detail                                                |
| ------ | ----------------------------------------------------- |
| Tools  | `ctx.llm` for writing, templates for structure        |
| Output | Documentation, articles, reports, changelogs          |
| Domain | Any - technical docs, product content, communications |
| Guard  | Output is reviewed by Reviewer before delivery        |

## Mode System

Modes describe work style, not domain. They apply universally regardless of what type of work is being done.

| Mode | Pipeline | Purpose |
| --- | --- | --- |
| fein | Full pipeline (adventurer - architect/planner - builder - reviewer) | Thorough, gated execution |
| sonar | Adventurer - architect/planner - stop | Research only, no creation |
| blitz | Builder directly (skip recon/design/review) | Fast execution on known territory |

Mode state persists to `.hermes-maestria/mode` and is injected into the system message by the `pre_llm_call` hook.

### Slash Commands

`/fein` - Set fein mode. Full pipeline execution. `/sonar` - Set sonar mode. Research only. `/blitz` - Set blitz mode. Fast execution. `/review` - Trigger a review of the last output. `/plan` - Trigger a planning session.

### Hook Injection

```
[MODE: fein]
Full pipeline: explore context, design solution, implement, review.
Each stage gates the next. Do not skip stages.
```

## Pipelines

Domain-agnostic pipeline sequences. The orchestrator classifies the request, selects the pipeline, sequences specialists, and synthesizes results.

| Work type | Pipeline | Notes |
| --- | --- | --- |
| Research question | adventurer - writer - reviewer | Gather info, synthesize, verify |
| Decision/design | adventurer - architect - writer - reviewer | Explore options, design, document, check |
| Implementation | adventurer - architect - builder - reviewer | Full build pipeline |
| Bug/issue | diagnose - builder - reviewer | Find root cause, fix, verify |
| Planning | adventurer - planner - reviewer | Explore context, plan, validate |
| Content | adventurer - writer - reviewer | Research, create, check |
| Complex coding | adventurer - architect - builder (OpenCode) - reviewer | Builder routes to OpenCode when beneficial |

## OpenCode Composition

OpenCode CLI is a tool available to specialists, not a separate architecture layer. The pattern is:

1. Builder (or Diagnose) evaluates task complexity
2. Simple/known patterns: use Hermes tools directly (edit, write, bash)
3. Complex/multi-file/risky: route to OpenCode CLI with a structured brief
4. Before routing, verify `@maestria/opencode` is configured in the target OpenCode instance
5. Results flow back to the Hermes pipeline for review and integration

The OpenCode bridge logic:

```
function delegate_to_opencode(task_brief, cwd):
    if opencode not installed:
        return error("OpenCode CLI not found")
    result = subprocess.run(
        ["opencode", "--cwd", cwd, task_brief],
        capture_output=True, timeout=300
    )
    return {
        "success": result.exit_code == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }
```

## Phase 1 (v0.1): Foundation

Core plugin that proves the methodology works in Hermes.

### Deliverables

- `plugin.yaml` + `__init__.py` with `register()`
- Mode system (fein/sonar/blitz) with file persistence
- `pre_llm_call` hook for mode injection into system message
- 4 skills: orchestrator, builder, reviewer, global-rules
- OpenCode routing tool (invoke CLI, capture results)
- 5 slash commands: `/fein`, `/sonar`, `/blitz`, `/review`, `/plan`

### Scaffold Layout

```
.hermes-maestria/
  plugin.yaml          # Plugin manifest
  mode                 # Current mode file
  state.json           # Session state
skills/
  orchestrator.md      # Orchestrator skill prompt
  builder.md           # Builder specialist
  reviewer.md          # Reviewer specialist
  global-rules.md      # Cross-cutting rules
plugin/
  __init__.py          # register() entry point
  hooks.py             # Hook handlers
  modes.py             # Mode system with persistence
  opencode_bridge.py   # OpenCode CLI delegation
```

### plugin.yaml

```yaml
name: hermes-maestria
version: 0.1.0
hooks:
  - pre_llm_call
  - post_llm_call
  - pre_tool_call
  - post_tool_call
  - transform_llm_output
commands:
  - /fein
  - /sonar
  - /blitz
  - /review
  - /plan
skills:
  - orchestrator.md
  - builder.md
  - reviewer.md
  - global-rules.md
```

### register()

```python
def register():
    return {
        "name": "hermes-maestria",
        "version": "0.1.0",
        "hooks": {
            "pre_llm_call": inject_mode_directive,
            "post_llm_call": tag_llm_output,
            "pre_tool_call": check_permissions,
            "post_tool_call": record_dispatch,
            "transform_llm_output": synthesize_output,
        },
        "commands": {
            "/fein": lambda ctx: set_mode(ctx, "fein"),
            "/sonar": lambda ctx: set_mode(ctx, "sonar"),
            "/blitz": lambda ctx: set_mode(ctx, "blitz"),
            "/review": lambda ctx: trigger_review(ctx),
            "/plan": lambda ctx: trigger_plan(ctx),
        },
        "skills": [
            "orchestrator.md",
            "builder.md",
            "reviewer.md",
            "global-rules.md",
        ],
    }
```

### Success Criteria

- Plugin loads into Hermes without errors
- Mode switching works correctly and persists across messages
- `pre_llm_call` injects mode context into system message
- Builder can complete a simple edit task using Hermes tools
- Builder can route a coding task to OpenCode CLI and capture results
- Reviewer can inspect output and report findings

## Phase 2 (v0.2): Full Roster

All 7 specialists with generalized skill files.

### Deliverables

- Adventurer, architect, diagnose, planner, writer skill files
- Full permission profiles enforced via `pre_tool_call` hook
- All slash commands for all specialists
- OpenCode lifecycle management (install check, config sync for `@maestria/opencode`)
- Result synthesis pipeline (combine outputs from multiple specialists)
- Session state hooks (`on_session_start` / `on_session_end`)

### Permission Profiles

| Tool           | fein    | sonar   | blitz   |
| -------------- | ------- | ------- | ------- |
| webfetch       | allowed | allowed | blocked |
| web_search     | allowed | allowed | blocked |
| browser        | allowed | allowed | blocked |
| grep/glob/read | allowed | allowed | allowed |
| python         | allowed | blocked | allowed |
| bash           | allowed | blocked | allowed |
| edit/write     | allowed | blocked | allowed |
| opencode (CLI) | allowed | blocked | allowed |

### Pipeline Orchestration

```python
def orchestrate_pipeline(ctx, pipeline, task):
    results = {}
    for specialist_name in pipeline:
        specialist = load_specialist(specialist_name)
        brief = format_brief(specialist, task, results)
        result = ctx.dispatch_tool("skill", brief)
        results[specialist_name] = result
    return synthesize(ctx, results)
```

### Success Criteria

- All 7 specialists can be dispatched from the orchestrator
- Permission profiles enforce correct tool access per mode
- OpenCode routing works with `@maestria/opencode` loaded in the target OpenCode instance
- Multi-specialist pipelines complete end-to-end (e.g., adventurer - planner - reviewer)
- Session state persists across conversations

## Phase 3 (v0.3): Advanced

Polished multi-tool orchestration.

### Deliverables

| Feature | Detail |
| --- | --- |
| Parallel delegation | Concurrent specialist dispatch for independent work streams |
| MCP server integration | External tool access via MCP, permission-gated per specialist |
| Memory and context management | Cross-session persistence for decisions, preferences, patterns |
| `transform_llm_output` synthesis | Methodology-aware response formatting with specialist attribution |
| Middleware system | Cross-cutting wrappers for timing, logging, rate limiting on hooks |
| Performance monitoring | Per-specialist metrics (duration, tool calls, token usage) |

## Maestria Pattern Integration

### Keep as-is (universal patterns)

- **Pipeline Composition** - sequence specialists with structured handoffs
- **Maker/Checker Split** - writer != reviewer, builder != reviewer. Never the same specialist validates its own work
- **Handoff Contracts** - structured briefings between pipeline stages with required context, dependencies, and output format
- **Iteration Limits** - maximum 3 proofread-revise cycles per stage before escalation
- **Mode System** - fein/sonar/blitz describe work style, not domain
- **Skill Prescription** - always-load and load-on-trigger skill rules per specialist
- **Completion Promises** - define verifiable success criteria before starting work

### Adapted for Hermes platform

| Maestria pattern  | OpenCode plugin        | Hermes plugin                               |
| ----------------- | ---------------------- | ------------------------------------------- |
| Tools             | opensrc, lsp           | webfetch, web_search, browser equivalents   |
| Permission model  | YAML frontmatter       | `pre_tool_call` hook                        |
| Delegation        | `task()` subagent call | `ctx.dispatch_tool()` + OpenCode CLI        |
| Context injection | `chat.message` hook    | `pre_llm_call` returning `{"context": ...}` |
| Skills            | Frontmatter + markdown | YAML-frontmatter markdown (same format)     |

### What is different from OpenCode plugin

- Specialists are general-purpose, not coding-focused. Adventurer explores the web, not just codebases. Architect designs any solution, not just software.
- Builder can route to OpenCode CLI for complex coding (not just use direct edit/write tools)
- No commit protocol - git operations are OpenCode's responsibility when routed
- Specialists use `ctx.llm` for independent reasoning (the host model, not a sub-process)
- Mode to specialist mapping is more flexible - any specialist can participate in any pipeline

## Open Questions

1. Does `@maestria/opencode` load automatically when OpenCode CLI is invoked, or does the Hermes plugin need to configure it explicitly?

2. Can `ctx.llm` be used for multi-turn reasoning (a specialist thinking through a problem across multiple LLM calls)?

3. How does `ctx.dispatch_tool()` handle errors from the delegated tool? Is there a standard error contract?

4. What is the fallback behavior when OpenCode CLI is not installed? (Builder should degrade gracefully to Hermes-native tools.)

5. Can the `transform_llm_output` hook distinguish between responses from different specialists?

6. Does Hermes support tool registration with toolset-based grouping (namespacing maestria specialists' tools from built-in tools)?

7. How does the Hermes Kanban system interact with mode switching and pipeline execution?
