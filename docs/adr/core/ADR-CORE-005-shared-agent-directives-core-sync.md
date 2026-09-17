# ADR-CORE-005: Shared Agent Directives via core-sync Bridge

## Status

Accepted - Updated (2026-06-24)

## Context

The monorepo had 3 plugin packages, each maintaining independent copies of agent directive files (specialist prompts, orchestrator instructions, and global rules): `@maestria/opencode` kept agents as manual copies, `@maestria/pi` used a fragile one-way shell script, and `@maestria/kimi-code` had no sync mechanism.

~80%+ of the content was identical across all three (specialist methodologies, cross-cutting rules, skill prescriptions). The remaining differences were mechanical and formulaic:

- **Tool name capitalization** - `task()` (opencode) vs `maestria_subagent()` (pi) vs `Agent()` (kimi-code)
- **Role prefixes** - `@` (opencode) vs `/` (pi) vs bare name (kimi-code)
- **Delegation API** - `task()` vs `maestria_subagent()` vs inline `AgentSwarm`
- **Frontmatter format** - YAML frontmatter (opencode, pi) vs SKILL.md frontmatter (kimi-code)
- **File structure** - flat files (opencode, pi) vs subdirectory `SKILL.md` (kimi-code)

Each plugin drifted independently when content changed: a methodology update to one specialist had to be ported to 3 files across 3 packages, and the subtle differences made porting error-prone.

ADR-KC-001's "Future Considerations" section deferred core extraction until 3+ platforms existed:

> When we support 3+ platforms (OpenCode, Kimi Code, and one more such as Cursor or Copilot), we should consider extracting a `packages/core/` that defines a canonical agent schema and platform adapters.

That milestone is reached: pi is in production, and the team has enough cross-platform experience to design a shared abstraction.

## Decision

Create a canonical content source at `packages/core/agent-directives/` and a config-driven sync pipeline at `packages/core/scripts/sync.ts` that derives plugin-specific agent files.

### 1. Core Content: `packages/core/agent-directives/`

Pure Markdown content, no platform-specific syntax, no frontmatter, no tool names: a single `rules.md` plus one flat file per specialist and `orchestrator.md`, with a README as the content ownership and editing guide.

Content rules:

- **No platform-specific tool names** - write `task()` instead of `@task` or `maestria_subagent()`; each plugin's config maps these during derivation
- **No frontmatter** - frontmatter is a plugin-specific concern (YAML vs SKILL.md format)
- **Canonical role tokens** - use `@architect`-style role identifiers as platform-neutral placeholders; sync configs map them to each platform's invocation form. Do not add platform-specific commands or tool syntax to core.
- **Section structure preserved** - Updated 2026-08-22: `!!!` markers, iteration limits, handoff contracts, and rules bullets remain unchanged; skill buckets were replaced by compact per-specialist Skills sections listing only verified skills (see ADR-CORE-019)
- **File naming** - snake-case `.md`, one file per specialist (flat, no subdirectories)
- **Rules as a single file** - rules were consolidated into one `rules.md` instead of separate files per topic, since the rules are short and rarely edited independently
- **Orchestrator lives here** - the orchestrator prompt shares the same sync pipeline as the specialist prompts; it was originally excluded (see Post-Implementation Evolution)

### 2. Sync Tool: `packages/core/scripts/sync.ts`

A single TypeScript script (not a separate package) run via a root-pinned `tsx` runner (see [ADR-CORE-016](ADR-CORE-016-root-resolved-sync-tooling.md)), backed by library modules for config loading and merging, resolution planning, the transform pipeline, anchor liveness validation (ADR-CORE-024), skill validation, diffing, and file I/O (atomic writes, stale-output cleanup). It is not published to npm; it only runs inside this monorepo, avoiding a publish-and-consume cycle.

**CLI flags** (not subcommands):

| Flag | Behavior |
| --- | --- |
| _(no flags)_ | Sync (write output) |
| `--check` | CI mode: exit 1 if any output would differ |
| `--diff` | Show unified diff of changes during write, check, or dry-run; the canonical source is the old path, the output is the new path |
| `--dry-run` | Print what would happen without writing |
| `--verbose` | Print every file operation |
| `--config` | Specify config path (default: `./sync.config.ts`, fallback `./sync.config.js`) |
| `--help` | Print CLI help |

Exit codes: 0 (ok), 1 (check failed), 2 (configuration error).

> Corrected 2026-09-11: `--diff` now also prints under `--dry-run` (it was silently skipped there) and labels the canonical source as the old path and the generated output as the new path. Configuration handling is fail closed: a missing `source` directory and configured file entries absent from both source locations throw `ConfigError` (exit 2) before any file work or anchor validation. See [ADR-CORE-025](ADR-CORE-025-consumer-driven-sync-and-adapter-simplification.md).

**Transform pipeline** (per file): strip frontmatter (if configured) → string-based find/replace → strip existing source comment (idempotency) → prepend content → append content → serialize frontmatter + auto-generated header → normalize line endings → write/check/diff/dry-run.

