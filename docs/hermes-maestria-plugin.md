# hermes-maestria — Implementation Plan

> **PREAMBLE:** This plan was originally written against an earlier codebase state (pre-June 2026). Since then, `origin/main` has shipped significant features including the **mode system** (fein/sonar/blitz — ADR-008), **commit authorization protocol** (ADR-009), **rewritten orchestrator prompt** (295 lines), **YAML frontmatter agent format with permission blocks**, and **Skill Prescription** in all agents. This revision adds `> **UPDATE:**` callouts throughout to document what shipped versus what remains planned. Shipped items are marked ✅, future items 📋.

---

## Goal

Build a standalone Hermes plugin (`hermes-maestria`) that carries forward maestria's methodology patterns — specialist delegation, global rules injection, permission enforcement — into the Hermes agent framework with a **domain-agnostic 9-specialist roster** covering all work domains: coding, research, analysis, communication, and creative work. No runtime coupling to `@maestria/opencode`. Each plugin optimized for its platform.

> **UPDATE:** The parent project `@maestria/opencode` shipped as an OpenCode plugin (TypeScript, not Python/Hermes). The Hermes plugin concept remains unstarted. This plan's core premise — build a standalone Hermes plugin — is still valid as a separate project, but the methodology patterns it planned to carry forward have evolved on main. Key divergences are documented below.

## Architecture Decision

### Separate Products, Shared Ideas (Option C)

Build `hermes-maestria` as a standalone Hermes plugin. Share methodology principles with `@maestria/opencode`, but no runtime coupling.

**Why:**

1. Plugin models are too different for tight coupling — TypeScript config hook vs Python `register(ctx)`
2. The valuable part is the _ideas_ (methodology, specialist patterns, ADR approach), not the code
3. Hermes has unique strengths to exploit: slash commands, 10+ hooks, `ctx.dispatch_tool`, MCP integration, Python ecosystem

> **UPDATE:** The premise remains valid. `@maestria/opencode` used TypeScript/OpenCode plugin API; a Hermes plugin would use Python. No shared runtime exists.

### ADR-010: General-Purpose Specialist Roster

> **UPDATE: ADR collision fixed.** This was originally numbered ADR-008 in the plan, but the real `ADR-008` on main is _"Keyword-Triggered Workflow Modes"_ (the mode system shipped June 2026). This ADR has been renumbered to **ADR-010** (next available). See the _Mode System_ section below for what actually ships as ADR-008.

The original maestria roster (7 coding-focused agents) is too narrow for Hermes, which serves users across all work domains. The new roster expands to 9 domain-agnostic specialists with clear boundaries and universal methodologies.

**Decision:** Replace coding-specific agent names (`adventurer`, `architect`, `builder`, `diagnose`) with domain-agnostic names (`researcher`, `analyst`, `implementer`, `diagnostician`). Add two new specialists (`communicator`, `ideator`) for stakeholder messaging and creative exploration.

**Consequences:**

- Specialist names describe _what they do_, not _what domain they work in_
- Pipelines compose specialists across domains (e.g., `researcher → communicator → reviewer` for stakeholder updates)
- The dispatcher can route any request type, not just code tasks

> **UPDATE: 📋 NOT SHIPPED on main.** The 9-specialist roster, domain-agnostic renaming, and communicator/ideator roles were **not implemented**. Main shipped with the original 7 coding-focused agents (adventurer, architect, builder, diagnose, planner, reviewer, writer). This remains a future consideration for a Hermes plugin.

### Mode System — ADR-008 (Shipped on main)

> **UPDATE: ✅ SHIPPED on main.** The real ADR-008 implemented **keyword-triggered workflow modes** — `fein` (full pipeline), `sonar` (research only), `blitz` (fast implementation). These are part of `@maestria/opencode` and any future Hermes plugin should integrate a similar concept.

| Mode    | Pipeline                                                   | Meaning                         |
| ------- | ---------------------------------------------------------- | ------------------------------- |
| `fein`  | `@adventurer → @architect/@planner → @builder → @reviewer` | Full pipeline, mandatory gates  |
| `sonar` | `@adventurer → @architect/@planner → STOP`                 | Research only, no code          |
| `blitz` | `@builder` directly                                        | Fast implementation, skip gates |

Detection is per-turn via `chat.message` hook (word-boundary regex), most-restrictive wins, denylist config.

### Commit Authorization — ADR-009 (Shipped on main)

> **UPDATE: ✅ SHIPPED on main.** ADR-009 added a 5-step commit protocol to the orchestrator: Inspect → Propose via `question()` → Execute via @builder → Stop (dispatch @reviewer) → Push (separate approval). Global rules enforce that only the orchestrator authorizes commits, subagents must refuse commit requests, and plans must not include implicit commit steps.

### Project North Star: VISION.md

This plan follows the direction set in **VISION.md** (repo root):

- **Agent = Model + Harness** — Maestria provides the harness (methodology, discipline, patterns). The Hermes plugin is a platform-specific implementation of that harness.
- **Multi-platform methodology** — Same design patterns adapted to each platform's native primitives. This plugin is the Hermes adaptation.
- **Discipline over capability** — Maker/checker split, iteration limits, handoff contracts are preserved as first-class concepts.

**Status per VISION.md:** `@maestria/hermes` is currently **"Exploring"**. Successful completion of Phase 1 (core loop proven) moves it to **"In development"**.

### Implementation Contract: PATTERNS.md

Every maestria platform package must implement the two design patterns documented in **PATTERNS.md** (repo root). This plugin's implementation contract:

1. **Pipeline Composition** — Work flows through sequential specialized stages with structured handoffs. No stage does the work of another.
2. **Maker/Checker Split** — The agent that produces work must not be the agent that validates it. Enforced by permission gating.

Below, each pattern is adapted to Hermes primitives.

> **UPDATE:** The actual `@maestria/opencode` on main implements these patterns through: (1) YAML frontmatter permissions per agent, (2) orchestrator prompt enforcing delegation via `task()`, (3) global rules for cross-cutting policy. A Hermes plugin would need different primitives.

#### Pipeline Composition — Hermes Adaptation

| Platform                         | Primitive                                    | Implementation                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **@maestria/opencode (shipped)** | `task()` tool + YAML frontmatter permissions | Orchestrator delegates via `task()`. Each agent has explicit permission blocks in frontmatter. Pipeline stages enforced by orchestrator prompt rules.                                                                                                                                                                                                                                                                            |
| **Hermes (planned)**             | `delegate_task` tool + `pre_llm_call` hooks  | Dispatcher routes to specialists via a single `delegate_task` tool with an enum of specialist names. Pipeline stages are enforced through the dispatcher skill prompt (not runtime — the LLM follows the methodology). Handoff contracts flow as structured delegation briefings. Permissions are gated per specialist by `pre_tool_call` hook. Maker/checker enforced by denying edit to reviewer specialist at the hook level. |

