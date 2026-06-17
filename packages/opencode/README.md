# @maestria/opencode

An OpenCode plugin that encodes learned AI-engineering patterns into a portable, self-wiring configuration.

## What It Does

This plugin bundles a set of agents and rules that encode effective AI-engineering workflows:

- **Agents** — 7 specialized subagents for different phases of work:
  - `@orchestrator` — Manager for complex multi-step tasks; restricted to delegating only to the 7 registered subagents via task permissions
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

### Design Philosophy

This plugin is built on the **Harness Engineering** principle:
`Agent = Model + Harness`. The harness is what turns a raw LLM into a
reliable coding agent — the model is just one component.

The 6 harness components map directly to plugin features:

| Component         | Plugin Mapping                                |
| ----------------- | --------------------------------------------- |
| **Instructions**  | `rules/AGENTS.md` injected into every session |
| **Tools**         | Skill prescription system + MCP integration   |
| **Sandboxes**     | `permission` frontmatter on every agent       |
| **Orchestration** | `mode: all/subagent` + `task()` delegation    |
| **Guardrails**    | `edit: deny`, `bash: ask`, iteration limits   |
| **Observability** | Session compaction hooks, structured handoffs |

Most agent failures are configuration failures, not model failures. The
plugin's agents are designed with this principle — precise rules, explicit
boundaries, and clear delegation chains over raw capability.

## Updating

OpenCode auto-updates plugins on restart. Or run:

```bash
opencode plugins update
```

## License

MIT
