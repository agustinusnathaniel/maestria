# hermes-maestria — Implementation Plan

> **PREAMBLE:** This plan was originally written against an earlier codebase state (pre-June 2026). Since then, `origin/main` has shipped significant features including the **mode system** (fein/sonar/blitz — ADR-008), **commit authorization protocol** (ADR-009), **rewritten orchestrator prompt** (295 lines), **YAML frontmatter agent format with permission blocks**, and **Skill Prescription** in all agents. This revision adds `> **UPDATE:**` callouts throughout to document what shipped versus what remains planned. Shipped items are marked ✅, future items 📋.

> **SESSION UPDATE (June 22, 2026):** This document was revised after a comprehensive fein-pipeline verification session. The session ran a full audit against Hermes Agent v0.17.0, the user's actual setup, and the shipped `@maestria/opencode` codebase. Six key corrections were identified:
>
> 1. **Specialist names** — The plan used 9 domain-agnostic names (researcher, analyst, etc.). The shipped `@maestria/opencode` uses 7 OpenCode agent names (adventurer, architect, builder, diagnose, planner, reviewer, writer). The Hermes plugin should match this roster for consistency.
> 2. **Skill format** — The plan assumed 50-80 line skills with no frontmatter. The shipped format is 114-295 lines with YAML frontmatter, identity statements, and permission blocks. Hermes skills should match this format.
> 3. **Mode injection** — The plan assumed mode injection goes into the system prompt. Hermes preserves the prompt cache across turns; mode context should go into the user message instead.
> 4. **Kanban hooks** — The plan assumed a `kanban_task_claimed` hook exists in Hermes. It doesn't. Kanban integration is deferred to a methodology skill rather than a plugin hook.
> 5. **Plugin loading** — The plan assumed auto-loading. Hermes plugins require opt-in via `hermes plugins enable`.
> 6. **Two-layer architecture** — The plugin is not Hermes-only. It composes with OpenCode CLI delegation through the existing opencode skill. See the new "OpenCode Composition" section.
>
> **User's verified setup:** `HERMES_HOME=/opt/data`, custom Crof.ai provider (`kimi-k2.6`) at `https://crof.ai/v2`, Kanban orchestrator + worker playbooks, 80+ installed skills across 15 categories, Telegram gateway with topic-bound routing, High Agency protocol enabled.
>
> **Direction confirmed:** Option A (Full Plugin) remains correct. The plugin provides the methodology layer; the existing opencode skill handles Hermes→OpenCode CLI delegation for coding tasks.
>
> Existing callouts (`✅ SHIPPED`, `📋 NOT SHIPPED`, `⚠️ Diverged`) are preserved throughout. New June 22 findings are marked `> **UPDATE (June 22, 2026):**`.

---

## Goal

Build a standalone Hermes plugin (`hermes-maestria`) that carries forward maestria's methodology patterns — specialist delegation, global rules injection, permission enforcement — into the Hermes agent framework with a **7-specialist roster** matching the shipped OpenCode agent names: adventurer, architect, builder, diagnose, planner, reviewer, writer. No runtime coupling to `@maestria/opencode`. Each plugin optimized for its platform.

> **UPDATE:** The parent project `@maestria/opencode` shipped as an OpenCode plugin (TypeScript, not Python/Hermes). The Hermes plugin concept remains unstarted. This plan's core premise — build a standalone Hermes plugin — is still valid as a separate project, but the methodology patterns it planned to carry forward have evolved on main. Key divergences are documented below.

> **UPDATE (June 22, 2026):** The session confirmed the 7-specialist OpenCode roster is the right target. The plan's original 9-specialist expansion (communicator, ideator) was speculative — those roles are better handled by the existing roster via methodology composition. All references to the 9-specialist scheme are marked below.

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

The original maestria roster (7 coding-focused agents) is too narrow for Hermes, which serves users across all work domains. The new roster expands to 7 domain-agnostic specialists with clear boundaries and universal methodologies.

**Decision:** Keep the shipped OpenCode agent names (`adventurer`, `architect`, `builder`, `diagnose`, `planner`, `reviewer`, `writer`) as the Hermes plugin's specialist roster. These names describe _what they do_, not _what domain they work in_. Pipelines compose specialists across domains.

**Consequences:**

- Specialist names match the `@maestria/opencode` shipped roster for consistency
- Pipelines compose specialists across domains (e.g., `adventurer → architect → builder → reviewer` for implementation)
- The dispatcher routes any request type, not just code tasks
- No `communicator` or `ideator` specialists — those domains are covered by methodology composition of the existing 7

> **UPDATE: 📋 NOT SHIPPED on main.** The 7-specialist roster expansion and domain-agnostic methodology are not implemented on main for Hermes. The shipped `@maestria/opencode` uses the 7 coding-focused agents with OpenCode-specific tooling. This remains a future consideration for a Hermes plugin.

> **UPDATE (June 22, 2026):** The original plan proposed a 9-specialist roster with domain-agnostic names (researcher, analyst, implementer, diagnostician, communicator, ideator). The session confirmed this is unnecessary. The shipped 7 OpenCode names work for both coding and non-coding domains when their methodology skills are written broadly. No new names needed.

### Mode System — ADR-008 (Shipped on main)

> **UPDATE: ✅ SHIPPED on main.** The real ADR-008 implemented **keyword-triggered workflow modes** — `fein` (full pipeline), `sonar` (research only), `blitz` (fast implementation). These are part of `@maestria/opencode` and any future Hermes plugin should integrate a similar concept.

| Mode    | Pipeline                                                   | Meaning                         |
| ------- | ---------------------------------------------------------- | ------------------------------- |
| `fein`  | `@adventurer → @architect/@planner → @builder → @reviewer` | Full pipeline, mandatory gates  |
| `sonar` | `@adventurer → @architect/@planner → STOP`                 | Research only, no code          |
| `blitz` | `@builder` directly                                        | Fast implementation, skip gates |

Detection is per-turn via `chat.message` hook (word-boundary regex), most-restrictive wins, denylist config.

> **UPDATE (June 22, 2026):** In the Hermes plugin, mode injection goes into the **user message** (not the system prompt). Hermes preserves the prompt cache across turns, so system prompt changes don't take effect until cache invalidation. Mode context is injected by `pre_llm_call` returning `{"context": mode_instructions}` — Hermes appends this to the user message.

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

> **UPDATE (June 22, 2026):** The Hermes plugin's delegation tool will be named `delegate_task` (not `task()`) to avoid confusion with Hermes's built-in task mechanism. The concept is the same — route to a specialist with a structured briefing — but the name differs from the OpenCode convention.

#### Maker/Checker Split — Hermes Adaptation

| Platform                         | Primitive                                | Implementation                                                                                                                                                                                                                            |
| -------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **@maestria/opencode (shipped)** | YAML frontmatter `permission.edit: deny` | Reviewer has `edit: deny` in its YAML frontmatter. OpenCode's runtime enforces this at the tool level. Builder has `edit: allow`. Enforcement is declarative, not imperative.                                                             |
| **Hermes (planned)**             | `pre_tool_call` hook                     | Reviewer specialist has `edit: deny` enforced by the `pre_tool_call` hook. The reviewer cannot modify files — only read and report. Builder has `edit: allow` with `bash: allow`. Enforcement is plugin-level, not permission-file level. |

> **UPDATE:** The shipped code uses YAML-based declarative permissions, not Python hook-based enforcement. A Hermes plugin would still need hook-based enforcement since Hermes has no native YAML permission model.

