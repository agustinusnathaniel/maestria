# @maestria/hermes - Hermes Plugin for Maestria Methodology

## Purpose

Bring the maestria methodology (7-specialist pipeline, maker/checker split, mode system) to the Hermes AI agent platform. Unlike @maestria/opencode which is domain-locked to software engineering, this plugin generalizes specialists to work across any domain - research, content, analysis, strategy, and coding.

Coding-specific work routes to the OpenCode CLI when it is installed; the plugin does not require it.

## Current implementation (2026-09-01)

The current package version is `0.1.13`. For the registered public surface, treat `packages/hermes/plugin.yaml`, `src/maestria_hermes/__init__.py`, and the runtime tests as authoritative. The package currently declares 12 skills, 7 commands, 10 hooks, one middleware component, and the `opencode_route` tool.

## Design Philosophy

Five principles that govern every decision in this plugin:

### 1. Methodology portable, adapter thin

The maestria methodology (7 specialists + pipeline + maker/checker) lives in `packages/core/agent-directives/` and is sync'd to every platform. The Hermes plugin is just the **adapter** - it maps the methodology to Hermes' native Plugin API. Keep plugin code lean; the real logic is in canonical sources.

### 2. Hermes-native first + memory-agnostic

Hermes has built-in features that solve the problems the plugin would otherwise need to reimplement - `delegate_task` for subagent dispatch, `kanban_*` tools for task orchestration, `/goal` for persistent objectives, and 8 memory providers (Mnemosyne, holographic, mem0, supermemory, etc.). Use them. Don't reinvent them. The plugin's job is to wire the methodology into these existing subsystems, not duplicate them.

**The plugin is memory-engine agnostic.** It never reads, writes, or cares which memory provider Hermes has configured. Memory is a platform concern - the user chooses their provider independently. The plugin does not add a memory layer on top, because:

- Doing so would couple the plugin to a specific backend
- Hermes already has dedicated memory infrastructure (8 providers)
- The methodology is about _how to work_ (pipeline, modes, maker/checker), not _what to remember_

Only fall back to custom implementations (JSON file for mode persistence) when the Hermes plugin API doesn't expose the relevant subsystem directly.

### 3. General agent, not a coding tool

Hermes is a general-purpose AI agent platform, not a coding CLI like OpenCode. The plugin's specialists must work across domains - research, content, analysis, strategy, operations, and software engineering. The coding path routes to the OpenCode CLI when it is installed; the plugin does not require it.

### 4. Minimal detection - only for external tooling

Different Hermes instances have different tools and providers configured. The plugin does not probe for any external tool at startup - the `opencode_route` tool is a simple CLI delegator that fails clearly if OpenCode CLI is not installed. Memory backends and platform features like kanban are deliberately not probed: Hermes provides them natively and the plugin doesn't need to know which ones are active.

The probe never blocks, installs, or modifies config. It just logs guidance.

### 5. Feel native to Hermes users

Commands, hooks, tools, and skills follow Hermes Plugin API conventions. Config lives in `config.yaml`. Users interact with `/fein`, `/sonar`, `/blitz` the same way they interact with `/goal`. The methodology is delivered through Hermes commands, hooks, tools, and skills rather than a separate interface.

## Role-Neutral Child Trust Policy (Approved 2026-08-10)

The specialist tables and pipeline diagrams in this document describe **directive-level routing** (which specialist the orchestrator should delegate to, and what that specialist is expected to do). They do **not** describe capability grants for delegated child sessions. Trust and tool capability are governed by the approved role-neutral child trust policy below (recorded in ADR-HM-002):

