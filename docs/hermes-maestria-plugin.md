# hermes-maestria — Implementation Plan

## Goal

Build a standalone Hermes plugin (`hermes-maestria`) that carries forward maestria's orchestration patterns — specialist delegation, global rules injection, permission enforcement, and the 7-agent roster — into the Hermes agent framework. No runtime coupling to `@maestria/opencode`. Each plugin optimized for its platform.

## Architecture Decision

### Separate Products, Shared Ideas (Option C)

Build `hermes-maestria` as a standalone Hermes plugin. Share agent prompts and orchestration principles with `@maestria/opencode`, but no runtime coupling.

**Why:**

1. Plugin models are too different for tight coupling — TypeScript config hook vs Python `register(ctx)`
2. The valuable part is the *ideas* (agent prompts, orchestration principles, ADR patterns), not the code
3. Hermes has unique strengths to exploit: slash commands, 10+ hooks, `ctx.dispatch_tool`, MCP integration, Python ecosystem

### Mapping: maestria Concepts → Hermes Equivalents

| maestria Concept | Hermes Equivalent | Notes |
|---|---|---|
| Agent mode (subagent/primary/all) | No equivalent | All "agents" are skills loaded on demand |
| `task()` delegation | `delegate_task` tool | Tool-based, not native call |
| `input.instructions` | `pre_llm_call` hook | Returns context string |
| YAML frontmatter permissions | `pre_tool_call` hook | Imperative, not declarative |
| `session.compacting` | `on_session_start/end` hooks | More hooks available |
| Agent config (`edit:deny`, `bash:allow`) | Python guard functions | Must implement per-tool gating |

### Key Design Principles (carried from ADRs)

- **ADR-001**: Global rules are cross-cutting, not per-agent. Agent-specific behavior lives in skill prompts.
- **ADR-002**: Pure plugin — no filesystem side effects outside the plugin directory.
- **ADR-003**: `!!!` markers for critical rules, cross-references between agents, skill prescription pattern.
- **ADR-004**: 4-bucket skill prescription, 5-section handoff, iteration limits, rules bullets.
- **ADR-005**: Orchestrator-direct skill installs, bundled questions, `--help` as source of truth.
- **ADR-006**: Permissions are permissive by default; directives encode policy.
- **ADR-007**: `opensrc` for repos, `webfetch` for pages.

---

## Phase 1 (v0.1): Core Loop

**Goal:** Prove orchestration works in Hermes — register a tool, inject rules, gate permissions, route to 3 specialists.

### Files

```
~/.hermes/plugins/hermes-maestria/
├── plugin.yaml              # Plugin manifest
├── __init__.py              # Entry point: register(ctx)
├── plugin.py                # Core logic: hooks, tools, guards
├── skills/
│   ├── orchestrator.md      # Manager agent — decompose, delegate, integrate
│   ├── builder.md           # Focused implementation
│   └── reviewer.md          # Code review with quality gates
└── rules/
    └── AGENTS.md            # Global rules injected into every session
```

### Tasks

#### 1.1 — plugin.yaml (Plugin Manifest)

**What:** Declare plugin metadata, dependencies, and entry point.

**Spec:**
```yaml
name: hermes-maestria
version: 0.1.0
description: Orchestration plugin with specialist delegation
entry: __init__.py
author: <author>
license: MIT
```

**Success criteria:** `hermes plugin install ~/.hermes/plugins/hermes-maestria` succeeds. Plugin appears in `hermes plugin list`.

#### 1.2 — __init__.py (Entry Point)

**What:** Implement `register(ctx)` — the plugin entry point that registers tools, hooks, commands, and skills.