> **UPDATE:** The shipped `@maestria/opencode` uses `task()` as the native delegation mechanism (not `delegate_task`). YAML frontmatter parsing in `src/index.ts` provides declarative permissions — no Python hooks. The Hermes adaptation should reference `task()` as the canonical name, not `delegate_task`.

#### Maker/Checker Split — Hermes Adaptation

| Platform                         | Primitive                                | Implementation                                                                                                                                                                                                                                |
| -------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **@maestria/opencode (shipped)** | YAML frontmatter `permission.edit: deny` | Reviewer has `edit: deny` in its YAML frontmatter. OpenCode's runtime enforces this at the tool level. Builder has `edit: allow`. Enforcement is declarative, not imperative.                                                                 |
| **Hermes (planned)**             | `pre_tool_call` hook                     | Reviewer specialist has `edit: deny` enforced by the `pre_tool_call` hook. The reviewer cannot modify files — only read and report. Implementer has `edit: allow` with `bash: allow`. Enforcement is plugin-level, not permission-file level. |

> **UPDATE:** The shipped code uses YAML-based declarative permissions, not Python hook-based enforcement. A Hermes plugin would still need hook-based enforcement since Hermes has no native YAML permission model.

### Mapping: `@maestria/opencode` Concepts → Hermes Equivalents

| `@maestria/opencode` Concept           | Hermes Equivalent            | Notes                                            |
| -------------------------------------- | ---------------------------- | ------------------------------------------------ |
| YAML frontmatter permissions           | `pre_tool_call` hook         | Different primitives — declarative vs imperative |
| `task()` delegation                    | `delegate_task` tool         | Tool-based in both, but different names          |
| `input.instructions` (rules injection) | `pre_llm_call` hook          | Returns context string                           |
| Agent modes (subagent/primary/all)     | No equivalent                | All "agents" are skills loaded on demand         |
| `session.compacting`                   | `on_session_start/end` hooks | More hooks available in Hermes                   |

### Specialist Roster Mapping

> **UPDATE: 📋 NOT SHIPPED.** The domain-agnostic renaming and expansion to 9 specialists was not implemented on main. Main kept the original 7 coding-focused names. The table below remains the planned design for a Hermes plugin.

| Old Name (`@maestria/opencode` shipped) | New Name (hermes-maestria planned) | Domain                                             | Core Methodology                                                |
| --------------------------------------- | ---------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| adventurer                              | `researcher`                       | Information gathering, analysis, synthesis         | Scope → source → extract → verify → report                      |
| architect                               | `analyst`                          | Decisions, evaluation, trade-off analysis          | Context → options → compare → recommend → document              |
| builder                                 | `implementer`                      | Focused execution — code, config, content creation | Read → execute → verify → report                                |
| diagnose                                | `diagnostician`                    | Root cause analysis, systematic tracing            | Error → environment → history → blast radius → fix → prevention |
| planner                                 | `planner`                          | Phased plans, roadmaps, prioritization             | Goal → phases → tasks → verification → rollback                 |
| reviewer                                | `reviewer`                         | Quality gates, validation, feedback                | Checklist → inspect → classify → recommend                      |
| writer                                  | `writer`                           | Structured documentation, content                  | Purpose → usage → details → proofread                           |
| —                                       | `communicator`                     | Stakeholder messaging, emails, updates             | Audience → intent → draft → review → send                       |
| —                                       | `ideator`                          | Brainstorming, creative exploration, design        | Diverge → converge → prototype → evaluate                       |

## Skill File Design

> **UPDATE: Major divergence from shipped code.** The plan below describes a hypothetical skill format (50-80 lines, no frontmatter, no identity, 5-section template). The actual `@maestria/opencode` agents shipped with a very different format. See the comparison table below.

### Actual Shipped Format (for reference)

The 7 agents on `@maestria/opencode` main use this structure:

- **YAML frontmatter** with `description`, `mode`, `permission` blocks, `color`, `maxSteps`
- **Identity statement** — every agent opens with "You are a focused implementation agent" / "You review code for quality" / etc.
- **Sections vary by agent** — no rigid template. Common sections: Process, Rules, Iteration Limits, Handoff, Related Agents, Skill Prescription
- **Length: 114–295 lines** (not 50-80)
- **Skill Prescription** — every agent has `### Always load` / `### Load on trigger` / `### Defer to specialist` / `### Skip if` buckets

**Example builder.md frontmatter:**

```yaml
---
description: >
  Focused implementation agent for atomic tasks.
  Executes one verifiable unit of work with minimal context.
mode: subagent
permission:
  read: allow
  glob: allow
  grep: allow
  edit: allow
  bash:
    '*': ask
    'git status*': allow
    'npm test*': allow
  webfetch: allow
---
```

### Planned Template (for Hermes plugin)

Skills are methodology bundles, not agent definitions. They're composable, focused, and domain-agnostic.

```markdown
# [Skill Name]

> One-line description.

## Methodology

[The process — steps, phases, patterns]

## Handoff Format

[Structured output contract]

## Rules

[!!! non-negotiables]

## Iteration Limits

[When to stop, when to escalate]

## Composition

[How this skill works with others]
```

### What Would Be Different from shipped `@maestria/opencode`

| `@maestria/opencode` Agent Prompts (shipped) | hermes-maestria Skills (planned)          |
| -------------------------------------------- | ----------------------------------------- |
| 114–295 lines                                | 50-80 lines                               |
| "You are a focused implementation agent"     | No identity — approach only               |
| YAML frontmatter with permissions            | No frontmatter — hooks handle permissions |
| References opensrc, lsp, task()              | References read, grep, webfetch, terminal |
| Related agents section                       | Composition section                       |
| Always active per session                    | Opt-in, loaded on demand                  |
| One agent = one session                      | Multiple skills composable                |
| Skill Prescription section embedded          | Skill Prescription handled by dispatcher  |

> **UPDATE:** The shipped agents on main are longer and more detailed than anticipated. The plan's assumption that "skills will get shorter and simpler (50-80 lines)" proved incorrect — prompts got longer (114–295 lines, with more detail per agent). The 50-80 line target for Hermes skills may need revision upward based on this evidence.

### Skill Composition Model

Skills are additive methodologies, not competing identities. When multiple skills are loaded, they merge into a combined behavior.

Composition patterns:

- Simple fix: implementer + reviewer
- Complex feature: dispatcher + planner + implementer + reviewer
- Bug investigation: dispatcher + diagnostician + implementer + reviewer
- Documentation: dispatcher + researcher + writer + reviewer
- Stakeholder update: dispatcher + communicator + analyst
- Architecture decision: dispatcher + analyst + researcher + writer

The Composition section in each skill declares its dependencies and interactions.

### Key Design Principles (carried from ADRs)

