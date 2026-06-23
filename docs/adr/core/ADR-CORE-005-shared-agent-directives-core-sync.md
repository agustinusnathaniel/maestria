# ADR-CORE-005: Shared Agent Directives via core-sync Bridge

## Status

Accepted — Updated (2026-06-24)

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

Create a canonical content source at `packages/core/agent-directives/` and a config-driven sync pipeline at `packages/core/scripts/sync.ts` that derives plugin-specific agent files.

### 1. Core Content: `packages/core/agent-directives/`

Pure Markdown content, no platform-specific syntax, no frontmatter, no tool names:

```
packages/core/agent-directives/
├── README.md              # Content ownership and editing guide
├── rules.md               # Cross-cutting rules (orchestration, delegation, commit policy, pipeline patterns)
└── specialists/
    ├── adventurer.md       # Read-only codebase reconnaissance
    ├── architect.md        # Architecture decisions, trade-off analysis
    ├── builder.md          # Focused implementation
    ├── diagnose.md         # Systematic bug tracing
    ├── orchestrator.md     # Manager agent (dispatcher, router)
    ├── planner.md          # Multi-phase planning
    ├── reviewer.md         # Code review with quality gates
    └── writer.md           # Documentation following structured patterns
```

Content rules:

- **No platform-specific tool names** — write `task()` instead of `@task` or `maestria_subagent()`; each plugin's config maps these during derivation
- **No frontmatter** — frontmatter is a plugin-specific concern (YAML vs SKILL.md format)
- **No role prefixes** — write "delegate to architect" rather than `@architect` or `/architect`
- **Section structure preserved** — `!!!` markers, skill buckets, iteration limits, handoff contracts, rules bullets remain unchanged
- **File naming** — snake-case `.md`, one file per specialist (flat, no subdirectories)
- **Rules as a single file** — rules were consolidated into one `rules.md` instead of separate files per topic, since the rules are short and rarely edited independently
- **Orchestrator lives here** — the orchestrator prompt is in `specialists/orchestrator.md`, alongside the 7 specialist prompts, sharing the same sync pipeline. It was originally excluded (see Post-Implementation Evolution).

### 2. Sync Tool: `packages/core/scripts/sync.ts`

A single TypeScript script (not a separate package) run via `npx tsx`. It lives at `packages/core/scripts/sync.ts` (142 lines) backed by 6 library modules:

| Module                        | Lines | Purpose                                                                                                    |
| ----------------------------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| `scripts/sync.ts`             | 142   | CLI entry — arg parsing, help, main loop                                                                   |
| `scripts/lib/config.ts`       | 120   | Config types (`SyncConfig`, `FileConfig`), loading, merging default + per-file config                      |
| `scripts/lib/transforms.ts`   | 39    | Content transform functions (strip frontmatter, find/replace, YAML serialization, line endings)            |
| `scripts/lib/file.ts`         | 100   | File I/O (directory walk, atomic write, auto-clean stale outputs)                                          |
| `scripts/lib/diff.ts`         | 16    | Unified diff wrapper (via `diff` package)                                                                  |
| `scripts/lib/process-file.ts` | 161   | Transform pipeline — reads a source file, applies transforms in order, dispatches to write/check/diff mode |
| `scripts/lib/sync.ts`         | 141   | Orchestration — walks source dirs, matches config entries, dispatches to `processFile`, auto-cleans        |

It is not published to npm. It runs inside the monorepo via `tsx`. This avoided adding a separate publish-and-consume cycle for a tool that only ever runs inside this repo.

**CLI flags** (not subcommands):

| Flag         | Behavior                                                                       |
| ------------ | ------------------------------------------------------------------------------ |
| _(no flags)_ | Sync (write output)                                                            |
| `--check`    | CI mode: exit 1 if any output would differ                                     |
| `--diff`     | Show unified diff of changes during write or check                             |
| `--dry-run`  | Print what would happen without writing                                        |
| `--verbose`  | Print every file operation                                                     |
| `--config`   | Specify config path (default: `./sync.config.ts`, fallback `./sync.config.js`) |
| `--help`     | Print CLI help                                                                 |

Exit codes: 0 (ok), 1 (check failed), 2 (configuration error).

**Transform pipeline** (per file):

```
source file
  → strip frontmatter (if configured)
  → find/replace (string-based from/to pairs)
  → strip existing source comment (idempotency)
  → prepend content
  → append content
  → serialize frontmatter + auto-generated header
  → normalize line endings
  → write / check / diff / dry-run
```

Every generated file starts with an auto-generated comment:

```html
<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->
```

### 3. Plugin Config: `sync.config.ts`

Each plugin declares a TypeScript config file at its package root, typed via `satisfies SyncConfig` for compile-time validation:

