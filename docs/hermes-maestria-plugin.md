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

## Open Questions (Resolved)

All questions answered against Hermes Agent source code (v0.17.0, July 2026).

### Q1: @maestria/opencode auto-loading

**Resolved: No. The Hermes plugin must configure it explicitly.**

The Hermes codebase has zero references to @maestria/opencode. The bundled opencode skill (`skills/autonomous-ai-agents/opencode/SKILL.md`) is for the `opencode` CLI tool (opencode.ai) -- a different product. The Hermes plugin's OpenCode routing tool must check/configure @maestria/opencode in the target OpenCode instance before delegating.

**Implementation guidance:** Before delegating to OpenCode CLI, the Builder specialist should verify that @maestria/opencode is in the OpenCode plugin configuration. This can be done by checking `cat ~/.config/opencode/opencode.json` for the presence of `@maestria/opencode` in the plugins list, or by running `opencode config get plugins` if such a command exists.

### Q2: Multi-turn reasoning with ctx.llm

**Resolved: Yes. `ctx.llm.complete()` accepts the standard OpenAI messages array.**

```python
# Multi-turn reasoning within a specialist:
messages = [
    {"role": "system", "content": "You are a strategist analyzing options."},
    {"role": "user", "content": "Here is the context: ..."},
]
result1 = ctx.llm.complete(messages=messages)
messages.append({"role": "assistant", "content": result1.text})
messages.append({"role": "user", "content": "Now evaluate the trade-offs."})
result2 = ctx.llm.complete(messages=messages)
```

The specialist skill is responsible for accumulating and managing the conversation history across calls. There is no built-in context management in PluginLlm -- it's a stateless facade.

### Q3: delegate_task structured output

**Resolved: Returns `json.dumps({"results": [...], "total_duration_seconds": N})`. No output schema enforcement.**

The results array contains one entry per task with the subagent's final output (conversation summary). There is no built-in output schema enforcement or validation. The orchestrator can include output format requirements in the delegation brief (as part of the `goal` or `context` parameters), and use `ctx.llm.complete_structured()` on the return value to parse and validate structured handoffs.

**Signature (`tools/delegate_tool.py` line 2065):**

```python
def delegate_task(
    goal: Optional[str] = None,
    context: Optional[str] = None,
    toolsets: Optional[List[str]] = None,
    tasks: Optional[List[Dict[str, Any]]] = None,
    max_iterations: Optional[int] = None,
    role: Optional[str] = None,        # "leaf" (default) or "orchestrator"
    background: Optional[bool] = None,
) -> str:
```

Supports single and batch modes. `role="orchestrator"` allows the child to further delegate (bounded by `delegation.max_spawn_depth`). `background=True` dispatches async and re-enters via the completion queue.

### Q4: OpenCode CLI fallback

**Resolved: No built-in fallback. The plugin must handle this.**

The bundled opencode skill has no graceful degradation -- it documents prerequisites but doesn't check availability before invocation. Other Hermes skills (e.g., GitHub skills) use the pattern:

```python
if command -v gh &>/dev/null; then
    # use gh
else
    # fallback or error
fi
```

**Implementation guidance:** The Builder specialist should check `which opencode` at the start of any OpenCode-routing path. If unavailable, fall back to Hermes-native tools (edit, write, bash) for simple tasks, or report the missing dependency for complex tasks that genuinely need OpenCode's sandbox.

### Q5: transform_llm_output specialist identification

**Resolved: No native specialist identification. The hook receives `(response_text, session_id, model, platform)`.**

```python
# Hook callback kwargs (from test at tests/test_transform_llm_output_hook.py line 51):
#   response_text: str
#   session_id: str
#   model: str
#   platform: str
```

To distinguish which specialist produced which part of the response, the plugin would need either:

1. **Session-level tracking**: Each specialist runs as a delegate_task subagent, so `session_id` identifies the subagent session. Map session_ids to specialist names.
2. **Text markers**: Inject specialist identifiers into the response text and strip them before delivery.

The first approach (session_id mapping) is cleaner and doesn't pollute output.

