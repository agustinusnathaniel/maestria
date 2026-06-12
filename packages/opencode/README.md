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

Add to your `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "plugin": ["@maestria/opencode@latest"],
}
```

If you want to pin a specific version, you can also keep a `package.json` in your config directory or let OpenCode auto-install it — the plugin publishes to npm under the `@maestria` scope. Restart OpenCode after adding the plugin.

## How It Works

1. **Plugin loads** — OpenCode installs `@maestria/opencode` from npm
2. **Config hook** — The plugin reads bundled agent markdown files, parses their frontmatter, and registers them programmatically with OpenCode
3. **Rules injected** — `system.transform` hook appends rules to every session
4. **Agents available** — All 7 agents are available as subagents via `@` mention
5. **State preserved** — `session.compacting` hook preserves task status across compaction events

## Updating

OpenCode auto-updates plugins on restart. Or run:

```bash
opencode plugins update
```

## License

MIT