Every generated file starts with an auto-generated comment noting it is generated from `@maestria/core` and that the canonical file should be edited instead.

### 3. Plugin Config: `sync.config.ts`

Each plugin declares a TypeScript config file at its package root, typed via `satisfies SyncConfig` for compile-time validation. Config shape (key differences from the design phase):

- **`replace` is string-based, not regex** - uses `content.split(from).join(to)` instead of regex. Simpler to write and review; regex wasn't needed in practice.
- **Per-file config** - each source file gets its own block for `output`, `frontmatter`, `prepend`, `append`, `replace`, and `stripFrontmatter`; a `default` block provides shared values.
- **`output` overrides** - can redirect output to a different path or filename (e.g. `rules.md` → `rules/AGENTS.md`, `adventurer.md` → `adventurer/SKILL.md`).
- **YAML quoting** - uses the `yaml` library's default (quotes only when structurally necessary), not explicit double-quoting.
- **`frontmatter` is a static object or string** - no function-based dynamic frontmatter generation; each plugin defines frontmatter inline per file.

The sync tool has zero knowledge of plugins: it reads the config, applies transforms, and writes output; plugins own their derivation.

> Corrected 2026-09-10: the original config example's replace ops (`task(` → `Agent(`, `webfetch` → `FetchURL`, and a `rules/AGENTS.md` output) no longer exist: canonical content carries no host tool names, and Kimi's profile text and routing appendix supply `Agent`/`AgentSwarm` and `FetchURL` directly. The rules projection now outputs to `SYSTEM.md`.

### 4. Root Orchestration Scripts

`scripts/sync-all` iterates over each `packages/*/sync.config.ts` via a bash glob and runs the tool once per package; `scripts/check-sync` runs the same tool in `--check` mode and is used in CI as part of `vp check`. Generated directories (`agents/`, `commands/`, `prompts/`, `rules/`, `skills/`, `SYSTEM.md`) are excluded from `vp fmt` via `fmt.ignorePatterns`, so formatting the canonical source cannot collide with generated output.

## Consequences

### Positive

- **Drift eliminated** - content is authored once in `core/agent-directives/` and derived per plugin; no manual porting.
- **4th plugin = one config file** - adding a Cursor or Copilot variant requires only a new `sync.config.ts` and zero pipeline code changes.
- **Declarative transforms** - explicit string `from`/`to` pairs are diff-friendly and reviewable.
- **Core stays pure content** - no platform logic, no TypeScript, no frontmatter; plugin owners own their derivation.
- **CI guard is trivial** - `scripts/check-sync` exits non-zero if output drifts and runs as part of `vp check`.
- **Type-safe config** - `satisfies SyncConfig` catches typos and missing fields without runtime validation.
- **Run dependency-free** - the tool is a TypeScript script inside `@maestria/core`, not a published package; no publish cycle is needed to update the pipeline.
- **Format/sync cycle resolved** - `fmt.ignorePatterns` excludes generated directories, breaking the circular dependency between formatting and sync.
- **Better DX than the original design** - the CLI uses flags (`--check`, `--diff`, `--dry-run`) instead of positional subcommands, matching how the tool is used.
- **Migration is additive** - existing plugin agent files remain until `sync.config.ts` is ready; rollout can be per-plugin.

### Negative

- **Generated artifacts** - existing plugin agent files become generated. Developers must edit `core/agent-directives/`, not the generated copies. Mitigation: an auto-generated comment on every file, a core README, and a CI check that fails writes.
- **Sync tax** - changes to core content must be followed by `scripts/sync-all` before they appear in any plugin. Mitigation: `check-sync` in CI (via `vp check`) and developers running `vp check` before pushing.
- **Migration effort** - extracting content from 3 plugins required careful diffing to preserve platform-specific patches that transforms do not capture.
- **Reconfiguring a plugin requires finding its config** - transforms live in each plugin's `sync.config.ts`, not in core. Intentional (the plugin owns its derivation), but adds a hop; per-plugin configs are short and easy to find.

## Alternatives Considered

### Option A: Markdown Source + Per-Plugin Bash Scripts

Each plugin has a `sync.sh` using `sed`/`awk`. Rejected because: pipeline logic is duplicated N times, error handling is inconsistent, `sed` portability differs between macOS and Linux, and `--check`/`--diff` would have to be reimplemented per script. Pi's existing shell script was the evidence.

### Option B: Typed NPM Package Exporting Agent Content

`packages/core/` exports agent content as TypeScript objects with typed transforms. Rejected because: content owners must edit TypeScript instead of Markdown, making methodology PRs harder to review for non-TypeScript contributors. The content is prose; Markdown is the right format.

### Option C: Template Engine with Placeholders

Core content uses Handlebars/EJS-style `{{toolName}}` placeholders filled by a per-plugin context object. Rejected because: conditional templates (`{{#if kimi_code}}`) handle structural differences poorly and end up harder to read than the raw content. The chosen hybrid (pure Markdown + declarative string replace) keeps the source readable while handling 90%+ of differences through simple transforms.

