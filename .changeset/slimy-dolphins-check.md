---
'@maestria/pi': minor
---

feat(pi): ship @maestria/pi@0.1.0 with full agent orchestration

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
