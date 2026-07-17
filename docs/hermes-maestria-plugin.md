# @maestria/hermes - Hermes Plugin for Maestria Methodology

## Purpose

Bring the maestria methodology (7-specialist pipeline, maker/checker split, mode system) to the Hermes AI agent platform. Unlike @maestria/opencode which is domain-locked to software engineering, this plugin generalizes specialists to work across any domain - research, content, analysis, strategy, and coding.

Coding-specific work routes to the OpenCode CLI as an optional power-up, not a hard dependency.

## Design Philosophy

Five principles that govern every decision in this plugin:

### 1. Methodology portable, adapter thin

The maestria methodology (7 specialists + pipeline + maker/checker) lives in `packages/core/agent-directives/` and is sync'd to every platform. The Hermes plugin is just the **adapter** — it maps the methodology to Hermes' native Plugin API. Keep plugin code lean; the real logic is in canonical sources.

### 2. Hermes-native first + memory-agnostic

Hermes has built-in features that solve the problems the plugin would otherwise need to reimplement — `delegate_task` for subagent dispatch, `kanban_*` tools for task orchestration, `/goal` for persistent objectives, and 8 memory providers (Mnemosyne, holographic, mem0, supermemory, etc.). Use them. Don't reinvent them. The plugin's job is to wire the methodology into these existing subsystems, not duplicate them.

**The plugin is memory-engine agnostic.** It never reads, writes, or cares which memory provider Hermes has configured. Memory is a platform concern — the user chooses their provider independently. The plugin does not add a memory layer on top, because:

- Doing so would couple the plugin to a specific backend
- Hermes already has dedicated memory infrastructure (8 providers)
- The methodology is about _how to work_ (pipeline, modes, maker/checker), not _what to remember_

Only fall back to custom implementations (JSON file for mode persistence) when the Hermes plugin API doesn't expose the relevant subsystem directly.

### 3. General agent, not a coding tool

Hermes is a general-purpose AI agent platform, not a coding CLI like OpenCode. The plugin's specialists must work across domains — research, content, analysis, strategy, operations — not just software engineering. The coding path routes to OpenCode CLI as an optional power-up, never a hard dependency.

### 4. Minimal detection — only for external tooling

Different Hermes instances have different tools and providers configured. The plugin probes at startup only for the one external dependency — the **OpenCode CLI** (an optional power-up for complex coding tasks). Memory backends and platform features like kanban are deliberately not probed: Hermes provides them natively and the plugin doesn't need to know which ones are active.

The probe never blocks, installs, or modifies config. It just logs guidance.

### 5. Feel native to Hermes users

Commands, hooks, tools, and skills follow Hermes Plugin API conventions. Config lives in `config.yaml`. Users interact with `/fein`, `/sonar`, `/blitz` the same way they interact with `/goal`. The plugin should feel like it belongs, not like a foreign methodology bolted on.

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

### Memory Providers (Platform Concern)

Hermes ships with 8 built-in memory providers:

- **Mnemosyne** — agent memory with recall, sleep cycles, canonical facts, graph edges
- **Uteke** — knowledge base wiki for permanent reference docs
- **holographic** — local SQLite FTS5 (offline-first)
- **mem0, supermemory, retaindb, openviking, hindsight, byterover, honcho** — various server-side backends

The maestria plugin is intentionally **memory-engine agnostic**. It never reads from, writes to, or checks for any memory provider. Memory is a platform concern — the user configures their preferred provider at the Hermes level, and the plugin doesn't add a layer on top.

For users who want cross-session memory: configure Mnemosyne or another provider in your Hermes config. The plugin's methodology (modes, pipeline, maker/checker) works regardless of which provider — or none — is active.

See [Hermes Memory documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory) for setup guides.

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

The Reviewer's pre_tool_call hook ideally blocks edit/write for review subagents:

```python
def pre_tool_hook(tool_name: str, **kwargs) -> None | dict:
    # Sonar mode: block ALL write tools (reliable — no subagent context needed)
    if mode == "sonar" and tool_name in _WRITE_TOOLS:
        return {"action": "block", "message": "..."}
    # Role-based gating below is currently UNUSABLE — Hermes does not pass
    # ``child_role`` to ``pre_tool_call`` hooks.  The kwarg is absent from
    # ``invoke_hook("pre_tool_call", ...)`` in hermes_cli/plugins.py:2145,
    # so we can never tell which specialist is making the call.
    role = kwargs.get("child_role", "")
    if not role:
        return None  # Allow — cannot determine caller
    ...
```