```typescript
// packages/opencode/sync.config.ts
import type { SyncConfig } from '../core/scripts/lib/config.js';

export default {
  source: '../core/agent-directives/specialists',
  output: 'agents',

  files: {
    'adventurer.md': {
      frontmatter: { description: '...', mode: 'subagent', permission: { ... } },
    },
    'architect.md': { frontmatter: { ... } },
    // ... one entry per specialist (including orchestrator.md)
    'rules.md': {
      output: '../rules/AGENTS.md',
    },
  },
} satisfies SyncConfig;
```

```typescript
// packages/kimi-code/sync.config.ts
import type { SyncConfig } from '../core/scripts/lib/config.js';

export default {
  source: '../core/agent-directives/specialists',
  output: 'skills',

  default: {
    replace: [
      { from: '@adventurer', to: 'adventurer' },
      { from: 'task(', to: 'Agent(' },
      { from: 'webfetch', to: 'FetchURL' },
      // ... 10+ platform-specific substitutions
    ],
  },

  files: {
    'adventurer.md': {
      output: 'adventurer/SKILL.md',
      prepend: '**Subagent profile:** `explore` — ...\n\n',
      frontmatter: { name: 'adventurer', type: 'prompt', ... },
    },
    'rules.md': {
      output: '../rules/AGENTS.md',
      // Custom content: kimi-code replaces the entire delegation table
      replace: [ ... ],
    },
  },
} satisfies SyncConfig;
```

Config shape (key differences from the design phase):

- **`replace` is string-based, not regex** — uses `content.split(from).join(to)` instead of regex. Simpler to write and review. Regex wasn't needed in practice.
- **Per-file config** — each source file gets its own config block for `output`, `frontmatter`, `prepend`, `append`, `replace`, and `stripFrontmatter`. A `default` block provides shared values.
- **`output` overrides** — can redirect output to a different path or filename (e.g. `rules.md` → `rules/AGENTS.md`, `adventurer.md` → `adventurer/SKILL.md`).
- **YAML quoting** — uses the `yaml` library's default (quotes only when structurally necessary), not explicit double-quoting.
- **`frontmatter` is a static object or string** — no function-based dynamic frontmatter generation. Each plugin defines frontmatter inline per file.

The sync tool has zero knowledge of plugins. It reads the config, applies transforms, and writes output. Plugins own their derivation.

### 4. Root Orchestration Scripts

Plugin discovery uses a bash glob over `packages/*/sync.config.ts`, running the tool once per package:

```bash
#!/usr/bin/env bash
# scripts/sync-all
for config in "$ROOT"/packages/*/sync.config.ts; do
  [ -f "$config" ] || continue
  PKG_DIR="$(dirname "$config")"
  (cd "$PKG_DIR" && npx tsx "$ROOT/packages/core/scripts/sync.ts" --verbose)
done
```

A companion `scripts/check-sync` runs `--check` instead of write, used in CI:

```json
// vite.config.ts (check-sync runs as part of "vp check")
tasks: {
  'check-sync': {
    command: 'bash scripts/check-sync',
    cache: false,
  },
}
```

Generated directories are excluded from `vp fmt` via `fmt.ignorePatterns`:

```typescript
// vite.config.ts
fmt: {
  ignorePatterns: [
    'packages/*/agents/**',
    'packages/*/prompts/**',
    'packages/*/rules/**',
    'packages/*/skills/**',
  ],
},
```

## Consequences

### Positive

- **Drift eliminated** — content is authored once in `core/agent-directives/`, derived per plugin. No manual porting.
- **4th plugin = one config file** — adding a Cursor or Copilot variant requires only a new `sync.config.ts` and zero pipeline code changes.
- **Declarative transforms** — `replace` rules (string `from`/`to` pairs) are explicit, diff-friendly, and reviewable. A PR to add a transform is self-documenting.
- **Core stays pure content** — no platform logic, no TypeScript, no frontmatter. Plugin owners own their derivation.
- **CI guard is trivial** — `scripts/check-sync` exits non-zero if output drifts. Runs as part of `vp check`.
- **Type-safe config** — `satisfies SyncConfig` catches typos and missing fields without needing runtime validation.
- **Run dependency-free** — the tool is a TypeScript script inside `@maestria/core`, not a published package. No publish cycle needed to update the pipeline.
- **Format/sync cycle resolved** — `fmt.ignorePatterns` excludes generated directories from `vp fmt`, so formatting the canonical source does not collide with generated output.
- **Better DX than the original design** — the CLI uses flags (`--check`, `--diff`, `--dry-run`) instead of positional subcommands, which maps directly to how the tool is used.
- **Migration is additive** — existing plugin agent files remain until `sync.config.ts` is ready. Rollout can be per-plugin.