- **ADR-001**: Global rules are cross-cutting, not per-agent. Specialist-specific behavior lives in skill prompts.
- **ADR-002**: Pure plugin — no filesystem side effects outside the plugin directory.
- **ADR-003**: `!!!` markers for critical rules, cross-references between specialists, skill prescription pattern.
- **ADR-004**: 4-bucket skill prescription, 5-section handoff, iteration limits, rules bullets.
- **ADR-005**: Dispatcher-direct skill installs, bundled questions, `--help` as source of truth.
- **ADR-006**: Permissions are permissive by default; directives encode policy.
- **ADR-007**: `opensrc` for repos, `webfetch` for pages.
- **ADR-008**: **Keyword-Triggered Workflow Modes** (shipped on main) — fein/sonar/blitz mode detection via `chat.message` hook.
- **ADR-009**: **Commit Authorization Rules** (shipped on main) — 5-step commit protocol, orchestrator-only authorization.
- **ADR-010**: Domain-agnostic specialist roster — names describe function, not domain.

> **UPDATE:** ADR-008 and ADR-009 now refer to shipped features on main, not planned concepts. The plan's original ADR-008 (General-Purpose Specialist Roster) has been renumbered to ADR-010.

---

## Default Pipelines

> **UPDATE:** The shipped system uses mode keywords (fein/sonar/blitz) to override default pipelines, plus an orchestrator `Default pipeline` rule. The plan's 6 pipeline sequences below could work as Hermes-specific pipelines, but should integrate mode concepts.

| Pipeline       | Sequence                                        | Use Case                                          |
| -------------- | ----------------------------------------------- | ------------------------------------------------- |
| Implementation | `researcher → analyst → implementer → reviewer` | Building features, writing code, creating configs |
| Bug fix        | `diagnostician → implementer → reviewer`        | Fixing failures, regressions, errors              |
| Planning       | `researcher → planner → reviewer`               | Roadmaps, migrations, prioritization              |
| Content        | `researcher → writer → reviewer`                | Documentation, READMEs, changelogs                |
| Communication  | `researcher → communicator → reviewer`          | Emails, status updates, stakeholder messages      |
| Creative       | `ideator → analyst → implementer`               | Brainstorming, design exploration, new ideas      |

**Shipped equivalent (fein mode):** `@adventurer → @architect/@planner → @builder → @reviewer`

## Routing Rules

> **UPDATE:** These planned routing rules use the 9-specialist roster names (not shipped). The shipped orchestrator uses trigger phrases to route to the 7 original agents. A Hermes plugin could adopt either naming scheme.

| Signal                                            | Specialist      | Pipeline                                 |
| ------------------------------------------------- | --------------- | ---------------------------------------- |
| "how does X work", "find all…", "explain"         | `researcher`    | —                                        |
| "should we use X or Y", "evaluate", "compare"     | `analyst`       | —                                        |
| "build X", "fix Y", "create Z", "implement"       | `implementer`   | `researcher → implementer → reviewer`    |
| "bug", "broken", "failing", "regression"          | `diagnostician` | `diagnostician → implementer → reviewer` |
| "plan X", "roadmap", "prioritize", "migrate"      | `planner`       | `researcher → planner → reviewer`        |
| "review this", "check my work", "QA"              | `reviewer`      | —                                        |
| "document X", "write README", "changelog"         | `writer`        | —                                        |
| "email X", "update stakeholders", "draft message" | `communicator`  | —                                        |
| "brainstorm", "ideas for", "creative", "design"   | `ideator`       | `ideator → analyst` (converge)           |
| Complex/multi-domain/ambiguous                    | `dispatcher`    | Dispatcher decides                       |

---

## Phase 1 (v0.1): Core Loop

**Goal:** Prove methodology works in Hermes — register a tool, inject rules, gate permissions, route to 3 specialists.

> **UPDATE:** Phase 1 was partially proven on main — but with OpenCode primitives (TypeScript plugin, YAML frontmatter, `task()` tool), not Hermes primitives (Python plugin, hooks, `delegate_task`). This phase describes the Hermes implementation that would need to be built from scratch.

### Files

```
~/.hermes/plugins/hermes-maestria/
├── plugin.yaml              # Plugin manifest
├── __init__.py              # Entry point: register(ctx)
├── plugin.py                # Core logic: hooks, tools, guards
├── skills/
│   ├── dispatcher.md        # Manager — decompose, delegate, integrate
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
description: Methodology plugin with domain-agnostic specialist delegation
entry: __init__.py
author: <author>
license: MIT
```

**Success criteria:** `hermes plugin install ~/.hermes/plugins/hermes-maestria` succeeds. Plugin appears in `hermes plugin list`.

#### 1.2 — **init**.py (Entry Point)

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
                    "enum": ["dispatcher", "implementer", "reviewer"],
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
    ctx.register_skill("dispatcher", skills_dir / "dispatcher.md")
    ctx.register_skill("implementer", skills_dir / "implementer.md")
    ctx.register_skill("reviewer", skills_dir / "reviewer.md")
```

**Success criteria:** `register()` completes without error. All 3 skills, 1 tool, 2 hooks, 1 command are registered.

#### 1.3 — plugin.py (Core Logic)

**What:** Implement the handler functions for the delegate_task tool, the pre_llm_call hook, and the pre_tool_call hook.

> **UPDATE:** The shipped `@maestria/opencode` does NOT use Python hooks. Permissions are YAML frontmatter-based, parsed by `parseFrontmatter()` in `src/index.ts`. Rules injection happens via `input.instructions` (array of file paths). Delegation uses the native `task()` tool, not a custom tool. The Hermes plugin described here uses Python hooks because Hermes has a different plugin API. The structure below is correct for Hermes but differs fundamentally from what shipped on main.

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

**1.3b — `pre_llm_call_inject_rules(session_id, user_message, conversation_history, is_first_turn, model, platform, **kwargs)`\*\*

Injects global rules into every LLM call by returning a context dict.

```python
def pre_llm_call_inject_rules(session_id, user_message, conversation_history, is_first_turn, model, platform, **kwargs):
    rules_path = Path(__file__).parent / "rules" / "AGENTS.md"
    rules = rules_path.read_text()
    return {"context": rules}
```

**1.3c — `pre_tool_call_enforce_permissions(tool_name, args, task_id, **kwargs)`\*\*

Gates tool execution based on the active specialist's permission profile. Returns `{"action": "block", "message": "..."}` to block, `None` to allow.

```python
# Permission profiles per specialist (Hermes-adapted from maestria frontmatter)
PERMISSIONS = {
    "dispatcher": {
        "read": "deny", "glob": "deny", "grep": "deny",
        "edit": "deny",
        "bash": {"*": "deny"},
        "delegate_task": "allow", "skill": "allow",
        "webfetch": "deny",
    },
    "implementer": {
        "read": "allow", "glob": "allow", "grep": "allow",
        "edit": "allow",
        "bash": {"*": "allow"},
        "skill": "allow",
    },
    "reviewer": {
        "read": "allow", "glob": "allow", "grep": "allow",
        "edit": "deny",
        "bash": {"*": "allow"},
        "skill": "allow",
    },
}