> **Platform limitation (v0.1):** Hermes' `pre_tool_call` hook dispatch does not include the subagent's role. Subagent-level tool gating cannot be implemented from a plugin until Hermes provides this context. The mode-level gate (sonar blocks writes, fein/blitz allow everything) is the reliable enforcement mechanism. See `hooks/pre_tool.py` for the documented fallback and `ADR-HM-001` for the scope decision to keep `/goal` as a separate concern.

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

## Phase 2 (v0.2): Full Roster + Hermes-Native Subsystems

All 7 specialists with full skill files, replacing custom JSON file persistence with Hermes' built-in subsystems.

### Deliverables

- Adventurer, architect, diagnose, planner, writer skill files
- Permission **roles** in pre_tool_call (rename from "profiles" to avoid collision with Hermes Agent Profiles feature)
- Each specialist uses `ctx.llm.complete_structured()` for reasoning
- delegate_task for subagent dispatch (native Hermes tool)
- subagent_start/stop hooks for pipeline tracking
- OpenCode lifecycle management (install check, config sync)
- Memory via **Mnemosyne** (not custom JSONL)
- Mode + state via **SessionDB.state_meta** (not custom JSON files)
- transform_tool_result hook for methodology annotations

### Key Changes: Custom Files → Hermes-Native APIs

| Before (standalone) | After (Hermes-native) | Why |
| --- | --- | --- |
| `~/.hermes/maestria-mode.json` | `session.state_meta["maestria:mode"]` | Survives `/resume`, `/goal resume`, session restart — no separate file |
| `~/.hermes/maestria-session.json` | SessionDB (built-in) | Already tracks session_id, timestamps — redundant file removed |
| `PermissionProfile` class name | `PermissionRole` | "Profile" is a Hermes Agent concept for isolated agent configs — rename to avoid confusion |
| Hardcoded tool-name lists in Python | Config-driven role→tool mappings in `config.yaml` `maestria:` key | Users customize roles without editing plugin code |

> **Memory deliberately excluded from this table.** The plugin is memory-engine agnostic — it never had a custom memory file and never will. Hermes has 8 built-in memory providers; the user chooses one independently. See "Memory Providers (Platform Concern)" below.

### Permission Roles

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

### Memory (Platform Concern — No Plugin Integration)

The plugin is memory-engine agnostic. There is no plugin-level memory integration because:

1. **Hermes provides it.** 8 memory providers are available at the platform level. Users configure one independently.
2. **The methodology doesn't require it.** Maestria defines _how to work_ (pipeline, modes, maker/checker split). Remembering decisions across sessions is a platform capability.
3. **No custom JSONL fallback.** Previous versions of this doc described a JSONL fallback that was never wired — `MemoryManager.record()` was never called, and `recall_context()` always returned empty. This was dead code and has been removed.

If users want cross-session memory, they configure Mnemosyne or another provider at the Hermes level. The plugin works identically regardless.

### Mode + State via SessionDB.state_meta

Replace JSON file persistence with session metadata stored in the SessionDB:

```python
# Set mode (instead of writing to maestria-mode.json)
session.state_meta["maestria:mode"] = "fein"

# Set current role
session.state_meta["maestria:role"] = "builder"

# Read anywhere — survives resume and restart
mode = session.state_meta.get("maestria:mode", "fein")
```

The `ModeManager` becomes a thin accessor over `state_meta` instead of a JSON file handler. No separate file I/O, no concurrency concerns.

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
            "context": {"mode": session.state_meta.get("maestria:mode")},
        })
        results[specialist_name] = result
    return synthesize(ctx, results)