### Q6: Toolset-based grouping

**Resolved: Yes, full support.**

- `ToolEntry.toolset` is a required field (registry.py line 81)
- `registry.get_registered_toolset_names()` returns all unique toolsets
- `registry.get_tool_names_for_toolset(name)` returns tools in a toolset
- `registry.register_toolset_alias(alias, toolset)` creates aliases
- `hermes_cli/plugins.get_plugin_toolsets()` returns plugin toolsets for the TUI

Plugin tools register with any toolset string via `ctx.register_tool(name=..., toolset="maestria", ...)`. The Hermes TUI surfaces plugin toolsets via `hermes tools`.

### Q7: Kanban and mode interaction

**Resolved: No direct integration. Kanban is orthogonal to agent modes.**

The 3 kanban lifecycle hooks (`kanban_task_claimed`, `kanban_task_completed`, `kanban_task_blocked`) are observer-only and process-aware:

- `claimed` fires in the kanban DISPATCHER process (before spawning a worker)
- `completed` fires in the WORKER process (when the task finishes)
- `blocked` fires in the WORKER process (when the task is blocked)

There is no concept of agent modes (fein/sonar/blitz) in the kanban system. The multi-gateway deployment feature uses gateway profiles (default, writer, coder, researcher) that could align with maestria modes, but this requires plugin-level logic -- there is no built-in integration.

**Future consideration:** The Hermes plugin could use `kanban_task_claimed` to detect which mode the worker should run in, by including mode information in the kanban task metadata. This is not built-in but is technically feasible.

### Q8: ctx.llm.complete_structured streaming

**Resolved: No. Neither `complete_structured` nor `acomplete_structured` support streaming.**

Both methods return complete `PluginLlmStructuredResult` objects:

```python
@dataclass
class PluginLlmStructuredResult:
    text: str
    provider: str
    model: str
    agent_id: str
    usage: PluginLlmUsage
    parsed: Optional[Any] = None    # JSON-parsed if json_schema or json_mode used
    content_type: str = "text"
    audit: Dict[str, Any] = field(default_factory=dict)
```

The word "stream" does not appear in `agent/plugin_llm.py`. All LLM calls are synchronous-or-async-complete, not streaming. For specialist reasoning, this is fine -- specialists produce discrete structured outputs, not streaming content.

### Q9: Plugin custom tool definitions

**Resolved: Yes, fully supported.**

`PluginContext.register_tool()` (plugins.py line 367) delegates to `ToolRegistry.register()` (registry.py line 234). The full signature:

```python
ctx.register_tool(
    name="maestria_investigate",          # tool name
    toolset="maestria",                   # toolset for grouping
    schema={...},                         # JSON schema
    handler=my_handler,                   # Callable
    check_fn=None,                        # availability check
    requires_env=None,                    # required env vars
    is_async=False,
    description="Investigate a research question",
    emoji="🔍",
    override=False,                       # replace built-in tool
)
```

Plugin tools enter the global registry alongside built-in tools, appear in `get_all_tool_names()`, and are available for tool discovery. The `override=True` flag allows plugins to replace built-in tools (e.g., swap `browser_navigate` for a custom implementation).

### Q10: pre_gateway_dispatch and subagent_start/stop interaction

**Resolved: Independent hooks at different lifecycle phases. Gateway messages do not reach subagents.**

- `pre_gateway_dispatch` fires in `gateway/run.py._handle_message()` (line 7292) for non-internal gateway events, BEFORE the message reaches the agent. Returns `{"action": "skip" | "rewrite" | "allow"}`. Runs BEFORE user authorization.
- `subagent_start` fires in `delegate_task` (delegate_tool.py line 1292) when a child agent spawns. Receives child session_id, role, status.
- `subagent_stop` fires in `delegate_task` (delegate_tool.py line 2440) when a child agent completes. Receives child session_id, role, summary, status, duration.

Subagents spawned via `delegate_task` are children of an existing session -- they are NOT reached directly by gateway messages. The pre_gateway_dispatch hook gates messages before they enter the conversation at all.