- **Native Hermes child roles are topology roles, not Maestria specialists.** A delegated child's native role is `leaf` (default) or `orchestrator`. The seven specialist names (adventurer, architect, builder, diagnose, planner, reviewer, writer) are methodology routing identities, not tool-granting child identities on Hermes.
- **Role provenance is normalized by Hermes, not evaluated by Maestria.** Hermes maps the requested delegation role to an effective native topology role (`leaf` or `orchestrator`) before `subagent_start` fires. Maestria never sees a requested specialist-named role, so it neither accepts nor rejects one; it validates the effective topology role and applies the same fixed child policy regardless. The plugin does not claim to reject original requested roles.
- **User/delegation text cannot grant capabilities.** `[MAESTRIA_ROLE: ...]`-style markers in user or delegation text neither create a role mapping nor relax any allowlist.
- **Delegated children receive a fixed read/research/LLM-only policy.** A delegated child may read, research, and use LLM reasoning. It cannot write, execute code, run a shell, delegate further, or invoke OpenCode (`opencode`/`opencode_route`). This applies regardless of which specialist the orchestrator routes to.
- **Top-level direct sessions retain normal direct behavior only with trusted native binding.** A session is trusted as direct/top-level only from recognized native lifecycle state (`on_session_start` on a recognized non-child platform, or a validated `task_id == session_id` binding). Ambiguous, invalid, or ended child state fails closed.
- **Sonar and direct blitz have literal positive allowlists that fail closed.** Unknown, renamed, and new tools are denied by default.
- **Review/landing enforcement is advisory.** Hermes has no native review-state or landing gate.
- **Lifecycle: session end is per-turn and resumable; finalize/reset/subagent stop are terminal trust boundaries.** A stopped or ended child has its role and trust cleared.
- **Role-specific delegated builder writes are deferred** until Hermes provides an authenticated capability channel that proves a delegated child is authorized to use a given capability. Until then, delegated children do not receive write/execute/shell/delegate/OpenCode capability. Code changes on Hermes are performed by a trusted top-level fein session under its direct-access boundary, not by a delegated `builder` child.

> Where a table below shows a specialist with write/bash/OpenCode access (for example the builder), read that as the specialist's **routing role and intended activity** under directive guidance. It is **not** a grant that a delegated child may write. The role-neutral child boundary is mechanically enforced by the runtime: `subagent_start` records only topology trust state, and `pre_tool_call` holds every delegated child to the fixed read/research/LLM-only policy. See [ADR-HM-002](adr/hermes/ADR-HM-002-orchestration-policy.md) for the enforcement status.

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

Each specialist is a methodology routing identity that the orchestrator dispatches to via `delegate_task`. A dispatched child runs under the approved role-neutral child policy: fixed read/research/LLM-only access, plus access to `ctx.llm.complete_structured()` for independent reasoning and structured handoff briefs from the orchestrator. Role-specific write access for delegated children is deferred until an authenticated capability channel exists.

OpenCode CLI (`opencode_route`) and direct write/bash tools are available to a trusted top-level fein session under its direct-access boundary, not to delegated children. Delegated children cannot invoke OpenCode, write, execute code, or run a shell. Until an authenticated capability channel exists, delegated builder writes are deferred; code changes on Hermes are performed by a trusted top-level fein session.

## Key Difference from @maestria/opencode

Both plugins use the same pipeline composition, mode system, and maker/checker split. The difference is domain scope and platform-native features.

| Aspect | @maestria/opencode | @maestria/hermes |
| --- | --- | --- |
| Primary domain | Software engineering | Any domain |
| Adventurer | Explores codebases | Web, docs, data, code, systems |
| Architect | Designs software | Any solution - systems, processes, content |
| Builder | Edits code files | Creates in any medium (delegated child is read/research/LLM-only; builder writes deferred) |
| Diagnose | Debugs code bugs | Any problem type |
| Planner | Plans coding work | Any multi-step work |
| Reviewer | Reviews code | Code, docs, plans, designs |
| Writer | Writes docs | Same (already general-purpose) |
| Modes | fein/sonar/blitz (coding) | fein/sonar/blitz (work style, domain-agnostic) |
| Tooling | OpenCode tools only | Hermes tools + optional OpenCode CLI |
| Subagents | task() function | Hermes native delegate_task |
| Reasoning | LLM via tool calls | ctx.llm.complete_structured() (JSON schema) |
| Permissions | YAML frontmatter | pre_tool_call hook |

## Hermes Platform Capabilities