```

### Success Criteria

- All 7 specialists dispatch from orchestrator
- Permission **roles** enforce correct tool access per mode (class renamed, config-driven)
- Each specialist uses `ctx.llm.complete_structured()` for reasoning
- subagent_start/stop hooks track pipeline progression
- Multi-specialist pipelines complete end-to-end
- Mode state survives `/resume` via SessionDB.state_meta (no JSON files)
- OpenCode routing works with @maestria/opencode loaded
- Memory uses Uteke MCP — decisions retrievable by semantic query

## Phase 3 (v0.3): Advanced + Kanban & Goals Integration

Polished multi-tool orchestration with all Hermes features. Integrates with built-in Kanban task board and Goals system.

### Deliverables

| Feature | Detail |
| --- | --- |
| Uteke knowledge base integration | Decisions stored as structured Uteke docs for long-term reference |
| MCP server integration | Expose plugin tools as MCP, consume external MCP tools |
| llm_request middleware | Inject methodology context into every LLM request |
| llm_execution middleware | Structured output enforcement |
| transform_llm_output synthesis | Specialist attribution in responses |
| Parallel delegation | Concurrent specialist dispatch via parallel delegate_task |
| Auxiliary tasks | Background reasoning for architect, diagnose, planner |
| ctx.inject_message() | Progress reporting during long pipelines |
| **Kanban integration** | Pipeline state pushed to kanban board — claimed/completed/blocked |
| **Goals integration** | Set `/goal` from maestria pipelines for multi-turn continuity |
| Performance monitoring | Per-specialist metrics (duration, tool calls, tokens) |
| Plugin trust gates | LLM access restrictions per specialist |

### Kanban Integration

Each pipeline step maps to a kanban task lifecycle. Use the `kanban_*` toolset — not just lifecycle hooks:

```python
# Orchestrator creates kanban tasks for each pipeline step:
ctx.dispatch_tool("kanban_create", {
    "title": f"Pipeline: {task_id} — Phase: {specialist}",
    "description": f"Run {specialist} specialist on {task_id}",
    "lane": "ready",
    "tags": ["maestria", pipeline_id, specialist],
})

# Specialists claim, update, and complete tasks:
ctx.dispatch_tool("kanban_claim", {"task_id": task_id})
ctx.dispatch_tool("kanban_show", {"task_id": task_id})  # read task state
ctx.dispatch_tool("kanban_block", {
    "task_id": task_id,
    "reason": "Missing dependency: architect output not ready",
})
ctx.dispatch_tool("kanban_heartbeat", {"task_id": task_id})  # keep-alive
ctx.dispatch_tool("kanban_comment", {
    "task_id": task_id,
    "comment": "Found root cause in auth middleware. See result brief.",
})
ctx.dispatch_tool("kanban_complete", {
    "task_id": task_id,
    "result_summary": "Authentication refactored, tests passing",
})
ctx.dispatch_tool("kanban_link", {
    "task_id": task_id,
    "linked_task_id": next_step_task_id,
    "relationship": "triggers",
})
```

The orchestrator reads the kanban board to decide which specialists to activate, which pipelines to resume, and what artifacts exist from prior work:

```python
# Orchestrator checks board state:
board = ctx.dispatch_tool("kanban_list", {"lane": "done", "tags": [pipeline_id]})
for task in board:
    # Read completed task summaries to feed next specialist
    pass
```

Kanban lifecycle hooks (`kanban_task_claimed`, `kanban_task_completed`, `kanban_task_blocked`) fire automatically in the dispatcher/worker processes and can be used for observability (logging, Uteke event recording, notifications).

This replaces ad-hoc pipeline tracking with the production-grade kanban subsystem — durable, board-visible, and inspectable via `hermes kanban dashboard`.

### Goals Integration

Map long-running maestria pipelines to Hermes Goals for `/resume` and multi-turn continuity:

```python
# When a multi-step pipeline starts, set a goal with a completion contract:
# The goal survives session boundaries and auto-continues until done.
#
# Pipeline name + mode stored in session.state_meta is restored on /goal resume.
# Goals add: turn budget, judge evaluation, auto-continuation.
```

The ideal setup is `/goal draft` — let the LLM structure a completion contract from a plain-language objective:

```
/goal draft Run the fein pipeline to implement user authentication
```

This produces a contract with outcome, verification, constraints, boundaries, and stop_when — which maps naturally to the maestria model:

| Goal contract field | Maestria equivalent                                     |
| ------------------- | ------------------------------------------------------- |
| `outcome`           | Pipeline deliverable (e.g., "User auth implemented")    |
| `verification`      | Reviewer specialist check + test results                |
| `constraints`       | "Don't change existing API contract", "FFU only"        |
| `boundaries`        | Scope limit for this pipeline (e.g., a specific module) |
| `stop_when`         | Escalation: DB migration needed, dependency not met     |

For long-running specialists (e.g., OpenCode complex coding), use `/goal wait <pid>` to park the goal loop while the specialist works:

```python
# Builder delegates to OpenCode, parks the goal:
pid = spawn_opencode(task)
ctx.dispatch_tool("/goal", {"action": "wait", "pid": pid, "reason": "OpenCode building"})
# Goal auto-resumes when OpenCode exits
```

The maestria mode + role in `state_meta` integrate naturally: when a Goal resumes via `/goal resume`, the mode and role are restored automatically from SessionDB. No separate goal mechanism needed in the plugin — just leverage the built-in Goals system for multi-turn task continuity.

### Mode + Goals Alignment

| Hermes Feature | Maestria Integration |
| --- | --- |
| `/goal` | Set as persistent pipeline objective. Mode restored on `/goal resume` via state_meta |
| `/goal draft` | Auto-generate completion contract from pipeline description |
| Goal turn budget | Maps to pipeline step count. Exceeded → escalate to orchestrator |
| Goal judge evaluation | Reviewer specialist evaluates goal completion criteria |
| Goals Dashboard | Pipeline progress visible in `hermes goal list` |
| `/goal wait <pid>` | Park loop during OpenCode or long-running specialist tasks |
| Completion contract | Maps to pipeline scope: outcome→deliverable, verification→reviewer check |

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

### Memory Integration (Mnemosyne)

```python
def store_decision(ctx, specialist, decision):
    ctx.dispatch_tool("mnemosyne_remember", {
        "content": f"Decision by {specialist}: {decision}",
        "type": "decision",
        "tags": ["maestria", specialist],
    })