### Negative

- **Generated artifacts** — existing plugin agent files become generated files. Developers must learn to edit `core/agent-directives/`, not the generated copies. Mitigation: auto-generated comment on every file, README in core dir, and CI check that fails writes.
- **Sync tax** — changes to core content must be followed by `scripts/sync-all` before they appear in any plugin. Mitigation: `check-sync` in CI (runs via `vp check`), and developers run `vp check` before pushing.
- **Migration effort** — extracting content from 3 plugins into the canonical core format required careful diffing to preserve platform-specific patches that aren't captured by transforms.
- **Reconfiguring a plugin requires finding its config** — transforms live in each plugin's `sync.config.ts`, not in core. This is intentional (plugin owns its derivation) but adds a hop. Mitigation: per-plugin configs are short and tooling (grep, glob) makes finding them fast.

## Alternatives Considered

### Option A: Markdown Source + Per-Plugin Bash Scripts

Each plugin has a `sync.sh` that uses `sed`/`awk` to transform content. No shared tool.

Rejected because: pipeline logic is duplicated N times, error handling is inconsistent, `sed` portability issues between macOS and Linux, no `--check` or `--diff` mode without reimplementing it in every script. Pi's existing shell script is the evidence — it works but is fragile and not extensible.

### Option B: Typed NPM Package Exporting Agent Content

`packages/core/` exports agent content as TypeScript objects with typed transforms. Each plugin imports the content and runs it through platform-specific renderers.

Rejected because: content owners must edit TypeScript instead of Markdown. PRs to change a specialist's methodology would be TypeScript diffs — harder to review, harder for non-TypeScript contributors. The content is prose, not code; Markdown is the right format for prose.

### Option C: Template Engine with Placeholders

Core content uses Handlebars/EJS-style `{{toolName}}` placeholders. Each plugin provides a context object that fills them in.

Rejected because: templates with conditionals (`{{#if kimi_code}}`) handle structural differences poorly — you end up with templates that are harder to read than the raw content. The chosen hybrid approach (pure Markdown + declarative string replace) keeps the source readable while handling 90%+ of differences through simple transforms.

### Option D: Monorepo Symlinks

Each plugin `agents/` directory contains symlinks to `core/agent-directives/`. No sync tool needed.

Rejected because: symlinks don't apply transforms. The files would still need platform-specific frontmatter, renaming, and tool names. Symlinks also break on Windows and confuse editor tooling.

## Post-Implementation Evolution

Several details diverged from the original design during implementation. This section documents what changed and why.

### Package Structure: Script, Not Package

**Designed:** `packages/core-sync/` as a separate npm-publishable CLI tool (`core-sync`).

**Built:** `packages/core/scripts/sync.ts` — a single TypeScript script inside the existing `@maestria/core` package, run via `npx tsx`.

**Why:** The tool only ever runs inside this monorepo. Publishing it as a standalone package added a publish-consume cycle (version bumps, changesets, CI) for zero benefit. Running it via `tsx` inside `@maestria/core` keeps the pipeline co-located with the content it processes. If a future consumer outside this repo needs it, extracting it into a package is straightforward — the library modules (`lib/config.ts`, `lib/sync.ts`, etc.) already have clean interfaces.

### Orchestrator Moved to Core

**Designed:** Orchestrator files remain in each plugin (excluded from sync). The ADR said: "They are platform integration points — sharing them would introduce platform coupling."

**Built:** `specialists/orchestrator.md` lives in `packages/core/agent-directives/` alongside the 7 specialists, synced via the same pipeline.

**Why:** The orchestrator prompt turned out to be ~90% shared methodology (commit protocol, delegation patterns, role-based pipeline, human-in-the-loop rules) and only ~10% platform-specific (tool names, delegation API syntax). The shared methodology was already duplicated across 3 plugins. Moving it to core eliminated that duplication and let the sync pipeline handle the platform-specific parts (same `replace` rules as specialists). The `preserve` config option still exists for any truly plugin-local content that should never be synced.

### Rules Consolidated to a Single File

**Designed:** `rules/` subdirectory with `context-management.md`, `commit-policy.md`, `pipeline-patterns.md`.

**Built:** A single `rules.md` file at the root of `agent-directives/`.

**Why:** The rules are short (72 lines total) and rarely edited independently. Splitting them into 3 files added file-management overhead with no practical benefit. A single file is easier to read, edit, and sync. The `rules/` directory still appears in the agent-directives README as a legacy reference — it was never created.

### Config Format: Static, per-File, String-Based

**Designed:** Config with `transforms` arrays using regex `find`/`replace` objects and a function-based `extension` parameter.