| Capability | Plugin Usage |
| --- | --- |
| `delegate_task` | Native subagent dispatch. Supports background/async |
| `ctx.llm.complete()` | Host LLM for specialist reasoning and content generation |
| `ctx.llm.complete_structured()` | Structured JSON output via schema. Used by architect, planner, reviewer |
| `ctx.inject_message()` | Insert specialist findings or progress into the conversation |
| `ctx.register_auxiliary_task()` | Sidecar LLM tasks for background specialist reasoning |
| `ctx.register_skill(name, path, description="")` | Register namespaced skills as `maestria-hermes:<skill>` |
| `ctx.register_command()` | Slash command registration |
| `ctx.dispatch_tool()` | Programmatic tool invocation |
| `pre_llm_call` hook | Mode injection into user message (preserves prompt cache) |
| `pre_tool_call` hook | Lifecycle trust-based tool gating (role-neutral child policy) |
| `transform_tool_result` hook | Append methodology annotation to write tool results |
| `subagent_start/stop` hooks | Record and clear a delegated child's trust state |
| `pre_gateway_dispatch` hook | Slash-command dispatch before the agent-busy check |
| `on_session_*` hooks | Session trust establishment and terminal trust boundaries |
| Middleware (`llm_execution`) | Mode footer annotation on LLM calls (opt-in via `MAESTRIA_MODE_FOOTER=1`) |
| MCP client/server | stdio/HTTP-SSE, OAuth, mTLS, dynamic tool discovery |
| plugin.yaml trust gates | Provider/model/agent_id/profile override controls |
| Skills system | YAML-frontmatter markdown, namespaced per plugin |
| 70+ built-in tools | File ops, terminal (6 backends), browser (5), web search (8), code sandbox, vision, MCP, kanban, todo, cron, home assistant, image/video gen, TTS/STT, process, network |
| 8 memory providers | holographic (SQLite FTS5), mem0, supermemory, retaindb, openviking, hindsight, byterover, honcho |

### Middleware Kinds

Hermes supports four middleware kinds. The plugin currently registers only `llm_execution`; the other three are platform capabilities the plugin does not currently use.

| Middleware | Registered | Trigger | Plugin Use |
| --- | --- | --- | --- |
| `tool_request` | No | Before tool call is initiated | _(not registered)_ |
| `tool_execution` | No | Wraps tool execution | _(not registered)_ |
| `llm_request` | No | Before LLM call | _(not registered)_ |
| `llm_execution` | Yes | Wraps LLM call | Mode footer annotation (opt-in via `MAESTRIA_MODE_FOOTER=1`) |

## Specialist Roster

All 7 maestria specialists, generalized to work across any domain. Each is a methodology routing identity, not a tool-granting child identity. Under the role-neutral child policy, a dispatched child is limited to the fixed read/research/LLM-only policy; the tools listed for each specialist describe that specialist's routing role and intended activity under directive guidance, not a capability grant for the child session.

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

| Aspect | Detail |
| --- | --- |
| Routing role | Create output and implement solutions |
| Reasoning | `ctx.llm.complete()` for implementation planning |
| Child capability | Read/research/LLM-only (role-neutral policy). Write/bash/OpenCode for a delegated child is deferred until an authenticated capability channel exists |
| OpenCode routing | Complex multi-file coding is routed through `opencode_route`, available to a trusted top-level fein session, not a delegated child |
| Guard | Output is reviewed by Reviewer before delivery |

### Diagnose

Find root causes and investigate problems.

| Aspect | Detail |
| --- | --- |
| Routing role | Find root causes and investigate problems |
| Tools | grep, read, data analysis, LLM reasoning |
| Reasoning | `ctx.llm.complete_structured()` for root cause analysis |
| Child capability | Read/research/LLM-only (role-neutral policy). Bash and OpenCode routing are not available to a delegated child |
| OpenCode routing | Complex debugging sessions delegate to OpenCode CLI via `opencode_route`, available to a trusted top-level fein session |

### Planner

Plan multi-step work and order tasks.

| Aspect    | Detail                                               |
| --------- | ---------------------------------------------------- |
| Tools     | `ctx.llm.complete_structured()` for planning schemas |
| Reasoning | Dependency analysis with milestone breakdown         |
| Guard     | Plans are reviewed by Reviewer before execution      |

### Reviewer

Validate output quality.

| Aspect | Detail |
| --- | --- |
| Tools | read, diff, `ctx.llm.complete_structured()` with review criteria |
| Guard | Read-only. Edit/write are not available to the reviewer child (role-neutral child policy and maker/checker split) |

### Writer

Create documentation and content.