### Mapping: `@maestria/opencode` Concepts → Hermes Equivalents

| `@maestria/opencode` Concept           | Hermes Equivalent            | Notes                                            |
| -------------------------------------- | ---------------------------- | ------------------------------------------------ |
| YAML frontmatter permissions           | `pre_tool_call` hook         | Different primitives — declarative vs imperative |
| `task()` delegation                    | `delegate_task` tool         | Tool-based in both, but different names          |
| `input.instructions` (rules injection) | `pre_llm_call` hook          | Returns context string                           |
| Agent modes (subagent/primary/all)     | No equivalent                | All "agents" are skills loaded on demand         |
| `session.compacting`                   | `on_session_start/end` hooks | More hooks available in Hermes                   |

> **UPDATE (June 22, 2026):** The `pre_llm_call` hook returns context that Hermes injects into the **user message**, not the system prompt. This is because Hermes caches the system prompt (including tool definitions) across turns; changing the system prompt per-turn would invalidate the cache. Mode context, rules, and specialist instructions go into the user message instead.

## OpenCode Composition

The hermes-maestria plugin does NOT replace or duplicate the existing opencode skill. Instead, it composes with it in a two-layer architecture:

```
Hermes Agent
  └─ hermes-maestria plugin ── methodology layer (modes, gates, specialist routing)
      └─ delegates coding to ──
          OpenCode CLI
            └─ @maestria/opencode plugin ── methodology layer (same concepts, TS)
                └─ specialist subagents (builder, reviewer, etc.)
```

**The existing opencode skill** (`autonomous-ai-agents/opencode/SKILL.md`, 321 lines) already handles Hermes→OpenCode CLI delegation:

- **One-shot mode:** `opencode run 'prompt'` — fire-and-forget coding task
- **Interactive TUI:** pty-based interactive session for complex work
- **Parallel worktrees:** isolated Git worktrees for parallel task execution
- **PR review:** `opencode pr 42` — route PR review to OpenCode
- **Custom Crof.ai provider:** configured for both Hermes and OpenCode (`kimi-k2.6` at `https://crof.ai/v2`)

**How the plugin composes:**

- When a pipeline stage determines implementation is needed (e.g., the `builder` specialist), it delegates to OpenCode via the existing skill's one-shot pattern
- The opencode skill handles CLI invocation, session management, and result collection
- The `@maestria/opencode` plugin loaded in OpenCode applies the same methodology principles (modes, gates, specialist routing)
- Results flow back into the Hermes pipeline for review and integration by the `reviewer` specialist

**This is NOT out of scope** — it's the natural integration path. The opencode skill already works; the plugin adds the methodology layer on top. The two layers share the same design patterns (Pipeline Composition, Maker/Checker Split) adapted to their respective platforms.

**When to delegate to OpenCode vs. handle in-Hermes:**

| Task Type                              | Handler               | Reason                                                                     |
| -------------------------------------- | --------------------- | -------------------------------------------------------------------------- |
| Research / information gathering       | Hermes direct         | Use adventurer skill with webfetch/grep — faster than spinning up OpenCode |
| Architecture decisions / trade-offs    | Hermes direct         | Architect skill uses Hermes tools — no CLI needed                          |
| Coding — single file, known patterns   | Hermes direct         | Builder skill with edit/grep — fast for simple changes                     |
| Coding — multi-file, complex, or novel | OpenCode CLI delegate | OpenCode's full pipeline (adventurer→architect→builder→reviewer) for rigor |
| PR review                              | OpenCode CLI delegate | `opencode pr 42` handles the review loop natively                          |
| Documentation                          | Hermes direct         | Writer skill — docs are prose, not code                                    |
| Parallel tasks                         | OpenCode worktrees    | Isolated worktrees prevent cross-contamination                             |

### OpenCode vs Hermes: When to Use Which

```
Simple edit / grep research / quick doc
  → Hermes direct (faster, lower overhead)

Multi-file feature / novel code / PR review
  → Delegate to OpenCode (more rigorous pipeline)

Uncertain?
  → Start in Hermes. If complexity rises, escalate to OpenCode.
```

## Specialist Roster Mapping

> **UPDATE: 📋 NOT SHIPPED.** The shipped `@maestria/opencode` on main uses the original 7 coding-focused names. The Hermes plugin should use the same names for consistency. The table below reflects the corrected roster.

> **UPDATE (June 22, 2026):** This table replaces the original 9-specialist mapping (which had researcher/analyst/implementer/diagnostician/communicator/ideator). The 7 OpenCode names are the canonical roster. No communicator or ideator specialists — those functions are covered by methodology composition of the existing 7.

| Name (`@maestria/opencode` shipped) | Role                                       | Core Methodology                                                |
| ----------------------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| `adventurer`                        | Information gathering, analysis, synthesis | Scope → source → extract → verify → report                      |
| `architect`                         | Decisions, evaluation, trade-off analysis  | Context → options → compare → recommend → document              |
| `builder`                           | Focused execution — code, config, content  | Read → execute → verify → report                                |
| `diagnose`                          | Root cause analysis, systematic tracing    | Error → environment → history → blast radius → fix → prevention |
| `planner`                           | Phased plans, roadmaps, prioritization     | Goal → phases → tasks → verification → rollback                 |
| `reviewer`                          | Quality gates, validation, feedback        | Checklist → inspect → classify → recommend                      |
| `writer`                            | Structured documentation, content          | Purpose → usage → details → proofread                           |

## Skill File Design

> **UPDATE: Major divergence from shipped code.** The plan below describes a hypothetical skill format (50-80 lines, no frontmatter, no identity, 5-section template). The actual `@maestria/opencode` agents shipped with a very different format. See the comparison table below.

> **UPDATE (June 22, 2026):** Session verification confirmed the shipped format is the right model for Hermes skills. The original 50-80 line target is too compressed — Hermes skills should target 100-250 lines with YAML frontmatter, identity statements, and permission blocks matching the shipped pattern. See "Corrected Template" below.

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

### Original Planned Template (superseded)

The original plan proposed skills as methodology bundles with this structure:

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

> **UPDATE (June 22, 2026):** The template above served as a useful starting point but proved incomplete. Session verification confirmed the shipped format is superior — it includes identity framing, permission declarations, and skill prescription that the template lacks. Hermes skills should use the shipped format, adapted for Hermes tooling.

### Corrected Template (June 2026)

Hermes skills should mirror the shipped `@maestria/opencode` format:

```markdown
---
description: >
  One-paragraph description of the specialist's role.
  What they do, when they're used.
mode: subagent
permission:
  read: allow
  glob: allow
  grep: allow
  edit: deny # or allow/ask per specialist
  bash:
    '*': deny # or allow/ask per specialist
    'git *': allow
  webfetch: allow
  delegate_task: deny # only dispatcher has this
---

You are a [specialist description]. [Identity statement about your role.]

## Process

[Methodology steps, phases, or workflow]

## Rules

- **!!! [Critical rules with !!! markers]**

## Handoff Format

[Structured output contract — what to include when reporting back]

## Iteration Limits

[When to stop, when to escalate]

## Skill Prescription

### Always load

[Skills always loaded for this specialist]

### Load on trigger

[Skill → trigger pattern mappings]

### Defer to specialist

[Skills that replace this one's default behavior]

### Skip if

[Conditions where this skill should not be loaded]

## Related Agents

[How this specialist composes with others]
```

