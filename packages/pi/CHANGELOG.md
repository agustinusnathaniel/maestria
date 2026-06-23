# Changelog

## 0.2.0

### Minor Changes

- [#12](https://github.com/agustinusnathaniel/maestria/pull/12) [`95a0ea0`](https://github.com/agustinusnathaniel/maestria/commit/95a0ea084f2ca48b5283375b55ab1c81c5f8a014) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - feat(pi): ship @maestria/pi@0.1.0 with full agent orchestration

  Implements the `@maestria/pi` package — a Pi coding agent extension bringing Maestria's structured agent orchestration (recon → design → implement → review) to the Pi ecosystem.

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