### Option D: Monorepo Symlinks

Each plugin's `agents/` directory symlinks to core. Rejected because: symlinks don't apply transforms, and the files would still need platform-specific frontmatter, renaming, and tool names. Symlinks also break on Windows and confuse editor tooling.

## Post-Implementation Evolution

Several details diverged from the original design during implementation.

### Package Structure: Script, Not Package

**Designed:** a separate npm-publishable CLI tool (`core-sync`). **Built:** a TypeScript script inside `@maestria/core` run via the root-pinned `tsx` runner (ADR-CORE-016). **Why:** the tool only runs in this monorepo; publishing it standalone added a publish-consume cycle for zero benefit, and extraction later stays easy because the library modules have clean interfaces.

### Orchestrator Moved to Core

**Designed:** orchestrator files remain per-plugin (excluded from sync) as platform integration points. **Built:** `orchestrator.md` syncs from core alongside the specialists. **Why:** the prompt was ~90% shared methodology (commit protocol, delegation patterns, role-based pipeline, human-in-the-loop rules) and only ~10% platform-specific, and the shared part was already duplicated across 3 plugins. The `preserve` config option still exists for truly plugin-local content.

### Rules Consolidated to a Single File

**Designed:** a `rules/` subdirectory with separate topic files. **Built:** one `rules.md` at the root of `agent-directives/`. **Why:** the rules are short and rarely edited independently; splitting them added file-management overhead with no practical benefit.

### Config Format: Static, per-File, String-Based

**Designed:** `transforms` arrays using regex `find`/`replace` objects and a function-based `extension` parameter. **Built:** per-file config with static `frontmatter`, string-based `replace` (from/to), `prepend`, `append`, and `output` overrides. **Why:** all real substitutions were exact strings (`split/join` avoids escaping issues); plugin frontmatter is known at config-write time; `prepend`/`append` express edge injections more clearly than regex; and a per-file `output` string is clearer than a function computing paths.

### Auto-Generated Notice Added

**Not in design.** Every generated file starts with an auto-generated provenance comment so developers landing on one know where to make edits.

> Updated 2026-09-11: a later `autoGenComment` config override let a config replace this notice. It was removed after an audit found zero sync configs used it, and the notice is now unconditional. See [ADR-CORE-025](ADR-CORE-025-consumer-driven-sync-and-adapter-simplification.md).

### YAML Serialization Uses Library Defaults

**Designed:** `QUOTE_DOUBLE` output. **Built:** the `yaml` library's default (quotes only when structurally necessary). **Why:** `QUOTE_DOUBLE` produced unnecessarily noisy YAML; changing back is trivial if a platform requires double-quoted YAML.

### CLI Uses Flags, Not Subcommands

**Designed:** positional `write`/`check`/`diff` subcommands. **Built:** write by default, with `--check`, `--diff`, `--dry-run`, and `--verbose` flags. **Why:** there are only 3 mutually exclusive modes; flags are simpler to parse, combine (e.g., `--check --diff`), and document, and the bash scripts can pass them through.

### Plugin Discovery: Bash Glob, Not Tool-Based

**Designed:** the tool discovers plugins by glob. **Built:** a bash script iterates over glob results and runs `pnpm exec tsx sync.ts` from each package root (the runner is pinned at the workspace root and resolves from any subdirectory; ADR-CORE-016). **Why:** the tool is a `.ts` file, not a published binary, so invoking it from outside `packages/core/` breaks relative module resolution.

### Config Files Use .ts with satisfies

**Designed:** `sync.config.js` with no type information. **Built:** `sync.config.ts` with `import type { SyncConfig }` and `satisfies SyncConfig`. **Why:** TypeScript catches config errors during development, and the project already uses TypeScript; `satisfies` preserves inference on the literal while enforcing conformance.

### Format/Sync Cycle Resolution

**Not in design.** Generated directories are excluded from `vp fmt` via `fmt.ignorePatterns`, breaking the circular dependency where formatting the canonical source then syncing could differ from syncing first.

## Related Decisions

- ADR-CORE-000 (ADR structure) - established the prefix-scoped subdirectory layout; this ADR extends core scope with a shared content package
- ADR-CORE-001 (global rules scope) - the `rules/` content is scoped per the three-way filter defined there
- ADR-CORE-002 (plugin architecture) - established Markdown as source of truth; this ADR extends that principle to multi-plugin content sharing
- ADR-CORE-003 (agent conventions) - the `!!!` markers, cross-references, skill pattern, and rules bullets are preserved in core content
- ADR-CORE-004 (agent prompt template) - Updated 2026-08-22: core content carries compact verified-skill sections, compact material handoffs, and progress-based repair bounds rather than the 4-bucket skills and fixed five-section handoff described there (see ADR-CORE-019)
- ADR-KC-001 (kimi-code architecture) - the "Future Considerations: Platform-Agnostic Core (After 3+ Platforms)" section set the trigger condition that this ADR satisfies

## Date

2026-06-23
