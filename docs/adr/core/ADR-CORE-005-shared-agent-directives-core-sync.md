# ADR-CORE-005: Shared Agent Directives via core-sync Bridge

## Status

Accepted (2026-06-23)

## Context

The monorepo has 3 plugin packages, each maintaining independent copies of agent directive files (7 specialist prompts, orchestrator instructions, and global rules):

| Package               | Agent files location                   | Sync mechanism               |
| --------------------- | -------------------------------------- | ---------------------------- |
| `@maestria/opencode`  | `packages/opencode/agents/*.md`        | Manual (no tooling)          |
| `@maestria/pi`        | `packages/pi/agents/*.md`              | Fragile one-way shell script |
| `@maestria/kimi-code` | `packages/kimi-code/skills/*/SKILL.md` | None                         |

~80%+ of the content is identical across all three (specialist methodologies, cross-cutting rules, skill prescriptions). The remaining differences are mechanical and formulaic:

- **Tool name capitalization** — `task()` (opencode) vs `maestria_subagent()` (pi) vs `Agent()` (kimi-code)
- **Role prefixes** — `@` (opencode) vs `/` (pi) vs bare name (kimi-code)
- **Delegation API** — `task()` (opencode) vs `maestria_subagent()` (pi) vs inline `AgentSwarm` (kimi-code)
- **Frontmatter format** — YAML frontmatter (opencode, pi) vs SKILL.md frontmatter (kimi-code)
- **File structure** — directory flat files (opencode, pi) vs subdirectory `SKILL.md` (kimi-code)

Each plugin independently drifts when content changes. A methodology update to one specialist must be ported to 3 files across 3 packages — and because the differences are subtle, the porting is error-prone. Pi has a fragile one-way shell script (`tools/sync-opencode-agents.sh`) that was a first attempt but duplicates pipeline logic. Kimi-code has no sync mechanism at all.

ADR-KC-001's "Future Considerations" section deferred core extraction until 3+ platforms existed:

> When we support 3+ platforms (OpenCode, Kimi Code, and one more such as Cursor or Copilot), we should consider extracting a `packages/core/` that defines a canonical agent schema and platform adapters.

That milestone is reached. The third platform (pi) is in production, and the team now has enough cross-platform experience to design a shared abstraction.

## Decision

Create two packages — `packages/core/agent-directives/` as the canonical content source and `packages/core-sync/` as a shared CLI tool — with a plugin-owned configuration layer in between.

### 1. Core Content: `packages/core/agent-directives/`

Pure Markdown content, no platform-specific syntax, no frontmatter, no tool names:

```
packages/core/agent-directives/
├── specialists/
│   ├── adventurer.md       # Read-only codebase reconnaissance
│   ├── architect.md        # Architecture decisions, trade-off analysis
│   ├── builder.md          # Focused implementation
│   ├── diagnose.md         # Systematic bug tracing
│   ├── planner.md          # Multi-phase planning
│   ├── reviewer.md         # Code review with quality gates
│   └── writer.md           # Documentation following structured patterns
├── rules/
│   ├── context-management.md   # Progressive disclosure, state checkpointing
│   ├── commit-policy.md        # Commit authorization rules
│   └── pipeline-patterns.md    # Role-based pipeline patterns
└── README.md                   # Content ownership and editing guide
```

Content rules:

- **No platform-specific tool names** — write `task()` instead of `@task` or `maestria_subagent()`; each plugin's config maps these during derivation
- **No frontmatter** — frontmatter is a plugin-specific concern (YAML vs SKILL.md format)
- **No role prefixes** — write "delegate to architect" rather than `@architect` or `/architect`
- **Section structure preserved** — `!!!` markers, skill buckets, iteration limits, handoff contracts, rules bullets remain unchanged
- **File naming** — snake-case `.md`, one specialist per file

### 2. Sync Tool: `packages/core-sync/`

A Node.js CLI tool (`core-sync`) with three commands:

| Command | Behavior                                                     |
| ------- | ------------------------------------------------------------ |
| `write` | Apply transforms and write output to each plugin's agent dir |
| `check` | Exit non-zero if output would differ from disk (for CI)      |
| `diff`  | Show changes between current disk state and derived output   |

Pipeline design:

```
core/agent-directives/*.md
        │
        ▼
   [plugin A transforms]  ←  plugin-a/sync.config.js
        │
        ▼
   plugin-a/agents/*.md  (generated)
```

The tool works in three steps:

1. **Read** — loads source Markdown files from `core/agent-directives/`
2. **Transform** — applies each plugin's declared find/replace rules, prepends frontmatter, renames files
3. **Write** — writes output files, or compares them for `check`/`diff` mode

### 3. Plugin Config: `sync.config.js`

Each plugin declares a config file at its package root:

```javascript
// packages/opencode/sync.config.js
export default {
  source: '../core/agent-directives',
  output: './agents',
  transforms: [
    // Role prefix: @
    { find: /(?<=delegate to )(\w+)/g, replace: '@$1' },
    // Prepend YAML frontmatter
    { find: /^/, replace: (match, file) => frontmatterFor(file) },
  ],
  extension: '.md',
};
```

