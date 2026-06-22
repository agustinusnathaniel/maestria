# ADR-010: Role-Based Agent Metadata — Thinker/Worker/Verifier Roles

## Status

Proposed

## Context

The `@maestria/opencode` plugin currently registers 7 subagents (orchestrator, adventurer, architect, builder, diagnose, planner, reviewer, writer) via the `config` hook. The orchestrator routes work to specialists based on trigger phrases — keyword matching in the user's message (e.g., "bug" → `@diagnose`, "review" → `@reviewer`).

This model works for straightforward delegation but has a gap: it routes on _task type_ alone, not on the _processing role_ needed. A user who says "verify this output needs verification" has only one path — `@reviewer` — because "verify" maps to reviewer by keyword. But what if the user wants a design verified before implementation? Or wants an architect to think through a problem the builder couldn't solve? The current model can't express "I need a Thinker for this" separate from "I need an Architect."

Recent research on evolutionary multi-agent coordination (arXiv:2512.04695) introduces TRINITY, a lightweight coordinator (~0.6B params) that dynamically assigns one of three roles per turn:

| Role     | Responsibility                            |
| -------- | ----------------------------------------- |
| Thinker  | Analysis, strategy, problem decomposition |
| Worker   | Execution, implementation                 |
| Verifier | Quality assurance, correctness checking   |

The TRINITY coordinator assigns roles dynamically based on the task and the state of prior turns. This is more flexible than our static agent-per-task mapping. But rather than replacing our specialist model (which has proven effective for domain-specific depth), we can augment it — add a `role` dimension to agent metadata so the orchestrator can route by both task type _and_ cognitive role.

The existing maker/checker split (ADR-004, ADR-009) already encodes a form of role separation — the agent that writes code must not QA it. Role-based metadata would formalize this principle machine-readably rather than relying solely on prose rules.

## Decision Drivers

1. **Backward compatibility** — existing agent files without a `role` field must continue to work
2. **Minimal plugin code changes** — metadata is parsed, not enforced; routing logic lives in prompts
3. **No breaking changes to orchestrator's delegation contract** — `task()` signatures remain the same
4. **Complement, don't replace, existing trigger-phrase routing** — `role` is an additional routing dimension
5. **Cross-cutting visibility** — global rules and orchestrator prompt should reference roles
6. **Simple mental model** — three roles (thinker, worker, verifier) with clear semantics

## Considered Options

### Option A: Optional `role` Frontmatter Field (Recommended)

Add an optional `role` field to the YAML frontmatter schema. Agents declare their primary role. The orchestrator's prompt references roles in delegation guidance. The plugin parses the field but does not enforce it — routing logic remains prompt-level.

```yaml
---
description: Focused implementation, single-task execution
mode: subagent
role: worker
permission:
  edit: allow
  bash: ask
---
```

Default role for agents without the field: `worker` (backward-compatible — most agents are executors).

#### Mapping of Current Agents to Roles

| Agent         | Role     | Rationale                                                   |
| ------------- | -------- | ----------------------------------------------------------- |
| `@adventurer` | thinker  | Reconnaissance is analysis and understanding before action  |
| `@architect`  | thinker  | Architecture decisions are analytical, design-oriented work |
| `@builder`    | worker   | Implements concrete, scoped tasks                           |
| `@diagnose`   | thinker  | Root cause analysis is investigative, requires reasoning    |
| `@planner`    | thinker  | Multi-phase planning is strategic analysis                  |
| `@reviewer`   | verifier | Quality assurance is verification, not implementation       |
| `@writer`     | worker   | Documentation production is execution of a defined task     |

This mapping is not exclusive — any agent can be asked to perform outside its default role via prompt-level overrides. The role is a _default_, not a constraint.

#### Orchestrator-Level Use

The orchestrator's trigger-phrase section gets an additional column or note:

```markdown
| Agent        | Role         | Trigger Phrases                                     |
| ------------ | ------------ | --------------------------------------------------- |
| `@architect` | **thinker**  | "should we use X or Y", "design decision", "ADR"    |
| `@builder`   | **worker**   | Concrete implementation task, no design ambiguity   |
| `@reviewer`  | **verifier** | "review", "check my changes", "QA", "is this ready" |
```

The orchestrator can then say "I need a Verifier for this" instead of guessing which agent to call. This is particularly useful when the task type doesn't cleanly map to one specialist — e.g., "verify my architect's design" should go to `@reviewer` (verifier role), but the current trigger-phrase system only maps "review" → `@reviewer` and "architecture" → `@architect`.

#### Pros