**Spec:**
```python
from pathlib import Path
from .plugin import (
    handle_delegate_task,
    pre_llm_call_inject_rules,
    pre_tool_call_enforce_permissions,
)

def register(ctx):
    # Register the delegation tool
    ctx.register_tool(
        name="delegate_task",
        toolset="maestria",
        schema={
            "type": "object",
            "properties": {
                "specialist": {
                    "type": "string",
                    "enum": ["orchestrator", "builder", "reviewer"],
                    "description": "Which specialist to delegate to"
                },
                "briefing": {
                    "type": "string",
                    "description": "Complete delegation briefing (goal, context, requirements, success criteria)"
                },
            },
            "required": ["specialist", "briefing"],
        },
        handler=handle_delegate_task,
    )

    # Register hooks
    ctx.register_hook("pre_llm_call", pre_llm_call_inject_rules)
    ctx.register_hook("pre_tool_call", pre_tool_call_enforce_permissions)

    # Register slash command
    ctx.register_command(
        "review",
        handler=lambda args: handle_delegate_task({
            "specialist": "reviewer",
            "briefing": args or "Review the current changes",
        }),
        description="Route to reviewer specialist for code review",
    )

    # Register skills
    skills_dir = Path(__file__).parent / "skills"
    ctx.register_skill("orchestrator", skills_dir / "orchestrator.md")
    ctx.register_skill("builder", skills_dir / "builder.md")
    ctx.register_skill("reviewer", skills_dir / "reviewer.md")
```

**Success criteria:** `register()` completes without error. All 3 skills, 1 tool, 2 hooks, 1 command are registered.

#### 1.3 — plugin.py (Core Logic)

**What:** Implement the handler functions for the delegate_task tool, the pre_llm_call hook, and the pre_tool_call hook.

**Sub-tasks:**

**1.3a — `handle_delegate_task(args)`**

Routes delegation to the appropriate specialist skill. Loads the specialist's skill prompt, wraps the briefing, and dispatches.

```python
async def handle_delegate_task(args: dict) -> str:
    specialist = args["specialist"]
    briefing = args["briefing"]

    # Load specialist skill prompt
    skill_path = Path(__file__).parent / "skills" / f"{specialist}.md"
    skill_prompt = skill_path.read_text()

    # Compose the delegation message
    delegation = f"""## Delegation to @{specialist}

{briefing}

## Specialist Instructions

{skill_prompt}

## Delegation Contract

If anything is unclear or ambiguous, ask before proceeding.
Report: what was done, what was found, what was NOT found, verification, next step.
"""
    return delegation
```

**1.3b — `pre_llm_call_inject_rules(session_id, user_message, conversation_history, is_first_turn, model, platform, **kwargs)`**

Injects global rules into every LLM call by returning a context dict.

```python
def pre_llm_call_inject_rules(session_id, user_message, conversation_history, is_first_turn, model, platform, **kwargs):
    rules_path = Path(__file__).parent / "rules" / "AGENTS.md"
    rules = rules_path.read_text()
    return {"context": rules}
```

**1.3c — `pre_tool_call_enforce_permissions(tool_name, args, task_id, **kwargs)`**

Gates tool execution based on the active specialist's permission profile. Returns `{"action": "block", "message": "..."}` to block, `None` to allow.

```python
# Permission profiles per specialist (Hermes-adapted from maestria frontmatter)
PERMISSIONS = {
    "orchestrator": {
        "read": "allow", "glob": "allow", "grep": "allow",
        "edit": "deny",
        "bash": {
            "*": "deny",
            "git status*": "allow", "git diff*": "allow", "git log*": "allow",
        },
        "delegate_task": "allow", "skill": "allow",
    },
    "builder": {
        "read": "allow", "glob": "allow", "grep": "allow",
        "edit": "allow",
        "bash": {
            "*": "allow",
            "git status*": "allow", "git diff*": "allow", "git log*": "allow",
        },
        "skill": "allow",
    },
    "reviewer": {
        "read": "allow", "glob": "allow", "grep": "allow",
        "edit": "deny",
        "bash": {
            "*": "allow",
            "git status*": "allow", "git diff*": "allow", "git log*": "allow",
        },
        "skill": "allow",
    },
}

def pre_tool_call_enforce_permissions(tool_name, args, task_id, **kwargs):
    profile = PERMISSIONS.get(_active_specialist, {})

    if tool_name == "bash":
        command = args.get("command", "")
        bash_policy = profile.get("bash", {})
        # Check specific command patterns first, then wildcard
        for pattern, policy in bash_policy.items():
            if pattern == "*" or command.startswith(pattern.rstrip("*")):
                if policy == "deny":
                    return {"action": "block", "message": f"@{_active_specialist} is not allowed to run: {command}"}
                break
    else:
        policy = profile.get(tool_name, "allow")
        if policy == "deny":
            return {"action": "block", "message": f"@{_active_specialist} is not allowed to use: {tool_name}"}

    return None  # Allow
```