**Built:** Per-file config with static `frontmatter` objects, string-based `replace` (from/to), `prepend`, `append`, and `output` path overrides.

**Why:** Several design-phase assumptions didn't hold:

- **Regex wasn't needed** — all real substitutions were exact string replacements (e.g., `@adventurer` → `/adventurer`, `task(` → `Agent(`). The `split/join` approach is simpler and avoids escaping issues.
- **Dynamic frontmatter generation wasn't needed** — each plugin's frontmatter is fully known at config-write time. No file-dependent logic required.
- **`prepend`/`append` were cleaner than regex** — injecting content at the beginning or end of a file is better expressed as explicit fields than as edge-case regex.
- **`output` override was simpler than `extension` functions** — redirecting a file to a different path (e.g., `rules.md` → `rules/AGENTS.md`, `adventurer.md` → `adventurer/SKILL.md`) is clearer as a per-file string than as a function that computes paths from filenames.

### Auto-Generated Notice Added

**Not in design.** Every generated file starts with `<!-- Auto-generated from @maestria/core. Do not edit directly. ... -->`. This was added to make the provenance of generated files unambiguous — developers landing on a generated file know immediately where to make edits.

### YAML Serialization Uses Library Defaults

**Designed:** `QUOTE_DOUBLE` for YAML output.

**Built:** Uses the `yaml` library's default (quotes only when structurally necessary).

**Why:** `QUOTE_DOUBLE` produced unnecessarily noisy YAML (e.g., `"*": ask` instead of `'*': ask`). The library's default quotes only when needed, which is more readable. The `serializeFrontmatter` function in `lib/transforms.ts` is a 4-line wrapper, so changing this back is trivial if a platform requires double-quoted YAML.

### CLI Uses Flags, Not Subcommands

**Designed:** `core-sync write`, `core-sync check`, `core-sync diff` as positional subcommands.

**Built:** `tsx sync.ts` (write by default), `--check`, `--diff`, `--dry-run`, `--verbose` as boolean flags.

**Why:** There are only 3 modes and they are mutually exclusive — they behaved like flags, not subcommands. Boolean flags are simpler to parse (Node's `parseArgs`), simpler to combine (e.g., `--check --diff` to see what CI would catch), and simpler to document. The bash scripts could also pass through flags easily for ad-hoc use.

### Plugin Discovery: Bash Glob, Not Tool-Based

**Designed:** `core-sync write packages/*/sync.config.js` — the tool discovers plugins by glob.

**Built:** A bash script (`scripts/sync-all`) iterates over glob results, changing into each package directory and running `tsx sync.ts` there.

**Why:** The tool is not a published binary — it's a `.ts` file. Running it from outside `packages/core/` means the module resolution for relative imports (e.g., `'../core/scripts/lib/config.js'`) breaks. The bash approach lets each plugin's `tsx` invocation resolve modules from its own package root. The overhead is negligible (one `cd` per plugin).

### Config Files Use .ts with satisfies

**Designed:** `sync.config.js` with no type information.

**Built:** `sync.config.ts` with `import type { SyncConfig }` and `satisfies SyncConfig`.

**Why:** TypeScript catches config errors (wrong field names, wrong types) during development rather than at runtime. Since the project is already TypeScript, `.ts` configs require no extra tooling. The `satisfies` keyword (TS 5.3+) preserves type inference on the config object literal while ensuring it conforms to `SyncConfig`. This was not available when the ADR was written (TS 5.3 shipped November 2023).

### Format/Sync Cycle Resolution

**Not in design.** Generated directories (`agents/`, `prompts/`, `rules/`, `skills/`) are excluded from `vp fmt` via `fmt.ignorePatterns` in `vite.config.ts`. Without this, formatting the canonical source and then running `scripts/sync-all` would produce a different result than running sync-all first — a circular dependency between fmt and sync. The ignore patterns break the cycle.

## Related Decisions

- ADR-CORE-000 (ADR structure) — established the prefix-scoped subdirectory layout; this ADR extends core scope with a shared content package
- ADR-CORE-001 (global rules scope) — the `rules/` subdirectory in core content is scoped per the three-way filter defined there
- ADR-CORE-002 (plugin architecture) — established Markdown as source of truth; this ADR extends that principle to multi-plugin content sharing
- ADR-CORE-003 (agent conventions) — the `!!!` markers, cross-references, skill pattern, and rules bullets are preserved in core content
- ADR-CORE-004 (agent prompt template) — the 4-bucket skills, 5-section handoff, and iteration limits are preserved in core content
- ADR-KC-001 (kimi-code architecture) — the "Future Considerations: Platform-Agnostic Core (After 3+ Platforms)" section set the trigger condition that this ADR satisfies

## Date

2026-06-23
