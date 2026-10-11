## Codex CLI Integration

### Global rules and routing

The companion maestria CLI installs a marked full orchestration block into Codex's active AGENTS.md. It includes the canonical router, global policy, and FEIN, SONAR, and BLITZ mode instructions. Natural-language mode keywords are case-insensitive and per-turn. These instructions remain guidance under Codex's sandbox and approval controls.

### Native custom agents

The CLI installs complete native TOML profiles in `$CODEX_HOME/agents/`: `maestria-adventurer`, `maestria-architect`, `maestria-builder`, `maestria-diagnose`, `maestria-planner`, `maestria-reviewer`, and `maestria-writer`. Use the corresponding `agent_type` when spawning a specialist. Each profile embeds its complete role and global policy. Research and review profiles retain the native read-only sandbox. `maestria configure codex` can update models while retaining instructions.

### Plugin boundary

Codex 0.153.4's AgentPlugin loader discovers the conventional root `skills/` and does not use the overlay skills selector to migrate commands. Marketplace installation therefore supplies only `handoff` and `iteration-limits`; orchestration and native profiles require the companion CLI installation. There are no extra Codex role or workflow skill facades, hooks, or MCP server. This integration does not override Codex's primary agent.

See [Codex custom agents](https://developers.openai.com/codex/subagents) and [plugin packaging](https://developers.openai.com/plugins/build/plugins).
