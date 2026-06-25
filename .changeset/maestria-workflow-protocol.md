---
'@maestria/opencode': minor
'@maestria/pi': minor
'@maestria/kimi-code': minor
---

Add `.maestria/` project workflow protocol to agent directives

Projects using maestria's agent directives can now define
`.maestria/workflow.md` for custom delegation sequencing and
`.maestria/rules.md` for project-specific non-negotiable rules.
The orchestrator loads these files via `@adventurer` delegation
and propagates project rules to all subagents via delegation
prompts.

See ADR-CORE-006 for the design decision.
