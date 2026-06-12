# @maestria/opencode

An OpenCode plugin that encodes learned AI-engineering patterns into a portable, self-wiring configuration.

## What It Does

This plugin bundles a set of agents and rules that encode effective AI-engineering workflows:

- **Agents** — 7 specialized subagents for different phases of work:
  - `@orchestrator` — Manager for complex multi-step tasks
  - `@architect` — Architecture decisions with decision matrices
  - `@builder` — Focused implementation agent for atomic tasks
  - `@diagnose` — Systematic 6-step regression tracing
  - `@planner` — Create detailed implementation plans with phased milestones
  - `@reviewer` — Code review with quality gates
  - `@writer` — Documentation following structured patterns

- **Rules** — Global directives injected into every session's system prompt

## Installation

Add one line to your `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "plugin": ["@maestria/opencode"],
}
```

Restart OpenCode. The plugin auto-installs via Bun.

## How It Works

1. **Plugin loads** — OpenCode installs `@maestria/opencode` from npm
2. **Config hook** — The plugin reads bundled agent markdown files, parses their frontmatter, and registers them programmatically with OpenCode
3. **Rules injected** — `system.transform` hook appends rules to every session
4. **Agents available** — All 7 agents are available as subagents via `@` mention
5. **State preserved** — `session.compacting` hook preserves task status across compaction events

## Updating

```bash
npm update @maestria/opencode
```

Or restart OpenCode — it will auto-update the plugin.

## License

MIT
