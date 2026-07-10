# @maestria/hermes - Hermes Plugin for Maestria Methodology

## Purpose

Bring the maestria methodology (7-specialist pipeline, maker/checker split, mode system) to the Hermes AI agent platform. Unlike @maestria/opencode which is domain-locked to software engineering, this plugin generalizes specialists to work across any domain - research, content, analysis, strategy, and coding.

Coding-specific work routes to the OpenCode CLI as an optional power-up, not a hard dependency.

## Architecture

Hermes has a native `delegate_task` tool (~139K lines of implementation) for spawning subagents. The maestria pipeline model works natively - no custom subagent mechanism needed.


```
User request
  - Hermes orchestrator (classify, select pipeline, delegate_task)
    - delegate_task(adventurer, brief)
    - delegate_task(architect, brief)
    - delegate_task(builder, brief)
    - delegate_task(diagnose, brief)
    - delegate_task(planner, brief)
    - delegate_task(reviewer, brief)
    - delegate_task(writer, brief)
  - Synthesize results via ctx.llm
  - Present to user
```

Each specialist runs as a Hermes subagent with its own toolset (restricted by pre_tool_call hook), access to `ctx.llm.complete_structured()` for independent reasoning, and structured handoff briefs from the orchestrator.

OpenCode CLI is only needed when the Builder needs a dedicated coding sandbox for complex multi-file work. For simple coding tasks, Hermes' own tools (edit, write, bash) suffice.

## Key Difference from @maestria/opencode

Both plugins use the same pipeline composition, mode system, and maker/checker split. The difference is domain scope and platform-native features.

| Aspect         | @maestria/opencode        | @maestria/hermes                               |
| -------------- | ------------------------- | ---------------------------------------------- |
| Primary domain | Software engineering      | Any domain                                     |
| Adventurer     | Explores codebases        | Web, docs, data, code, systems                 |
| Architect      | Designs software          | Any solution - systems, processes, content     |
| Builder        | Edits code files          | Creates in any medium. Can route to OpenCode   |
| Diagnose       | Debugs code bugs          | Any problem type                               |
| Planner        | Plans coding work         | Any multi-step work                            |
| Reviewer       | Reviews code              | Code, docs, plans, designs                     |
| Writer         | Writes docs               | Same (already general-purpose)                 |
| Modes          | fein/sonar/blitz (coding) | fein/sonar/blitz (work style, domain-agnostic) |
| Tooling        | OpenCode tools only       | Hermes tools + optional OpenCode CLI           |
| Subagents      | task() function           | Hermes native delegate_task                    |
| Reasoning      | LLM via tool calls        | ctx.llm.complete_structured() (JSON schema)    |
| Permissions    | YAML frontmatter          | pre_tool_call hook                             |

## Hermes Platform Capabilities

| Capability | Plugin Usage |
| --- | --- |
| `delegate_task` | Native subagent dispatch. Supports background/async |
| `ctx.llm.complete()` | Host LLM for specialist reasoning and content generation |
| `ctx.llm.complete_structured()` | Structured JSON output via schema. Used by architect, planner, reviewer |
| `ctx.inject_message()` | Insert specialist findings or progress into the conversation |
| `ctx.register_auxiliary_task()` | Sidecar LLM tasks for background specialist reasoning |
| `ctx.register_skill()` | Register namespaced skills as `<plugin>:<skill>` |
| `ctx.register_command()` | Slash command registration |
| `ctx.dispatch_tool()` | Programmatic tool invocation |
| `pre_llm_call` hook | Mode injection into user message (preserves prompt cache) |
| `pre/post_tool_call` hooks | Permission gating and dispatch auditing |
| `transform_tool_result` hook | Transform tool output before model sees it |
| `transform_llm_output` hook | Multi-specialist output synthesis |
| `transform_terminal_output` hook | Shell output transformation |
| `subagent_start/stop` hooks | Pipeline lifecycle tracking |
| `pre_gateway_dispatch` hook | Gateway message interception |
| `kanban_task_*` hooks | Kanban integration (claimed/completed/blocked) |
| Middleware (4 kinds) | tool_request, tool_execution, llm_request, llm_execution |
| MCP client/server | stdio/HTTP-SSE, OAuth, mTLS, dynamic tool discovery |
| plugin.yaml trust gates | Provider/model/agent_id/profile override controls |
| Skills system | YAML-frontmatter markdown, namespaced per plugin |
| 70+ built-in tools | File ops, terminal (6 backends), browser (5), web search (8), code sandbox, vision, MCP, kanban, todo, cron, home assistant, image/video gen, TTS/STT, process, network |
| 8 memory providers | holographic (SQLite FTS5), mem0, supermemory, retaindb, openviking, hindsight, byterover, honcho |

