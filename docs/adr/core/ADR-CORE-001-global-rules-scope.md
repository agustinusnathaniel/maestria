# ADR-CORE-001: Global Rules Scope — What Belongs in rules/AGENTS.md

## Status

Accepted

## Context

We built `@maestria/opencode` with three layers where behavior is defined:

- **Agent files** (`agents/*.md`) — per-agent instructions and methodology
- **Global rules** (`rules/AGENTS.md`) — cross-cutting principles injected into every session
- **OpenCode defaults** — built-in permission model, agent mode behavior, commit handling

After a comprehensive scan of `my-base` KB (~300 files across AI concepts, agent patterns, directive library, loop engineering, and 6 methodology skills), we needed to decide which patterns to promote to global rules vs. leave in agent files vs. exclude entirely.

## Decision

Apply this three-way filter when evaluating any candidate pattern:

| Destination      | Condition                                                                        | Example                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent file**   | Applies to one agent's domain                                                    | "Fix root cause, not symptom" → `diagnose.md`                                                                                               |
| **Global rules** | Cross-cutting AND not covered by any agent directive AND not an OpenCode default | "Use opensrc instead of API calls"                                                                                                          |
| **Exclude**      | Covered by agent directives OR OpenCode defaults OR too narrow for global scope  | "Don't delete what you didn't create" (covered by `edit: ask`), Model tiering (OpenCode config), Keyboard `e.preventDefault()` (too narrow) |

### Rationale

1. **Agent files are the primary layer.** Each agent has a focused domain. Domain-specific methodology lives with the agent, not in global rules. Users reading the agent file see everything that agent needs.

2. **Global rules are for cross-cutting techniques only.** If a pattern applies across all agents and is not already encoded in any agent's instructions, it belongs here. The bar is high: patterns that are "nice to know" but don't change agent behavior are excluded.

3. **OpenCode defaults handle infrastructure.** Permission enforcement, commit behavior, model assignment — these are OpenCode's job, not ours. Duplicating them in our rules creates maintenance burden and drift risk.

4. **Human-facing awareness notes don't belong in agent rules.** Concepts like "token cost matters" or "the loop makes mistakes too" are for the human operator to know and manage. Encoding them as agent directives adds noise without changing behavior.

### Consequences

- Positive: Global rules stay lean (~30 lines), easy to audit, no duplication with agent files
- Positive: Agent files are self-contained — reading one file gives you the full methodology for that agent
- Negative: Must re-apply the filter when adding new rules; easy to accidentally include overlapping patterns
- Negative: Subtle cross-cutting patterns may be missed if they don't surface during review

## Filtering History (This Session)

The following patterns were evaluated against this filter:

| Pattern                                   | Filter Result | Reason                                                                     |
| ----------------------------------------- | ------------- | -------------------------------------------------------------------------- |
| `!!! Don't delete what you didn't create` | Excluded      | Covered by `edit: ask` permission + "prefer edit over write" in builder.md |
| `!!! Validate before handoff`             | Excluded      | Enforced in `diagnose.md:92`, `builder.md:123`                             |
| `!!! Read official docs first`            | Excluded      | "Don't assume — verify against official docs" in `architect.md:99`         |
| `!!! Leverage available skills`           | Excluded      | Skill section + check tool instruction in `orchestrator.md:73-84`          |
| `!!! Ask before removing/overwriting`     | Excluded      | Permission model (`edit: ask`) covers this                                 |
| `!!! Commit solo`                         | Excluded      | OpenCode default behavior                                                  |
| `!!! Document diagnostic work`            | Excluded      | Documentation section in `diagnose.md:116-125`                             |
| Model tiering                             | Excluded      | OpenCode user config, not a global rule                                    |
| Check-Test-Commit                         | Excluded      | Per-agent in builder.md, diagnose.md                                       |
| Agent anti-patterns                       | Excluded      | In orchestrator.md:151-156                                                 |
| Token cost awareness                      | Excluded      | Human-facing, not an agent directive                                       |
| Loop engineering caveats                  | Excluded      | Human-facing awareness notes                                               |
| **Clone repos to temp / opensrc**         | **Added** ✅  | Cross-cutting technique, not covered anywhere else                         |

## Date

2026-06-12
