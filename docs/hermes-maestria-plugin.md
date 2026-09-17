# @maestria/hermes - Hermes Plugin for Maestria Methodology

## Purpose

Bring the Maestria methodology (7-specialist pipeline, maker/checker split, mode system) to the Hermes AI agent platform. The plugin generalizes specialists across domains - research, content, analysis, strategy, operations, and software engineering - instead of locking them to software engineering as `@maestria/opencode` does. Coding-specific work routes to the OpenCode CLI when it is installed; the plugin does not require it.

## Current implementation (2026-09-01)

The registered surface is authoritative in `packages/hermes/plugin.yaml`, `packages/hermes/src/maestria_hermes/__init__.py`, and the runtime tests. At the 2026-09-01 record point the package declared 12 skills (9 methodology + 3 command), 7 commands, 10 hooks, the `llm_execution` middleware, and the `opencode_route` tool. Current version, installation, and usage live in `plugin.yaml` and the [package README](../packages/hermes/README.md).

## Design Philosophy

Five principles govern every decision in this plugin:

### 1. Methodology portable, adapter thin

Canonical methodology (7 specialists + pipeline + maker/checker) lives in `packages/core/agent-directives/` and is synced to every platform. The Hermes plugin is only the adapter mapping it to the Hermes Plugin API; keep plugin code lean, because the real logic lives in canonical sources.

### 2. Hermes-native first + memory-agnostic

Hermes already provides `delegate_task` for subagent dispatch, `kanban_*` tools for task orchestration, `/goal` for persistent objectives, and 8 memory providers. Wire the methodology into these subsystems instead of reimplementing them. The plugin is memory-engine agnostic: it never reads, writes, or checks which memory provider is configured and adds no memory layer, because memory is a platform concern and the methodology is about how to work (pipeline, modes, maker/checker), not what to remember. Fall back to custom storage only where the Hermes plugin API exposes no subsystem; mode persistence uses a JSON file.

### 3. General agent, not a coding tool

Hermes is a general-purpose agent platform, not a coding CLI like OpenCode. Specialists work across research, content, analysis, strategy, operations, and software engineering. The coding path routes to the OpenCode CLI when installed; the plugin does not require it.

### 4. Minimal detection - only for external tooling

The plugin probes no external tool at startup: `opencode_route` is a CLI delegator that fails clearly if the OpenCode CLI is missing. Memory backends and platform features such as kanban are deliberately not probed, because Hermes provides them natively and the plugin does not need to know which are active.

### 5. Feel native to Hermes users

Commands, hooks, tools, and skills follow Hermes Plugin API conventions; config lives in `config.yaml`. Users interact with `/fein`, `/sonar`, and `/blitz` the same way they interact with `/goal`, through Hermes commands, hooks, tools, and skills rather than a separate interface.

## Role-Neutral Child Trust Policy (Approved 2026-08-10)

The specialist tables and pipeline diagrams below describe directive-level routing (which specialist the orchestrator delegates to and what that specialist is expected to do), not capability grants for delegated child sessions. Trust and tool capability follow the approved role-neutral child trust policy recorded in [ADR-HM-002](adr/hermes/ADR-HM-002-orchestration-policy.md); the runtime and canonical directives are the operational source. In brief:

- Delegated children have native Hermes topology roles (`leaf` or `orchestrator`), not Maestria specialist identities; the seven specialist names are methodology routing identities only.
- Role provenance is normalized by Hermes before `subagent_start` fires. Maestria sees only the effective topology role, applies the same fixed child policy regardless, and neither accepts nor rejects specialist-named requested roles.
- User or delegation text never grants capability: `[MAESTRIA_ROLE: ...]`-style markers create no role mapping and relax no allowlist.
- Every delegated child receives a fixed read/research/LLM-only policy. It cannot write, execute code, run a shell, delegate further, or invoke OpenCode.
- Top-level direct sessions retain normal direct behavior only with trusted native binding (`on_session_start` on a recognized non-child platform, or a validated `task_id == session_id`). Ambiguous, invalid, or ended child state fails closed.
- Sonar and direct blitz use literal positive allowlists that fail closed; unknown, renamed, and new tools are denied by default.
- Review and landing enforcement is advisory; Hermes has no native review-state or landing gate.
- Session end is per-turn and resumable; finalize, reset, and subagent stop are terminal trust boundaries that clear a child's role and trust.
- Role-specific delegated builder writes are deferred until Hermes provides an authenticated capability channel. Until then, code changes run on a trusted top-level fein session, not a delegated `builder` child.

The boundary is mechanically enforced by the runtime: `subagent_start` records topology trust state only, and `pre_tool_call` holds every delegated child to the fixed read/research/LLM-only policy.

## Architecture

Hermes provides a native `delegate_task` tool (~139K lines of implementation) for spawning subagents, so the Maestria pipeline model works without a custom subagent mechanism.