def retrieve_decisions(ctx, specialist):
    return ctx.dispatch_tool("mnemosyne_recall", {
        "query": f"decisions by {specialist}",
        "tags": ["maestria", specialist],
        "limit": 10,
    })
```

For long-term reference documents (architecture specs, ADRs), use Uteke to create structured wiki pages that persist independently of agent sessions.

## Distribution & Environment Adaptation

The plugin ships as a pip package for `pip install maestria-hermes`, then enabled via `hermes plugins enable maestria-hermes`. Different Hermes instances will have different tools and providers configured.

For a turnkey experience, the maestria methodology can also be distributed as a **Hermes Profile Distribution** — a git repo users install with one command, giving them the complete agent with all skills, config, and optional add-ons pre-configured.

### Two Distribution Channels

| Channel | Install | What you get | Best for |
| --- | --- | --- | --- |
| **pip plugin** | `pip install maestria-hermes` + `hermes plugins enable maestria-hermes` | Methodology hooks, commands, tools, skills loaded into existing Hermes instance | Users who already have Hermes set up and want maestria methodology |
| **Profile distribution** | `hermes profile install gh:agustinusnathaniel/maestria-dist` | A complete, isolated Hermes agent with maestria config + skills + cron pre-loaded | Users who want a dedicated maestria agent, or quick evaluation |

### Profile Distribution Contents

A profile distribution repo (`maestria-dist`) packages the whole agent:

```
maestria-dist/
├── distribution.yaml    # manifest: name, version, env-var requirements
├── config.yaml          # maestria-optimized Hermes config
│                        #   - delegation configured for pipeline dispatch
│                        #   - kanban enabled for task orchestration
│                        #   - plugin maestria-hermes pre-enabled
├── SOUL.md              # maestria methodology personality prompt
├── skills/              # bundled skills (orchestrator, builder, etc.)
├── plugins/             # maestria-hermes plugin (or declared as dependency)
├── cron/                # optional: pipeline cron jobs
└── .env.EXAMPLE         # API key template
```

Users install:

```bash
hermes profile install gh:agustinusnathaniel/maestria-dist
cp ~/.hermes/profiles/maestria/.env.EXAMPLE ~/.hermes/profiles/maestria/.env
# Edit .env with their own keys
maestria chat
```

Updates push via:

```bash
hermes profile update maestria
```

The user's sessions, memories, and API keys stay untouched on update.

## Orchestrator Profile (Kanban Deployment)

For multi-agent setups, the maestria orchestrator can run as a dedicated Hermes **profile** with a kanban description. This lets it dispatch pipeline steps to worker profiles automatically.

### Setup

```bash
hermes profile create maestria-orch \
  --description "Maestria pipeline orchestrator — decomposes work, assigns specialists, reviews output"
```

The orchestrator profile has:

- The `maestria-hermes` plugin loaded (hooks, commands, skills)
- The `kanban` toolset enabled (create, assign, complete tasks)
- `delegate_task` for spawning specialist subagents
- `delegation.orchestrator_enabled: true` in its config

Worker profiles (one per specialist role) register with role descriptions:

```bash
hermes profile create maestria-builder \
  --description "Maestria builder specialist — implements solutions, edits files"