def pre_tool_call_enforce_permissions(tool_name, args, task_id, **kwargs):
    profile = PERMISSIONS.get(_active_specialist, {})

    if tool_name == "bash":
        command = args.get("command", "")
        bash_policy = profile.get("bash", {})
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
- `pre_tool_call` hook blocks `edit` for reviewer, blocks ALL tools for dispatcher except `delegate_task` and `skill`
- Permission profiles match the domain-agnostic specialist specs

#### 1.4 — rules/AGENTS.md (Global Rules)

**What:** Domain-agnostic global rules for hermes-maestria. Adapted from OpenCode global rules with Hermes-specific tooling.

> **UPDATE:** The shipped `packages/opencode/rules/AGENTS.md` includes sections this plan didn't anticipate: **Workflow modes** (fein/sonar/blitz), **Commit Policy** (orchestrator-only authorization), **Tool hierarchy** (webfetch → websearch). The plan's rules template below should be updated to include these if a Hermes plugin wants parity.

**Content (adapted from shipped rules, with Hermes-specific tooling):**

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
- **!!! Webfetch may hang — don't block on it** — if a web request
  hangs after you've issued it, proceed without the result and
  surface the skip in your next user-facing message. Don't wait
  for a hung fetch to complete.
- **!!! CLI references — use `--help` flags first** — for CLI tools,
  run `<command> --help` or `<command> <subcommand> --help` before
  searching the web. Local help text is faster and more reliable.
- **!!! Local files — read directly** — use `read`, `glob`, or `grep`
  for any file you have path access to. Don't fetch a local file
  via web search or browser.

## Delegation

When delegating work via `delegate_task`, use only the registered
specialists below. **Never delegate to built-in agents** — they are
not part of the specialist pipeline.

| Specialist      | Role                                   | When to Delegate                                                     |
| --------------- | -------------------------------------- | -------------------------------------------------------------------- |
| `researcher`    | Information gathering and synthesis    | Understanding unfamiliar domains, gathering context, finding sources |
| `analyst`       | Decisions, evaluation, trade-offs      | Comparing options, evaluating approaches, making recommendations     |
| `implementer`   | Focused execution of atomic tasks      | Concrete, scoped tasks with no ambiguity — code, config, content     |
| `diagnostician` | Systematic root cause analysis         | Debugging failures, tracing regressions, investigating errors        |
| `planner`       | Phased plans with milestones           | Complex features, rollouts, migrations, prioritization               |
| `reviewer`      | Quality gates and validation           | Pre-submit review, QA, security audit, completeness checks           |
| `writer`        | Structured documentation and content   | READMEs, docs, changelogs, ADRs, explanations                        |
| `communicator`  | Stakeholder messaging and updates      | Emails, status updates, team messages, cross-platform comms          |
| `ideator`       | Brainstorming and creative exploration | Generating ideas, exploring design spaces, creative direction        |

## Context Management

- **Progressive disclosure** — start high-level, get specific as needed.
- **State checkpointing** — periodically summarize what's done, what's
  in progress, what's next.
- **Context pruning** — remove irrelevant context when no longer needed.
- **Completion promises** — define success criteria before starting work.
  "This task is complete when [verifiable conditions]."
```

**Success criteria:** Rules are injected as system message. Content is domain-agnostic (no coding-only references). `!!!` markers preserved. All 9 specialists listed in delegation table. Hermes-adapted directives match the mapping: "Webfetch may hang" kept as-is, "CLI references — use `--help` flags first", "Local files — read directly" kept as-is.

#### 1.5 — skills/dispatcher.md

**What:** Create the dispatcher skill from scratch using the skill template. The dispatcher is the entry point for complex work — it decomposes, delegates, and integrates. It never executes work itself.

> **UPDATE:** The shipped `orchestrator.md` (295 lines) serves this role. It uses YAML frontmatter with `permission` blocks (all tools denied except `task()`, `skill`, `question`, and `todowrite`), identity statement, CRITICAL RULES section, COMMIT PROTOCOL, Workflow Mode Override, and Skill Prescription. The plan's 50-80 line no-frontmatter design below differs significantly.

**Spec:**

- Target length: 50-80 lines
- Sections: Methodology, Handoff Format, Rules, Iteration Limits, Composition
- No YAML frontmatter, no identity statement, no permission references
- Only tool mentioned is `delegate_task` — dispatcher never reads, writes, or inspects

**Complete file content:**

```markdown
# Dispatcher

> Route work to specialists. Your only tool is `delegate_task`. You never execute, read, or inspect anything yourself.

## Methodology

### Decomposition

1. **Classify the request** — Single-task, multi-step, or cross-domain?
2. **Identify atomic units** — Each unit is one specialist's work
3. **Map dependencies** — What blocks what?
4. **Sequence** — Order by dependency; fan out independent work

### Delegation

Every delegation is a complete briefing with: Goal, Context, Requirements, Success criteria, Next step.

End every briefing with: "If anything is unclear, ask before proceeding."

### Integration

Collect results, verify success criteria, report consolidated status.

## Handoff Format

1. What was requested
2. What was done (by whom)
3. What was NOT done
4. Open questions
5. Next step

## Rules

- **!!! Your only tool is `delegate_task`** — Never read, write, or inspect anything yourself. If you need context, delegate to `researcher`.
- **!!! Never delegate to built-in agents** — use only the registered specialists.
- **!!! One atomic unit per delegation** — never bundle unrelated work.
- **!!! Maker/checker split** — the specialist that executes must not validate.
- **!!! After any implementation, dispatch `reviewer`** — unless user opts out.
- Set iteration limits on delegated loops (max 3 rounds).

## Iteration Limits

- Max 3 rounds per unit before escalating
- Max 5 units per turn
- Escalation format: "Tried X, Y, Z. Blocked by [cause]. Need [input]."

## Composition

- With `planner` — for phased execution
- With `researcher` — when context is needed before delegation
- With `reviewer` — always after implementation
- With `diagnostician` — when a unit fails unexpectedly
- Dispatcher is the entry point; all other skills augment its delegation briefings.
```

**Success criteria:** File is 50-80 lines. Uses the skill template. No YAML frontmatter. No identity statement. Only tool mentioned is `delegate_task`. Strictest profile: dispatcher never does work directly.

#### 1.6 — skills/implementer.md

**What:** Create the implementer skill from scratch using the skill template. This is NOT a direct port of maestria's builder prompt — it's a fresh design using the methodology-first template.

> **UPDATE:** The shipped `builder.md` (175 lines) has YAML frontmatter with 27-line permission block, identity statement ("You are a focused implementation agent"), Implementation Staircase, Constraint Escalation, Skill Prescription (3 Always-load, 27 Load-on-trigger, 6 Defer-to-specialist), and Iteration Limits. It's much more detailed than the 50-80 line template below.

**Spec:**

- Target length: 50-80 lines
- Sections: Methodology, Handoff Format, Rules, Iteration Limits, Composition
- No YAML frontmatter, no identity statement, no permission references
- Domain-agnostic: same methodology for code, config, content, or infrastructure
- References read, grep, webfetch, terminal (not opensrc, lsp)

**Complete file content:**

```markdown
# Implementer