**Success criteria:**
- `delegate_task` tool can be invoked with `{"specialist": "builder", "briefing": "Fix the typo in README.md"}`
- `pre_llm_call` hook injects global rules as a system message before every LLM call
- `pre_tool_call` hook blocks `edit` for reviewer, blocks `bash` for orchestrator (except allow-listed commands)
- Permission profiles match the maestria frontmatter specs (adapted for Hermes)

#### 1.4 — rules/AGENTS.md (Global Rules)

**What:** Adapt maestria's global rules for Hermes context. Replace opencode-specific references.

**Spec:** Copy from `packages/opencode/rules/AGENTS.md` with these changes:
- Remove `@maestria/opencode` title — use `hermes-maestria`
- Replace `task()` references with `delegate_task` tool
- Replace `opensrc` skill reference with generic "clone repos to temp dir" guidance (Hermes may not have opensrc)
- Keep `!!!` markers, context management rules, delegation table

**Content:**
```markdown
# Global Agent Rules — hermes-maestria

## Orchestration

- **!!! Don't assume** — verify against actual code and docs. Guesses lead to bugs.
- **!!! Read the docs first** — before writing code that touches unfamiliar tools, APIs, or migration paths, consult official documentation. Don't guess at API changes.
- **Don't reference internal project names in explanations** — avoid leaking context outside the workspace.
- **For external repos, clone once and read locally** — when analyzing a GitHub/GitLab/BitBucket repo, clone it to a temp directory and use local file tools. Don't fetch a multi-file repo one file at a time.

## Delegation

When delegating work via `delegate_task`, use only the registered specialists.
**Never delegate to built-in agents** — they are not part of the specialist pipeline.

| Specialist    | Role                                             | When to Delegate                                                                             |
| ------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `orchestrator`| Manager agent, decompose work, delegate          | Complex multi-step tasks, 3+ step workflows                                                  |
| `builder`     | Focused implementation, single-task execution    | Feature work, bug fixes, test writing, refactors                                             |
| `reviewer`    | Code review with quality gates                   | Pre-merge review, security audit, post-implementation QA                                     |

## Context Management

- **Progressive disclosure** — start high-level, get specific as needed.
- **State checkpointing** — periodically summarize what's done, what's in progress, what's next.
- **Context pruning** — remove irrelevant context when no longer needed.
- **Completion promises** — define success criteria before starting work. "This task is complete when [verifiable conditions]."
```

**Success criteria:** Rules are injected as system message. Content is Hermes-native (no opencode references). `!!!` markers preserved.

#### 1.5 — skills/orchestrator.md

**What:** Adapt maestria's orchestrator agent prompt for Hermes skill format. Remove YAML frontmatter (permissions handled by Python hooks). Keep the methodology, delegation patterns, critical rules.

**Adaptation rules:**
- Remove YAML frontmatter block (`---...---`)
- Replace `task()` calls with `delegate_task` tool calls
- Replace `@agent` references with `delegate_task(specialist="agent")`
- Keep: CRITICAL RULES, Available Specialists table, Delegation Pattern, Anti-Patterns, Iteration Limits
- Keep: `!!!` markers, maker/checker split, commit authorization rules
- Update: Skill Prescription section — use Hermes skill names if known, otherwise mark as "TBD — validate against Hermes skill registry"

**Source:** `packages/opencode/agents/orchestrator.md` (266 lines)

**Success criteria:** Skill prompt is self-contained. No YAML frontmatter. All `task()` → `delegate_task`. All `@agent` → `specialist="agent"`.

#### 1.6 — skills/builder.md

**What:** Adapt builder agent prompt. Remove frontmatter. Keep process, implementation patterns, rules.

**Source:** `packages/opencode/agents/builder.md` (171 lines)

**Success criteria:** Same adaptation rules as 1.5. Skill prompt is self-contained.

#### 1.7 — skills/reviewer.md

**What:** Adapt reviewer agent prompt. Remove frontmatter. Keep review checklist, output format, rules.

**Source:** `packages/opencode/agents/reviewer.md` (173 lines)

**Success criteria:** Same adaptation rules as 1.5. Skill prompt is self-contained.

### Phase 1 Verification

