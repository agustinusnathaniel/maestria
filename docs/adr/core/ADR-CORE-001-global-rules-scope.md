# ADR-CORE-001: Global Rules Scope - What Belongs in rules/AGENTS.md

## Status

Accepted

## Context

`@maestria/opencode` defines behavior in three layers:

- **Agent files** (`agents/*.md`) - per-agent instructions and methodology
- **Global rules** (`rules/AGENTS.md`) - cross-cutting principles injected into every session
- **OpenCode defaults** - built-in permission model, agent mode behavior, commit handling

## Decision

Apply this three-way filter when evaluating any candidate pattern:

| Destination | Condition | Example |
| --- | --- | --- |
| **Agent file** | Applies to one agent's domain | "Fix root cause, not symptom" for the diagnose agent |
| **Global rules** | Cross-cutting AND not covered by any agent directive AND not an OpenCode default | "Use opensrc instead of API calls" |
| **Exclude** | Covered by agent directives OR OpenCode defaults OR too narrow for global scope | "Don't delete what you didn't create" (covered by `edit: ask`), model tiering (OpenCode config), keyboard `e.preventDefault()` (too narrow) |

### Rationale

1. **Agent files are the primary layer.** Each agent has a focused domain; reading one file gives you the full methodology that agent needs. Domain-specific methodology lives with the agent, not in global rules.
2. **Global rules are for cross-cutting techniques only.** If a pattern applies across all agents and is not already encoded in any agent's instructions, it belongs here. The bar is high: patterns that are "nice to know" but don't change agent behavior are excluded.
3. **OpenCode defaults handle infrastructure.** Permission enforcement, commit behavior, and model assignment are OpenCode's job; duplicating them in our rules creates maintenance burden and drift risk.
4. **Human-facing awareness notes don't belong in agent rules.** Concepts like "token cost matters" or "the loop makes mistakes too" are for the human operator to manage; encoding them as agent directives adds noise without changing behavior.

### Consequences

- Positive: Global rules stay lean, easy to audit, no duplication with agent files
- Positive: Agent files are self-contained - reading one file gives you the full methodology for that agent
- Negative: Must re-apply the filter when adding new rules; easy to accidentally include overlapping patterns
- Negative: Subtle cross-cutting patterns may be missed if they don't surface during review

## Filtering History (This Session)

Applying the filter excluded patterns already covered by agent prompts or OpenCode defaults: do-not-delete and ask-before-overwriting (permission model and edit-over-write guidance), validate-before-handoff and diagnostic documentation (diagnose and builder prompts), read-official-docs-first (architect), skill loading (orchestrator), commit-solo (OpenCode default), model tiering (user config), check-test-commit (per-agent), agent anti-patterns (orchestrator), and token-cost/loop-awareness notes (human-facing). The only addition was the cross-cutting clone-repos-to-temp/opensrc technique, which no other layer covered.

## Date

2026-06-12
