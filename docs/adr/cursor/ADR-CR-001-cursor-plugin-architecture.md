# ADR-CR-001: Cursor Plugin Architecture - Declarative Plugin for IDE and CLI

## Status

Accepted (2026-07-21)

## Context

Maestria ships methodology as platform packages (`@maestria/opencode`, `@maestria/kimi-code`, `@maestria/pi`, `@maestria/hermes`). Cursor IDE and Cursor CLI (`agent`) share a declarative plugin system: a directory with `.cursor-plugin/plugin.json` plus rules, skills, agents, commands, and optional hooks/MCP.

ADR-KC-001 already flagged Cursor as a next platform (`.cursor/rules/` with `.mdc`). Since then Cursor added first-class plugins that package those primitives into one installable bundle, usable from Customize in the IDE and from `agent --plugin-dir` / local plugins in the CLI.

OpenCode-style TypeScript hooks do not apply. Cursor plugins are declarative files (same class as Kimi Code), with richer component types: custom agents (Task subagents), skills, rules, and slash commands.

## Decision

### Choose: Declarative Cursor plugin under `packages/cursor`

**`@maestria/cursor` is a Cursor plugin — no build step, no SDK runtime.** It consists of:

1. **`.cursor-plugin/plugin.json`** — manifest (name, version, metadata). Components auto-discovered from default folders.
2. **`rules/maestria-global.mdc`** — synced from `rules.md`, `alwaysApply: true`.
3. **`agents/*.md`** — seven specialists as custom Cursor agents (Task targets).
4. **`skills/orchestrator/SKILL.md`** — orchestrator methodology (agent-decides / `/orchestrator`).
5. **`commands/*.md`** — workflow modes: `fein`, `sonar`, `blitz`, `orchestrate` (hand-authored).
6. **Install** — `maestria install cursor` copies the package into `~/.cursor/plugins/local/maestria`.

### Component map

| Canonical source       | Cursor output                                | Role                   |
| ---------------------- | -------------------------------------------- | ---------------------- |
| `rules.md`             | `rules/maestria-global.mdc`                  | Always-on global rules |
| `specialists/*.md` (7) | `agents/<name>.md`                           | Task subagents         |
| `orchestrator.md`      | `skills/orchestrator/SKILL.md`               | Dispatcher methodology |
| (platform)             | `commands/{fein,sonar,blitz,orchestrate}.md` | Workflow modes         |

### Maker/checker (v1)

Cursor native plugin agent schema supports `readonly: true` in agent frontmatter. v1 enforces maker/checker with **two layers**:

1. **Runtime enforcement** — `readonly: true` flag on `adventurer`, `planner`, and `reviewer` agents blocks write tools (Write, StrReplace, Delete) at the Cursor runtime level.
2. **Prompt-level guidance** — Agent prepends and descriptions also include explicit read-only instructions as a backup.

### IDE and CLI parity

One plugin bundle serves both:

- **IDE** — install under `~/.cursor/plugins/local/maestria` (or Marketplace later)
- **CLI** — same path, or `agent --plugin-dir ./packages/cursor` for local development

### Sync

`packages/cursor/sync.config.ts` derives agents, orchestrator skill, and global rule from `packages/core/agent-directives/`. Canonical sources stay platform-agnostic; Cursor tool names and Task language are sync transforms only. See ADR-CORE-005.

### What we are not doing (v1)

1. Cursor Marketplace publish / root `marketplace.json`
2. Hooks for hard tool denial
3. `@cursor/sdk` programmatic agents
4. Project-scoped `.cursor/rules` file-copy install (plugin covers IDE + CLI)

## Consequences

- Positive: Same declarative pattern as Kimi Code; sync pipeline already supports it.
- Positive: Custom agents give specialist isolation via Task (closer to OpenCode than Kimi's 3 built-in profiles).
- Positive: One install path for IDE and CLI.
- Mixed: Maker/checker is two-layer (runtime `readonly: true` flag + prompt instructions) — stronger than prompt-only, but not yet matching OpenCode's hard `edit: deny` at the agent definition level.
- Negative: Until Marketplace listing, distribution is local-plugin copy from GitHub `main` / monorepo path.

## Related Decisions

- [ADR-CORE-000](../core/ADR-CORE-000-adr-structure.md) — CR prefix reserved for Cursor
- [ADR-CORE-005](../core/ADR-CORE-005-shared-agent-directives-core-sync.md) — sync bridge
- [ADR-CORE-007](../core/ADR-CORE-007-cli-package-plugin-management.md) — CLI platform handlers
- [ADR-KC-001](../kimi-code/ADR-KC-001-kimi-code-architecture.md) — declarative precedent; named Cursor as candidate