### Middleware Kinds

| Middleware | Trigger | Plugin Use |
| --- | --- | --- |
| `tool_request` | Before tool call is initiated | Mode gating (block edit/write in sonar) |
| `tool_execution` | Wraps tool execution | Timing, logging, result transformation |
| `llm_request` | Before LLM call | Inject methodology into every LLM request |
| `llm_execution` | Wraps LLM call | Response validation, structured output enforcement |

## Specialist Roster

All 7 maestria specialists, generalized to work across any domain.

### Adventurer

Explore, research, and gather information.

| Aspect    | Detail                                                           |
| --------- | ---------------------------------------------------------------- |
| Tools     | webfetch, web_search, browser_navigate, grep, glob, read, python |
| Reasoning | `ctx.llm.complete()` to summarize findings                       |
| Guard     | May not make decisions or produce final artifacts                |

### Architect

Design solutions and evaluate options.

| Aspect    | Detail                                                          |
| --------- | --------------------------------------------------------------- |
| Tools     | `ctx.llm.complete_structured()` with decision framework schemas |
| Reasoning | Structured evaluation with weighted criteria                    |
| Guard     | May not implement                                               |

### Builder

Create output and implement solutions.

| Aspect           | Detail                                                                  |
| ---------------- | ----------------------------------------------------------------------- |
| Tools            | Hermes edit/write/bash for direct work. OpenCode CLI for complex coding |
| Reasoning        | `ctx.llm.complete()` for implementation planning                        |
| OpenCode routing | Complex multi-file tasks delegate to OpenCode CLI                       |
| Guard            | Output is reviewed by Reviewer before delivery                          |

### Diagnose

Find root causes and investigate problems.

| Aspect           | Detail                                                              |
| ---------------- | ------------------------------------------------------------------- |
| Tools            | grep, read, bash, data analysis. OpenCode CLI for complex debugging |
| Reasoning        | `ctx.llm.complete_structured()` for root cause analysis             |
| OpenCode routing | Complex debugging sessions delegate to OpenCode CLI                 |

### Planner

Plan multi-step work and order tasks.

| Aspect    | Detail                                               |
| --------- | ---------------------------------------------------- |
| Tools     | `ctx.llm.complete_structured()` for planning schemas |
| Reasoning | Dependency analysis with milestone breakdown         |
| Guard     | Plans are reviewed by Reviewer before execution      |

### Reviewer

Validate output quality.

| Aspect | Detail                                                           |
| ------ | ---------------------------------------------------------------- |
| Tools  | read, diff, `ctx.llm.complete_structured()` with review criteria |
| Guard  | Blocked from edit/write via pre_tool_call (maker/checker split)  |

### Writer

Create documentation and content.

| Aspect | Detail                                                    |
| ------ | --------------------------------------------------------- |
| Tools  | `ctx.llm.complete()` for writing, templates for structure |
| Guard  | Output is reviewed by Reviewer                            |

## How Specialists Use Hermes Features

| Specialist | Key Hermes Features Used | Toolset |
| --- | --- | --- |
| Adventurer | webfetch, browser, web_search, `ctx.llm.complete()` | Read-only |
| Architect | `ctx.llm.complete_structured()`, `ctx.register_auxiliary_task()` | Read + ctx.llm |
| Builder | edit, write, bash, `ctx.llm.complete()`, `ctx.inject_message()` | Full tools |
| Diagnose | grep, read, bash, `ctx.llm.complete_structured()`, auxiliary tasks | Read + ctx.llm |
| Planner | `ctx.llm.complete_structured()`, `ctx.dispatch_tool(delegate_task)` | Read + ctx.llm |
| Reviewer | read, diff, `ctx.llm.complete_structured()` | Read-only (edit/write blocked by hook) |
| Writer | `ctx.llm.complete()`, `ctx.llm.complete_structured()` | Read + ctx.llm |

## Mode System

Modes describe work style, not domain.