### What Would Be Different from shipped `@maestria/opencode`

| `@maestria/opencode` Agent Prompts (shipped) | hermes-maestria Skills (corrected)        | Original Plan (superseded)  |
| -------------------------------------------- | ----------------------------------------- | --------------------------- |
| 114–295 lines                                | 100-250 lines (matching shipped pattern)  | 50-80 lines                 |
| "You are a focused implementation agent"     | Same pattern — identity statement         | No identity — approach only |
| YAML frontmatter with permissions            | YAML frontmatter with permissions         | No frontmatter — hooks only |
| References opensrc, lsp, task()              | References read, grep, webfetch, terminal | Same as corrected           |
| Related agents section                       | Related agents section                    | Composition section         |
| Always active per session                    | Opt-in, loaded on demand                  | Same as corrected           |
| One agent = one session                      | One skill = one session                   | Multiple skills composable  |
| Skill Prescription section embedded          | Skill Prescription section embedded       | Handled by dispatcher       |

> **UPDATE (June 22, 2026):** The original plan's assumptions about shorter skills, no frontmatter, and no identity statements were invalidated by the shipped code. The corrected template above brings Hermes skills in line with the proven format.

### Skill Composition Model

Skills are additive methodologies, not competing identities. When multiple skills are loaded, they merge into a combined behavior.

Composition patterns:

- Simple fix: builder + reviewer
- Complex feature: dispatcher + planner + builder + reviewer
- Bug investigation: dispatcher + diagnose + builder + reviewer
- Documentation: dispatcher + adventurer + writer + reviewer
- Architecture decision: dispatcher + architect + adventurer + writer

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
- **ADR-010**: Domain-agnostic specialist roster — names describe function, not domain (using 7 OpenCode names).

> **UPDATE:** ADR-008 and ADR-009 now refer to shipped features on main, not planned concepts. The plan's original ADR-008 (General-Purpose Specialist Roster) has been renumbered to ADR-010.

---

## Default Pipelines

> **UPDATE:** The shipped system uses mode keywords (fein/sonar/blitz) to override default pipelines, plus an orchestrator `Default pipeline` rule. The plan's pipeline sequences below use the corrected 7-specialist OpenCode names and should integrate mode concepts.

> **UPDATE (June 22, 2026):** Pipeline names updated to use 7 OpenCode specialist names. Communication and Creative pipelines removed — those domains are handled by composing the existing 7 specialists with appropriate methodology.

| Pipeline       | Sequence                                      | Use Case                                          |
| -------------- | --------------------------------------------- | ------------------------------------------------- |
| Implementation | `adventurer → architect → builder → reviewer` | Building features, writing code, creating configs |
| Bug fix        | `diagnose → builder → reviewer`               | Fixing failures, regressions, errors              |
| Planning       | `adventurer → planner → reviewer`             | Roadmaps, migrations, prioritization              |
| Content        | `adventurer → writer → reviewer`              | Documentation, READMEs, changelogs                |

**Shipped equivalent (fein mode):** `@adventurer → @architect/@planner → @builder → @reviewer`

## Routing Rules

> **UPDATE:** These routing rules use the corrected 7 OpenCode specialist names (matching shipped convention). The original plan's 9-name scheme (researcher, analyst, implementer, diagnostician, communicator, ideator) has been replaced.

> **UPDATE (June 22, 2026):** No communicator or ideator routing rules — those signals are handled by the existing 7 specialists. For example, "email X" → writer with communication methodology; "brainstorm" → architect/adventurer with divergent methodology.

| Signal                                        | Specialist   | Pipeline                          |
| --------------------------------------------- | ------------ | --------------------------------- |
| "how does X work", "find all…", "explain"     | `adventurer` | —                                 |
| "should we use X or Y", "evaluate", "compare" | `architect`  | —                                 |
| "build X", "fix Y", "create Z", "implement"   | `builder`    | `adventurer → builder → reviewer` |
| "bug", "broken", "failing", "regression"      | `diagnose`   | `diagnose → builder → reviewer`   |
| "plan X", "roadmap", "prioritize", "migrate"  | `planner`    | `adventurer → planner → reviewer` |
| "review this", "check my work", "QA"          | `reviewer`   | —                                 |
| "document X", "write README", "changelog"     | `writer`     | —                                 |
| Complex/multi-domain/ambiguous                | `dispatcher` | Dispatcher decides                |

---

## Phase 1 (v0.1): Core Loop

**Goal:** Prove methodology works in Hermes — register hooks, inject rules, gate permissions, implement mode state machine, route to 3 specialists.

> **UPDATE:** Phase 1 was partially proven on main — but with OpenCode primitives (TypeScript plugin, YAML frontmatter, `task()` tool), not Hermes primitives (Python plugin, hooks, `delegate_task`). This phase describes the Hermes implementation that would need to be built from scratch.