```
User request
  - Hermes orchestrator: classify, select pipeline, dispatch each specialist via delegate_task
  - Synthesize results via ctx.llm
  - Present to user
```

Each specialist is a methodology routing identity the orchestrator dispatches to. A dispatched child runs under the role-neutral policy above: fixed read/research/LLM-only access plus `ctx.llm.complete_structured()` for independent reasoning and structured handoff briefs from the orchestrator. OpenCode CLI routing and direct write/bash tools belong to a trusted top-level fein session, never to delegated children.

## Key Difference from @maestria/opencode

Both plugins share the pipeline composition, mode system, and maker/checker split; the difference is domain scope and platform-native features.

| Aspect | @maestria/opencode | @maestria/hermes |
| --- | --- | --- |
| Primary domain | Software engineering | Any domain |
| Adventurer | Explores codebases | Web, docs, data, code, systems |
| Architect | Designs software | Any solution: systems, processes, content |
| Builder | Edits code files | Creates in any medium; a delegated child is read/research/LLM-only (builder writes deferred) |
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

The plugin wires the methodology into host features rather than reimplementing them:

| Capability | Plugin usage |
| --- | --- |
| `delegate_task` | Native subagent dispatch, supports background/async; specialists are dispatched as agent skills |
| `ctx.llm.complete()` / `ctx.llm.complete_structured()` | Host LLM for specialist reasoning and content generation; schema-constrained JSON output used by architect, planner, and reviewer |
| `ctx.inject_message()`, `ctx.register_auxiliary_task()` | Insert findings, progress, or structured results from parallel delegate runs mid-pipeline; sidecar LLM tasks for background reasoning |
| `ctx.register_skill()`, `ctx.register_command()`, `ctx.register_tool()`, `ctx.dispatch_tool()` | Register the plugin's skills, commands, and the `opencode_route` tool; invoke tools programmatically |
| Lifecycle hooks | Mode injection, trust-based tool gating, subagent/session trust tracking, and command dispatch (see the hook table below) |
| Middleware (`llm_execution`) | Opt-in mode footer annotation on LLM calls |
| Skills system | YAML-frontmatter markdown, namespaced per plugin |
| MCP client/server | stdio/HTTP-SSE, OAuth, mTLS, dynamic tool discovery |
| plugin.yaml trust gates | Provider/model/agent_id/profile override controls |
| Memory providers | Host-provided; the plugin is agnostic and adds no memory layer |

