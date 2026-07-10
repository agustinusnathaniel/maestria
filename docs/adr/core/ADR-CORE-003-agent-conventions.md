# ADR-CORE-003: Agent Conventions - `!!!` Markers, Cross-References, Skill Pattern

## Status

Accepted

## Context

As we built 7 agents (orchestrator, architect, builder, diagnose, planner, reviewer, writer), we needed consistent conventions for:

1. **Critical vs. advisory rules** - How to distinguish non-negotiable instructions from suggestions within agent prompts
2. **Agent interconnections** - How agents reference each other for delegation
3. **Skill discovery** - How agents tell the user to install relevant skills
4. **Review output format** - How reviewer structures its findings

These conventions emerged during implementation and should be documented so future agents follow the same patterns.

## Decision

### 1. `!!!` Marker Convention

Prefix critical, non-negotiable rules with `!!!`. This signals "this is not a suggestion - violating this will produce incorrect or destructive output."

| Context      | Example                                   |
| ------------ | ----------------------------------------- |
| Orchestrator | `!!! Never implement yourself - delegate` |
| Reviewer     | `!!! Never edit files (read-only)`        |
| Builder      | `!!! Run tests before claiming done`      |
| Diagnose     | `!!! Always verify before handoff`        |
| Writer       | `!!! Proofread before finishing`          |

Rules without `!!!` are advisory or contextual - the agent should follow them unless there's a compelling reason not to.

### 2. Agent Cross-References

Every agent has two sections for inter-agent communication:

#### `Related Agents` (end of file)

Lists sibling agents with specific delegation triggers:

```markdown
## Related Agents

- `@architect` - Consult for architecture input before detailed planning
- `@reviewer` - Review the plan for completeness and blind spots before execution
```

Rules:

- Each entry states WHEN to delegate, not just what the agent does
- Ordered by most likely delegation first
- Only list agents that this agent would realistically hand off to

#### Orchestrator's `Specialists` Table

The orchestrator additionally has a full table of all subagents with role descriptions and delegation triggers:

```markdown
| Agent        | Role                   | When to Delegate            |
| ------------ | ---------------------- | --------------------------- |
| `@architect` | Architecture decisions | Choosing between approaches |
| `@builder`   | Focused implementation | Feature work, bug fixes     |
```

### 3. Skill Pattern: Check → Use → Suggest

Every agent follows the same three-step pattern for skills:

```
1. Check via `skill` tool if a relevant skill exists
2. If available, load and follow it
3. If not, suggest installing with:
   `pnpx skills@latest add <repo> -g -y --skill <name>`
```

Scope convention:

- Use `-g` (global) for cross-project methodology skills (e.g., diagnose, tdd)
- Omit `-g` for stack-specific skills (e.g., hallmark, impeccable)

Skills are listed in each agent grouped by domain with source repos, so the agent can construct the install command without guessing.

### 4. Conventional Comments in Review Output

The reviewer prefixes each issue with a [Conventional Comments](https://conventionalcomments.org/) label:

| Label         | When                           |
| ------------- | ------------------------------ |
| `praise:`     | Positive feedback              |
| `suggestion:` | Improvement idea, not blocking |
| `issue:`      | A problem that should be fixed |
| `nitpick:`    | Minor style preference         |
| `question:`   | Needs clarification            |

This makes review output structured, grepable, and consistent across sessions.

#### Triage Suggestion Labels

In addition to Conventional Comments, each review issue now carries a triage suggestion in brackets appended to the label:

| Triage Label | Meaning                                | Next Action                              |
| ------------ | -------------------------------------- | ---------------------------------------- |
| `[fix]`      | Actionable defect or improvement       | Dispatched to Builder for implementation |
| `[dismiss]`  | Nit or preference, not blocking        | Resolved with a comment                  |
| `[escalate]` | Ambiguous, high-risk, or cross-cutting | Surfaced to the user via question        |

Example: `issue: [fix] Password reset token is not hashed before storage - use bcrypt hash.`

The triage label lets the orchestrator process review output without re-reading the full context of every issue. When multiple lenses disagree on the same issue, the conservative categorization wins (`fix` over `dismiss`, any single `escalate` escalates the whole issue).

## Consequences

- Positive: `!!!` makes critical rules instantly recognizable - agents can't claim "I didn't know this was mandatory."
- Positive: Cross-references make the agent system navigable - reading one agent tells you when to delegate to another.
- Positive: Skill pattern is self-service - agents don't bundle skills but can install them on demand.
- Positive: Conventional Comments create structured, actionable review output.
- Negative: `!!!` can lose meaning if overused - must reserve for genuinely non-negotiable rules only (~1-3 per agent).
- Negative: Skill catalogs in agent files need maintenance when new skills emerge or repos rename.

## Date

2026-06-12
