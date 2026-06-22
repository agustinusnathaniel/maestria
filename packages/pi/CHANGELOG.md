# Changelog

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