| Check | How |
|---|---|
| Plugin loads | `hermes plugin list` shows `hermes-maestria` |
| Tool registered | `delegate_task` appears in tool list |
| Hooks fire | `pre_llm_call` injects rules (verify with debug logging) |
| Permission gate | `pre_tool_call` blocks `edit` for reviewer |
| Skill loadable | `orchestrator`, `builder`, `reviewer` skills load via `ctx.register_skill` |
| Slash command | `/review` routes to reviewer specialist |
| End-to-end | Invoke `delegate_task(specialist="builder", briefing="Read the README")` — specialist prompt loads, briefing is complete |

### Rollback Point

After Phase 1: plugin loads, 3 skills work, delegation tool routes correctly. Can ship as v0.1.0.

---

## Phase 2 (v0.2): Full Specialist Roster

**Goal:** Add remaining 4 specialists. Add slash commands. Add session state persistence.

### Dependencies

Phase 1 complete.

### Files to Add

```
skills/
├── adventurer.md     # Codebase reconnaissance
├── architect.md      # Architecture decisions, ADRs
├── diagnose.md       # Systematic bug tracing
├── planner.md        # Implementation plans
└── writer.md         # Documentation writing
```

### Files to Modify

```
__init__.py           # Register new skills, commands, hooks
plugin.py             # Add permission profiles, session hooks
rules/AGENTS.md       # Update delegation table with all 7 specialists
```

### Tasks

#### 2.1 — skills/adventurer.md

**What:** Adapt adventurer prompt. Read-only reconnaissance agent.

**Source:** `packages/opencode/agents/adventurer.md` (174 lines)

**Adaptation notes:**
- Remove frontmatter
- Keep: Mission, Process, Exploration Techniques, Complexity Tiers, Output Format
- Keep: `!!! Never edit files`, `!!! Never implement`, `!!! Never make design decisions`
- Update: Skill Prescription — mark `opensrc` as "clone external repos to temp dir"

**Success criteria:** Skill prompt is self-contained. Reconnaissance report format preserved.

#### 2.2 — skills/architect.md

**What:** Adapt architect prompt. Architecture decisions with decision matrices and ADRs.

**Source:** `packages/opencode/agents/architect.md` (157 lines)

**Adaptation notes:**
- Remove frontmatter
- Keep: 5-phase process (Understand → Present → Clarify → Recommend → Document)
- Keep: ADR template, Shortcut Rules, Iteration Limits
- Update: `opensrc` → "clone external repos"

**Success criteria:** Skill prompt is self-contained. ADR template preserved.

#### 2.3 — skills/diagnose.md

**What:** Adapt diagnose prompt. Systematic 6-step regression tracing.

**Source:** `packages/opencode/agents/diagnose.md` (166 lines)

**Adaptation notes:**
- Remove frontmatter
- Keep: 6-step process (Error → Environment → Git History → Blast Radius → Fix → Prevention)
- Keep: `!!! Always verify before handoff`, `!!! Document diagnostic work`
- Keep: Iteration Limits (max 3 fix attempts)

**Success criteria:** Skill prompt is self-contained. 6-step process preserved.

#### 2.4 — skills/planner.md

**What:** Adapt planner prompt. Implementation plans with phased milestones.

**Source:** `packages/opencode/agents/planner.md` (114 lines)

**Adaptation notes:**
- Remove frontmatter
- Keep: Structure (Goal, Phases, Tasks, Verification, Rollback Points)
- Keep: Handoff contract, Iteration Limits, Guard Rails
- Keep: `!!! Each phase must have verifiable completion criteria`

**Success criteria:** Skill prompt is self-contained. Plan structure preserved.

#### 2.5 — skills/writer.md

**What:** Adapt writer prompt. Documentation following structured patterns.

**Source:** `packages/opencode/agents/writer.md` (150 lines)

**Adaptation notes:**
- Remove frontmatter
- Keep: Structure (Purpose, Usage, Details), Principles, Patterns by Document Type
- Keep: `!!! Proofread before finishing`, `!!! Maker/checker split`
- Update: Skill Prescription — mark Hermes-available skills

**Success criteria:** Skill prompt is self-contained. Document type patterns preserved.

#### 2.6 — Register New Skills and Commands

**What:** Update `__init__.py` to register all 7 skills and 3 slash commands.