> **UPDATE (June 22, 2026):** Phase 1 has been restructured based on session findings:
>
> - Mode state machine added (`modes.py` with file persistence)
> - Mode injection goes into **user message** (not system prompt)
> - `maestria_mode` tool replaces the generic `delegate_task` for mode management
> - Slash commands added: `/fein`, `/sonar`, `/blitz`, `/review`, `/plan`
> - Skills use the corrected format (YAML frontmatter, 100-250 lines)
> - Skills named `maestria-<role>` to avoid collision with built-in Hermes skills
> - `kanban_task_claimed` hook removed (doesn't exist in Hermes)
> - Plugin is opt-in via `hermes plugins enable` (not auto-loading)
> - No `delegate_task` tool in Phase 1 — uses existing Kanban + opencode skill for delegation

### Files

```
/opt/data/hermes/plugins/hermes-maestria/
├── plugin.yaml                 # Plugin manifest
├── src/
│   ├── __init__.py             # register(ctx) — registers hooks, tools, skills, slash commands
│   ├── plugin.py               # Plugin class with lifecycle
│   ├── modes.py                # Mode state machine (fein/sonar/blitz) with file persistence
│   ├── hooks/
│   │   ├── __init__.py
│   │   ├── pre_llm.py          # Mode detection + context injection (into user message)
│   │   └── pre_tool.py         # Sonar guard (blocks edit/write in research mode)
│   └── tools/
│       ├── __init__.py
│       └── mode.py             # maestria_mode(action="get"|"set", mode=?)
├── skills/
│   ├── maestria-orchestrator/SKILL.md    # Pipeline composition methodology
│   ├── maestria-builder/SKILL.md         # Implementation staircase
│   ├── maestria-reviewer/SKILL.md        # Quality gates
│   └── maestria-global-rules/SKILL.md    # Cross-cutting methodology rules
└── README.md
```

> **UPDATE (June 22, 2026):** Plugin directory uses `/opt/data/hermes/` not `~/.hermes/`. This matches the user's verified `HERMES_HOME=/opt/data` setup. The `src/` package structure replaces the flat file layout from the original plan.

### Tasks

#### 1.1 — plugin.yaml (Plugin Manifest)

**What:** Declare plugin metadata, dependencies, and entry point.

**Spec:**

```yaml
name: hermes-maestria
version: 0.1.0
description: Methodology plugin with specialist delegation and mode-based workflows
entry: src/__init__.py
author: <author>
license: MIT
```

**Success criteria:** `hermes plugins install /opt/data/hermes/plugins/hermes-maestria` succeeds. Plugin appears in `hermes plugins list`.

> **UPDATE (June 22, 2026):** Hermes plugins require opt-in. After install, the user must run `hermes plugins enable hermes-maestria` to activate. The plugin is not auto-loaded.

#### 1.2 — src/\_\_init\_\_.py (Entry Point)

**What:** Implement `register(ctx)` — the plugin entry point that registers tools, hooks, commands, and skills.

**Spec:**

```python
from pathlib import Path
from .plugin import Plugin

def register(ctx):
    plugin = Plugin(ctx, Path(__file__).parent.parent)
    plugin.register()
```

**Success criteria:** `register()` completes without error. All hooks, tools, slash commands, and skills are registered.

#### 1.3 — src/plugin.py (Plugin Lifecycle)

**What:** Plugin class that wires together all components.

**Spec:**

```python
from pathlib import Path

class Plugin:
    def __init__(self, ctx, base_path: Path):
        self.ctx = ctx
        self.base_path = base_path

    def register(self):
        # Register hooks
        from .hooks.pre_llm import pre_llm_call_inject_context
        from .hooks.pre_tool import pre_tool_call_sonar_guard

        self.ctx.register_hook("pre_llm_call", pre_llm_call_inject_context)
        self.ctx.register_hook("pre_tool_call", pre_tool_call_sonar_guard)

        # Register tools
        from .tools.mode import handle_maestria_mode

        self.ctx.register_tool(
            name="maestria_mode",
            toolset="maestria",
            schema={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["get", "set"],
                        "description": "Get current mode or set a new mode",
                    },
                    "mode": {
                        "type": "string",
                        "enum": ["fein", "sonar", "blitz"],
                        "description": "Mode to set (required when action='set')",
                    },
                },
                "required": ["action"],
            },
            handler=handle_maestria_mode,
        )

        # Register slash commands
        self.ctx.register_command(
            "fein",
            handler=lambda args: handle_maestria_mode({"action": "set", "mode": "fein"}),
            description="Set full pipeline mode (adventurer → architect/planner → builder → reviewer)",
        )
        self.ctx.register_command(
            "sonar",
            handler=lambda args: handle_maestria_mode({"action": "set", "mode": "sonar"}),
            description="Set research-only mode (adventurer → STOP — no code)",
        )
        self.ctx.register_command(
            "blitz",
            handler=lambda args: handle_maestria_mode({"action": "set", "mode": "blitz"}),
            description="Set fast implementation mode (builder directly)",
        )
        self.ctx.register_command(
            "review",
            handler=lambda args: handle_review(args),
            description="Route to reviewer specialist for quality review",
        )
        self.ctx.register_command(
            "plan",
            handler=lambda args: handle_plan(args),
            description="Route to planner specialist for planning",
        )

        # Register skills
        skills_dir = self.base_path / "skills"
        self.ctx.register_skill("maestria-orchestrator", skills_dir / "maestria-orchestrator" / "SKILL.md")
        self.ctx.register_skill("maestria-builder", skills_dir / "maestria-builder" / "SKILL.md")
        self.ctx.register_skill("maestria-reviewer", skills_dir / "maestria-reviewer" / "SKILL.md")
        self.ctx.register_skill("maestria-global-rules", skills_dir / "maestria-global-rules" / "SKILL.md")
```

**Success criteria:** All 2 hooks, 1 tool, 5 slash commands, and 4 skills registered without error.

> **UPDATE (June 22, 2026):** Key changes from original plan:
>
> - No `delegate_task` tool in Phase 1 — delegation uses existing Kanban + opencode skill
> - Added `maestria_mode` tool for mode state machine interaction
> - Added `/fein`, `/sonar`, `/blitz` slash commands for mode switching
> - Skills named with `maestria-` prefix to avoid collision with built-in Hermes skills
> - No `kanban_task_claimed` hook registration — that hook doesn't exist in Hermes

#### 1.4 — src/modes.py (Mode State Machine)

**What:** File-based mode state machine. Persists the current mode to a JSON state file so it survives Hermes restarts.

**Spec:**

```python
import json
from pathlib import Path

_STATE_FILE = Path(__file__).parent.parent / ".maestria-state.json"

VALID_MODES = ["fein", "sonar", "blitz"]
_DEFAULT_MODE = "fein"

def _load():
    if _STATE_FILE.exists():
        try:
            data = json.loads(_STATE_FILE.read_text())
            mode = data.get("mode", _DEFAULT_MODE)
            if mode in VALID_MODES:
                return mode
        except (json.JSONDecodeError, OSError):
            pass
    return _DEFAULT_MODE

def _save(mode):
    _STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    _STATE_FILE.write_text(json.dumps({"mode": mode}))

def get_mode() -> str:
    return _load()

def set_mode(mode: str) -> str:
    if mode not in VALID_MODES:
        raise ValueError(f"Invalid mode: {mode}. Valid: {VALID_MODES}")
    _save(mode)
    return mode

def mode_to_pipeline(mode: str) -> list[str]:
    pipelines = {
        "fein":  ["adventurer", "architect", "builder", "reviewer"],
        "sonar": ["adventurer", "architect"],
        "blitz": ["builder"],
    }
    return pipelines.get(mode, pipelines["fein"])
```

**Success criteria:** Mode persists across Hermes restarts. `get_mode()` returns stored mode or default. `set_mode()` validates input and persists. `mode_to_pipeline()` returns correct pipeline for each mode.

#### 1.5 — src/hooks/pre_llm.py (Context Injection)

**What:** Injects mode context and global rules into every LLM call. Returns context that Hermes appends to the user message (not system prompt — preserves prompt cache).

**Spec:**

```python
from pathlib import Path
from ..modes import get_mode, mode_to_pipeline, VALID_MODES

_RULES_PATH = Path(__file__).parent.parent.parent / "skills" / "maestria-global-rules" / "SKILL.md"

def pre_llm_call_inject_context(session_id, user_message, conversation_history, is_first_turn, model, platform, **kwargs):
    """Inject mode context and global rules into the user message."""
    mode = get_mode()
    pipeline = mode_to_pipeline(mode)

    # Load global rules
    rules = ""
    if _RULES_PATH.exists():
        rules = _RULES_PATH.read_text()

    # Compose mode context (goes to user message, not system prompt)
    context = f"""<maestria-context>
Current mode: {mode}
Active pipeline: {' → '.join(pipeline)}

Mode rules:
- fein:  Full pipeline with mandatory gates. All stages required.
- sonar: Research only. NO code, NO edits, NO writes.
- blitz: Fast implementation. Skip planning and review gates.
</maestria-context>

{rules}
"""
    return {"context": context.strip()}
```

**Success criteria:**

- Mode context is injected on every turn (not just first turn)
- Sonar mode context explicitly forbids code/edit/write
- Global rules from `maestria-global-rules` are included
- Context is injected into the **user message** (not system prompt)

> **UPDATE (June 22, 2026):** Mode injection goes into the user message, not the system prompt. Hermes caches the system prompt (including tool definitions) across turns. Injecting mode context into the system prompt would invalidate the cache on every mode switch. The `pre_llm_call` hook returns `{"context": ...}` which Hermes appends to the user message — this avoids cache invalidation while keeping mode awareness on every turn.

#### 1.6 — src/hooks/pre_tool.py (Sonar Guard)

**What:** Blocks edit/write/delete tool calls in sonar mode. Also enforces mode-appropriate tool usage.

**Spec:**

```python
from ..modes import get_mode

# Tools that modify state — blocked in sonar mode
_MUTATING_TOOLS = {"edit", "write", "delete", "bash"}

# Read-only tools — allowed in all modes
_READ_TOOLS = {"read", "glob", "grep", "webfetch", "skill"}

def pre_tool_call_sonar_guard(tool_name, args, task_id, **kwargs):
    """Block mutating tool calls in sonar mode."""
    mode = get_mode()

    if mode == "sonar":
        if tool_name in _MUTATING_TOOLS:
            return {
                "action": "block",
                "message": f"[maestria] Tool '{tool_name}' is blocked in sonar mode. "
                           f"sonar = research only. Switch to fein or blitz mode to use this tool.",
            }
        # In sonar mode, also block non-research bash
        if tool_name == "bash":
            command = args.get("command", "")
            # Allow read-only commands
            if not any(command.startswith(p) for p in ["git log", "git diff", "git show", "git status",
                                                        "which", "ls ", "cat ", "pwd", "echo"]):
                return {
                    "action": "block",
                    "message": f"[maestria] Bash command '{command[:60]}' blocked in sonar mode. "
                               f"sonar = research only. Switch to fein or blitz to execute.",
                }

    return None  # Allow
```

**Success criteria:**

- In sonar mode: `edit`, `write`, `delete` are blocked
- In sonar mode: mutating bash commands are blocked (git commit, npm install, etc.)
- In sonar mode: read-only bash is allowed (git log, ls, which)
- In fein/blitz mode: no restrictions (tool-level permission gating is Phase 2)
- Non-tool operations are unaffected

#### 1.7 — src/tools/mode.py (maestria_mode tool)

**What:** Tool for the LLM to query and change the mode state machine. Used by the orchestrator skill to manage workflow modes.

**Spec:**

```python
from ..modes import get_mode, set_mode, mode_to_pipeline, VALID_MODES

async def handle_maestria_mode(args: dict) -> str:
    action = args.get("action")
    mode = args.get("mode")

    if action == "get":
        current = get_mode()
        pipeline = mode_to_pipeline(current)
        return f"Current mode: {current}\nPipeline: {' → '.join(pipeline)}\nValid modes: {', '.join(VALID_MODES)}"

    elif action == "set":
        if not mode:
            return "Error: 'mode' is required when action='set'. Valid modes: " + ", ".join(VALID_MODES)
        if mode not in VALID_MODES:
            return f"Error: Invalid mode '{mode}'. Valid modes: " + ", ".join(VALID_MODES)
        set_mode(mode)
        pipeline = mode_to_pipeline(mode)
        return f"Mode set to: {mode}\nPipeline: {' → '.join(pipeline)}"

    return f"Error: Unknown action '{action}'. Use 'get' or 'set'."
```

**Success criteria:**

- `maestria_mode(action="get")` returns current mode and pipeline
- `maestria_mode(action="set", mode="sonar")` changes mode and returns confirmation
- Invalid mode raises error message (not exception)
- Mode change is persisted to file

#### 1.8 — Skills (skills/maestria-\*/)

**What:** Create 4 skills using the corrected format (YAML frontmatter, identity statements, 100-250 lines). Skills are named with `maestria-` prefix to avoid collision with built-in Hermes skills.

> **UPDATE (June 22, 2026):** Skills use the corrected format (see Skill File Design section). Each skill has YAML frontmatter with permission blocks, an identity statement, methodology sections, and skill prescription. Target length: 100-250 lines. File format: `SKILL.md` to match Hermes convention.

**Skills to create:**

| Skill                   | Role                                              | Key Permissions                 |
| ----------------------- | ------------------------------------------------- | ------------------------------- |
| `maestria-orchestrator` | Pipeline manager — decomposes, delegates, reviews | `read: deny`, `delegate: allow` |
| `maestria-builder`      | Focused implementation for atomic tasks           | `edit: allow`, `bash: allow`    |
| `maestria-reviewer`     | Quality gates and validation                      | `edit: deny`, `read: allow`     |
| `maestria-global-rules` | Cross-cutting methodology rules injected always   | `read: deny` (rules only)       |

**maestria-orchestrator/SKILL.md — Key design points:**

- Identity: "You are a methodology orchestrator. You route work, you never execute it."
- Only tool: `maestria_mode` for mode management, `delegate_task` (Phase 2+) for delegation
- Includes the mode-to-pipeline mapping table
- Includes commit authorization protocol (ADR-009)
- Includes maker/checker split enforcement instructions

**maestria-builder/SKILL.md — Key design points:**

- Identity: "You are a focused implementation agent for atomic tasks."
- Methodology: Implementation Staircase, Scope Check, Execution Loop
- Includes OpenCode delegation pattern for Complex/multi-file tasks
- Permission: `edit: allow`, `bash: allow`

**maestria-reviewer/SKILL.md — Key design points:**

- Identity: "You review code and methodology for quality."
- Permission: `edit: deny` — reviewer cannot modify anything
- Review checklist: completeness, correctness, consistency, security
- Output format with classification labels (praise, suggestion, issue, nit)

**maestria-global-rules/SKILL.md — Key design points:**

- No identity — this is a rules file, not an agent
- Contains cross-cutting methodology rules adapted from `@maestria/opencode` rules
- Orchestration rules (don't assume, read first, etc.)
- Delegation rules (specialist roster, `task()` constraints, etc.)
- Context management (progressive disclosure, checkpoints, pruning)
- Tool hierarchy (webfetch → websearch)
- Commit policy (orchestrator-only authorization)
- Mode workflow rules

**Success criteria:** All 4 skills load via `ctx.register_skill`. Each has YAML frontmatter with permission blocks. Each has an identity statement. Length is 100-250 lines. Skill Prescription section present in each.

#### 1.9 — README.md

**What:** Plugin README with installation, configuration, and usage instructions.

**Spec:**

````markdown
# hermes-maestria

Methodology plugin for Hermes Agent — mode workflows, specialist delegation, quality gates.

## Installation

```bash
hermes plugins install /opt/data/hermes/plugins/hermes-maestria
hermes plugins enable hermes-maestria
```
````

## Usage

- `/fein` — Full pipeline mode (adventurer → architect → builder → reviewer)
- `/sonar` — Research-only mode (no code, no edits)
- `/blitz` — Fast implementation mode (builder directly)
- `/review` — Route to reviewer for quality check
- `/plan` — Route to planner for task breakdown

## Configuration

Mode persistence: `.maestria-state.json` in plugin directory.

```

**Success criteria:** README documents install, enable, and all 5 slash commands.

### Phase 1 Verification

| Check                    | How                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Plugin installs          | `hermes plugins install /opt/data/hermes/plugins/hermes-maestria` succeeds                                                   |
| Plugin enables           | `hermes plugins enable hermes-maestria` activates the plugin                                                                 |
| Plugin loads             | `hermes plugins list` shows `hermes-maestria`                                                                                |
| Tool registered          | `maestria_mode` appears in tool list                                                                                         |
| Hooks fire               | `pre_llm_call` injects mode context on every turn (verify with debug logging)                                                |
| Sonar guard              | `pre_tool_call` blocks `edit`/`write` in sonar mode; allows read-only bash                                                   |
| Skills loadable          | All 4 skills load via `ctx.register_skill`                                                                                   |
| Slash commands           | `/fein`, `/sonar`, `/blitz`, `/review`, `/plan` route correctly                                                              |
| Mode persistence         | `/sonar`, restart Hermes, `/fein` reports blitz? No — `/sonar` reports sonar (persisted)                                     |
| End-to-end               | `/fein` → verify mode is fein → `/sonar` → verify edit is blocked → `/blitz` → builder skills available                     |

### Rollback Point

After Phase 1: mode system works, sonar guard functional, 5 slash commands, 4 skills with corrected format. Can ship as v0.1.0.

---

## Phase 2 (v0.2): Full Specialist Roster + Delegation

**Goal:** Add remaining specialists to complete the 7-specialist roster. Add proper permission profiles for all specialists. Add session state hooks. Expand slash commands.

> **UPDATE: 📋 NOT SHIPPED on main.** The full specialist roster and Hermes-specific delegation remain future work. Phase 2 builds on Phase 1's mode system.

> **UPDATE (June 22, 2026):** This phase now targets the 7 OpenCode names (not 9). No communicator or ideator specialists. The `delegate_task` tool is added here (Phase 2, not Phase 1) since Phase 1 focuses on the mode system. Permission profiles match the 7 OpenCode agents plus the dispatcher.

### Dependencies

Phase 1 complete.

### Files to Add

```

src/tools/
└── delegate.py # delegate_task tool for specialist routing
skills/
├── maestria-adventurer/SKILL.md # Information gathering and synthesis
├── maestria-architect/SKILL.md # Decisions, evaluation, trade-offs
├── maestria-diagnose/SKILL.md # Systematic root cause analysis
├── maestria-planner/SKILL.md # Phased plans, roadmaps
└── maestria-writer/SKILL.md # Structured documentation

```

### Files to Modify

```

src/**init**.py # Register delegate_task tool, new skills, new commands
src/plugin.py # Register new skills/commands
src/hooks/pre_tool.py # Full permission profiles for all specialists

````

### Tasks

#### 2.1 — Add `delegate_task` Tool

**What:** Register a `delegate_task` tool for routing work to specialists. This is the primary delegation mechanism for pipeline composition.

**Spec:**

```python
self.ctx.register_tool(
    name="delegate_task",
    toolset="maestria",
    schema={
        "type": "object",
        "properties": {
            "specialist": {
                "type": "string",
                "enum": ["orchestrator", "adventurer", "architect", "builder",
                         "diagnose", "planner", "reviewer", "writer"],
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
````

**Handler:** Loads the specialist's skill file, composes a delegation message with briefing + specialist instructions + handoff template, returns it.

**Success criteria:** `delegate_task(specialist="adventurer", briefing="Research X")` loads adventurer skill and returns complete delegation with briefing, instructions, and handoff format.

#### 2.2 — Add 5 New Skills

Create skills for the remaining 5 specialists, all using the corrected format:

| Skill                 | Lines   | Identity Statement                                | Key Permissions            |
| --------------------- | ------- | ------------------------------------------------- | -------------------------- |
| `maestria-adventurer` | 100-250 | "You are a codebase reconnaissance agent."        | `edit: deny`, `bash: ask`  |
| `maestria-architect`  | 100-250 | "You make architecture decisions systematically." | `edit: deny`, `bash: ask`  |
| `maestria-diagnose`   | 100-250 | "You trace bugs systematically."                  | `edit: ask`, `bash: ask`   |
| `maestria-planner`    | 100-250 | "You create implementation plans."                | `edit: ask`, `bash: ask`   |
| `maestria-writer`     | 100-250 | "You write documentation."                        | `edit: allow`, `bash: ask` |

Each skill follows the corrected template: YAML frontmatter, identity, Process, Rules, Handoff Format, Iteration Limits, Skill Prescription, Related Agents.

**Success criteria:** All 5 skills load. Each has YAML frontmatter with permission blocks. Identity statement present. Length 100-250 lines.

#### 2.3 — Add Slash Commands

```python
self.ctx.register_command("adventure", handler=..., description="Route to adventurer specialist")
self.ctx.register_command("architect", handler=..., description="Route to architect specialist")
self.ctx.register_command("diagnose", handler=..., description="Route to diagnose specialist")
self.ctx.register_command("write", handler=..., description="Route to writer specialist")
```

**Success criteria:** `/adventure`, `/architect`, `/diagnose`, `/write` route to correct specialists.

#### 2.4 — Full Permission Profiles

**What:** Expand `pre_tool_call` hook with full permission profiles for all 7 specialists plus the orchestrator.

**Spec (adapted from shipped `@maestria/opencode` frontmatter, using Hermes hook primitives):**

| Specialist       | read     | glob     | grep     | edit     | bash                                                      | skill | webfetch | delegate_task |
| ---------------- | -------- | -------- | -------- | -------- | --------------------------------------------------------- | ----- | -------- | ------------- |
| **orchestrator** | **deny** | **deny** | **deny** | **deny** | **deny**                                                  | allow | deny     | **allow**     |
| adventurer       | allow    | allow    | allow    | deny     | deny (git log/diff/which: allow)                          | allow | allow    | —             |
| architect        | allow    | allow    | allow    | deny     | deny (which: allow)                                       | allow | allow    | —             |
| builder          | allow    | allow    | allow    | allow    | allow                                                     | allow | —        | —             |
| diagnose         | allow    | allow    | allow    | ask      | ask (git status/diff/log/blame/show/which/env/pwd: allow) | allow | allow    | —             |
| planner          | allow    | allow    | allow    | ask      | ask (git status/diff/log: allow)                          | allow | allow    | —             |
| reviewer         | allow    | allow    | allow    | deny     | allow (git status/diff/log: allow)                        | allow | —        | —             |
| writer           | allow    | allow    | allow    | allow    | ask (git status: allow)                                   | allow | allow    | —             |

**Note:** `ask` is not a native Hermes hook return value. Implement as `allow` with a log warning (future: prompt user before execution).

**Orchestrator strictness:** All tools denied except `delegate_task` and `skill`. The orchestrator must never read, glob, grep, edit, webfetch, or run bash itself.

**Success criteria:** `pre_tool_call` enforces correct permissions for all 7 specialists plus orchestrator. Reviewer can't edit. Orchestrator has only `delegate_task` and `skill` — everything else denied.

#### 2.5 — Session State Hooks

**What:** Implement `on_session_start` and `on_session_end` hooks for state persistence.

**Spec:** (same as original plan — file-based `.maestria-state.json` with current mode and active specialist tracking)

**Success criteria:** State persists across sessions. Mode and active specialist restored on restart.

### Phase 2 Verification

| Check               | How                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------- |
| All skills load     | `hermes skill list` shows all 7                                                       |
| delegate_task works | Invoke with each specialist, verify correct skill loads + briefing is complete        |
| All commands work   | `/adventure`, `/architect`, `/diagnose`, `/write`, `/review`, `/plan` route correctly |
| Permission profiles | `pre_tool_call` enforces correct permissions for all 7; orchestrator is strictest     |
| Session persistence | Restart Hermes, verify mode and active specialist restored                            |
| Global rules        | Rules injection includes full 7-specialist table and mode system rules                |

### Rollback Point

After Phase 2: full 7-specialist roster, `delegate_task` tool, 6 slash commands, session persistence, full permissions. Can ship as v0.2.0.

---

## Phase 3 (v0.3): Advanced Features

**Goal:** Parallel delegation, MCP integration, automation (schedule_task), skill prescription enforcement, shared prompt library, memory integration.

> **UPDATE:** Some Phase 3 features have shipped on main. Others remain future work. Each item below is individually annotated.

> **UPDATE (June 22, 2026):** Specialist names updated to 7 OpenCode names throughout.

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
                    "specialist": {"type": "string", "enum": [
                        "orchestrator", "adventurer", "architect", "builder",
                        "diagnose", "planner", "reviewer", "writer",
                    ]},
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
                "enum": ["orchestrator", "adventurer", "architect", "builder",
                         "diagnose", "planner", "reviewer", "writer"],
                "description": "Which specialist to delegate to on schedule"
            },
            "briefing": {"type": "string", "description": "Task briefing for the specialist"},
        },
        "required": ["cron", "specialist", "briefing"],
    },
    handler=handle_schedule_task,
)
```

**Handler:** Store scheduled tasks in `.maestria-state.json`. On `on_session_start`, check for due tasks and dispatch.

**Success criteria:** `schedule_task` registers. Cron expression is parsed. Due tasks dispatch to correct specialist on session start.

> **UPDATE:** 📋 FUTURE WORK. Not shipped on main.

#### 3.4 — Skill Prescription

**What:** Implement the skill prescription pattern from ADR-004 — each specialist skill defines "Always load", "Load on trigger", "Defer to specialist", "Skip if" buckets.

**Spec:** Parse skill prescription sections from specialist markdown files. Before delegation, check if prescribed skills are available. If not, prompt user for installation (bundled question per ADR-005).

**Success criteria:** Orchestrator checks skill prescription before delegation. Missing skills trigger bundled install prompt.

> **UPDATE:** ✅ SHIPPED on main (partially). Skill Prescription is embedded in every agent file on main (e.g., builder.md has 27 Load-on-trigger entries, adventurer.md has 7). The orchestrator has a dedicated "Skills for Subagents" section with proactive/reactive paths, guard rails, and miss handling. However, the dispatcher-level skill prescription parsing and bundled install prompt (Phase 3.4 as described) was not implemented — skill prescription is declarative in agent files, not enforced by the orchestrator.

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

**Spec:** Use `on_session_end` to persist key findings to a memory store. Use `on_session_start` to restore relevant context. Fall back to file-based `.maestria-state.json` if no memory API exists.

**Success criteria:** Key findings persist across sessions. Specialist context is available without re-research.

> **UPDATE:** 📋 FUTURE WORK. Not shipped on main.

#### 3.7 — Post-Tool-Call Observability Hook

**What:** Implement `post_tool_call` hook for logging and observation.

**Spec:**

```python
async def post_tool_call_observe(tool_name, args, result, **kwargs):
    """Log tool calls for observability."""
    specialist = _active_specialist
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

> **UPDATE (June 22, 2026):** The original plan's migration process assumed compressing from 114-295 lines to 50-80 lines. The corrected approach keeps lengths in the 100-250 range with YAML frontmatter and identity statements intact.

Key differences:

- **Identity preserved** — Skills keep "You are an X agent" identity statements (matching shipped format)
- **Length range** — Skills target 100-250 lines (not 50-80)
- **Template includes frontmatter** — YAML frontmatter with permission blocks (not frontmatter-free)
- **Skill Prescription embedded** — Each skill has Always load / Load on trigger / Defer to specialist / Skip if sections
- **Related Agents section** — Replaces the original Composition section

### Process

For each agent prompt in `packages/opencode/agents/*.md`:

1. **Extract methodology** — Identify the core process, rules, and patterns
2. **Reference PATTERNS.md** — Ensure the skill satisfies both Pipeline Composition and Maker/Checker Split contracts
3. **Adapt using corrected template** — Rewrite using the corrected template (YAML frontmatter, identity, process, rules, handoff, iteration limits, skill prescription, related agents)
4. **Target 100-250 lines** — Keep identity statements, permission blocks, and Skill Prescription
5. **Generalize for Hermes** — Replace opensrc/lsp/task() with Hermes equivalents (webfetch/grep/delegate_task)
6. **Add Hermes-specific sections** — Mode awareness, slash command integration, Kanban delegation patterns
7. **Validate** — Ensure the skill is self-contained, satisfies PATTERNS.md, and follows the corrected template

### What to Keep from `@maestria/opencode` Prompts

- Core methodology and process steps
- `!!!` markers for critical rules
- Iteration limits and escalation patterns
- Handoff format requirements
- Maker/checker split principles
- Skill Prescription patterns (Always load, Load on trigger, Defer to specialist, Skip if)
- Commit protocol rules (per ADR-009)
- Mode system awareness (per ADR-008)
- YAML frontmatter _structure_ (description, mode, permission blocks)

### What to Adapt from `@maestria/opencode` Prompts

- YAML frontmatter permissions → Hermes hook permission profiles (same intent, different mechanism)
- `opensrc` → `webfetch` (Hermes tools for external data)
- `lsp` → `grep` with broader patterns (Hermes doesn't have LSP integration)
- `task()` → `delegate_task` (canonical names differ)
- `input.instructions` → `pre_llm_call` context injection

### What to Discard from `@maestria/opencode` Prompts

- Nothing wholesale — even domain-specific examples can be adapted to be domain-agnostic
- OpenCode-specific tool names (replace with Hermes equivalents, don't delete the methodology behind them)

---

## Testing Strategy

> **UPDATE (June 22, 2026):** Tests updated for Phase 1 scope (mode system + sonar guard). Phase 2+ tests use corrected 7-specialist names.

### Unit Tests

- `test_modes.py` — Verify mode persistence, transitions, pipeline mapping
- `test_sonar_guard.py` — Verify sonar mode blocks edit/write/mutating bash
- `test_context_injection.py` — Verify `pre_llm_call` injects mode context
- `test_permission_profiles.py` — Verify each specialist's permission profile blocks/permits correctly (Phase 2)
- `test_delegate_task_handler.py` — Verify tool routing, briefing composition, skill loading (Phase 2)
- `test_session_state.py` — Verify state persistence across start/end hooks (Phase 2)

### Integration Tests

- `test_end_to_end_pipeline.py` — Set mode → verify mode context → invoke specialist → verify output
- `test_slash_commands.py` — Invoke `/fein`, `/sonar`, `/blitz`, `/review`, `/plan`, verify mode changes and routing
- `test_mode_transitions.py` — Cycle through all 3 modes, verify pipeline mappings correct
- `test_sonar_to_fein.py` — Start in sonar, verify edit blocked, switch to fein, verify edit allowed
- `test_permission_enforcement.py` — Attempt blocked operations, verify rejection (Phase 2)
- `test_orchestrator_strictness.py` — Verify orchestrator has no tools except `delegate_task` and `skill` (Phase 2)

### Manual Tests

- Load plugin in Hermes, run `/sonar`, attempt to edit a file — verify blocked
- Run `/fein`, verify context shows full pipeline instructions
- Switch modes mid-conversation, verify context updates on next turn
- Restart Hermes, verify mode persists from previous session
- Run `/review` on a real diff, verify reviewer skill loads correctly (Phase 2)

---

## Risk Register

> **UPDATE (June 22, 2026):** Risks updated for Phase 1 scope. Divergence risk downgraded — session verification confirmed the corrected direction.

| Risk                                               | Likelihood | Impact | Mitigation                                                                                                                                                                                                  |
| -------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hermes `register(ctx)` API changes                 | Medium     | High   | Pin Hermes version in `plugin.yaml`. Monitor Hermes changelog.                                                                                                                                              |
| Skill loading mechanism differs from spec          | Medium     | High   | Validate `ctx.register_skill` signature early in Phase 1.                                                                                                                                                   |
| `pre_tool_call` hook signature wrong               | Medium     | Medium | Verify hook contract with Hermes docs before implementation.                                                                                                                                                |
| `pre_llm_call` context injection mechanism differs | Medium     | Medium | Test early — inject a test string, verify it appears in user message.                                                                                                                                       |
| Mode file persistence conflicts with Kanban state  | Low        | Medium | Use separate namespace (`.maestria-state.json`) vs Kanban state file.                                                                                                                                       |
| Permission profiles too restrictive/lenient        | Low        | Medium | Start permissive (ADR-006), tighten based on real usage. Sonar guard is the only restriction in Phase 1.                                                                                                    |
| OpenCode CLI not available when builder delegates  | Low        | High   | Check `which opencode` before delegation. Fall back to in-Hermes builder skill if CLI unavailable.                                                                                                          |
| **Divergence from shipped methodology**            | Low        | Medium | **Session verification corrected the major divergences (names, format, injection, hooks, loading). Remaining divergence (Python hooks vs YAML frontmatter) is inherent to Hermes platform and acceptable.** |

---

## Open Questions / Assumptions

### Assumptions to Validate

1. ✅ **Hermes `register(ctx)` signature** — Confirmed. Entry point is `register(ctx)`.
2. ✅ **`ctx.register_skill(name, path)` signature** — Confirmed. Takes name string and path.
3. ⚠️ **`pre_llm_call` context injection** — Partially verified. Returns `{"context": rules_text}` to inject context. Expected to go into user message (not system prompt). **Verify in Phase 1.**
4. ✅ **`ctx.register_hook(hook_name, fn)` hook names** — Confirmed: `pre_llm_call`, `pre_tool_call`, `on_session_start`, `on_session_end`.
5. ✅ **`ctx.register_command(name, handler, description)` signature** — Confirmed.
6. ✅ **`ctx.dispatch_tool(name, args)` availability** — Confirmed.
7. ❌ **`ctx.get_state/set_state/load_state/save_state` API** — **Not found.** Use module-level variables and file-based persistence instead.
8. ❌ **Hook return values for `pre_tool_call`** — **Not `(bool, str)` tuple.** Return `{"action": "block", "message": "..."}` to block, `None` to allow. No "ask" behavior.
9. ❌ **Hook callback signatures receive `ctx`** — **Wrong.** All hooks receive their specific arguments directly (no `ctx` param).
10. ⚠️ **`ask` permission level** — Not native to Hermes. Where shipped format uses `ask`, implement as `allow` with logging in Phase 1-2. Future: prompt user before execution.
11. ✅ **Plugin opt-in required** — Confirmed. `hermes plugins enable <name>` required after install.

> **UPDATE (June 22, 2026):** Assumptions 3, 10, and 11 reflect session findings. Items 3 and 11 were previously unverified.

### Open Questions

1. **Does Hermes support toolset grouping?** — We use `toolset="maestria"` in `register_tool`. Does Hermes group tools by toolset? Or is it metadata-only?
2. **How does Hermes handle slash command arguments?** — Does `/review` pass args to the handler? Or does the handler need to read context?
3. **Is there a Hermes skill registry/marketplace?** — For skill prescription (Phase 3), we need to know if skills can be discovered/installed programmatically.
4. **What is the Hermes plugin lifecycle?** — When exactly does `register()` run? Once per session? Once per startup?
5. ✅ **Can hooks block tool execution?** — Confirmed. `pre_tool_call` returns `{"action": "block", "message": "..."}` to block, `None` to allow.
6. ⚠️ **Does `pre_llm_call` context inject into user message or system prompt?** — Expected: user message. **Verify in Phase 1.**
7. **How does Hermes Kanban playbook integration work?** — For Phase 2+ delegation routing via Kanban.

### Additional APIs Discovered

Note these as useful for future phases:

- `ctx.llm` — host-owned LLM facade for plugin-initiated completions (could spawn specialists)
- `transform_tool_result` hook — transform tool results before returning to model
- `transform_llm_output` hook — transform final LLM response before delivery
- `ctx.register_cli_command` — register `hermes maestria` CLI subcommands
- `ctx.register_middleware` — register behavior-changing middleware

---

## Summary

> **UPDATE (June 22, 2026):** Summary updated with corrected 7-specialist roster, revised Phase 1 scope, and adjusted targets.

| Phase        | Milestone     | Deliverables                                                                                                                                                                                                                                                                                | Version    |
| ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Phase 1      | Core Loop     | plugin.yaml, src/\_\_init\_\_.py, src/plugin.py, src/modes.py, 2 hooks (pre_llm, pre_tool), 1 tool (maestria_mode), 5 slash commands (/fein /sonar /blitz /review /plan), 4 skills (orchestrator, builder, reviewer, global-rules) in corrected format (YAML frontmatter, 100-250 lines)    | v0.1.0     |
| Phase 2      | Full Roster   | delegate_task tool, 5 more skills (adventurer, architect, diagnose, planner, writer), 4 more commands (/adventure /architect /diagnose /write), session persistence, full permission profiles for all 7 + orchestrator                                                                      | v0.2.0     |
| Phase 3      | Advanced      | Parallel delegation, MCP, automation (schedule_task), skill prescription enforcement, shared prompts, memory integration, observability                                                                                                                                                     | v0.3.0     |
| Skill Design | Cross-cutting | All skills follow the corrected format: YAML frontmatter with permission blocks, identity statements, 100-250 lines, Skill Prescription sections. Skills are composable, domain-agnostic, and opt-in. All skills satisfy PATTERNS.md contracts (Pipeline Composition, Maker/Checker Split). | All phases |

> **Status recap:**
>
> - ✅ **SHIPPED on main**: Mode system (ADR-008), commit protocol (ADR-009), YAML frontmatter agents, Skill Prescription in all agents, rewritten orchestrator (295 lines), common rules patterns
> - 📋 **NOT SHIPPED (Hermes-specific future)**: 7-specialist Hermes plugin, mode state machine, sonar guard, `delegate_task` tool, shared prompt library, MCP integration, automation, memory
> - ⚠️ **Diverged (corrected June 2026)**: Specialist names (now 7 OpenCode names), skill format (now YAML frontmatter + identity, 100-250 lines), mode injection (now user message), plugin loading (now opt-in), Kanban hooks (deferred to methodology skill), OpenCode composition (two-layer architecture)
>
> **Session summary (June 22, 2026):** The fein-pipeline verification confirmed Option A (Full Plugin) is the right direction. Six corrections were applied: specialist names (9→7 OpenCode), skill format (50-80 no-frontmatter → 100-250 YAML frontmatter), mode injection (system prompt → user message), Kanban hooks (removed — doesn't exist), plugin loading (auto → opt-in), and architecture (single-layer → two-layer with OpenCode CLI composition). Phase 1 now focuses on the mode system as the core loop, with delegation deferred to Phase 2.

**Termination condition:** All phases have success criteria, all dependencies mapped, all rollback points identified, all assumptions documented, all 7 specialists have permission profiles (Phase 2). All skills use the corrected format (YAML frontmatter, identity, 100-250 lines). PATTERNS.md contains Hermes adaptation rows for both design patterns. All shipped divergences and June 2026 corrections documented and cross-referenced.