```

### Pipeline Flow

```
User → maestria-orch (profile)
  │
  ├─ kanban_create(task="research", lane="ready")
  ├─ kanban_create(task="design", lane="blocked", blocked_by=1)
  ├─ kanban_create(task="implement", lane="blocked", blocked_by=2)
  ├─ kanban_create(task="review", lane="blocked", blocked_by=3)
  │
  └─ Kanban dispatcher assigns tasks to matching profiles
       ├─ maestria-adventurer claims "research" → completes → "done"
       ├─ maestria-architect claims "design" → review → completes
       ├─ maestria-builder claims "implement" → OpenCode → completes
       └─ maestria-reviewer claims "review" → blocks if fails
```

Each specialist is a real OS-level Hermes profile, coordinated via the durable kanban board rather than in-process `delegate_task` calls. The plugin runs on each profile, limiting tools via permission roles.

### When to Use

| Pattern                         | Best for                                            |
| ------------------------------- | --------------------------------------------------- |
| **Plugin-only** (delegate_task) | Single-user, same machine, quick pipelines          |
| **Profile + kanban**            | Multi-user, multi-machine, durable queue, dashboard |

### Detection Strategy

At startup (`register()`), the plugin probes the environment and selects backends:

| Feature | Preferred | Fallback 1 | Fallback 2 | Fallback 3 |
| --- | --- | --- | --- | --- |
| Memory | **Not probed — platform concern.** Hermes has 8 built-in providers; user chooses independently. Plugin doesn't care which is active. | — | — | — |
| Mode persistence | SessionDB.state_meta | Custom JSON file | In-memory (session-only) | — |
| Kanban integration | **Not probed — platform feature.** Available via kanban\_\* tools when enabled. Plugin doesn't need to know. | — | — | — |
| Goals integration | Built-in `/goal` command | Pipeline only (no goals) | — | — |
| OpenCode routing | `which opencode` available | Hermes native tools only | — | — |
| Parallel dispatch | `delegate_task(tasks=[...])` batched mode | Sequential `delegate_task` calls | In-process tool calls | — |
| Profile distribution | Available as pop profile | Plugin only (no profile) | — | — |

### Strategy Implementation

```python
def minimal_probe():
    """The only probe the plugin performs is OpenCode CLI availability.

    Memory, kanban, and other platform features are deliberately not probed:
    Hermes provides them natively and the plugin doesn't need to know which
    ones are active. See Principle #2 (memory-agnostic) above.
    """
    backends = {
        "opencode": False,
    }

    # Check for OpenCode CLI (only external dependency)
    if which("opencode"):
        backends["opencode"] = True

    return backends
```

Users can override detection via `config.yaml`:

```yaml
maestria:
  memory_backend: uteke # force Uteke over auto-detected Mnemosyne
  mode_backend: json_file # force JSON file over state_meta
  kanban: false # disable kanban integration
```

### What Gets Bundled

| Component | Bundled? | Why |
| --- | --- | --- |
| Plugin Python code (`maestria_hermes/`) | ✅ pip package | Core plugin |
| 9 SKILL.md files | ✅ pip package | Specialist methodology guides |
| Mode system | ✅ pip package | Standalone Python, no deps |
| OpenCode CLI | ❌ Not bundled | External CLI tool |
| maestria-dist profile | ✅ Separate git repo | Completely optional, for turnkey setup |

> Memory backends (Mnemosyne, Uteke, etc.) are deliberately not listed here — they are platform concerns, not plugin concerns. Users configure their preferred memory provider at the Hermes level independently of this plugin.

### Detection & Guidance on Plugin Load

The plugin's `register()` function only logs guidance about the one external dependency — OpenCode CLI. Memory and kanban are not probed (they're platform concerns; see Principle #2). The probe never blocks, installs, or modifies config.

```
# Example: if OpenCode CLI is installed but @maestria/opencode plugin is missing
⚠ OpenCode CLI found but @maestria/opencode missing.
  The opencode_route tool will require install.
  Run: pnpx maestria@latest install opencode
```

### User-Facing Docs (apps/docs/)

Setup guides for OpenCode live in the existing `apps/docs/` site — not in the plugin code:

| Guide | Location | Content |
| --- | --- | --- |
| Full maestria stack | `apps/docs/src/content/docs/hermes/getting-started.mdx` | Plugin install + optional extras |

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
