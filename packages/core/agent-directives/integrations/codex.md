## Codex CLI Integration

### Global rules and routing

The companion maestria CLI installs this file, the package's `codex.agents.md`, as a marked block in Codex's active global AGENTS.md. It holds the always-on core, the FEIN, SONAR, and BLITZ mode instructions, and this note, within Codex's 32 KiB default instruction limit. Natural-language mode keywords are case-insensitive and per-turn. These instructions remain guidance under Codex's sandbox and approval controls.

### Native custom agents

The CLI installs the native `maestria-reviewer` TOML profile in `$CODEX_HOME/agents/`. Use it as the `agent_type` when spawning the independent reviewer. It embeds its complete role and the global policy parts it needs. Codex has not applied `sandbox_mode` from an agent role file since 2026-08, so the reviewer's read-only role rests on its instructions: it must not edit files. Once you trust the plugin hooks, a maestria hook also blocks edit-tool calls inside `maestria-reviewer`; shell writes are still yours to avoid. `maestria configure codex` can update models while retaining instructions.

### Plugin boundary

Codex's AgentPlugin loader discovers the conventional root `skills/`. Marketplace installation therefore supplies only the eight skills (`handoff`, `review-loop`, `implement`, `create-pull-request`, `docs-update`, `diagnose`, `recon`, and `architecture-plan`); orchestration and native profiles require the companion CLI installation. This integration does not override Codex's primary agent.

See [Codex custom agents](https://developers.openai.com/codex/subagents) and [plugin packaging](https://developers.openai.com/codex/plugins/build).