| Aspect | Detail                                                    |
| ------ | --------------------------------------------------------- |
| Tools  | `ctx.llm.complete()` for writing, templates for structure |
| Guard  | Output is reviewed by Reviewer                            |

## How Specialists Use Hermes Features

Under the role-neutral child policy, a dispatched child is always limited to the fixed read/research/LLM-only policy; the "Toolset" column reflects the specialist's routing role under directive guidance, not a capability grant for the child.

| Specialist | Key Hermes Features Used | Toolset |
| --- | --- | --- |
| Adventurer | webfetch, browser, web_search, `ctx.llm.complete()` | Read-only |
| Architect | `ctx.llm.complete_structured()`, `ctx.register_auxiliary_task()` | Read + ctx.llm |
| Builder | `ctx.llm.complete()`, `ctx.inject_message()` | Read/research/LLM-only for a child (write/bash/OpenCode deferred until an authenticated capability channel) |
| Diagnose | grep, read, `ctx.llm.complete_structured()`, auxiliary tasks | Read + ctx.llm |
| Planner | `ctx.llm.complete_structured()`, `ctx.dispatch_tool(delegate_task)` | Read + ctx.llm |
| Reviewer | read, diff, `ctx.llm.complete_structured()` | Read-only |
| Writer | `ctx.llm.complete()`, `ctx.llm.complete_structured()` | Read + ctx.llm |

## Mode System

Modes describe work style, not domain.

| Mode  | Pipeline                                          | Purpose                           |
| ----- | ------------------------------------------------- | --------------------------------- |
| fein  | Full pipeline (explore - design - build - review) | Thorough, gated execution         |
| sonar | Explore - design/analyze - stop                   | Research only, no creation        |
| blitz | Build directly                                    | Fast execution on known territory |

Mode state persists to `$HERMES_HOME/maestria-mode.json` and is injected into the user message by `pre_llm_call` (not system prompt - preserves prompt cache).

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
| `/mode`   | Show current mode and status  |
| `/review` | Trigger review of last output |
| `/plan`   | Trigger planning session      |

## Pipeline Sequences

| Work type | Pipeline |
| --- | --- |
| Research question | adventurer - writer - reviewer |
| Decision/design | adventurer - architect - writer - reviewer |
| Implementation | adventurer - architect - builder - reviewer |
| Bug/issue | diagnose - builder - reviewer |
| Planning | adventurer - planner - reviewer |
| Content | adventurer - writer - reviewer |
| Complex coding | adventurer - architect - builder - reviewer (OpenCode routing via a trusted top-level fein session) |

## Hermes Feature Deep Dive

### Native delegate_task

The orchestrator dispatches specialists via `ctx.dispatch_tool("delegate_task", brief)`. Delegation includes a structured brief with context, constraints, and output format. Supports background/async for parallel specialist work. `subagent_start` and `subagent_stop` hooks monitor the lifecycle.

> Regardless of the toolset requested in the delegation brief, a delegated child is limited to the fixed read/research/LLM-only policy under the role-neutral child trust policy. The child cannot write, execute code, run a shell, delegate further, or invoke OpenCode.

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

- **Mnemosyne** - agent memory with recall, sleep cycles, canonical facts, graph edges
- **Uteke** - knowledge base wiki for permanent reference docs
- **holographic** - local SQLite FTS5 (offline-first)
- **mem0, supermemory, retaindb, openviking, hindsight, byterover, honcho** - various server-side backends

The maestria plugin is intentionally **memory-engine agnostic**. It never reads from, writes to, or checks for any memory provider. Memory is a platform concern - the user configures their preferred provider at the Hermes level, and the plugin doesn't add a layer on top.

For users who want cross-session memory: configure Mnemosyne or another provider in your Hermes config. The plugin's methodology (modes, pipeline, maker/checker) works regardless of which provider - or none - is active.

See [Hermes Memory documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory) for setup guides.

### Registered Lifecycle Hooks

The plugin registers exactly the hooks declared under `provides_hooks` in `plugin.yaml`:

