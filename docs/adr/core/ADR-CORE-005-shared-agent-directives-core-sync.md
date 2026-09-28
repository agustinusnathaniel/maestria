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

**CLI flags** (not subcommands) are defined by the tool's own `--help` output: sync by default, plus `--check`, `--diff`, `--dry-run`, `--verbose`, `--config`, and `--help`. The `sync.ts` source is authoritative for the current flag set and behavior.

Exit codes: 0 (ok), 1 (check failed), 2 (configuration error).

> Corrected 2026-09-11: `--diff` now also prints under `--dry-run` (it was silently skipped there) and labels the canonical source as the old path and the generated output as the new path. Configuration handling is fail closed: a missing `source` directory and configured file entries absent from both source locations throw `ConfigError` (exit 2) before any file work or anchor validation. See [ADR-CORE-025](ADR-CORE-025-consumer-driven-sync-and-adapter-simplification.md).

**Transform pipeline** (per file): strip frontmatter (if configured) → string-based find/replace → strip existing source comment (idempotency) → prepend content → append content → serialize frontmatter + auto-generated header → normalize line endings → write/check/diff/dry-run.

Every generated file starts with an auto-generated comment noting it is generated from `@maestria/core` and that the canonical file should be edited instead.

### 3. Plugin Config: `sync.config.ts`

Each plugin declares a TypeScript config file at its package root, typed via `satisfies SyncConfig` for compile-time validation. Config shape (key differences from the design phase):

- **String-based `replace`** - `content.split(from).join(to)`, not regex: simpler to write and review, and regex was never needed in practice.
- **Per-file config with a `default` block** for shared values; each file sets its own `output`, `frontmatter`, `prepend`, `append`, `replace`, and `stripFrontmatter`, and may override the output path or filename.
- **Static frontmatter and library YAML defaults** - no function-based dynamic frontmatter, and the `yaml` library's default quoting rather than explicit `QUOTE_DOUBLE`.

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

Several details diverged from the original design during implementation. Each entry keeps only the rationale the sections above do not already carry.

- **Orchestrator synced from core.** It was originally excluded as a per-plugin integration point, but roughly 90% of the prompt was shared methodology already duplicated across three plugins and only about 10% was platform-specific; the `preserve` config option still covers plugin-local content.
- **Auto-generated notice.** The provenance comment is unconditional: a later `autoGenComment` override let a config replace it, and was removed after an audit found no config using it ([ADR-CORE-025](ADR-CORE-025-consumer-driven-sync-and-adapter-simplification.md)).
- **YAML serialization.** `QUOTE_DOUBLE` produced unnecessarily noisy output, and switching back is trivial if a platform ever requires double-quoted YAML.
- **Plugin discovery.** A bash script iterates the glob because the tool is a `.ts` file rather than a published binary, so invoking it from outside `packages/core/` breaks relative module resolution.

## Related Decisions

- [ADR-CORE-000](ADR-CORE-000-adr-structure.md) - established the prefix-scoped subdirectory layout; this ADR extends core scope with a shared content package
- [ADR-CORE-002](ADR-CORE-002-plugin-architecture.md) - established Markdown as source of truth; this ADR extends that principle to multi-plugin content sharing
- [ADR-CORE-016](ADR-CORE-016-root-resolved-sync-tooling.md) - the root-pinned runner the sync tool executes through

## Date

2026-06-23