| Mode  | Pipeline                                          | Purpose                           |
| ----- | ------------------------------------------------- | --------------------------------- |
| fein  | Full pipeline (explore - design - build - review) | Thorough, gated execution         |
| sonar | Explore - design/analyze - stop                   | Research only, no creation        |
| blitz | Build directly                                    | Fast execution on known territory |

Mode state persists to `.hermes-maestria/mode` and is injected into the user message by `pre_llm_call` (not system prompt - preserves prompt cache).

### Hook Injection Format

```
[MODE: fein]
Full pipeline: explore context, design, implement, review.
Do not skip stages.
```

### Slash Commands

| Command   | Action                        |
| --------- | ----------------------------- |
| `/fein`   | Set fein mode                 |
| `/sonar`  | Set sonar mode                |
| `/blitz`  | Set blitz mode                |
| `/review` | Trigger review of last output |
| `/plan`   | Trigger planning session      |

## Pipeline Sequences

| Work type         | Pipeline                                               |
| ----------------- | ------------------------------------------------------ |
| Research question | adventurer - writer - reviewer                         |
| Decision/design   | adventurer - architect - writer - reviewer             |
| Implementation    | adventurer - architect - builder - reviewer            |
| Bug/issue         | diagnose - builder - reviewer                          |
| Planning          | adventurer - planner - reviewer                        |
| Content           | adventurer - writer - reviewer                         |
| Complex coding    | adventurer - architect - builder (OpenCode) - reviewer |

## Hermes Feature Deep Dive

### Native delegate_task

The orchestrator dispatches specialists via `ctx.dispatch_tool("delegate_task", brief)`. Delegation includes a structured brief with context, constraints, and output format. Supports background/async for parallel specialist work. `subagent_start` and `subagent_stop` hooks monitor the lifecycle.

```
ctx.dispatch_tool("delegate_task", {
    "task": brief_context,
    "tools": specialist.allowed_tools,
    "context": {"mode": read_mode_file(), "pipeline": pipeline_id},
})
```

### ctx.llm.complete_structured()

Plugin specialists make their own LLM calls using host credentials. JSON schema enforces structured output - no verbose tool-based reasoning needed.

```
result = ctx.llm.complete_structured(
    prompt="Evaluate these options against our constraints",
    schema={
        "type": "object",
        "properties": {
            "options": {"type": "array", "items": {"type": "string"}},
            "recommendation": {"type": "string"},
            "rationale": {"type": "string"},
            "confidence": {"type": "number"}
        },
        "required": ["options", "recommendation", "rationale"]
    }
)
```

Trust gates in plugin.yaml control LLM access: `plugins.entries.<name>.llm.allow_provider_override`, `allow_model_override`, `allow_agent_id_override`, `allow_profile_override`.

### Memory Providers (8 Built-in)

| Provider | Type | Use Case |
| --- | --- | --- |
| holographic | Local SQLite FTS5 | Offline-first, no server |
| mem0 | Server-side | Cross-session persistent memory |
| supermemory | Server-side | Long-term knowledge base |
| retaindb, openviking, hindsight, byterover, honcho | Server-side | Various backends |

The plugin can register its own provider or use existing ones. Works with `ctx.llm.complete_structured()` for fact extraction across sessions.

### All Lifecycle Hooks (22)

The plugin uses hooks to implement the methodology:

| Hook | Phase | Plugin Use |
| --- | --- | --- |
| `pre_llm_call` | Before LLM | Mode injection into user message |
| `post_llm_call` | After LLM | Tag output with specialist metadata |
| `pre_tool_call` | Before tool | Permission gating by mode and specialist |
| `post_tool_call` | After tool | Audit logging, result capture |
| `pre_gateway_dispatch` | Gateway | Message interception |
| `subagent_start/stop` | Subagent lifecycle | Pipeline tracking, duration logging |
| `transform_llm_output` | Output | Multi-specialist synthesis |
| `transform_tool_result` | Tool output | Security annotations, methodology markers |
| `transform_terminal_output` | Terminal | Shell output sanitization |
| `kanban_task_claimed/completed/blocked` | Kanban | Task lifecycle tracking |
| (plus 9 standard session and agent lifecycle hooks) |  |  |

### Middleware (4 Kinds)