| Hook | Phase | Plugin Use |
| --- | --- | --- |
| `pre_gateway_dispatch` | Gateway | Slash-command dispatch before the agent-busy check |
| `pre_llm_call` | Before LLM | Mode injection into user message |
| `pre_tool_call` | Before tool | Lifecycle trust-based tool gating (role-neutral child policy) |
| `on_session_start` | Session | Establish trust for a recognized top-level session |
| `on_session_end` | Session | Preserve trust across per-turn, resumable session end |
| `on_session_finalize` | Session | Terminal trust boundary (clears trust) |
| `on_session_reset` | Session | Terminal trust boundary (clears trust) |
| `subagent_start` | Subagent lifecycle | Record a delegated child's native topology role as trust state |
| `subagent_stop` | Subagent lifecycle | Clear a delegated child's trust on exit (terminal boundary) |
| `transform_tool_result` | Tool output | Append methodology annotation to write tool results |

### Middleware

The plugin registers a single middleware kind:

- **`llm_execution`** - Wraps LLM calls to append the mode footer annotation (opt-in via `MAESTRIA_MODE_FOOTER=1`).

### MCP Integration

Full MCP client with stdio and HTTP-SSE transports, OAuth, mTLS, and dynamic tool discovery. Hermes can also act as an MCP server (`hermes mcp serve`). Plugin usage: register MCP servers for external tool access, expose plugin tools as MCP, permission-gate MCP tools per specialist via pre_tool_call.

### Skills System

Skills are YAML-frontmatter markdown files, registered via `ctx.register_skill(name, path, description="")`. The plugin passes the filesystem path to a `SKILL.md` file; `description` is optional and defaults to `""`. The bare `name` must match `[a-zA-Z0-9_-]+` and contain no `:`.

Plugin skills are namespaced - they don't enter the flat skills tree. They resolve only as `<plugin_name>:<skill_name>`, and because the plugin name is `maestria-hermes`, that namespace is `maestria-hermes:<skill_name>` (e.g., `maestria-hermes:orchestrator`, `maestria-hermes:global-rules`, `maestria-hermes:command-fein`).

The plugin registers 12 skills: 9 methodology skills (orchestrator, builder, reviewer, global-rules, adventurer, architect, diagnose, planner, writer) plus 3 command workflow skills (`command-fein`, `command-sonar`, `command-blitz`).

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

OpenCode CLI (`opencode_route`) is available to a **trusted top-level fein session**, not to delegated children. A delegated child cannot invoke OpenCode. The builder or diagnose specialist (running as the routing decision-maker, with the actual coding performed at the top-level fein session) evaluates task complexity:

1. Builder (or Diagnose) evaluates task complexity
2. Simple tasks: use Hermes tools directly (edit, write, bash) from the trusted top-level fein session
3. Complex/multi-file/risky: route to OpenCode CLI with structured brief
4. Delegate via `opencode run <goal>` - the tool reports clearly if the CLI is missing
5. Results flow back for review and integration

> Delegated children are read/research/LLM-only and cannot write or invoke OpenCode. Role-specific delegated builder writes are deferred until an authenticated capability channel exists.

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

The orchestrator decomposes a request, selects a pipeline, and dispatches each specialist via `delegate_task`. Each delegation carries a structured brief: the specialist's routing role, relevant context from prior stages, an output format spec, and iteration limits. Each dispatched child runs under the approved role-neutral child trust policy - fixed read/research/LLM-only access, plus `ctx.llm.complete_structured()` for independent reasoning. It cannot write, execute code, run a shell, delegate further, or invoke OpenCode.

