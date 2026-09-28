# ADR-CORE-002: Plugin Architecture - Pure Plugin, Markdown Agents, 2 Hooks

## Status

Accepted

## Context

We needed to decide how `@maestria/opencode` delivers its agents, rules, and skills to the user's OpenCode installation. Three approaches were considered:

1. **File-copy approach** - npm postinstall script copies files into `~/.config/opencode/`
2. **Config-only approach** - no plugin code; markdown files that the user manually copies or links (like `opencode-agent-orchestration-kit`)
3. **Pure plugin approach** - the plugin registers agents via `config`, injects rules via `input.instructions`, and preserves state via `session.compacting`; only the npm package is installed, with no filesystem side effects outside the package directory

## Decision

### Choose: Pure Plugin Approach (Option 3)

**The plugin is pure hooks.** No postinstall script, no file copying, no filesystem side effects.

### Key Architecture Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| **Agent format** | Markdown files with YAML frontmatter | Readable, editable, versionable; no TypeScript factories needed. |
| **Agent registration** | `config` hook reads agents/\*.md, parses frontmatter, injects into `input.agent` | Always current - no stale files. |
| **Initial hook set** | 2 (`config`, `session.compacting`) | More hooks = more surface area. |
| **Rules injection** | `input.instructions` in `config` hook, not file copy | Rules always present regardless of the user's existing AGENTS.md. |
| **Build tool** | `tsc` | The package is small; bundling with `tsdown` is unnecessary. |
| **Skills distribution** | Not bundled; reference by name | Skills install separately via `pnpx skills@latest add`; keeps the plugin focused. |
| **Postinstall** | None | Pure plugin has no side effects outside the npm package directory. |

### What We Avoid (learned from reference implementations)

| Anti-pattern               | Why Not                                                 |
| -------------------------- | ------------------------------------------------------- |
| TypeScript agent factories | Markdown is editable, inspectable, versionable.         |
| 10+ lifecycle hooks        | Too much maintenance surface.                           |
| Postinstall file copying   | Creates stale files, requires sentinel checks, fragile. |
| Greek mythology naming     | Functional naming tells you what the agent does.        |
| Telemetry / usage tracking | Privacy-invasive, adds no user value.                   |
| Subscription / auth gating | Open-source, MIT license, no gatekeeping.               |
| Package sprawl             | 1 package, focused scope.                               |

## Consequences

- Positive: No stale files after updates. Agents are always exactly what the plugin version defines.
- Positive: No overwrite logic or sentinel checks; no filesystem side effects.
- Positive: Agents editable with any text editor; no compilation needed to modify behavior.
- Positive: Compatible with any provider/model - no vendor lock-in.
- Negative: Must parse YAML frontmatter at runtime (via the `yaml` library).
- Negative: Agents are not visible as loose files in the user's config directory (they load from the npm package, not `~/.config/opencode/agents/`).
- Negative: The package must include `agents/` and `rules/` in the npm `files` array so the plugin can read them at runtime.

## Agent Format and Plugin API

Agent frontmatter follows the OpenCode SDK agent config shape and is parsed at plugin load time, and the plugin uses the SDK's `config` hook to register agents and inject rules. The `packages/opencode/` package is authoritative for the active hook inventory and the accepted frontmatter fields.

## Date

2026-06-12