> Execute one atomic task with focused precision. Code, config, content — any domain.

## Methodology

### Scope Check

Before starting, verify the task is atomic:

- Single file or tightly coupled file group
- Single concern (one bug, one feature slice, one config change)
- No design ambiguity (approach is clear)

If the task spans multiple unrelated concerns, stop and request decomposition.

### Execution Loop

1. **Read** — Load relevant files. Understand existing patterns.
2. **Plan** — Identify the minimal change. Prefer `edit` over `write`.
3. **Execute** — Make the change. Touch only files relevant to the task.
4. **Verify** — Run tests, type checks, or validation. Confirm correctness.
5. **Report** — State what changed, why, and verification results.

### Implementation Staircase

For complex features, build incrementally:

1. Hardcoded version that demonstrates the concept
2. Add state management with mock data
3. Connect to real data/API
4. Add error handling and edge cases
5. Optimize and polish

Each step is verifiable before moving to the next.

### Constraint Escalation

Start tight, relax as needed:

- Round 1: Existing dependencies only
- Round 2: Standard library features
- Round 3: External dependencies if necessary

## Handoff Format

1. **Files modified** — list with one-line summary per file
2. **What changed** — the diff in plain language
3. **Why** — rationale for the approach taken
4. **Verification** — test results, type check output
5. **Blockers or follow-ups** — anything that needs attention

## Rules

- **!!! Touch only files relevant to the task** — no collateral changes.
- **!!! Read before writing** — never implement without reading the target files first.
- **!!! Read the docs first** — before using unfamiliar APIs, consult documentation. Don't guess.
- **!!! Run verification before claiming done** — tests, type checks, or manual validation.
- **!!! Maker/checker split** — your work is reviewed by `reviewer` before it lands.
- **!!! Don't delete what you didn't create** — flag deletions of unrelated code in your diff.
- **!!! If anything is unclear, flag it in your handoff** — wrong assumptions waste more time than asking questions.
- Prefer `edit` over `write` — preserve existing structure.
- Keep the change focused — one concern per invocation.

## Iteration Limits

- **Max 3 fix attempts** when verification fails before escalating.
- **Termination condition:** verification passes, diff is focused on task scope, no collateral changes.
- **Escalation format:** "Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed."

## Composition

