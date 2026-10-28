## Codex CLI Integration

### Global rules and routing

The companion maestria CLI installs a marked full orchestration block into Codex's active AGENTS.md. It includes the canonical router, global policy, and FEIN, SONAR, and BLITZ mode instructions. Natural-language mode keywords are case-insensitive and per-turn. These instructions remain guidance under Codex's sandbox and approval controls.

### Native custom agents

The CLI installs the native `maestria-reviewer` TOML profile in `$CODEX_HOME/agents/`. Use it as the `agent_type` when spawning the independent reviewer. It embeds its complete role and the global policy parts it needs, and keeps the native read-only sandbox. `maestria configure codex` can update models while retaining instructions.

### Plugin boundary

Codex 0.153.4's AgentPlugin loader discovers the conventional root `skills/` and does not use the overlay skills selector to migrate commands. Marketplace installation therefore supplies only the five skills (`handoff`, `iteration-limits`, `create-pull-request`, `docs-update`, and `diagnose`); orchestration and native profiles require the companion CLI installation. There are no extra Codex role or workflow skill facades, hooks, or MCP server. This integration does not override Codex's primary agent.

See [Codex custom agents](https://developers.openai.com/codex/subagents) and [plugin packaging](https://developers.openai.com/plugins/build/plugins).
