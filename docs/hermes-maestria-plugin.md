# hermes-maestria — Implementation Plan

## Goal

Build a standalone Hermes plugin (`hermes-maestria`) that carries forward maestria's orchestration patterns — specialist delegation, global rules injection, permission enforcement — into the Hermes agent framework with a **domain-agnostic 9-specialist roster** covering all work domains: coding, research, analysis, communication, and creative work. No runtime coupling to `@maestria/opencode`. Each plugin optimized for its platform.

## Architecture Decision

### Separate Products, Shared Ideas (Option C)

Build `hermes-maestria` as a standalone Hermes plugin. Share orchestration principles with `@maestria/opencode`, but no runtime coupling.

**Why:**

1. Plugin models are too different for tight coupling — TypeScript config hook vs Python `register(ctx)`
2. The valuable part is the *ideas* (orchestration principles, specialist methodology, ADR patterns), not the code
3. Hermes has unique strengths to exploit: slash commands, 10+ hooks, `ctx.dispatch_tool`, MCP integration, Python ecosystem

### ADR-008: General-Purpose Specialist Roster

The original maestria roster (7 coding-focused agents) is too narrow for Hermes, which serves users across all work domains. The new roster expands to 9 domain-agnostic specialists with clear boundaries and universal methodologies.

**Decision:** Replace coding-specific agent names (`adventurer`, `architect`, `builder`, `diagnose`) with domain-agnostic names (`researcher`, `analyst`, `implementer`, `diagnostician`). Add two new specialists (`communicator`, `ideator`) for stakeholder messaging and creative exploration.

**Consequences:**
- Specialist names describe *what they do*, not *what domain they work in*
- Pipelines compose specialists across domains (e.g., `researcher → communicator → reviewer` for stakeholder updates)
- The orchestrator can route any request type, not just code tasks

### Mapping: maestria Concepts → Hermes Equivalents

| maestria Concept | Hermes Equivalent | Notes |
|---|---|---|
| Agent mode (subagent/primary/all) | No equivalent | All "agents" are skills loaded on demand |
| `task()` delegation | `delegate_task` tool | Tool-based, not native call |
| `input.instructions` | `pre_llm_call` hook | Returns context string |
| YAML frontmatter permissions | `pre_tool_call` hook | Imperative, not declarative |
| `session.compacting` | `on_session_start/end` hooks | More hooks available |
| Agent config (`edit:deny`, `bash:allow`) | Python guard functions | Must implement per-tool gating |

### Specialist Roster Mapping

| Old Name (maestria) | New Name (hermes-maestria) | Domain | Core Methodology |
|---|---|---|---|
| adventurer | `researcher` | Information gathering, analysis, synthesis | Scope → source → extract → verify → report |
| architect | `analyst` | Decisions, evaluation, trade-off analysis | Context → options → compare → recommend → document |
| builder | `implementer` | Focused execution — code, config, content creation | Read → execute → verify → report |
| diagnose | `diagnostician` | Root cause analysis, systematic tracing | Error → environment → history → blast radius → fix → prevention |
| planner | `planner` | Phased plans, roadmaps, prioritization | Goal → phases → tasks → verification → rollback |
| reviewer | `reviewer` | Quality gates, validation, feedback | Checklist → inspect → classify → recommend |
| writer | `writer` | Structured documentation, content | Purpose → usage → details → proofread |
| — | `communicator` | Stakeholder messaging, emails, updates | Audience → intent → draft → review → send |
| — | `ideator` | Brainstorming, creative exploration, design | Diverge → converge → prototype → evaluate |

### Key Design Principles (carried from ADRs)

- **ADR-001**: Global rules are cross-cutting, not per-agent. Specialist-specific behavior lives in skill prompts.
- **ADR-002**: Pure plugin — no filesystem side effects outside the plugin directory.
- **ADR-003**: `!!!` markers for critical rules, cross-references between specialists, skill prescription pattern.
- **ADR-004**: 4-bucket skill prescription, 5-section handoff, iteration limits, rules bullets.
- **ADR-005**: Orchestrator-direct skill installs, bundled questions, `--help` as source of truth.
- **ADR-006**: Permissions are permissive by default; directives encode policy.
- **ADR-007**: `opensrc` for repos, `webfetch` for pages.
- **ADR-008**: Domain-agnostic specialist roster — names describe function, not domain.