- **tool_request** - Mode gating. Block edit/write in sonar. Block destructive tools in review mode. Return modified request or block with message.
- **tool_execution** - Timing, logging, result transformation for all tools.
- **llm_request** - Inject methodology context into every LLM request without modifying the system prompt.
- **llm_execution** - Response validation, structured output enforcement.

### MCP Integration

Full MCP client with stdio and HTTP-SSE transports, OAuth, mTLS, and dynamic tool discovery. Hermes can also act as an MCP server (`hermes mcp serve`). Plugin usage: register MCP servers for external tool access, expose plugin tools as MCP, permission-gate MCP tools per specialist via pre_tool_call.

### Skills System

Skills are YAML-frontmatter markdown files. Registered via `ctx.register_skill(name, content, description)`. Plugin skills are namespaced - they don't enter the flat skills tree. Accessible only as `<plugin_name>:<skill_name>` (e.g., `hermes-maestria:orchestrator`).

### ctx.inject_message()

Inject messages into the active conversation for:

- Reporting specialist findings mid-pipeline
- Progress updates during long-running tasks
- Inserting structured results from parallel delegate_task calls

### ctx.register_auxiliary_task()

Register sidecar LLM tasks for background reasoning:

```python
task_id = ctx.register_auxiliary_task(
    name="evaluate_option_a",
    prompt="Evaluate option A against our constraints",
    schema=evaluation_schema
)
```

Collect results when all complete.

## OpenCode Composition

OpenCode CLI is a tool available to specialists, not a separate layer:

1. Builder (or Diagnose) evaluates task complexity
2. Simple tasks: use Hermes tools directly (edit, write, bash)
3. Complex/multi-file/risky: route to OpenCode CLI with structured brief
4. Verify @maestria/opencode is configured in the target OpenCode instance
5. Results flow back for review and integration

```python
def delegate_to_opencode(task_brief, cwd):
    if not which("opencode"):
        return {"success": False, "error": "OpenCode CLI not found"}
    result = subprocess.run(
        ["opencode", "--cwd", cwd, task_brief],
        capture_output=True, timeout=300
    )
    return {"success": result.returncode == 0,
            "stdout": result.stdout, "stderr": result.stderr}
```

## Maestria Pattern Integration

### Pipeline Composition via delegate_task

The orchestrator dispatches specialists via delegate_task. The brief contains role, tool access list, context from prior stages, output format spec, and iteration limits. Each specialist runs as a Hermes subagent with restricted tool access.

### Maker/Checker Split via pre_tool_call

The Reviewer's pre_tool_call hook blocks edit/write:

```python
def pre_tool_call(ctx, tool_name, tool_args):
    if ctx.current_subagent == "reviewer" and tool_name in ("edit", "write"):
        return {"action": "block",
                "message": "Reviewers cannot modify output."}
    if read_mode_file() == "sonar" and tool_name in ("edit", "write", "bash"):
        return {"action": "block",
                "message": "Sonar mode: read only."}
    return {"action": "allow"}
```

### Specialist Reasoning via ctx.llm

Each specialist uses `ctx.llm.complete_structured()` instead of verbose tool-based reasoning. Structured JSON schemas ensure machine-readable handoffs. This reduces token usage and provides cleaner output.

## Phase 1 (v0.1): Core Loop

Minimum viable plugin proving the methodology works in Hermes.

### Deliverables

- Plugin scaffold (plugin.yaml + **init**.py with register())
- Mode system with file persistence
- pre_llm_call hook for mode injection into user message
- pre_tool_call hook for sonar guard (block edit/write in research mode)
- tool_request middleware for mode gating
- 4 skills: orchestrator, builder, reviewer, global-rules
- Slash commands: /fein, /sonar, /blitz, /review, /plan
- OpenCode CLI routing (optional)

### Scaffold Layout