**Spec:**
```python
# In register(ctx):

# Register all skills
skills = ["orchestrator", "adventurer", "architect", "builder", "diagnose", "planner", "reviewer", "writer"]
skills_dir = Path(__file__).parent / "skills"
for skill_name in skills:
    ctx.register_skill(skill_name, skills_dir / f"{skill_name}.md")

# Register slash commands
ctx.register_command("plan", handler=plan_handler, description="Route to planner specialist")
ctx.register_command("review", handler=review_handler, description="Route to reviewer specialist")
ctx.register_command("diagnose", handler=diagnose_handler, description="Route to diagnose specialist")
```

**Success criteria:** All 7 skills registered. 3 slash commands work.

#### 2.7 — Permission Profiles for New Specialists

**What:** Add permission profiles for adventurer, architect, diagnose, planner, writer in `plugin.py`.

**Spec (derived from maestria frontmatter):**

| Specialist  | read | glob | grep | edit | bash | skill | webfetch |
|-------------|------|------|------|------|------|-------|----------|
| adventurer  | allow | allow | allow | deny | ask (git log/diff/which: allow) | allow | allow |
| architect   | allow | allow | allow | deny | ask (which/npm view: allow) | allow | allow |
| diagnose    | allow | allow | allow | ask | ask (git status/diff/log/blame/show/which/env/pwd: allow) | allow | allow |
| planner     | allow | allow | allow | ask | ask (git status/diff/log: allow) | allow | allow |
| writer      | allow | allow | allow | allow | ask (git status/npm view: allow) | allow | allow |

**Success criteria:** `pre_tool_call` hook enforces correct permissions for all 7 specialists. Reviewer can't edit. Orchestrator can't bash (except allow-listed). Builder's bash is `ask`.

#### 2.8 — Session State Hooks

**What:** Implement `on_session_start` and `on_session_end` hooks for state persistence via file-based storage (no `ctx.get_state/set_state` APIs exist).

**Spec:**
```python
import json
from pathlib import Path

_STATE_FILE = Path(__file__).parent / ".state.json"
_active_specialist = "orchestrator"

def _load_state():
    global _active_specialist
    if _STATE_FILE.exists():
        data = json.loads(_STATE_FILE.read_text())
        _active_specialist = data.get("active_specialist", "orchestrator")

def _save_state():
    _STATE_FILE.write_text(json.dumps({
        "active_specialist": _active_specialist,
    }))

def on_session_start(session_id, model, platform, **kwargs):
    """Restore active specialist state from previous session."""
    _load_state()

def on_session_end(session_id, completed, interrupted, model, platform, **kwargs):
    """Persist active specialist state."""
    _save_state()
```

**Register in `__init__.py`:**
```python
ctx.register_hook("on_session_start", on_session_start)
ctx.register_hook("on_session_end", on_session_end)
```

**Note:** `pre_tool_call_enforce_permissions` reads `_active_specialist` module variable directly instead of `ctx.get_state()`.

**Success criteria:** State persists across sessions. Active specialist is restored on restart.

#### 2.9 — Update Global Rules

**What:** Update `rules/AGENTS.md` delegation table to include all 7 specialists.

**Spec:** Add adventurer, architect, diagnose, planner, writer to the delegation table.

**Success criteria:** Rules injection includes all 7 specialists in the table.

### Phase 2 Verification

| Check | How |
|---|---|
| All skills load | `hermes skill list` shows all 7 |
| All commands work | `/plan`, `/review`, `/diagnose` route correctly |
| Permission profiles | `pre_tool_call` enforces correct permissions for all 7 |
| Session persistence | Restart Hermes, verify state restored |
| Global rules | Rules injection includes full specialist table |

### Rollback Point

After Phase 2: full 7-specialist roster, 3 slash commands, session persistence. Can ship as v0.2.0.

---

## Phase 3 (v0.3): Advanced Features

**Goal:** Parallel delegation, MCP integration, skill prescription, shared prompt library.

### Dependencies

Phase 2 complete.

### Tasks

#### 3.1 — Parallel Delegation Support

**What:** Allow `delegate_task` to accept multiple specialists in a single call for fan-out patterns.

