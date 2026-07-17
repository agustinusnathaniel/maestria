# ADR-HM-002: Hermes Orchestrator Defaults to Single-Thread — Delegate Only for Complex Tasks

## Status

Accepted (2026-07-17)

## Context

The Maestria orchestrator SKILL.md was ported from `@maestria/opencode`, where the orchestrator is a **pure dispatcher** with no implementation tools — its only actions are `task()` (delegate) and `question()` (ask the user). This design works for OpenCode because the coding agent handles implementation.

On Hermes Agent, the orchestrator has **full tool access** (read, write, bash, LLM, delegation). The "pure dispatcher" mandate is actively harmful because it forces unnecessary `delegate_task()` calls for simple tasks that could be done faster and more reliably in a single turn.

## Decision

The Hermes orchestrator defaults to **single-thread execution**. It uses `delegate_task()` to spawn specialists only for complex tasks that benefit from parallelization or focused expertise:

- 4+ files requiring coordinated changes
- Multi-domain work (e.g., frontend + backend + docs)
- Risky changes needing maker/checker split
- Explicit "Maestria mode" requested by the user

### What changed

| Layer | Before | After |
| --- | --- | --- |
| Orchestrator SKILL.md | "Only tools are delegate_task() and question(). Never implement yourself." | "Default to direct implementation. Only delegate for complex tasks." |
| `pre_llm.py` fein context | "All stages execute. Maker/checker split applies." | "Default: single-thread execution. Maker/checker split applies when delegation is used." |
| `sync.config.ts` | No replace rules for orchestrator mandate | 5 replace rules adapting canonical "pure dispatcher" language for Hermes |
| `permissions.py` | Unchanged — orchestrator role already allows full access when no role mapping | No change needed |

### What did NOT change

- **Specialist roles** (adventurer, builder, reviewer, etc.) — unchanged. They still describe their roles correctly for when delegation IS used.
- **Mode system** (fein/sonar/blitz) — unchanged.
- **Permission enforcement** — unchanged. The main session has no role mapping, so all tools pass through `pre_tool_call`.

## Consequences

### Positive

- Simple tasks complete in fewer turns (no subagent overhead)
- No context fragmentation for straightforward changes
- Existing delegation infrastructure still available for complex tasks

### Negative

- Orchestrator skill diverges from canonical `@maestria/opencode` source — sync replaces must be maintained
- Developers may over-rely on single-thread and not delegate when beneficial

## References

- ADR-HM-001: `/goal` integration decision
- PR #89: Implementation of this policy
- Hermes Agent docs: https://hermes-agent.nousresearch.com/docs
- Canonical orchestrator source: `packages/core/agent-directives/specialists/orchestrator.md`