- Backward compatible: default `worker` means zero changes to existing agent files
- Simple: one YAML field, no new infrastructure
- Prompt-level routing: no plugin code enforcement needed
- Extensible: agents can declare multiple roles via a list format later
- Visible: `role` is self-documenting metadata in every agent file

#### Cons

- No enforcement: the orchestrator can still ignore roles
- Fixed per agent: an agent declared as `worker` can't dynamically switch to `verifier` without prompt trickery
- Overlaps with existing trigger phrases: role redundancy when the specialist name already implies the role (e.g., `@reviewer` is always a verifier)

### Option B: Dynamic Role Adjudication (Prompt-Level Only)

Don't add a frontmatter field. Instead, teach the orchestrator to assign roles dynamically based on task context, using a rubric embedded in the orchestrator prompt. Roles are inferred, not declared.

The orchestrator prompt would contain a "Role Adjudication" section:

```markdown
## Role Adjudication

Before delegating, classify the task into one of three cognitive roles:

- **Thinker** — tasks requiring analysis, strategy, design, investigation
- **Worker** — tasks requiring execution, implementation, production
- **Verifier** — tasks requiring validation, checking, review, QA

Then map to the agent whose _task-type specialty_ best matches.
```

No agent metadata changes. No plugin code changes.

#### Pros

- Zero infrastructure changes — pure prompt engineering
- Flexible: the orchestrator can assign any role to any agent per turn
- No metadata maintenance: no frontmatter to keep in sync

#### Cons

- Does not solve the "I need a Verifier" routing problem: the orchestrator still maps by task type, not role
- No machine-readable metadata: global rules, other agents, and downstream tools can't inspect role assignments
- Relies entirely on LLM instruction-following without structural reinforcement
- Harder to audit: role assignments are ephemeral per-turn decisions, not declarations

### Option C: Schema-Enforced Multi-Role with Validator

Add a `roles` list field (not a single `role`) and validate it in the plugin's `config` hook. Allow agents to declare multiple roles. The plugin would reject frontmatter with invalid roles at load time.

```yaml
---
roles:
  - thinker
  - worker
---
```

The `config` hook would validate against an allowed enum: `['thinker', 'worker', 'verifier']`. Invalid roles trigger a parse error.

#### Pros

- Machine-enforced: invalid metadata is caught at plugin load, not at runtime
- Multi-role declaration: an agent like `@diagnose` could declare both `thinker` (analysis) and `verifier` (validation of fixes)
- Structured data available to the plugin for future tooling

#### Cons

- Breaking change: all agent files must be updated or the plugin must handle missing `roles` gracefully
- Over-engineered for current needs: no downstream consumer of this data yet
- Parse errors add friction: a user editing an agent file and mis-typing a role value breaks the plugin
- List format complicates the simple "what is this agent's default role?" question
- ADR-002 established that plugin hooks should be minimal; schema enforcement that early in the pipeline adds coupling

## Decision

**Accept Option A: Optional `role` Frontmatter Field.**

Add `role` as an optional string field to the YAML frontmatter schema. Valid values: `thinker`, `worker`, `verifier`. Default: `worker`. The parser validates the field's value against the known roles for correctness (catching typos), but does not enforce behavior — an agent's declared role is a suggestion, not a constraint.

### Rationale

1. **Backward compatibility is the primary constraint.** The system works today without roles. Adding a field must not break existing agent files. A default of `worker` achieves this — every agent without the field behaves exactly as before.

2. **Prompt-level routing is the right layer for delegation decisions.** ADR-002 established that plugin hooks should be minimal and policy belongs in directives. Role-based routing is a delegation policy, not an infrastructure concern. The orchestrator's prompt already handles routing via trigger phrases; adding role awareness is a natural extension.

3. **The `role` field provides machine-readable metadata without enforcement.** This is the key distinction from Option C. The field is available for inspection by the orchestrator, by global rules, and by future tooling — but it doesn't mandate behavior. An agent declared as `verifier` can still be tasked as a `worker` if the orchestrator explicitly overrides.

4. **Single role, not list, for simplicity.** At this stage, no agent needs to declare multiple roles. A list format would be more accurate (agents are capable of multiple modes) but adds parsing complexity and weakens the "default role" concept. Single role is good enough until demonstrated otherwise.

5. **Three roles map cleanly to existing agents.** The mapping is not perfect — `@adventurer` as `thinker` is a stretch since reconnaissance is more data-gathering than analysis — but it's close enough for routing guidance. The role is a _default_, not a cage.

6. **Tension between drivers resolved.** Driver 2 (minimal plugin code changes) and Driver 5 (cross-cutting visibility) pull in opposite directions; the chosen option balances them by keeping the code change to a single optional field while making the metadata visible across all layers.

### What About Dynamic Role Switching?