**Schema change:**
```python
schema={
    "type": "object",
    "properties": {
        "tasks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "specialist": {"type": "string", "enum": [...]},
                    "briefing": {"type": "string"},
                },
                "required": ["specialist", "briefing"],
            },
            "description": "Multiple delegations to run in parallel (max 5)",
        },
    },
    "required": ["tasks"],
}
```

**Handler:** Dispatch all tasks, collect results, return merged handoffs.

**Success criteria:** `delegate_task(tasks=[{...}, {...}])` returns both results. Max 5 tasks enforced.

#### 3.2 — MCP Integration

**What:** Register the `delegate_task` tool as an MCP tool so external MCP clients can invoke specialist delegation.

**Spec:** Use Hermes MCP bridge to expose `delegate_task` as an MCP tool endpoint.

**Success criteria:** External MCP client can call `delegate_task` and receive specialist output.

#### 3.3 — Skill Prescription

**What:** Implement the skill prescription pattern from ADR-004 — each specialist skill defines "Always load", "Load on trigger", "Defer to specialist", "Skip if" buckets.

**Spec:** Parse skill prescription sections from specialist markdown files. Before delegation, check if prescribed skills are available. If not, prompt user for installation (bundled question per ADR-005).

**Success criteria:** Orchestrator checks skill prescription before delegation. Missing skills trigger bundled install prompt.

#### 3.4 — Shared Prompt Library

**What:** Create a `prompts/` directory with extracted, platform-agnostic prompt fragments that both `@maestria/opencode` and `hermes-maestria` can reference.

**Spec:**
```
prompts/
├── orchestration-principles.md    # Cross-cutting rules
├── specialist-registry.md         # Specialist table
├── delegation-pattern.md          # Briefing template
├── iteration-limits.md            # Standard iteration limits
└── rules-bullets.md               # Standard rules bullets (maker/checker, validate, ambiguity, parallelization)
```

**Success criteria:** Both plugins can import from `prompts/`. No duplication of core principles.

#### 3.5 — Post-Tool-Call Observability Hook

**What:** Implement `post_tool_call` hook for logging and observation.

**Spec:**
```python
async def post_tool_call_observe(ctx, tool_name, args, result):
    """Log tool calls for observability."""
    specialist = ctx.get_state("active_specialist", default="orchestrator")
    ctx.log(f"[{specialist}] {tool_name}: {args.get('command', args.get('path', ''))[:80]}")
```

**Success criteria:** Tool calls are logged with active specialist context.

### Phase 3 Verification

| Check | How |
|---|---|
| Parallel delegation | `delegate_task(tasks=[...])` returns merged results |
| MCP exposure | External MCP client can invoke `delegate_task` |
| Skill prescription | Missing skills trigger install prompt |
| Shared prompts | Both plugins reference same prompt fragments |
| Observability | `post_tool_call` logs specialist + tool + args |

### Rollback Point

After Phase 3: full feature set. Can ship as v0.3.0.

---

## Migration Path: maestria Prompts → Hermes Skills

### Process

For each agent prompt in `packages/opencode/agents/*.md`:

1. **Strip YAML frontmatter** — permissions are handled by Python hooks, not declarative frontmatter
2. **Replace `task()` calls** with `delegate_task` tool invocations
3. **Replace `@agent` references** with `specialist="agent"` syntax
4. **Replace opencode-specific tools** (`lsp`, `opensrc`) with Hermes equivalents or generic guidance
5. **Keep everything else** — methodology, `!!!` markers, iteration limits, rules bullets, handoff contracts, skill prescription

### Template

```markdown
# [Agent Name]

[Rest of agent prompt — no YAML frontmatter]

## Hermes Adaptations

- `task(agent, briefing)` → `delegate_task(specialist="agent", briefing=briefing)`
- `@agent` → `specialist="agent"`
- `opensrc path <repo>` → `git clone <repo> /tmp/<repo> && read locally`
- `lsp` tool → remove (Hermes may not have LSP; use grep/read instead)
```

---

## Testing Strategy

### Unit Tests

- `test_permission_profiles.py` — Verify each specialist's permission profile blocks/permits correctly
- `test_delegate_task_handler.py` — Verify tool routing, briefing composition, skill loading
- `test_rules_injection.py` — Verify `pre_llm_call` injects correct rules content
- `test_session_state.py` — Verify state persistence across start/end hooks

### Integration Tests