```
.hermes-maestria/
  plugin.yaml          # Plugin manifest
  mode                 # Current mode file
  state.json           # Session state
skills/
  orchestrator.md      # Orchestrator skill
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
- Mode switching persists across messages
- pre_llm_call injects mode context into user message
- pre_tool_call blocks edit/write in sonar mode
- Builder completes simple edits with Hermes tools
- Builder routes coding tasks to OpenCode CLI and captures results
- Reviewer inspects output and reports findings

## Phase 2 (v0.2): Full Roster

All 7 specialists with full skill files and Hermes-native features.

### Deliverables

- Adventurer, architect, diagnose, planner, writer skill files
- Permission profiles in pre_tool_call (per specialist and per mode)
- Each specialist uses `ctx.llm.complete_structured()` for reasoning
- delegate_task for subagent dispatch (native Hermes tool)
- subagent_start/stop hooks for pipeline tracking
- OpenCode lifecycle management (install check, config sync)
- Memory integration (store decisions, user preferences, project context)
- transform_tool_result hook for methodology annotations
- Session state persistence

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
| ctx.llm        | allowed | allowed | allowed |
| delegate_task  | allowed | allowed | blocked |
| opencode (CLI) | allowed | blocked | allowed |

### Pipeline Orchestration

```python
def orchestrate_pipeline(ctx, pipeline, task):
    results = {}
    for specialist_name in pipeline:
        specialist = load_specialist(specialist_name)
        brief = format_brief(specialist, task, results)
        result = ctx.dispatch_tool("delegate_task", {
            "task": specialist.prompt + brief,
            "tools": specialist.allowed_tools,
            "context": {"mode": read_mode_file()},
        })
        results[specialist_name] = result
    return synthesize(ctx, results)
```

### Success Criteria

- All 7 specialists dispatch from orchestrator
- Permission profiles enforce correct tool access per mode
- Each specialist uses `ctx.llm.complete_structured()` for reasoning
- subagent_start/stop hooks track pipeline progression
- Multi-specialist pipelines complete end-to-end
- Session state persists across conversations
- OpenCode routing works with @maestria/opencode loaded
- Memory stores and retrieves decisions across sessions

## Phase 3 (v0.3): Advanced

Polished multi-tool orchestration with all Hermes features.

### Deliverables

| Feature                        | Detail                                                 |
| ------------------------------ | ------------------------------------------------------ |
| Memory provider integration    | holographic or mem0 for persistent context             |
| MCP server integration         | Expose plugin tools as MCP, consume external MCP tools |
| llm_request middleware         | Inject methodology context into every LLM request      |
| llm_execution middleware       | Structured output enforcement                          |
| transform_llm_output synthesis | Specialist attribution in responses                    |
| Parallel delegation            | Concurrent specialist dispatch                         |
| Auxiliary tasks                | Background reasoning for architect, diagnose, planner  |
| ctx.inject_message()           | Progress reporting during long pipelines               |
| Kanban task hooks              | Pipeline state via claimed/completed/blocked           |
| Performance monitoring         | Per-specialist metrics (duration, tool calls, tokens)  |
| Plugin trust gates             | LLM access restrictions per specialist                 |

### Middleware Example: llm_request

```python
def methodology_context_middleware(ctx, llm_request):
    mode = read_mode_file()
    specialist = llm_request.get("specialist", "unknown")
    llm_request["messages"].insert(0, {
        "role": "system",
        "content": f"You are the {specialist} in mode {mode}."
    })
    return llm_request
```

### Memory Integration

```python
def store_decision(ctx, specialist, decision):
    ctx.dispatch_tool("memory.store", {
        "provider": "holographic",
        "key": f"decision:{specialist}:{timestamp()}",
        "value": {"specialist": specialist, "decision": decision}
    })

def retrieve_decisions(ctx, specialist):
    return ctx.dispatch_tool("memory.search", {
        "provider": "holographic",
        "query": f"decision:{specialist}", "limit": 10
    })
```

## Open Questions

1. Does @maestria/opencode load automatically when OpenCode CLI is invoked, or must the Hermes plugin configure it explicitly?

2. Can `ctx.llm` be used for multi-turn reasoning (multiple LLM calls sharing a context) within a single specialist?

3. How does delegate_task handle structured output from subagents? Is there an output schema enforcement mechanism?

4. What is the fallback when OpenCode CLI is not installed? Builder should degrade gracefully to Hermes-native tools.

5. Can transform_llm_output distinguish which specialist produced which part of the response?

6. Does Hermes support toolset-based grouping (namespacing plugin tools separately from built-in tools)?

7. How does the Kanban system interact with mode switching and pipeline execution?

8. Does `ctx.llm.complete_structured()` support streaming structured output or only complete JSON responses?

9. Can the plugin register custom tool definitions in tool discovery, or are plugins limited to hooks and middleware?

10. How do pre_gateway_dispatch and subagent_start/stop interact? Do gateway messages reach subagents?