```javascript
// packages/kimi-code/sync.config.js
export default {
  source: '../core/agent-directives',
  output: './skills',
  transforms: [
    // Tool name: Agent()
    { find: /\btask\b/g, replace: 'Agent' },
    // Role prefix: bare
    { find: /@(\w+)/g, replace: '$1' },
    // Each file -> subdirectory/SKILL.md
    { find: /^/, replace: (match, file) => kimiFrontmatterFor(file) },
  ],
  extension: (file) => `/${basename(file, '.md')}/SKILL.md`,
};
```

Core-sync has zero knowledge of plugins. It reads the config, applies transforms in order, and writes output. Plugins own their derivation.

### 4. Root Orchestration Scripts

```json
// package.json scripts
{
  "sync-all": "core-sync write packages/*/sync.config.js",
  "check-sync": "core-sync check packages/*/sync.config.js"
}
```

### What Stays in Each Plugin

Orchestrator files remain in each plugin. They are platform integration points — they define how the main agent talks to the platform's delegation API, how agents are registered (or not), and how state is preserved. Sharing them would introduce platform coupling that core-dir content avoids.

## Consequences

### Positive

- **Drift eliminated** — content is authored once in `core/agent-directives/`, derived per plugin. No manual porting.
- **4th plugin = one config file** — adding a Cursor or Copilot variant requires only a new `sync.config.js` and zero pipeline code changes.
- **Declarative transforms** — find/replace rules are explicit, diff-friendly, and reviewable. A PR to add a transform is self-documenting.
- **Core stays pure content** — no platform logic, no TypeScript, no frontmatter. Plugin owners own their derivation.
- **CI guard is trivial** — `core-sync check` exits non-zero if output drifts from generated files, preventing stale agents from landing.
- **Familiar tool pattern** — `sync.config.js` follows the same declarative pattern as `vitest.config.ts`, `vite.config.ts`, etc.
- **Migration is additive** — existing plugin agent files remain until `sync.config.js` is ready. Rollout can be per-plugin.

### Negative

- **Generated artifacts** — existing plugin agent files become generated files. Developers must learn to edit `core/agent-directives/`, not the generated copies. Mitigation: `.gitattributes` markers, README in core dir, and CI check that fails on direct edits.
- **Sync tax** — changes to core content must be followed by `core-sync write` before they appear in any plugin. Mitigation: root-level `sync-all` script and `check-sync` in CI.
- **Migration effort** — extracting content from 3 plugins into the canonical core format requires careful diffing to preserve platform-specific patches that aren't captured by transforms.
- **Transform coverage isn't 100%** — some differences may be structural (e.g., Kimi Code's SKILL.md per-subdirectory format vs opencode's flat files). The config's `extension` function exists for this case, but structural divergence may require per-file overrides.
- **Plugin config lives in the plugin** — transforms are in sync.config.js, not in core. A developer changing a transform needs to find the right plugin's config. This is intentional (plugin owns its derivation) but adds a hop.

## Alternatives Considered

### Option A: Markdown Source + Per-Plugin Bash Scripts

Each plugin has a `sync.sh` that uses `sed`/`awk` to transform content. No shared CLI tool.

Rejected because: pipeline logic is duplicated N times, error handling is inconsistent, `sed` portability issues between macOS and Linux, no `--check` or `--diff` mode without reimplementing it in every script. Pi's existing shell script is the evidence — it works but is fragile and not extensible.

### Option B: Typed NPM Package Exporting Agent Content

`packages/core/` exports agent content as TypeScript objects with typed transforms. Each plugin imports the content and runs it through platform-specific renderers.

Rejected because: content owners must edit TypeScript instead of Markdown. PRs to change a specialist's methodology would be TypeScript diffs — harder to review, harder for non-TypeScript contributors. The content is prose, not code; Markdown is the right format for prose.

### Option C: Template Engine with Placeholders

Core content uses Handlebars/EJS-style `{{toolName}}` placeholders. Each plugin provides a context object that fills them in.

Rejected because: templates with conditionals (`{{#if kimi_code}}`) handle structural differences poorly — you end up with templates that are harder to read than the raw content. The chosen hybrid approach (pure Markdown + declarative find/replace) keeps the source readable while handling 90%+ of differences through simple string transforms.

### Option D: Monorepo Symlinks

Each plugin `agents/` directory contains symlinks to `core/agent-directives/`. No sync tool needed.

Rejected because: symlinks don't apply transforms. The files would still need platform-specific frontmatter, renaming, and tool names. Symlinks also break on Windows and confuse editor tooling.

## Related Decisions

- ADR-CORE-000 (ADR structure) — established the prefix-scoped subdirectory layout; this ADR extends core scope with a shared content package
- ADR-CORE-001 (global rules scope) — the `rules/` subdirectory in core content is scoped per the three-way filter defined there
- ADR-CORE-002 (plugin architecture) — established Markdown as source of truth; this ADR extends that principle to multi-plugin content sharing
- ADR-CORE-003 (agent conventions) — the `!!!` markers, cross-references, skill pattern, and rules bullets are preserved in core content
- ADR-CORE-004 (agent prompt template) — the 4-bucket skills, 5-section handoff, and iteration limits are preserved in core content
- ADR-KC-001 (kimi-code architecture) — the "Future Considerations: Platform-Agnostic Core (After 3+ Platforms)" section set the trigger condition that this ADR satisfies

## Date

2026-06-23
