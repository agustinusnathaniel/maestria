# ADR-CORE-002: OpenCode Plugin Architecture: Pure Plugin, Markdown Agents

## Status

Accepted (2026-06-12). Condensed 2026-11-27: the original two-hook limit, `tsc` build, and unbundled skills no longer hold; [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) bundles the method skills and the package source owns the current hook set.

## Context

`@maestria/opencode` has to deliver agents, rules, and skills to a user's OpenCode installation. Three approaches were considered:

1. **File copy:** an npm postinstall script copies files into `~/.config/opencode/`.
2. **Config only:** no plugin code; users copy or link Markdown files themselves.
3. **Pure plugin:** the plugin registers agents and injects rules through OpenCode's plugin hooks; only the npm package is installed.

## Decision

Choose the pure plugin. No postinstall script, no file copying, no filesystem side effects outside the package directory. Agents are Markdown with YAML frontmatter, read from the package and registered through the plugin's config hook, so they always match the installed version. Rules are injected by the plugin rather than written next to the user's `AGENTS.md`. Add a hook only for a concrete need; every hook is maintenance surface.

## Consequences

- No stale files after updates, and no overwrite logic or sentinel checks.
- Agents stay editable Markdown with no compilation step.
- Frontmatter is parsed at runtime, and the package must publish its `agents/` and `rules/` directories.
- Agents are not visible as loose files in the user's config directory.

## Alternatives Considered

- **Postinstall file copying:** rejected because it leaves stale files, needs sentinel checks, and is fragile.
- **Config-only Markdown:** rejected because users would update copies by hand and drift from the package.
- **TypeScript agent factories:** rejected because Markdown is easier to read, review, and edit.
- **Many lifecycle hooks up front:** rejected because each hook adds maintenance surface without a demonstrated need.
- **Thematic names such as mythological figures:** rejected because a functional name says what the agent or mode does.

## Date

2026-06-12