- **With `dispatcher`** — implementer receives atomic units from dispatcher; report back via handoff format.
- **With `reviewer`** — always pair with reviewer after implementation for maker/checker validation.
- **With `diagnostician`** — load when unexpected issues surface mid-implementation.
- **With `researcher`** — load when implementation requires understanding unfamiliar code or APIs.
- Implementer is domain-agnostic: same methodology for code, config, content, or infrastructure.
```

**Success criteria:** File is 50-80 lines. Uses the skill template (Methodology, Handoff Format, Rules, Iteration Limits, Composition). No YAML frontmatter. No identity statement. Domain-agnostic language.

#### 1.7 — skills/reviewer.md

**What:** Create the reviewer skill from scratch using the skill template. This is NOT a direct port of maestria's reviewer prompt — it's a fresh design using the methodology-first template.

> **UPDATE:** The shipped `reviewer.md` (176 lines) has YAML frontmatter with `edit: deny`, identity statement ("You review code for quality"), 7-section Review Checklist, Questions to Ask Yourself, Skill Prescription (1 Always-load, 15 Load-on-trigger, 2 Defer-to-specialist), Output Format with Conventional Comments labels, and external References links. It's focused on code review specifically, not domain-agnostic.

**Spec:**

- Target length: 50-80 lines
- Sections: Methodology, Handoff Format, Rules, Iteration Limits, Composition
- No YAML frontmatter, no identity statement, no permission references
- Domain-agnostic: quality gates for any work domain (code, content, decisions)
- References read, grep, webfetch, terminal (not opensrc, lsp)

**Success criteria:** File is 50-80 lines. Uses the skill template (Methodology, Handoff Format, Rules, Iteration Limits, Composition). No YAML frontmatter. No identity statement. Domain-agnostic quality gate methodology.

#### 1.8 — Update PATTERNS.md with Hermes platform adaptation

**What:** Add Hermes rows to the platform adaptation tables in `PATTERNS.md`.

**Spec:**
Add to the **Pipeline Composition** platform adaptation table in `PATTERNS.md`:

```markdown
| **Hermes** | `delegate_task` tool + `pre_llm_call` hooks | Dispatcher routes to specialists via a single `delegate_task` tool with an enum of specialist names. Pipeline stages are enforced through the dispatcher skill prompt (not runtime — the LLM follows the methodology). Handoff contracts flow as structured delegation briefings. Permissions are gated per specialist by `pre_tool_call` hook. Maker/checker enforced by denying edit to reviewer specialist at the hook level. |
```

Add to the **Maker/Checker Split** platform adaptation table in `PATTERNS.md`:

```markdown
| **Hermes** | `pre_tool_call` hook | Reviewer specialist has `edit: deny` enforced by the `pre_tool_call` hook. The reviewer cannot modify files — only read and report. Builder/implementer has `edit: allow` with `bash: allow`. Enforcement is plugin-level, not permission-file level. |
```

**Success criteria:** Both PATTERNS.md tables have Hermes rows. Pipeline Composition entry documents the dispatcher skill model. Maker/Checker entry documents `pre_tool_call` enforcement.

### Phase 1 Verification

| Check               | How                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Plugin loads        | `hermes plugin list` shows `hermes-maestria`                                                                                 |
| Tool registered     | `delegate_task` appears in tool list                                                                                         |
| Hooks fire          | `pre_llm_call` injects rules (verify with debug logging)                                                                     |
| Permission gate     | `pre_tool_call` blocks `edit` for reviewer; blocks ALL tools for dispatcher except `delegate_task`                           |
| Skill loadable      | `dispatcher`, `implementer`, `reviewer` skills load via `ctx.register_skill`                                                 |
| Slash command       | `/review` routes to reviewer specialist                                                                                      |
| End-to-end          | Invoke `delegate_task(specialist="implementer", briefing="Read the README")` — specialist prompt loads, briefing is complete |
| Domain-agnostic     | Global rules contain no coding-only references                                                                               |
| PATTERNS.md updated | Hermes rows added to both platform adaptation tables                                                                         |

### Rollback Point

After Phase 1: plugin loads, 3 skills work, delegation tool routes correctly. Can ship as v0.1.0.

---

## Phase 2 (v0.2): Full Specialist Roster

**Goal:** Add remaining 6 specialists. Add slash commands. Add session state persistence. Full permission profiles for all 9 specialists.

> **UPDATE: 📋 NOT SHIPPED on main.** The full 9-specialist roster, domain-agnostic naming, and communicator/ideator roles remain future work. Main shipped the original 7 coding-focused agents. This entire phase would be built from scratch for a Hermes plugin.

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

**What:** Create the researcher skill from scratch using the skill template. This is NOT a direct port of maestria's adventurer prompt — it's a fresh design using the methodology-first template.

> **UPDATE:** The shipped `adventurer.md` (179 lines) has YAML frontmatter with `edit: deny`, identity statement ("You are a codebase reconnaissance agent"), 4-tier complexity strategy, Output Format with Reconnaissance Report template, and Skill Prescription. If building a Hermes researcher, consider whether to model it after the shipped format or the planned template.

**Spec:**

- Target length: 50-80 lines
- Sections: Methodology, Handoff Format, Rules, Iteration Limits, Composition
- No YAML frontmatter, no identity statement, no permission references
- Domain-agnostic: information gathering in any domain (code, data, research, analysis)
- References read, grep, webfetch, terminal (not opensrc, lsp)

**Success criteria:** File is 50-80 lines. Uses the skill template (Methodology, Handoff Format, Rules, Iteration Limits, Composition). No YAML frontmatter. No identity statement. Domain-agnostic information gathering methodology.

#### 2.2 — skills/analyst.md

**What:** Create the analyst skill from scratch using the skill template. This is NOT a direct port of maestria's architect prompt — it's a fresh design using the methodology-first template.

> **UPDATE:** The shipped `architect.md` (163 lines) has YAML frontmatter with `edit: deny`, identity statement ("You make architecture decisions systematically"), Phase 1 (Understand the Problem) through Phase 3 (Document) process, and Skill Prescription.

**Spec:**

- Target length: 50-80 lines
- Sections: Methodology, Handoff Format, Rules, Iteration Limits, Composition
- No YAML frontmatter, no identity statement, no permission references
- Domain-agnostic: evaluation and trade-off analysis in any domain
- References read, grep, webfetch, terminal (not opensrc, lsp)

**Success criteria:** File is 50-80 lines. Uses the skill template (Methodology, Handoff Format, Rules, Iteration Limits, Composition). No YAML frontmatter. No identity statement. Domain-agnostic decision framework.

#### 2.3 — skills/diagnostician.md

**What:** Create the diagnostician skill from scratch using the skill template. This is NOT a direct port of maestria's diagnose prompt — it's a fresh design using the methodology-first template.

> **UPDATE:** The shipped `diagnose.md` (169 lines) has YAML frontmatter with `edit: ask`, identity statement ("You trace bugs systematically"), systematic 6-step regression tracing process, and Skill Prescription.

**Spec:**

- Target length: 50-80 lines
- Sections: Methodology, Handoff Format, Rules, Iteration Limits, Composition
- No YAML frontmatter, no identity statement, no permission references
- Domain-agnostic: failure analysis in any domain (code bugs, system failures, process breakdowns)
- References read, grep, webfetch, terminal (not opensrc, lsp)

**Success criteria:** File is 50-80 lines. Uses the skill template (Methodology, Handoff Format, Rules, Iteration Limits, Composition). No YAML frontmatter. No identity statement. Domain-agnostic failure analysis methodology.

#### 2.4 — skills/planner.md

**What:** Create the planner skill from scratch using the skill template. This is NOT a direct port of maestria's planner prompt — it's a fresh design using the methodology-first template.

> **UPDATE:** The shipped `planner.md` (114 lines) has YAML frontmatter with `edit: ask`, identity statement ("You create implementation plans"), and phased planning structure.

**Spec:**

- Target length: 50-80 lines
- Sections: Methodology, Handoff Format, Rules, Iteration Limits, Composition
- No YAML frontmatter, no identity statement, no permission references
- Domain-agnostic: phased plans, roadmaps, and prioritization in any domain
- References read, grep, webfetch, terminal (not opensrc, lsp)

**Success criteria:** File is 50-80 lines. Uses the skill template (Methodology, Handoff Format, Rules, Iteration Limits, Composition). No YAML frontmatter. No identity statement. Domain-agnostic planning methodology.

#### 2.5 — skills/writer.md

**What:** Create the writer skill from scratch using the skill template. This is NOT a direct port of maestria's writer prompt — it's a fresh design using the methodology-first template.

> **UPDATE:** The shipped `writer.md` (156 lines) has YAML frontmatter with `edit: allow`, identity statement ("You write documentation"), skill prescription section (Always load: writing-clearly-and-concisely, humanizer; Load on trigger: multiple doc-format skills), and structured writing patterns.

**Spec:**

- Target length: 50-80 lines
- Sections: Methodology, Handoff Format, Rules, Iteration Limits, Composition
- No YAML frontmatter, no identity statement, no permission references
- Domain-agnostic: structured documentation and content in any domain
- References read, grep, webfetch, terminal (not opensrc, lsp)

**Success criteria:** File is 50-80 lines. Uses the skill template (Methodology, Handoff Format, Rules, Iteration Limits, Composition). No YAML frontmatter. No identity statement. Domain-agnostic documentation methodology.

#### 2.6 — skills/communicator.md

**What:** Create the communicator skill from scratch using the skill template. This is a new specialist for stakeholder messaging.

**Spec:**

- Target length: 50-80 lines
- Sections: Methodology, Handoff Format, Rules, Iteration Limits, Composition
- No YAML frontmatter, no identity statement, no permission references
- Domain-agnostic: stakeholder messaging, emails, status updates, cross-platform communications
- References read, grep, webfetch, terminal (not opensrc, lsp)

**Success criteria:** File is 50-80 lines. Uses the skill template (Methodology, Handoff Format, Rules, Iteration Limits, Composition). No YAML frontmatter. No identity statement. Communication methodology is clear and actionable.

#### 2.7 — skills/ideator.md

**What:** Create the ideator skill from scratch using the skill template. This is a new specialist for brainstorming and creative exploration.

**Spec:**

- Target length: 50-80 lines
- Sections: Methodology, Handoff Format, Rules, Iteration Limits, Composition
- No YAML frontmatter, no identity statement, no permission references
- Domain-agnostic: brainstorming, creative exploration, design thinking
- References read, grep, webfetch, terminal (not opensrc, lsp)

**Success criteria:** File is 50-80 lines. Uses the skill template (Methodology, Handoff Format, Rules, Iteration Limits, Composition). No YAML frontmatter. No identity statement. Creative methodology is clear and actionable.

#### 2.8 — Register New Skills and Commands

**What:** Update `__init__.py` to register all 9 skills and 6 slash commands.

**Spec:**

```python
# In register(ctx):