Host capabilities the plugin does not use (70+ built-in tools spanning file ops, terminal with 6 backends, browser with 5, web search with 8, code sandbox, vision, kanban, todo, cron, home assistant, media generation, TTS/STT, process, and network; `/goal`; the other middleware kinds) remain Hermes concerns; see the [Hermes docs](https://hermes-agent.nousresearch.com/docs).

### Middleware Kinds

Hermes supports four middleware kinds; the plugin registers only `llm_execution`.

| Middleware | Registered | Trigger | Plugin use |
| --- | --- | --- | --- |
| `tool_request` | No | Before tool call is initiated | (not registered) |
| `tool_execution` | No | Wraps tool execution | (not registered) |
| `llm_request` | No | Before LLM call | (not registered) |
| `llm_execution` | Yes | Wraps LLM call | Mode footer annotation (opt-in via `MAESTRIA_MODE_FOOTER=1`) |

## Specialist Roster

All seven specialists are methodology routing identities generalized to any domain, not tool-granting child identities; a dispatched child always runs under the fixed read/research/LLM-only policy.

| Specialist | Routing role | Hermes features | Guard |
| --- | --- | --- | --- |
| Adventurer | Explore, research, gather information | webfetch, browser_navigate, web_search, grep, glob, read, python; `ctx.llm.complete()` to summarize findings | May not make decisions or produce final artifacts |
| Architect | Design solutions and evaluate options | `ctx.llm.complete_structured()` with decision-framework schemas, `ctx.register_auxiliary_task()`; weighted-criteria evaluation | May not implement |
| Builder | Create output and implement solutions | `ctx.llm.complete()` for implementation planning, `ctx.inject_message()`; complex multi-file coding routed via `opencode_route` from a trusted top-level fein session | Output reviewed by Reviewer; child write/bash/OpenCode deferred until an authenticated capability channel exists |
| Diagnose | Find root causes and investigate problems | grep, read, data analysis, `ctx.llm.complete_structured()` for root-cause analysis and auxiliary tasks; complex debugging routed via `opencode_route` from a trusted top-level fein session | Bash and OpenCode routing unavailable to a delegated child |
| Planner | Plan multi-step work and order tasks | `ctx.llm.complete_structured()` for planning schemas, `ctx.dispatch_tool(delegate_task)`; dependency analysis with milestone breakdown | Plans reviewed by Reviewer before execution |
| Reviewer | Validate output quality | read, diff, `ctx.llm.complete_structured()` with review criteria | Read-only; edit/write unavailable (role-neutral policy and maker/checker split) |
| Writer | Create documentation and content | `ctx.llm.complete()`, `ctx.llm.complete_structured()`, templates for structure | Output reviewed by Reviewer |

## Mode System

Modes describe work style, not domain.

| Mode  | Pipeline                                          | Purpose                           |
| ----- | ------------------------------------------------- | --------------------------------- |
| fein  | Full pipeline (explore - design - build - review) | Thorough, gated execution         |
| sonar | Explore - design/analyze - stop                   | Research only, no creation        |
| blitz | Build directly                                    | Fast execution on known territory |

Mode state persists to `$HERMES_HOME/maestria-mode.json` and is injected into the user message by `pre_llm_call` (not the system prompt, which preserves prompt cache).

### Hook Injection Format

```
[MODE: fein]
Full pipeline: explore context, design, implement, review.
Do not skip stages.
```

### Slash Commands

| Command       | Action                        |
| ------------- | ----------------------------- |
| `/fein`       | Set fein mode                 |
| `/sonar`      | Set sonar mode                |
| `/blitz`      | Set blitz mode                |
| `/mode`       | Show current mode and status  |
| `/mode-clear` | Clear mode state              |
| `/review`     | Trigger review of last output |
| `/plan`       | Trigger planning session      |

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

The orchestrator dispatches specialists via `ctx.dispatch_tool("delegate_task", brief)`. The brief carries the specialist's routing role, prior-stage context, constraints, output format, and iteration limits, and supports background/async parallel specialist work; `subagent_start` and `subagent_stop` track the lifecycle. Regardless of the tools requested in the brief, the child is limited to the fixed read/research/LLM-only policy.

### ctx.llm.complete_structured()

Specialists make their own LLM calls with host credentials; JSON schema enforces structured output, so no verbose tool-based reasoning is needed. Trust gates in `plugin.yaml` control LLM access: `plugins.entries.<name>.llm.allow_provider_override`, `allow_model_override`, `allow_agent_id_override`, `allow_profile_override`.

### Memory Providers (Platform Concern)

Hermes ships built-in memory providers including Mnemosyne (agent memory with recall, sleep cycles, canonical facts, and graph edges), Uteke (knowledge-base wiki for permanent reference docs), holographic (local SQLite FTS5, offline-first), and the server-side backends mem0, supermemory, retaindb, openviking, hindsight, byterover, and honcho. The plugin is intentionally memory-engine agnostic: it never reads from, writes to, or checks for any provider, and adds no layer on top. Users who want cross-session memory configure a provider at the Hermes level; the methodology (modes, pipeline, maker/checker) works regardless of which provider, or none, is active. See the [Hermes Memory documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory).

### Registered Lifecycle Hooks

The plugin registers exactly the hooks declared under `provides_hooks` in `plugin.yaml`:

| Hook | Phase | Plugin use |
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

### MCP Integration

Hermes provides a full MCP client (stdio and HTTP-SSE, OAuth, mTLS, dynamic tool discovery) and can act as an MCP server (`hermes mcp serve`). Plugin usage: register MCP servers for external tool access, expose plugin tools as MCP, and permission-gate MCP tools per specialist via `pre_tool_call`.

### Skills System

Skills are YAML-frontmatter markdown registered via `ctx.register_skill(name, path, description="")`, where `path` points to a `SKILL.md` file; `description` is optional and defaults to `""`, and `name` must match `[a-zA-Z0-9_-]+` with no `:`. Plugin skills do not enter the flat skills tree; they resolve only as `<plugin_name>:<skill_name>`, which is `maestria-hermes:<skill_name>` (for example `maestria-hermes:orchestrator`, `maestria-hermes:global-rules`, `maestria-hermes:command-fein`). The plugin registers 12 skills: 9 methodology skills (orchestrator, builder, reviewer, global-rules, adventurer, architect, diagnose, planner, writer) plus 3 command workflow skills (`command-fein`, `command-sonar`, `command-blitz`).

## OpenCode Composition

OpenCode CLI (`opencode_route`) is available to a trusted top-level fein session, never to delegated children. The Builder or Diagnose specialist, as the routing decision-maker, evaluates task complexity:

1. Simple tasks: use Hermes tools directly (edit, write, bash) from the trusted top-level fein session.
2. Complex, multi-file, or risky tasks: route to OpenCode CLI with a structured brief via `opencode run <goal>`; the tool reports clearly if the CLI is missing.
3. Results return to the top-level session for review and integration.

Delegated children are read/research/LLM-only and cannot write or invoke OpenCode; role-specific delegated builder writes are deferred until an authenticated capability channel exists.