Pipelines are summarized in [Pipeline Sequences](#pipeline-sequences):

- fein: full pipeline with review
- sonar: reconnaissance and analysis, stops before creation
- blitz: direct, read/research/LLM-only

Code changes on Hermes are performed by a trusted top-level fein session (optionally via `opencode_route`), not by a delegated child.

### Project Structure

```
packages/hermes/
├── plugin.yaml                    # Plugin manifest (provides_hooks, middleware, commands, tools)
├── pyproject.toml                 # Python package metadata (src layout)
├── __init__.py                    # Root shim re-exporting the src/maestria_hermes package
├── sync.config.ts                 # Sync configuration for agent directives
├── src/maestria_hermes/
│   ├── __init__.py                # register() entry point + command handlers
│   ├── permissions.py             # Literal tool allowlists + native child topology roles
│   ├── modes.py                   # Mode system (fein/sonar/blitz) with JSON persistence
│   ├── session.py                 # Session trust-state registry (trusted top-level / delegated child)
│   ├── hooks/
│   │   ├── pre_gateway.py         # Pre-gateway command dispatch
│   │   ├── pre_llm.py             # Mode injection into user messages
│   │   ├── pre_tool.py            # Lifecycle trust-based tool gating
│   │   └── transform.py           # Tool result annotations
│   ├── middleware/
│   │   └── llm_output.py          # llm_execution middleware (opt-in mode footer)
│   ├── tools/
│   │   └── opencode.py            # OpenCode CLI routing tool
│   └── skills/                    # SKILL.md files (9 methodology + 3 command skills)
└── tests/
    └── test_hooks.py              # Plugin registration + hook behavior tests
```

### plugin.yaml (Actual)

```yaml
name: maestria-hermes
version: 0.1.13
description: Maestria methodology plugin for Hermes Agent
kind: standalone
author: Maestria Contributors
license: MIT
provides_tools:
  - opencode_route
provides_hooks:
  - pre_gateway_dispatch
  - pre_llm_call
  - pre_tool_call
  - on_session_start
  - on_session_end
  - on_session_finalize
  - on_session_reset
  - subagent_start
  - subagent_stop
  - transform_tool_result
provides_middleware:
  - llm_execution
provides_commands:
  - fein
  - sonar
  - blitz
  - mode
  - review
  - plan
```

### register() (Actual API)

The plugin uses the v2 Plugin API -- see `packages/hermes/src/maestria_hermes/__init__.py` for the full implementation:

```python
def register(ctx):
    mode_manager = ModeManager()
    session_manager = SessionManager()

    # Pre-gateway command dispatch (runs before the agent-busy check)
    ctx.register_hook("pre_gateway_dispatch", create_pre_gateway_hook(mode_manager))

    # LLM lifecycle hooks
    ctx.register_hook("pre_llm_call", create_pre_llm_hook(mode_manager))
    ctx.register_hook("pre_tool_call", create_pre_tool_hook(mode_manager))

    # Session lifecycle hooks (trust establishment + terminal boundaries)
    ctx.register_hook("on_session_start", session_manager.on_session_start)
    ctx.register_hook("on_session_end", session_manager.on_session_end)
    ctx.register_hook("on_session_finalize", session_manager.on_session_finalize)
    ctx.register_hook("on_session_reset", session_manager.on_session_reset)
    ctx.register_hook("subagent_start", _on_subagent_start)
    ctx.register_hook("subagent_stop", _on_subagent_stop)
    ctx.register_hook("transform_tool_result", create_transform_tool_result_hook(mode_manager))

    # Middleware
    ctx.register_middleware("llm_execution", create_llm_output_middleware(mode_manager))

    # Tools
    ctx.register_tool(
        name="opencode_route",
        toolset="maestria",
        schema=opencode_route_tool_schema(),
        handler=opencode_route_handler,
        description="Delegate a complex coding task to OpenCode CLI",
        emoji="🔧",
    )

    # Slash commands
    ctx.register_command("fein", _cmd_set_mode(mode_manager, "fein"), ...)
    ctx.register_command("sonar", _cmd_set_mode(mode_manager, "sonar"), ...)
    ctx.register_command("blitz", _cmd_set_mode(mode_manager, "blitz"), ...)
    ctx.register_command("mode", _cmd_status(mode_manager), ...)
    ctx.register_command("review", _cmd_set_mode(mode_manager, "fein"), ...)
    ctx.register_command("plan", _cmd_set_mode(mode_manager, "fein"), ...)

    # Skills: 9 methodology + 3 command workflow modes, namespaced maestria-hermes:<name>
    for name, path in _skill_registrations:
        if path.exists():
            ctx.register_skill(name, path)
```

### Success Criteria

- Plugin loads into Hermes without errors
- Mode switching persists across messages
- pre_llm_call injects mode context into user message
- pre_tool_call blocks edit/write in sonar mode
- Trusted top-level fein sessions complete edits with Hermes tools (delegated children are read/research/LLM-only)
- Builder routes coding tasks to OpenCode CLI and captures results
- Reviewer inspects output and reports findings

> Superseded v0.2/v0.3 planning and the July 2026 API research notes were removed from this document; git history preserves them.