Dynamic role adjudication (Option B) is not adopted as the primary mechanism, but the prompt-level approach leaves room for it. The orchestrator can still override role assignments per-turn — the frontmatter role is a hint, not a constraint. Future iterations could add dynamic role adjudication on top of the structural metadata.

### Frontmatter Schema Changes

The `parseFrontmatter` function adds one line:

```typescript
interface AgentFrontmatter {
  description: string;
  mode: string;
  role?: 'thinker' | 'worker' | 'verifier'; // NEW
  permission: Record<string, unknown>;
  color?: string;
  maxSteps?: number;
}
```

The parser treats unknown/missing role values as `worker`:

```typescript
const validRoles = ['thinker', 'worker', 'verifier'] as const;
const role = validRoles.includes(result.role as string)
  ? (result.role as 'thinker' | 'worker' | 'verifier')
  : 'worker';
```

### Orchestrator Prompt Changes

The Available Specialists table gains a Role column:

```markdown
| Agent         | Role         | When to Delegate                                 |
| ------------- | ------------ | ------------------------------------------------ |
| `@adventurer` | **thinker**  | Codebase reconnaissance, deep code understanding |
| `@architect`  | **thinker**  | Architecture decisions, trade-off analysis, ADRs |
| `@builder`    | **worker**   | Focused implementation, single-task execution    |
| `@diagnose`   | **thinker**  | Systematic bug tracing, root cause analysis      |
| `@planner`    | **thinker**  | Implementation plans with phased milestones      |
| `@reviewer`   | **verifier** | Code review with quality gates                   |
| `@writer`     | **worker**   | Documentation following structured patterns      |
```

A new general rule is added to the orchestrator prompt:

```
## Role-Based Routing

Each specialist has a default role (thinker/worker/verifier). When you
need a specific cognitive role, delegate to the specialist whose role
matches — even if the trigger phrase suggests a different agent.
For example, "verify this design" → @reviewer (verifier), not @architect.
```

### Global Rules Changes

The delegation table in `rules/AGENTS.md` gains a Role column matching the orchestrator's table. This ensures all subagents see the role assignments and can self-identify.

### What We Avoid

- **Multi-role per agent for now** — agents declare a single primary role. Runtime role switching may be explored later.
- **Siloed role enforcement** — the role field is guidance for the orchestrator, not a permission boundary. An agent declared as `worker` can still be assigned thinking tasks by the orchestrator.

## Consequences

### Positive

- Agents self-declare their cognitive role as machine-readable metadata
- Orchestrator can route by role, not just by trigger phrase — "I need a Verifier" resolves to `@reviewer` without guessing
- Backward compatible: default `worker` means zero migration effort
- Prompt-level routing keeps the plugin lean (consistent with ADR-002)
- Role metadata is visible in agent files, orchestrator prompt, and global rules

### Negative

- No enforcement: the orchestrator can still ignore role assignments
- Single-role declaration is reductive — agents like `@diagnose` can both think (analyze) and verify (check fixes)
- Role field adds one more piece of frontmatter to maintain across 7 agent files
- Marginal token overhead in frontmatter parsing and prompt tables

### Risks

- **Role inflation**: users may add custom roles (e.g., `supervisor`, `critic`) that don't match the Thinker/Worker/Verifier model. Mitigation: the plugin silently defaults unrecognized roles to `worker` — no crashes, no errors. Custom roles are ignored by the orchestrator's role-based routing but don't break anything.

- **Stale role assignments**: an agent's role may drift from its actual capabilities as the prompt evolves. Mitigation: role is a hint, not a constraint. The orchestrator can override per-turn.

- **Over-reliance on roles**: the orchestrator might default to role-based routing and skip trigger-phrase matching, losing precision in domain-specific delegation. Mitigation: the prompt explicitly says "role is a secondary dimension — trigger phrases take precedence for domain-specific tasks."

## References

- [Evolved Orchestrator for Multi-Agent Code Generation](https://arxiv.org/abs/2512.04695) — TRINITY: lightweight coordinator with Thinker/Worker/Verifier roles, optimized via CMA-ES (ICLR 2026)
- [Learning to Orchestrate Agents in Natural Language with Reinforcement Learning](https://arxiv.org/abs/2512.04388) — Conductor: RL-trained orchestrator with recursive topologies (ICLR 2026)
- ADR-002: Plugin Architecture — Pure Plugin, Markdown Agents, 2 Hooks
- ADR-004: Agent Prompt Template — 4-Bucket Skills, 5-Section Handoff, Iteration Limits, Rules Bullets
- ADR-008: Keyword-Triggered Workflow Modes — Hybrid Hook + Prompt, Denylist Config

## Date

2026-06-22
