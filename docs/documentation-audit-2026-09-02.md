# Documentation audit: 2026-09-02

## Purpose

Record the repository documentation audit, the improvements applied, and the structural work that remains. This is an internal audit, not a user-facing support document.

## Audience

Maintainers and contributors who need to understand which documentation is authoritative, which pages are task-oriented, and which records are historical.

## Scope and method

The audit covered 304 tracked Markdown and MDX files plus one tracked text file, 305 files in total. It included root guidance, `docs/`, public Starlight content, package READMEs and installation guides, ADRs, plans, notes, and generated-document boundaries. It used repository structure, package manifests, sync configuration, current source files, existing documentation standards, and the public docs build as evidence. Generated platform projections were treated as outputs, not authoring sources.

## Major findings

### 1. Current and historical information were mixed

The 1,131-line Hermes design record combined current architecture, old implementation snapshots, v0.2 planning, v0.3 ideas, and dated research. Plans also looked active after their implementation work had moved on.

### 2. Documentation drifted from runtime behavior

Examples found during the audit included:

- `.maestria/workflow.md` required a nonexistent `pnpm ready` command and mandatory reconnaissance for every change, which conflicted with the selective routing model.
- `PATTERNS.md` described Claude Code as hook-based even though the current package is declarative and ships no hooks.
- CLI docs overstated portable-command flags, omitted Hermes from version-pinning limits, and listed an incomplete model-configuration matrix.
- Hermes contributor docs pointed contributors at nonexistent `commands/` and shortened source paths.
- Pi and OMP reference text described all non-writing roles as read-only even though Architect and Diagnose retain Bash for evidence gathering.
- The portable package was described as published while its package and manifest remained at `0.0.0` with a pending release changeset.

### 3. Navigation and progressive disclosure were uneven

The CLI getting-started page duplicated command-reference material. Several Starlight pages repeated their frontmatter title as a body H1. Core concepts did not have one concise platform-selection page, and internal documentation had no index explaining authority or audience.

### 4. Terminology needed a stable model

The repository used `agent`, `specialist`, `skill`, and `subagent` interchangeably in places. The intended model is: eight agents total, one orchestrator and seven specialists; skills are the portable content unit; subagents are host-specific runtime sessions.

## Examples of clarity improvements

| Before | After | Why |
| --- | --- | --- |
| "All commands accept `--json` and `--quiet` ... `--compact` is supported on every command except `check`" | Runtime commands support runtime output flags; portable `plugin` commands support `--json` only. | Matches the actual command surface. |
| "The cost of fixing a bug increases by about an order of magnitude at each stage." | "Finding a problem earlier usually reduces rework." | Keeps the rationale without presenting an unsupported quantitative law. |
| "There is no maestria CLI step" for Hermes | The Maestria CLI delegates to Hermes's plugin manager, with direct Hermes installation as the fallback. | Removes a direct contradiction between the overview and installation guide. |
| "Platform-only methodology skills" for `handoff` and `iteration-limits` | Both are canonical skills synced from core; only new package-specific additions are platform-only. | Points contributors to the correct source. |

## Improvements applied

- Added a task-oriented [platform matrix](../apps/docs/src/content/docs/core/platforms.mdx) and linked it from the docs navigation.
- Added this audit and an [internal documentation index](README.md).
- Corrected current-versus-historical status in ADRs, plans, and the Hermes design record.
- Repaired CLI, Hermes, Pi/OMP, Prime Agent, Codex, Cursor, Kimi Code, and portable-package guidance against repository evidence.
- Added missing package and platform entries to root and contributor documentation.
- Consolidated duplicated CLI onboarding material into the command reference.
- Removed duplicate Starlight title headings without changing the page titles in frontmatter.
- Preserved package-specific limitations, runtime caveats, evidence dates, and installation details rather than shortening them away.

## Recommendations not yet applied

- Split the Hermes design record into a current reference, historical planning record, and API research appendix. A focused [current Hermes reference](hermes-plugin-current.md) now separates the active contract from the historical record; the planning and research sections remain archived in the original file until a later focused extraction.
- Split the runtime support matrix into a current status page and a dated evidence ledger, or add a generated summary so support claims do not drift from package metadata.
- Canonicalize the legacy `/pi/` and `/omp/` routes to the combined `/pi-omp/` section.
- Record package version, source commit, and stored output for each live Agent Plugin compatibility check.
- Generate shared platform and install metadata from one source where practical; until then, verify the platform matrix against package manifests during releases.

## Dated evidence

- `[verified]` 2026-09-02: `git ls-files` found 305 tracked Markdown, MDX, RST, and text files; 68 tracked public MDX pages; and 47 tracked files under `docs/`.
- `[verified]` 2026-09-02: `packages/agent-plugin/package.json` and `plugin.json` are both version `0.0.0`; `.changeset/portable-agent-plugin.md` describes its first release.
- `[verified]` 2026-09-02: package manifests and runtime sources support the platform and CLI corrections listed above.
- `[verified]` 2026-09-02: `pnpm --filter @maestria/docs test` passed 74 tests.
- `[verified]` 2026-09-02: `pnpm --filter @maestria/docs build` built 70 pages and reported that all internal links are valid.
- `[verified]` 2026-09-02: `bash scripts/check-sync` reported all ten generated projections in sync.

## Next step

Use this audit as the baseline for the next documentation change. Revisit the deferred structural recommendations when a release or platform-support update already requires touching those documents.