---

## Default Pipelines

| Pipeline | Sequence | Use Case |
|---|---|---|
| Implementation | `researcher → analyst → implementer → reviewer` | Building features, writing code, creating configs |
| Bug fix | `diagnostician → implementer → reviewer` | Fixing failures, regressions, errors |
| Planning | `researcher → planner → reviewer` | Roadmaps, migrations, prioritization |
| Content | `researcher → writer → reviewer` | Documentation, READMEs, changelogs |
| Communication | `researcher → communicator → reviewer` | Emails, status updates, stakeholder messages |
| Creative | `ideator → analyst → implementer` | Brainstorming, design exploration, new ideas |

## Routing Rules

| Signal | Specialist | Pipeline |
|---|---|---|
| "how does X work", "find all…", "explain" | `researcher` | — |
| "should we use X or Y", "evaluate", "compare" | `analyst` | — |
| "build X", "fix Y", "create Z", "implement" | `implementer` | `researcher → implementer → reviewer` |
| "bug", "broken", "failing", "regression" | `diagnostician` | `diagnostician → implementer → reviewer` |
| "plan X", "roadmap", "prioritize", "migrate" | `planner` | `researcher → planner → reviewer` |
| "review this", "check my work", "QA" | `reviewer` | — |
| "document X", "write README", "changelog" | `writer` | — |
| "email X", "update stakeholders", "draft message" | `communicator` | — |
| "brainstorm", "ideas for", "creative", "design" | `ideator` | `ideator → analyst` (converge) |
| Complex/multi-domain/ambiguous | `orchestrator` | Orchestrator decides |

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
│   ├── orchestrator.md      # Manager — decompose, delegate, integrate
│   ├── implementer.md       # Focused execution of atomic tasks
│   └── reviewer.md          # Quality gates and validation
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
description: Orchestration plugin with domain-agnostic specialist delegation
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
                    "enum": ["orchestrator", "implementer", "reviewer"],
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
        description="Route to reviewer specialist for quality review",
    )

    # Register skills
    skills_dir = Path(__file__).parent / "skills"
    ctx.register_skill("orchestrator", skills_dir / "orchestrator.md")
    ctx.register_skill("implementer", skills_dir / "implementer.md")
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
    "implementer": {
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
- `delegate_task` tool can be invoked with `{"specialist": "implementer", "briefing": "Fix the typo in README.md"}`
- `pre_llm_call` hook injects global rules as a system message before every LLM call
- `pre_tool_call` hook blocks `edit` for reviewer, blocks `bash` for orchestrator (except allow-listed commands)
- Permission profiles match the domain-agnostic specialist specs

#### 1.4 — rules/AGENTS.md (Global Rules)

**What:** Domain-agnostic global rules for hermes-maestria. No coding-specific references.

**Content:**
```markdown
# Global Agent Rules — hermes-maestria

## Orchestration

- **!!! Don't assume** — verify against actual sources.
  Guesses lead to errors.
- **!!! Read/watch/listen first** — before acting on unfamiliar
  tools, APIs, data, or domains, consult the source material.
  Don't guess at behavior. This rule is scar tissue from
  repeated failures, not a preference.
- **Don't reference internal project names in explanations** — avoid
  leaking context outside the workspace.

## Delegation

When delegating work via `delegate_task`, use only the registered
specialists below. **Never delegate to built-in agents** — they are
not part of the specialist pipeline.

| Specialist      | Role                                    | When to Delegate                                                     |
| --------------- | --------------------------------------- | -------------------------------------------------------------------- |
| `researcher`    | Information gathering and synthesis     | Understanding unfamiliar domains, gathering context, finding sources |
| `analyst`       | Decisions, evaluation, trade-offs       | Comparing options, evaluating approaches, making recommendations     |
| `implementer`   | Focused execution of atomic tasks       | Concrete, scoped tasks with no ambiguity — code, config, content     |
| `diagnostician` | Systematic root cause analysis          | Debugging failures, tracing regressions, investigating errors        |
| `planner`       | Phased plans with milestones            | Complex features, rollouts, migrations, prioritization               |
| `reviewer`      | Quality gates and validation            | Pre-submit review, QA, security audit, completeness checks           |
| `writer`        | Structured documentation and content    | READMEs, docs, changelogs, ADRs, explanations                        |
| `communicator`  | Stakeholder messaging and updates       | Emails, status updates, team messages, cross-platform comms          |
| `ideator`       | Brainstorming and creative exploration  | Generating ideas, exploring design spaces, creative direction        |

## Context Management

- **Progressive disclosure** — start high-level, get specific as needed.
- **State checkpointing** — periodically summarize what's done, what's
  in progress, what's next.
- **Context pruning** — remove irrelevant context when no longer needed.
- **Completion promises** — define success criteria before starting work.
  "This task is complete when [verifiable conditions]."
```

**Success criteria:** Rules are injected as system message. Content is domain-agnostic (no coding-only references). `!!!` markers preserved. All 9 specialists listed in delegation table.

#### 1.5 — skills/orchestrator.md

**What:** Adapt maestria's orchestrator agent prompt for Hermes skill format. Remove YAML frontmatter (permissions handled by Python hooks). Keep the methodology, delegation patterns, critical rules. Update specialist names to domain-agnostic roster.

**Adaptation rules:**
- Remove YAML frontmatter block (`---...---`)
- Replace `task()` calls with `delegate_task` tool calls
- Replace `@agent` references with `delegate_task(specialist="agent")`
- Replace old specialist names: `adventurer` → `researcher`, `architect` → `analyst`, `builder` → `implementer`, `diagnose` → `diagnostician`
- Add new specialists: `communicator`, `ideator`
- Keep: CRITICAL RULES, Available Specialists table, Delegation Pattern, Anti-Patterns, Iteration Limits
- Keep: `!!!` markers, maker/checker split, commit authorization rules
- Update: Skill Prescription section — use Hermes skill names

**Source:** `packages/opencode/agents/orchestrator.md` (266 lines)

**Success criteria:** Skill prompt is self-contained. No YAML frontmatter. All `task()` → `delegate_task`. All old names → new names. 9 specialists in roster.

#### 1.6 — skills/implementer.md

**What:** Adapt builder agent prompt to `implementer`. Remove frontmatter. Keep process, implementation patterns, rules. Generalize beyond code — implementer handles any focused execution (code, config, content creation).

**Source:** `packages/opencode/agents/builder.md` (171 lines)

**Adaptation notes:**
- Rename from `builder` to `implementer`
- Generalize language: "code" → "work product" where appropriate
- Keep: process, implementation patterns, rules
- Keep: `!!!` markers, verification steps

**Success criteria:** Skill prompt is self-contained. Domain-agnostic language. Process preserved.

#### 1.7 — skills/reviewer.md

**What:** Adapt reviewer agent prompt. Remove frontmatter. Keep review checklist, output format, rules. Generalize beyond code review — reviewer handles quality gates for any work domain.

**Source:** `packages/opencode/agents/reviewer.md` (173 lines)

**Adaptation notes:**
- Generalize: "code review" → "quality review" where appropriate
- Keep: review checklist, output format, rules
- Keep: `!!!` markers, maker/checker split

**Success criteria:** Skill prompt is self-contained. Quality gate methodology preserved.

### Phase 1 Verification

| Check | How |
|---|---|
| Plugin loads | `hermes plugin list` shows `hermes-maestria` |
| Tool registered | `delegate_task` appears in tool list |
| Hooks fire | `pre_llm_call` injects rules (verify with debug logging) |
| Permission gate | `pre_tool_call` blocks `edit` for reviewer |
| Skill loadable | `orchestrator`, `implementer`, `reviewer` skills load via `ctx.register_skill` |
| Slash command | `/review` routes to reviewer specialist |
| End-to-end | Invoke `delegate_task(specialist="implementer", briefing="Read the README")` — specialist prompt loads, briefing is complete |
| Domain-agnostic | Global rules contain no coding-only references |

### Rollback Point

After Phase 1: plugin loads, 3 skills work, delegation tool routes correctly. Can ship as v0.1.0.

---

## Phase 2 (v0.2): Full Specialist Roster

**Goal:** Add remaining 6 specialists. Add slash commands. Add session state persistence. Full permission profiles for all 9 specialists.

### Dependencies

Phase 1 complete.

### Files to Add

```
skills/
├── researcher.md      # Information gathering and synthesis
├── analyst.md         # Decisions, evaluation, trade-offs
├── diagnostician.md   # Systematic root cause analysis
├── planner.md         # Phased plans, roadmaps, prioritization
├── writer.md          # Structured documentation and content
├── communicator.md    # Stakeholder messaging and updates
└── ideator.md         # Brainstorming and creative exploration
```

### Files to Modify

```
__init__.py           # Register new skills, commands, hooks
plugin.py             # Add permission profiles, session hooks
rules/AGENTS.md       # Already has all 9 from Phase 1 (verify)
```

### Tasks

#### 2.1 — skills/researcher.md

**What:** Adapt adventurer prompt to `researcher`. Generalize beyond codebase reconnaissance — researcher handles information gathering in any domain.

**Source:** `packages/opencode/agents/adventurer.md` (174 lines)

**Adaptation notes:**
- Rename from `adventurer` to `researcher`
- Generalize: "codebase" → "sources", "code" → "information"
- Keep: Mission, Process, Exploration Techniques, Complexity Tiers, Output Format
- Keep: `!!! Never edit files`, `!!! Never implement`, `!!! Never make design decisions`
- Update: Skill Prescription — mark `opensrc` as "clone external repos to temp dir"

**Success criteria:** Skill prompt is self-contained. Reconnaissance report format preserved. Domain-agnostic language.

#### 2.2 — skills/analyst.md

**What:** Adapt architect prompt to `analyst`. Generalize beyond architecture decisions — analyst handles evaluation and trade-off analysis in any domain.

**Source:** `packages/opencode/agents/architect.md` (157 lines)

**Adaptation notes:**
- Rename from `architect` to `analyst`
- Generalize: "architecture" → "decisions", "system design" → "evaluation"
- Keep: 5-phase process (Understand → Present → Clarify → Recommend → Document)
- Keep: ADR template, Shortcut Rules, Iteration Limits
- Update: `opensrc` → "clone external repos"

**Success criteria:** Skill prompt is self-contained. Decision framework preserved. Domain-agnostic language.

#### 2.3 — skills/diagnostician.md

**What:** Adapt diagnose prompt to `diagnostician`. Keep systematic 6-step root cause analysis. Generalize beyond code bugs — diagnostician handles failure analysis in any domain.

**Source:** `packages/opencode/agents/diagnose.md` (166 lines)

**Adaptation notes:**
- Rename from `diagnose` to `diagnostician`
- Generalize: "bug" → "failure", "regression" → "unexpected behavior"
- Keep: 6-step process (Error → Environment → History → Blast Radius → Fix → Prevention)
- Keep: `!!! Always verify before handoff`, `!!! Document diagnostic work`
- Keep: Iteration Limits (max 3 fix attempts)

**Success criteria:** Skill prompt is self-contained. 6-step process preserved. Domain-agnostic language.

#### 2.4 — skills/planner.md

**What:** Adapt planner prompt. Keep phased plan structure. Generalize beyond implementation plans — planner handles roadmaps, migrations, and prioritization in any domain.

**Source:** `packages/opencode/agents/planner.md` (114 lines)

**Adaptation notes:**
- Generalize: "implementation plan" → "plan" where appropriate
- Keep: Structure (Goal, Phases, Tasks, Verification, Rollback Points)
- Keep: Handoff contract, Iteration Limits, Guard Rails
- Keep: `!!! Each phase must have verifiable completion criteria`

**Success criteria:** Skill prompt is self-contained. Plan structure preserved. Domain-agnostic language.

#### 2.5 — skills/writer.md

**What:** Adapt writer prompt. Keep structured documentation patterns. Generalize beyond code documentation — writer handles any structured content.

**Source:** `packages/opencode/agents/writer.md` (150 lines)

**Adaptation notes:**
- Keep: Structure (Purpose, Usage, Details), Principles, Patterns by Document Type
- Keep: `!!! Proofread before finishing`, `!!! Maker/checker split`
- Update: Skill Prescription — mark Hermes-available skills

**Success criteria:** Skill prompt is self-contained. Document type patterns preserved.

#### 2.6 — skills/communicator.md

**What:** New specialist for stakeholder messaging. Follows the Audience → Intent → Draft → Review → Send methodology.

**Spec:**
```markdown
# Communicator

Stakeholder messaging, emails, status updates, cross-platform communications.

## Methodology

1. **Audience** — Identify who receives the message, their context, their needs
2. **Intent** — Clarify what the message should achieve (inform, request, update, persuade)
3. **Draft** — Write the message in appropriate tone and format for the platform
4. **Review** — Check for clarity, completeness, tone, and correctness
5. **Send** — Deliver via the appropriate channel

## Rules

- **!!! Know your audience** — tone, detail level, and format depend on who reads it
- **!!! One message, one purpose** — don't bundle unrelated asks
- **!!! Proofread before sending** — typos in stakeholder comms erode trust
- Never send without confirming the recipient and channel
- Match the platform's conventions (email vs Slack vs formal memo)

## Output Format

- Subject/purpose line
- Body with clear structure (context → action → deadline if applicable)
- Sign-off appropriate to the platform
```

**Success criteria:** Skill prompt is self-contained. Communication methodology is clear and actionable.

#### 2.7 — skills/ideator.md

**What:** New specialist for brainstorming and creative exploration. Follows the Diverge → Converge → Prototype → Evaluate methodology.

**Spec:**
```markdown
# Ideator

Brainstorming, creative exploration, design thinking.

## Methodology

1. **Diverge** — Generate many ideas without judgment. Quantity over quality.
2. **Converge** — Cluster, filter, and rank ideas by feasibility and impact.
3. **Prototype** — Sketch or describe the top ideas in enough detail to evaluate.
4. **Evaluate** — Assess prototypes against criteria. Recommend top options.

## Rules

- **!!! No premature convergence** — diverge first, evaluate later
- **!!! Quantity drives quality** — more ideas = better final selection
- **!!! Build on others' ideas** — combine and extend, don't just filter
- Never dismiss an idea during the diverge phase
- Use analogies and cross-domain references to spark novel ideas

## Output Format

- Diverge: list of 10+ ideas (brief descriptions)
- Converge: top 3-5 clusters with rationale
- Prototype: detailed sketch/description of top 2-3
- Evaluate: recommendation with trade-off analysis
```

**Success criteria:** Skill prompt is self-contained. Creative methodology is clear and actionable.

#### 2.8 — Register New Skills and Commands

**What:** Update `__init__.py` to register all 9 skills and 6 slash commands.

**Spec:**
```python
# In register(ctx):

# Register all skills
skills = [
    "orchestrator", "researcher", "analyst", "implementer",
    "diagnostician", "planner", "reviewer", "writer",
    "communicator", "ideator",
]
skills_dir = Path(__file__).parent / "skills"
for skill_name in skills:
    ctx.register_skill(skill_name, skills_dir / f"{skill_name}.md")

# Register slash commands
ctx.register_command("review", handler=review_handler, description="Route to reviewer specialist")
ctx.register_command("plan", handler=plan_handler, description="Route to planner specialist")
ctx.register_command("diagnose", handler=diagnose_handler, description="Route to diagnostician specialist")
ctx.register_command("research", handler=research_handler, description="Route to researcher specialist")
ctx.register_command("brainstorm", handler=brainstorm_handler, description="Route to ideator specialist")
ctx.register_command("communicate", handler=communicate_handler, description="Route to communicator specialist")
```

**Success criteria:** All 9 skills registered. 6 slash commands work.

#### 2.9 — Permission Profiles for All Specialists

**What:** Add permission profiles for researcher, analyst, diagnostician, planner, writer, communicator, ideator in `plugin.py`.

**Spec (derived from maestria frontmatter, generalized):**

| Specialist      | read | glob | grep | edit | bash | skill | webfetch |
|-----------------|------|------|------|------|------|-------|----------|
| orchestrator    | allow | allow | allow | deny | deny (git status/diff/log: allow) | allow | — |
| researcher      | allow | allow | allow | deny | deny (git log/diff/which: allow) | allow | allow |
| analyst         | allow | allow | allow | deny | deny (which/npm view: allow) | allow | allow |
| implementer     | allow | allow | allow | allow | allow | allow | — |
| diagnostician   | allow | allow | allow | ask | ask (git status/diff/log/blame/show/which/env/pwd: allow) | allow | allow |
| planner         | allow | allow | allow | ask | ask (git status/diff/log: allow) | allow | allow |
| reviewer        | allow | allow | allow | deny | allow (git status/diff/log: allow) | allow | — |
| writer          | allow | allow | allow | allow | ask (git status/npm view: allow) | allow | allow |
| communicator    | allow | allow | allow | deny | deny | allow | allow |
| ideator         | allow | allow | allow | deny | deny | allow | allow |

**Note:** `ask` is not a native Hermes hook return value. Use `allow` for tools the specialist needs and `deny` for those it doesn't. Where `ask` is listed, implement as `allow` with a log warning (future: prompt user before execution).

**Success criteria:** `pre_tool_call` hook enforces correct permissions for all 9 specialists. Reviewer can't edit. Orchestrator can't bash (except allow-listed). Communicator and ideator are read-only.

#### 2.10 — Session State Hooks

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

### Phase 2 Verification

| Check | How |
|---|---|
| All skills load | `hermes skill list` shows all 9 |
| All commands work | `/review`, `/plan`, `/diagnose`, `/research`, `/brainstorm`, `/communicate` route correctly |
| Permission profiles | `pre_tool_call` enforces correct permissions for all 9 |
| Session persistence | Restart Hermes, verify state restored |
| Global rules | Rules injection includes full 9-specialist table |
| New specialists | `communicator` and `ideator` skills load and have correct methodology |

### Rollback Point

After Phase 2: full 9-specialist roster, 6 slash commands, session persistence, full permissions. Can ship as v0.2.0.

---

## Phase 3 (v0.3): Advanced Features

**Goal:** Parallel delegation, MCP integration, automation (schedule_task), skill prescription, shared prompt library, memory integration.

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

#### 3.3 — Automation (schedule_task tool)

**What:** Register a `schedule_task` tool for cron-based automation. Automation is a trigger mechanism, not a specialist — it dispatches to the appropriate specialist on schedule.

**Spec:**
```python
ctx.register_tool(
    name="schedule_task",
    toolset="maestria",
    schema={
        "type": "object",
        "properties": {
            "cron": {"type": "string", "description": "Cron expression"},
            "specialist": {
                "type": "string",
                "enum": ["orchestrator", "researcher", "analyst", "implementer",
                         "diagnostician", "planner", "reviewer", "writer",
                         "communicator", "ideator"],
                "description": "Which specialist to delegate to on schedule"
            },
            "briefing": {"type": "string", "description": "Task briefing for the specialist"},
        },
        "required": ["cron", "specialist", "briefing"],
    },
    handler=handle_schedule_task,
)
```

**Handler:** Store scheduled tasks in `.state.json`. On `on_session_start`, check for due tasks and dispatch.

**Success criteria:** `schedule_task` registers. Cron expression is parsed. Due tasks dispatch to correct specialist on session start.

#### 3.4 — Skill Prescription

**What:** Implement the skill prescription pattern from ADR-004 — each specialist skill defines "Always load", "Load on trigger", "Defer to specialist", "Skip if" buckets.

**Spec:** Parse skill prescription sections from specialist markdown files. Before delegation, check if prescribed skills are available. If not, prompt user for installation (bundled question per ADR-005).

**Success criteria:** Orchestrator checks skill prescription before delegation. Missing skills trigger bundled install prompt.

#### 3.5 — Shared Prompt Library

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

#### 3.6 — Memory Integration

**What:** Integrate with Hermes memory system (if available) for cross-session context retention. Store specialist decisions, research findings, and evaluation outcomes.

**Spec:** Use `on_session_end` to persist key findings to a memory store. Use `on_session_start` to restore relevant context. Fall back to file-based `.state.json` if no memory API exists.

**Success criteria:** Key findings persist across sessions. Specialist context is available without re-research.

#### 3.7 — Post-Tool-Call Observability Hook

**What:** Implement `post_tool_call` hook for logging and observation.

**Spec:**
```python
async def post_tool_call_observe(tool_name, args, result, **kwargs):
    """Log tool calls for observability."""
    specialist = _active_specialist
    # Log to file or stdout
    print(f"[{specialist}] {tool_name}: {args.get('command', args.get('path', ''))[:80]}")
```

**Success criteria:** Tool calls are logged with active specialist context.

### Phase 3 Verification

| Check | How |
|---|---|
| Parallel delegation | `delegate_task(tasks=[...])` returns merged results |
| MCP exposure | External MCP client can invoke `delegate_task` |
| Automation | `schedule_task` registers and dispatches on schedule |
| Skill prescription | Missing skills trigger install prompt |
| Shared prompts | Both plugins reference same prompt fragments |
| Memory | Key findings persist across sessions |
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
4. **Rename specialists** — `adventurer` → `researcher`, `architect` → `analyst`, `builder` → `implementer`, `diagnose` → `diagnostician`
5. **Replace opencode-specific tools** (`lsp`, `opensrc`) with Hermes equivalents or generic guidance
6. **Generalize language** — remove coding-specific terminology where the specialist's domain is broader
7. **Keep everything else** — methodology, `!!!` markers, iteration limits, rules bullets, handoff contracts, skill prescription

### Template

```markdown
# [Specialist Name]

[Rest of specialist prompt — no YAML frontmatter]

## Hermes Adaptations

- `task(agent, briefing)` → `delegate_task(specialist="agent", briefing=briefing)`
- `@agent` → `specialist="agent"`
- `adventurer` → `researcher`, `architect` → `analyst`, `builder` → `implementer`, `diagnose` → `diagnostician`
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
- `test_routing_rules.py` — Verify signal-to-specialist routing matches the routing table

### Integration Tests

- `test_end_to_end_delegation.py` — Invoke `delegate_task`, verify specialist prompt loads, verify output format
- `test_slash_commands.py` — Invoke `/review`, `/plan`, `/diagnose`, `/research`, `/brainstorm`, `/communicate`, verify routing
- `test_permission_enforcement.py` — Attempt blocked operations, verify rejection
- `test_pipeline_composition.py` — Verify multi-specialist pipelines compose correctly

### Manual Tests

- Load plugin in Hermes, run `/review` on a real diff
- Verify global rules appear in system context (domain-agnostic)
- Verify `pre_tool_call` blocks reviewer from editing files
- Verify session state persists across restart
- Test each new specialist: `/research`, `/brainstorm`, `/communicate`

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hermes `register(ctx)` API changes | Medium | High | Pin Hermes version in `plugin.yaml`. Monitor Hermes changelog. |
| Skill loading mechanism differs from spec | Medium | High | Validate `ctx.register_skill` signature early in Phase 1. |
| `pre_tool_call` hook signature wrong | Medium | Medium | Verify hook contract with Hermes docs before implementation. |
| Domain-agnostic names confuse existing users | Low | Medium | Document mapping table. Keep old names as aliases in Phase 2 transition. |
| MCP integration complexity | Low | Medium | Defer to Phase 3. MCP is additive, not core. |
| Permission profiles too restrictive/lenient | Low | Medium | Start permissive (ADR-006), tighten based on real usage. |
| Shared prompt library creates coupling | Low | Low | Prompts are reference-only, not runtime dependency. |
| `communicator` and `ideator` underused | Low | Low | They're additive — no impact if unused. Can deprecate later. |

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
10. ⚠️ **`ask` permission level** — Not native to Hermes. Where maestria uses `ask`, implement as `allow` with logging. Future: prompt user before execution.

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

| Phase | Milestone | Deliverables | Version |
|---|---|---|---|
| Phase 1 | Core Loop | plugin.yaml, __init__.py, plugin.py, 3 skills (orchestrator, implementer, reviewer), 1 tool, 2 hooks, 1 command (/review), domain-agnostic global rules | v0.1.0 |
| Phase 2 | Full Roster | 6 more skills (researcher, analyst, diagnostician, planner, writer, communicator, ideator), 5 more commands (/plan, /diagnose, /research, /brainstorm, /communicate), session persistence, full permissions for all 9 | v0.2.0 |
| Phase 3 | Advanced | Parallel delegation, MCP, automation (schedule_task), skill prescription, shared prompts, memory integration, observability | v0.3.0 |

**Termination condition:** All phases have success criteria, all dependencies mapped, all rollback points identified, all assumptions documented, all 9 specialists have permission profiles.