# Register all skills
skills = [
    "dispatcher", "researcher", "analyst", "implementer",
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

**Spec (derived from maestria frontmatter, generalized, with strict dispatcher profile):**

| Specialist     | read     | glob     | grep     | edit     | bash                                                      | skill | webfetch | delegate_task |
| -------------- | -------- | -------- | -------- | -------- | --------------------------------------------------------- | ----- | -------- | ------------- |
| **dispatcher** | **deny** | **deny** | **deny** | **deny** | **deny**                                                  | allow | deny     | **allow**     |
| researcher     | allow    | allow    | allow    | deny     | deny (git log/diff/which: allow)                          | allow | allow    | —             |
| analyst        | allow    | allow    | allow    | deny     | deny (which/npm view: allow)                              | allow | allow    | —             |
| implementer    | allow    | allow    | allow    | allow    | allow                                                     | allow | —        | —             |
| diagnostician  | allow    | allow    | allow    | ask      | ask (git status/diff/log/blame/show/which/env/pwd: allow) | allow | allow    | —             |
| planner        | allow    | allow    | allow    | ask      | ask (git status/diff/log: allow)                          | allow | allow    | —             |
| reviewer       | allow    | allow    | allow    | deny     | allow (git status/diff/log: allow)                        | allow | —        | —             |
| writer         | allow    | allow    | allow    | allow    | ask (git status/npm view: allow)                          | allow | allow    | —             |
| communicator   | allow    | allow    | allow    | deny     | deny                                                      | allow | allow    | —             |
| ideator        | allow    | allow    | allow    | deny     | deny                                                      | allow | allow    | —             |

**Note:** `ask` is not a native Hermes hook return value. Use `allow` for tools the specialist needs and `deny` for those it doesn't. Where `ask` is listed, implement as `allow` with a log warning (future: prompt user before execution).

**Dispatcher strictness:** All tools denied except `delegate_task` and `skill`. The dispatcher must never read, glob, grep, edit, webfetch, or run bash itself. "If you are tempted to 'just check' something — that is a `delegate_task` call, not a tool call."

**Success criteria:** `pre_tool_call` hook enforces correct permissions for all 9 specialists. Reviewer can't edit. Dispatcher has only `delegate_task` and `skill` allowed — everything else denied. Communicator and ideator are read-only.

#### 2.10 — Session State Hooks

**What:** Implement `on_session_start` and `on_session_end` hooks for state persistence via file-based storage (no `ctx.get_state/set_state` APIs exist).

**Spec:**

```python
import json
from pathlib import Path

_STATE_FILE = Path(__file__).parent / ".state.json"
_active_specialist = "dispatcher"

def _load_state():
    global _active_specialist
    if _STATE_FILE.exists():
        data = json.loads(_STATE_FILE.read_text())
        _active_specialist = data.get("active_specialist", "dispatcher")

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

| Check               | How                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------- |
| All skills load     | `hermes skill list` shows all 9                                                             |
| All commands work   | `/review`, `/plan`, `/diagnose`, `/research`, `/brainstorm`, `/communicate` route correctly |
| Permission profiles | `pre_tool_call` enforces correct permissions for all 9; dispatcher is strictest             |
| Session persistence | Restart Hermes, verify state restored                                                       |
| Global rules        | Rules injection includes full 9-specialist table                                            |
| New specialists     | `communicator` and `ideator` skills load and have correct methodology                       |

### Rollback Point

After Phase 2: full 9-specialist roster, 6 slash commands, session persistence, full permissions. Can ship as v0.2.0.

---

## Phase 3 (v0.3): Advanced Features

**Goal:** Parallel delegation, MCP integration, automation (schedule_task), skill prescription, shared prompt library, memory integration.

> **UPDATE:** Some Phase 3 features have shipped on main. Others remain future work. Each item below is individually annotated.

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

> **UPDATE:** 📋 FUTURE WORK. Not shipped on main. The shipped orchestrator supports parallel fan-out via multiple `task()` calls in one turn (documented in orchestrator.md's "Parallel Fan-Out" section), but there's no batching tool.

#### 3.2 — MCP Integration

**What:** Register the `delegate_task` tool as an MCP tool so external MCP clients can invoke specialist delegation.

**Spec:** Use Hermes MCP bridge to expose `delegate_task` as an MCP tool endpoint.

**Success criteria:** External MCP client can call `delegate_task` and receive specialist output.

> **UPDATE:** 📋 FUTURE WORK. Not shipped on main. The `@maestria/opencode` plugin is not exposed as MCP.

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
                "enum": ["dispatcher", "researcher", "analyst", "implementer",
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

> **UPDATE:** 📋 FUTURE WORK. Not shipped on main.

#### 3.4 — Skill Prescription

**What:** Implement the skill prescription pattern from ADR-004 — each specialist skill defines "Always load", "Load on trigger", "Defer to specialist", "Skip if" buckets.

**Spec:** Parse skill prescription sections from specialist markdown files. Before delegation, check if prescribed skills are available. If not, prompt user for installation (bundled question per ADR-005).

**Success criteria:** Dispatcher checks skill prescription before delegation. Missing skills trigger bundled install prompt.

> **UPDATE:** ✅ SHIPPED on main (partially). Skill Prescription is embedded in every agent file on main (e.g., builder.md has 27 Load-on-trigger entries, adventurer.md has 7). The orchestrator has a dedicated "Skills for Subagents" section with proactive/reactive paths, guard rails, and miss handling. However, the dispatcher-level skill prescription parsing and bundled install prompt (Phases 3.4 as described) was not implemented — skill prescription is declarative in agent files, not enforced by the dispatcher.

#### 3.5 — Shared Prompt Library

**What:** Create a `prompts/` directory with extracted, platform-agnostic prompt fragments that both `@maestria/opencode` and `hermes-maestria` can reference.

**Spec:**

```
prompts/
├── methodology-principles.md     # Cross-cutting rules
├── specialist-registry.md        # Specialist table
├── delegation-pattern.md         # Briefing template
├── iteration-limits.md           # Standard iteration limits
└── rules-bullets.md              # Standard rules bullets (maker/checker, validate, ambiguity, parallelization)
```

**Success criteria:** Both plugins can import from `prompts/`. No duplication of core principles.

> **UPDATE:** 📋 FUTURE WORK. Not shipped on main. No shared prompts directory exists.

#### 3.6 — Memory Integration

**What:** Integrate with Hermes memory system (if available) for cross-session context retention. Store specialist decisions, research findings, and evaluation outcomes.

**Spec:** Use `on_session_end` to persist key findings to a memory store. Use `on_session_start` to restore relevant context. Fall back to file-based `.state.json` if no memory API exists.

**Success criteria:** Key findings persist across sessions. Specialist context is available without re-research.

> **UPDATE:** 📋 FUTURE WORK. Not shipped on main.

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

> **UPDATE:** 📋 FUTURE WORK. Not shipped on main. The `@maestria/opencode` plugin has no observability layer.

### Phase 3 Verification

| Check               | How                                                  |
| ------------------- | ---------------------------------------------------- |
| Parallel delegation | `delegate_task(tasks=[...])` returns merged results  |
| MCP exposure        | External MCP client can invoke `delegate_task`       |
| Automation          | `schedule_task` registers and dispatches on schedule |
| Skill prescription  | Missing skills trigger install prompt                |
| Shared prompts      | Both plugins reference same prompt fragments         |
| Memory              | Key findings persist across sessions                 |
| Observability       | `post_tool_call` logs specialist + tool + args       |

### Rollback Point

After Phase 3: full feature set. Can ship as v0.3.0.

---

## Migration Path: maestria Prompts → Hermes Skills

### Important: Skills Follow PATTERNS.md, Not Direct Ports

The source of truth for implementation is **PATTERNS.md** (repo root), not the `@maestria/opencode` agent prompts. The two design patterns — Pipeline Composition and Maker/Checker Split — are the implementation contract that every skill must satisfy.

Skills are **designed from scratch** following PATTERNS.md. The maestria agent prompts are useful reference material (they demonstrate the patterns in practice) but are NOT source material to copy.

> **UPDATE:** The shipped `@maestria/opencode` agents on main are the most evolved form of the methodology. Any Hermes plugin should reference them as the primary source of truth for how methodology patterns work in practice, while adapting to Hermes-specific primitives.

Key differences:

- **Identity removal** — Skills have no "You are a focused implementation agent" identity statement
- **Length reduction** — Skills target 50-80 lines vs 114-295 lines
- **Template-first** — All skills use the same 5-section template (Methodology, Handoff Format, Rules, Iteration Limits, Composition)
- **Composition model** — Skills declare how they work with others, not which agents they relate to
- **No frontmatter** — Permissions are handled by Python hooks, not YAML declarations

### Process

For each agent prompt in `packages/opencode/agents/*.md`:

1. **Extract methodology** — Identify the core process, rules, and patterns
2. **Reference PATTERNS.md** — Ensure the skill satisfies both Pipeline Composition and Maker/Checker Split contracts
3. **Redesign using template** — Rewrite from scratch using the skill template
4. **Compress** — Target 50-80 lines by removing identity statements, redundant examples, and domain-specific details
5. **Generalize** — Remove coding-specific terminology where the specialist's domain is broader
6. **Add Composition** — Declare how this skill works with others
7. **Validate** — Ensure the skill is self-contained, domain-agnostic, and satisfies PATTERNS.md

### What to Keep from `@maestria/opencode` Prompts

- Core methodology and process steps
- `!!!` markers for critical rules
- Iteration limits and escalation patterns
- Handoff format requirements
- Maker/checker split principles
- Skill Prescription patterns (Always load, Load on trigger, Defer to specialist, Skip if)
- Commit protocol rules (per ADR-009)
- Mode system awareness (per ADR-008)

### What to Discard from `@maestria/opencode` Prompts

- YAML frontmatter blocks (replaced by Python hook permission profiles)
- Identity statements ("You are a focused implementation agent")
- Domain-specific examples (keep patterns, remove specifics)
- OpenCode-specific tool references (opensrc, lsp, task())
- Related agents section (replaced by Composition)
- Skill prescription section (handled by dispatcher, not individual skills)

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
- `test_dispatcher_strictness.py` — Verify dispatcher has no tools except `delegate_task`

### Manual Tests

- Load plugin in Hermes, run `/review` on a real diff
- Verify global rules appear in system context (domain-agnostic)
- Verify `pre_tool_call` blocks reviewer from editing files; blocks ALL tools for dispatcher except `delegate_task`
- Verify session state persists across restart
- Test each new specialist: `/research`, `/brainstorm`, `/communicate`

---

## Risk Register

| Risk                                         | Likelihood | Impact     | Mitigation                                                                                                                                                                                                                                          |
| -------------------------------------------- | ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hermes `register(ctx)` API changes           | Medium     | High       | Pin Hermes version in `plugin.yaml`. Monitor Hermes changelog.                                                                                                                                                                                      |
| Skill loading mechanism differs from spec    | Medium     | High       | Validate `ctx.register_skill` signature early in Phase 1.                                                                                                                                                                                           |
| `pre_tool_call` hook signature wrong         | Medium     | Medium     | Verify hook contract with Hermes docs before implementation.                                                                                                                                                                                        |
| Domain-agnostic names confuse existing users | Low        | Medium     | Document mapping table. Keep old names as aliases in Phase 2 transition.                                                                                                                                                                            |
| MCP integration complexity                   | Low        | Medium     | Defer to Phase 3. MCP is additive, not core.                                                                                                                                                                                                        |
| Permission profiles too restrictive/lenient  | Low        | Medium     | Start permissive (ADR-006), tighten based on real usage.                                                                                                                                                                                            |
| Shared prompt library creates coupling       | Low        | Low        | Prompts are reference-only, not runtime dependency.                                                                                                                                                                                                 |
| `communicator` and `ideator` underused       | Low        | Low        | They're additive — no impact if unused. Can deprecate later.                                                                                                                                                                                        |
| **Divergence from shipped methodology**      | **High**   | **Medium** | **The plan was written before fein/sonar/blitz modes, commit protocol, and YAML frontmatter agents shipped on main. Ensure Hermes plugin references shipped `@maestria/opencode` as the evolved methodology, not the plan's original assumptions.** |

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

| Phase        | Milestone     | Deliverables                                                                                                                                                                                                                                               | Version    |
| ------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Phase 1      | Core Loop     | plugin.yaml, **init**.py, plugin.py, 3 skills (dispatcher, implementer, reviewer), 1 tool, 2 hooks, 1 command (/review), domain-agnostic global rules, PATTERNS.md Hermes adaptation                                                                       | v0.1.0     |
| Phase 2      | Full Roster   | 6 more skills (researcher, analyst, diagnostician, planner, writer, communicator, ideator), 5 more commands (/plan, /diagnose, /research, /brainstorm, /communicate), session persistence, full permissions for all 9                                      | v0.2.0     |
| Phase 3      | Advanced      | Parallel delegation, MCP, automation (schedule_task), skill prescription, shared prompts, memory integration, observability                                                                                                                                | v0.3.0     |
| Skill Design | Cross-cutting | All skills follow the methodology-first template (50-80 lines). Skills are composable, domain-agnostic, and opt-in. Composition model enables multi-skill workflows. All skills satisfy PATTERNS.md contracts (Pipeline Composition, Maker/Checker Split). | All phases |

> **Status recap:**
>
> - ✅ **SHIPPED on main**: Mode system (ADR-008), commit protocol (ADR-009), YAML frontmatter agents, Skill Prescription in all agents, rewritten orchestrator (295 lines), common rules patterns
> - 📋 **NOT SHIPPED (Hermes-specific future)**: 9-specialist roster, domain-agnostic renaming, communicator/ideator, Python plugin, `delegate_task` tool, shared prompt library, MCP integration, automation, memory
> - ⚠️ **Diverged**: Agent length (shipped 114-295 vs planned 50-80), frontmatter format (shipped YAML vs planned no-frontmatter), identity statements (shipped has them, planned doesn't), permission model (shipped YAML declarative vs planned Python hook imperative)

**Termination condition:** All phases have success criteria, all dependencies mapped, all rollback points identified, all assumptions documented, all 9 specialists have permission profiles. All skills use the skill template and are 50-80 lines. PATTERNS.md contains Hermes adaptation rows for both design patterns. All shipped divergences documented and cross-referenced.