- `test_end_to_end_delegation.py` — Invoke `delegate_task`, verify specialist prompt loads, verify output format
- `test_slash_commands.py` — Invoke `/plan`, `/review`, `/diagnose`, verify routing
- `test_permission_enforcement.py` — Attempt blocked operations, verify rejection

### Manual Tests

- Load plugin in Hermes, run `/review` on a real diff
- Verify global rules appear in system context
- Verify `pre_tool_call` blocks reviewer from editing files
- Verify session state persists across restart

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hermes `register(ctx)` API changes | Medium | High | Pin Hermes version in `plugin.yaml`. Monitor Hermes changelog. |
| Skill loading mechanism differs from spec | Medium | High | Validate `ctx.register_skill` signature early in Phase 1. |
| `pre_tool_call` hook signature wrong | Medium | Medium | Verify hook contract with Hermes docs before implementation. |
| MCP integration complexity | Low | Medium | Defer to Phase 3. MCP is additive, not core. |
| Permission profiles too restrictive/lenient | Low | Medium | Start permissive (ADR-006), tighten based on real usage. |
| Shared prompt library creates coupling | Low | Low | Prompts are reference-only, not runtime dependency. |

---

## Open Questions / Assumptions

### Assumptions to Validate

1. ✅ **Hermes `register(ctx)` signature** — Confirmed. Entry point is `register(ctx)`.
2. ✅ **`ctx.register_skill(name, path)` signature** — Confirmed. Takes name string and path.
3. ⚠️ **`ctx.inject_message(text, role)` signature** — Partially correct. Hook does NOT use `ctx.inject_message`. Instead, `pre_llm_call` returns `{"context": rules_text}` to inject context.
4. ✅ **`ctx.register_hook(hook_name, fn)` hook names** — Confirmed: `pre_llm_call`, `pre_tool_call`, `on_session_start`, `on_session_end`.
5. ✅ **`ctx.register_command(name, handler, description)` signature** — Confirmed.
6. ✅ **`ctx.dispatch_tool(name, args)` availability** — Confirmed.
7. ❌ **`ctx.get_state/set_state/load_state/save_state` API** — **Not found.** Use module-level variables and file-based persistence instead.
8. ❌ **Hook return values for `pre_tool_call`** — **Wrong format.** Not `(bool, str)` tuple. Return `{"action": "block", "message": "..."}` to block, `None` to allow. No "ask" behavior.
9. ❌ **Hook callback signatures receive `ctx`** — **Wrong.** All hooks receive their specific arguments directly (no `ctx` param). See Fix 1 details.

### Open Questions

1. **Does Hermes support toolset grouping?** — We use `toolset="maestria"` in `register_tool`. Does Hermes group tools by toolset? Or is it metadata-only?
2. **How does Hermes handle slash command arguments?** — Does `/review` pass args to the handler? Or does the handler need to read context?
3. **Is there a Hermes skill registry/marketplace?** — For skill prescription (Phase 3), we need to know if skills can be discovered/installed programmatically.
4. **What is the Hermes plugin lifecycle?** — When exactly does `register()` run? Once per session? Once per startup?
5. ✅ **Can hooks block tool execution?** — Confirmed. `pre_tool_call` returns `{"action": "block", "message": "..."}` to block, `None` to allow.

### Additional APIs Discovered

Note these as useful for future phases:
- `ctx.llm` — host-owned LLM facade for plugin-initiated completions (could spawn specialists)
- `transform_tool_result` hook — transform tool results before returning to model
- `transform_llm_output` hook — transform final LLM response before delivery
- `ctx.register_cli_command` — register `hermes maestria` CLI subcommands
- `ctx.register_middleware` — register behavior-changing middleware

---

## Summary

| Phase | Milestone | Deliverables | Timeline |
|---|---|---|---|
| Phase 1 | Core Loop | plugin.yaml, __init__.py, plugin.py, 3 skills, 1 tool, 2 hooks, 1 command | v0.1.0 |
| Phase 2 | Full Roster | 4 more skills, 2 more commands, session persistence, full permissions | v0.2.0 |
| Phase 3 | Advanced | Parallel delegation, MCP, skill prescription, shared prompts, observability | v0.3.0 |

**Termination condition:** All phases have success criteria, all dependencies mapped, all rollback points identified, all assumptions documented.
