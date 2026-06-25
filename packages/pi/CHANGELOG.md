# Changelog

## 0.3.0

### Minor Changes

- [#36](https://github.com/agustinusnathaniel/maestria/pull/36) [`d1bc253`](https://github.com/agustinusnathaniel/maestria/commit/d1bc253b9c4004ccf4ef09cfa9c8b1a7f99b39e7) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add `.maestria/` project workflow protocol to agent directives

  Projects using maestria's agent directives can now define `.maestria/workflow.md` for custom delegation sequencing and `.maestria/rules.md` for project-specific non-negotiable rules. The orchestrator loads these files via `@adventurer` delegation and propagates project rules to all subagents via delegation prompts.

  See ADR-CORE-006 for the design decision.

- [`665bf4b`](https://github.com/agustinusnathaniel/maestria/commit/665bf4b0aed6162ed93579a1f1c55e80fae887ec) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add effort anthropomorphism guard and writing style guidance to agent directives
  - **Critical Rule [#11](https://github.com/agustinusnathaniel/maestria/issues/11) (orchestrator):** "Don't anthropomorphize effort" - prevents the dispatcher from avoiding the correct specialist because an analysis "feels like too much work"
  - **Output Style section (orchestrator):** Guides the dispatcher to write for humans, avoiding AI-typical patterns like em dash overuse and promotional phrasing
  - **Global agent rules (rules.md):** Cross-agent versions of both - "Don't anthropomorphize effort" and "Write for humans" - so architect, planner, builder, and all other specialists also receive the guidance

## 0.2.1

### Patch Changes

- [#33](https://github.com/agustinusnathaniel/maestria/pull/33) [`c2075b6`](https://github.com/agustinusnathaniel/maestria/commit/c2075b69b3c44ec8a95ba3711ce4bc4d76e6d163) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Introduce @maestria/core as canonical source for agent directives with config-driven sync tool
  - Add packages/core/agent-directives/ with canonical specialist, orchestrator, and rules files
  - Add packages/core/scripts/sync.ts transform pipeline (replace, prepend, append, frontmatter)
  - Add per-plugin sync.config.ts for opencode, pi, and kimi-code
  - Add scripts/sync-all and scripts/check-sync with auto-discovery via glob
  - Wire sync check into vp check via vite.config.ts run.tasks
  - Document architecture decision in ADR-CORE-005

## 0.2.0

### Minor Changes

- [#12](https://github.com/agustinusnathaniel/maestria/pull/12) [`95a0ea0`](https://github.com/agustinusnathaniel/maestria/commit/95a0ea084f2ca48b5283375b55ab1c81c5f8a014) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - feat(pi): ship @maestria/pi@0.1.0 with full agent orchestration

  Implements the `@maestria/pi` package - a Pi coding agent extension bringing Maestria's structured agent orchestration (recon → design → implement → review) to the Pi ecosystem.

  Includes:
  - 9 source modules: extension, modes, rules, rules-content, state, compaction, subagent, commands, tools
  - 3 workflow modes: fein (full pipeline), sonar (research), blitz (fast impl)
  - 8 prompt templates: orchestrator + 7 specialists
  - 2 methodology skills: handoff, iteration-limits
  - Subagent dispatch with 3 modes: single, parallel (max 8), chain (with {previous} placeholder)
  - Global rules injection via before_agent_start event
  - Compaction state preservation
  - Maker/checker enforcement via tool-call interception
  - 9 Pi commands: /fein, /sonar, /blitz, /orchestrate, /review, /restore-model, /review-model, /handoff, /maestria-status
  - 63 tests with full coverage
  - User-facing documentation (7 pages)
  - 3 ADRs documenting architecture decisions

## 0.1.0 (2026-06-22)

### Features

- 8 specialist prompt templates (orchestrator + 7 specialists)
- 3 workflow modes: fein (full pipeline), sonar (research only), blitz (fast implementation)
- Global rules injection via `before_agent_start` event
- Session compaction preservation with structured state summaries
- Subagent dispatch via `@gotgenes/pi-subagents` with 6-field handoff validation
- `/orchestrate`, `/review`, `/maestria-status` commands
- Maker/checker enforcement via tool-call interception
- 2 methodology skills: handoff contract and iteration limits
