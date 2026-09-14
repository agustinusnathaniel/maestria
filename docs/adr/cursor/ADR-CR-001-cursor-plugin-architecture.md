# ADR-CR-001: Cursor Plugin Architecture - Declarative Plugin for IDE and CLI

## Status

Accepted (2026-07-21)

## Context

Maestria ships methodology as platform packages (`@maestria/opencode`, `@maestria/kimi-code`, `@maestria/pi`, `@maestria/hermes`). Cursor IDE and Cursor CLI (`agent`) share a declarative plugin format: a directory with `.cursor-plugin/plugin.json` plus rules, skills, agents, commands, and optional hooks/MCP.

ADR-KC-001 named Cursor as a next platform (`.cursor/rules/` with `.mdc`); Cursor has since added first-class plugins that bundle those primitives into one installable package, used from Customize in the IDE and `agent --plugin-dir` / local plugins in the CLI. Unlike OpenCode, no TypeScript hooks apply: Cursor plugins are declarative (same class as Kimi Code) with custom agents (Task subagents), skills, rules, and slash commands.

## Decision

### Choose: Declarative Cursor plugin under `packages/cursor`

**`@maestria/cursor` is a Cursor plugin - no build step, no SDK runtime.** It consists of:

1. **`.cursor-plugin/plugin.json`** - manifest; components auto-discovered from default folders.
2. **Synced components** - global rules (`rules/maestria-global.mdc`, `alwaysApply: true`), seven specialist agents (`agents/*.md`), and the orchestrator skill (`skills/orchestrator/SKILL.md`, agent-decides / `/orchestrator`).
3. **`commands/*.md`** - workflow modes: `fein`, `sonar`, `blitz`, `orchestrate` (hand-authored).

> **Amendment (2026-09-14):** `commands/*.md` are generated from the canonical directives by `packages/cursor/sync.config.ts`; the hand-authored inputs are the manifest, sync config, and assets.

4. **Install** - `maestria install cursor` copies the package into `~/.cursor/plugins/local/maestria`.

### Component map

| Canonical source       | Cursor output                                | Role                   |
| ---------------------- | -------------------------------------------- | ---------------------- |
| `rules.md`             | `rules/maestria-global.mdc`                  | Always-on global rules |
| `specialists/*.md` (7) | `agents/<name>.md`                           | Task subagents         |
| `orchestrator.md`      | `skills/orchestrator/SKILL.md`               | Dispatcher methodology |
| (platform)             | `commands/{fein,sonar,blitz,orchestrate}.md` | Workflow modes         |

### Maker/checker (v1)

Cursor's native plugin agent schema supports `readonly: true` in agent frontmatter; v1 enforces maker/checker with two layers:

1. **Runtime enforcement** - `readonly: true` on the `adventurer`, `planner`, and `reviewer` agents blocks write tools (Write, StrReplace, Delete) at the Cursor runtime level.
2. **Prompt-level guidance** - agent prepends and descriptions also state the read-only instruction as a backup.

### IDE and CLI parity

One bundle serves both: install under `~/.cursor/plugins/local/maestria` (IDE or later Marketplace); in the CLI use the same path or `agent --plugin-dir ./packages/cursor` for local development.

### Sync

The Cursor sync config derives agents, the orchestrator skill, and the global rule from the canonical agent directives. Canonical sources stay platform-agnostic; Cursor tool names and Task language are sync transforms only. See ADR-CORE-005.

### What we are not doing (v1)

1. Cursor Marketplace publish / root `marketplace.json`
2. Hooks for hard tool denial
3. `@cursor/sdk` programmatic agents
4. Project-scoped `.cursor/rules` file-copy install (plugin covers IDE + CLI)

## Consequences

- Positive: same declarative pattern as Kimi Code; the sync pipeline already supports it.
- Positive: custom agents give specialist isolation via Task (closer to OpenCode than Kimi's 3 built-in profiles).
- Positive: one install path for IDE and CLI.
- Mixed: two-layer maker/checker (runtime `readonly: true` + prompt instructions) is stronger than prompt-only but short of OpenCode's hard `edit: deny`.
- Negative: until Marketplace listing, distribution is a local-plugin copy from GitHub `main` / monorepo path.

## Related Decisions

- [ADR-CORE-000](../core/ADR-CORE-000-adr-structure.md) - CR prefix reserved for Cursor
- [ADR-CORE-005](../core/ADR-CORE-005-shared-agent-directives-core-sync.md) - sync bridge
- [ADR-CORE-007](../core/ADR-CORE-007-cli-package-plugin-management.md) - CLI platform handlers
- [ADR-KC-001](../kimi-code/ADR-KC-001-kimi-code-architecture.md) - declarative precedent; named Cursor as candidate
