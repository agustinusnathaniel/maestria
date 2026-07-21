# Contributing to Maestria

## 1. Development Setup

```bash
# Prerequisites: Node 24.16+, pnpm 11.8+, Python 3.11+, ruff (pip install ruff)
# Install dependencies
vp install

# Verify everything works
vp check
```

The project uses [Vite+](https://viteplus.dev) as its unified toolchain. `vp check` runs format, lint, and type-checking across all packages.

---

## 2. Monorepo Structure

```
maestria/
├── packages/
│   ├── core/              Canonical agent directives + sync pipeline (private, v0.2.0)
│   ├── opencode/          OpenCode plugin (published, v0.4.9)
│   ├── kimi-code/         Kimi Code plugin (private, v0.2.1)
│   └── pi/                Pi extension (published, v0.4.1)
├── apps/
│   └── docs/              Starlight documentation site (private)
├── scripts/
│   ├── sync-all           Regenerate all plugin outputs from canonical sources
│   └── check-sync         CI verification: fail if any output differs
├── docs/
│   ├── adr/               Architecture Decision Records by area
│   ├── testing.md         Testing philosophy
│   └── checklist.md       Pre-commit verification gates
├── AGENTS.md              AI agent guidance
├── PATTERNS.md            Design patterns (Pipeline Composition, Maker/Checker Split)
└── VISION.md              Project motivation and long-term goals
```

### Package Roles

| Package | Published | Role |
| --- | --- | --- |
| `@maestria/core` | No | Canonical agent prompts in `agent-directives/`, sync pipeline scripts |
| `@maestria/opencode` | Yes | 7 specialist subagents + orchestrator + workflow modes for OpenCode |
| `@maestria/kimi-code` | No | 7 specialist skills with swarm-aware orchestration for Kimi Code |
| `@maestria/pi` | Yes | 7 specialists + 3 workflow modes as a Pi extension |
| `@maestria/docs` | No | User-facing docs site at [maestria.sznm.dev](https://maestria.sznm.dev) |

### Data Flow

```
packages/core/agent-directives/  (canonical source)
    │
    ▼ (scripts/sync-all iterates packages/*/sync.config.ts)
packages/{opencode,kimi-code,pi}/
    sync.config.ts defines:
      • source (where canonical files live)
      • output (where generated files go)
      • transforms (per-file find/replace, prepend, append, frontmatter)
```

---

## 3. The Sync Pipeline (Core Concept)

This is the most critical infrastructure in the project. **Single source of truth for every agent prompt across every platform.**

### Purpose

One canonical copy of each specialist prompt lives in `packages/core/agent-directives/specialists/`. The sync pipeline derives platform-specific files - with correct tool names, frontmatter, and routing - for each plugin. Edit once, sync everywhere.

### Architecture

Config-driven content derivation. The sync reads canonical markdown, applies a sequence of string-based transforms per-file, and writes platform-specific output.

**Transform pipeline** (defined in `process-file.ts`):

```
source file
  → strip frontmatter     (if configured)
  → find/replace          (string replacements for platform tool names)
  → strip source comment  (idempotency)
  → prepend               (platform-specific header content)
  → append                (platform-specific footer content)
  → serialize frontmatter (YAML frontmatter if configured)
  → auto-generated header ("<!-- Auto-generated from @maestria/core -->")
  → write output
```

### Key Files

| File | Role |
| --- | --- |
| `packages/core/scripts/sync.ts` | CLI entry point - `--check` for CI, `--diff` for review, `--dry-run` for preview |
| `packages/core/scripts/lib/process-file.ts` | Single-file transform pipeline (the canonical transform) |
| `packages/core/scripts/lib/transforms.ts` | Individual transform functions (stripFrontmatter, findAndReplace, serializeFrontmatter, etc.) |
| `packages/core/scripts/lib/config.ts` | Config types: `SyncConfig`, `FileConfig`, `ReplaceOp`, `ResolvedFileConfig` |
| `packages/core/scripts/lib/sync.ts` | Core orchestration - walks source dirs, dispatches to processFile, auto-cleans stale outputs |
| `packages/core/scripts/lib/file.ts` | File I/O: atomic write (tmp + rename), directory walker, auto-clean |
| `packages/core/scripts/lib/diff.ts` | Unified diff generation for `--diff` mode |

### Sync Configs (per-plugin)

Each plugin defines its transforms in `sync.config.ts`:

| Plugin | Key transforms | Output format |
| --- | --- | --- |
| **opencode** | Adds YAML frontmatter with `mode`, `permission` blocks | `agents/<name>.md` - agent files with tool permissions |
| **kimi-code** | 18 string replacements (`task(` → `Agent(`, `webfetch` → `FetchURL`, etc.) + prepend subagent profile + append routing/swarm docs | `skills/<name>/SKILL.md` - Kimi Code skills |
| **pi** | Unified `sync.config.ts` (9 replacements: `task(` → `maestria_subagent(`, `@` → `/`) with dual output paths for agents + skills | `agents/<name>.md` (subagent agent files) + `skills/<name>/SKILL.md` (Pi skill files) |

### Commands

```bash
# Regenerate all plugin outputs
scripts/sync-all

# CI check - exit 1 if any output differs from expected
scripts/check-sync

# Per-plugin (run from the plugin directory)
cd packages/opencode && npx tsx ../core/scripts/sync.ts --verbose
cd packages/opencode && npx tsx ../core/scripts/sync.ts --check  # CI mode
cd packages/opencode && npx tsx ../core/scripts/sync.ts --diff   # show changes
```

### Critical Rule

**Never edit generated files.** Every generated file starts with an `<!-- Auto-generated from @maestria/core -->` comment. Always edit the canonical source in `packages/core/agent-directives/` and re-sync. Before committing agent directive changes, always run `scripts/check-sync` to verify synced plugins are up-to-date.

---

## 4. Adding or Editing a Specialist

### Add a new specialist

1. Create `packages/core/agent-directives/specialists/<name>.md` - follow the existing structure (role description, methodology, iteration limits, handoff format, skill prescription, related agents)
2. Register in the orchestrator prompt's delegation table
3. For each plugin, check `sync.config.ts`:
   - **OpenCode:** Add frontmatter with `mode: subagent`, `description`, and `permission` blocks
   - **Kimi Code:** Add a `files` entry with subagent type mapping, prepend content, frontmatter with `name`/`description`/`whenToUse`, and add to the routing table in `orchestrator`'s append
   - **Pi:** Usually just default transforms apply - check if specialist-specific overrides are needed

### Edit an existing specialist

1. Edit `packages/core/agent-directives/specialists/<name>.md` - never edit generated copies
2. Run `scripts/sync-all` to regenerate all plugin outputs
3. Verify with `scripts/check-sync`
4. Run tests: `vp check && pnpm test`

---

## 5. Adding a New Platform Plugin

To port Maestria to a new AI coding agent (e.g., Claude Code, Copilot):

1. **Create the package:** `packages/<name>/` with its own `package.json`
2. **Create `sync.config.ts`:** define `source` (pointing to `packages/core/agent-directives/`), `output` directory, and transforms:
   - String replacements for platform-specific tool names
   - Frontmatter/format adjustments for the target platform
   - Prepend/append for platform-required headers or routing tables
3. **Implement the plugin:** write source code that hooks into the target platform's lifecycle (subagents, skills, extensions, etc.)
4. **Sync integration:** the root `scripts/sync-all` auto-detects new `packages/*/sync.config.ts` files - no script registration needed
5. **Document:** add a docs section in `apps/docs/src/content/docs/<name>/`
6. **Test:** `vp check` must pass; add platform-specific tests

The canonical sync pipeline handles content derivation. The plugin package handles platform integration. These concerns are deliberately separate.

---

## 6. Per-Plugin Development

### opencode

| Concern      | Details                                                     |
| ------------ | ----------------------------------------------------------- |
| Entry point  | `packages/opencode/src/index.ts` (~190 lines)               |
| Hooks        | `config`, `chat.message`, `experimental.session.compacting` |
| Test         | `pnpm --filter @maestria/opencode test`                     |
| Build        | `vp pack` (Rolldown) - outputs to `dist/`                   |
| Agents       | Auto-generated in `agents/` from sync pipeline              |
| Dependencies | `@opencode-ai/plugin` (peer), `yaml`, `zod`, `es-toolkit`   |

### kimi-code

| Concern        | Details                                                           |
| -------------- | ----------------------------------------------------------------- |
| Format         | Declarative - no build step (no `dist/` output)                   |
| Skills         | Auto-generated in `skills/<name>/SKILL.md` from sync pipeline     |
| Manifest       | `kimi.plugin.json` - plugin definition file                       |
| Test           | `vp test`                                                         |
| Release        | Push `@maestria/kimi-code@v<version>` tag → CI runs subtree split |
| Subagent types | `explore` (read-only), `coder` (write/edit), `plan` (read+bash)   |

### pi

| Concern | Details |
| --- | --- |
| Entry point | `packages/pi/src/extension.ts` |
| Source modules | `modes.ts`, `rules.ts`, `compaction.ts`, `subagent.ts`, `commands.ts`, `tools.ts`, `state.ts`, `rules-content.ts` |
| Test | `pnpm --filter @maestria/pi test` |
| Build | `vp pack` (Rolldown) - outputs to `dist/` |
| Validate | `pnpm --filter @maestria/pi validate` |
| Prebuild | `node --experimental-strip-types scripts/build-rules.ts` |
| Peer deps | `@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`, `typebox` |
| Key transforms | `task(` → `maestria_subagent(`, `@` → `/` |

### cursor

| Concern        | Details                                                           |
| -------------- | ----------------------------------------------------------------- |
| Format         | Declarative Cursor plugin - no build step (no `dist/`)            |
| Manifest       | `.cursor-plugin/plugin.json`                                      |
| Agents         | Auto-generated in `agents/*.md` from sync (7 specialists)         |
| Skills         | Auto-generated `skills/orchestrator/SKILL.md`                     |
| Rules          | Auto-generated `rules/maestria-global.mdc` (`alwaysApply: true`)  |
| Commands       | Hand-authored `commands/{fein,sonar,blitz,orchestrate}.md`        |
| Test           | `pnpm --filter @maestria/cursor test`                             |
| Install        | CLI copies to `~/.cursor/plugins/local/maestria`                  |
| Key transforms | `task(` → `Task(`, `@name` → bare name, tools → Cursor PascalCase |

---

## 7. Testing Philosophy

See [`docs/testing.md`](docs/testing.md) for the full guide. Key principles:

- **Test from contracts, not implementation** - test observable behavior at the highest practical boundary
- **Avoid mocks** - prefer real lightweight boundaries or explicit fakes; mocking is a design smell
- **Keep regression tests intentional** - only add a regression test if it protects a durable contract or a meaningful failure mode
- **Use explicit `it()` blocks** - `it("does X when Y")` so condition and behavior are clear from the name

---

## 8. Changeset Workflow

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

```bash
# Create a changeset (follow the prompts)
pnpm changeset

# Version packages (apply changesets, bump versions)
pnpm version-packages

# Publish to npm
pnpm release
```

Create a changeset whenever you make a user-facing change to a published package (`@maestria/opencode`, `@maestria/pi`). Private packages (`@maestria/core`, `@maestria/kimi-code`, `@maestria/docs`) can skip changesets but use `"tag": true` for internal tracking.

---

## 9. Pull Request Process

1. **Fork + feature branch** - branch from `main`, use a descriptive name (`fix/sync-crash`, `feat/claude-code-plugin`)
2. **Make changes following conventions:**
   - Edit canonical sources, never generated copies
   - If changing agent directives: run `scripts/sync-all` + `scripts/check-sync`
   - If adding/removing files: update `package.json` `files` array and export map
   - If introducing a design decision: add a corresponding ADR in `docs/adr/<area>/`
3. **Verify:** `vp check` + relevant tests pass across all packages
4. **Create a changeset** if the change affects published packages
5. **Submit PR** with a clear description of the change, motivation, and any migration notes

---

## 10. Documentation

| Area | Location | How to run |
| --- | --- | --- |
| User-facing docs | `apps/docs/` (Astro + Starlight) | `vp run @maestria/docs#dev` |
| Architecture decisions | `docs/adr/{core,opencode,kimi-code,pi}/` | Read as markdown |
| Testing guide | `docs/testing.md` | Read as markdown |
| Completion checklist | `docs/checklist.md` | Read as markdown |
| Root project docs | `AGENTS.md`, `PATTERNS.md`, `VISION.md`, `README.md` | Read as markdown |

The docs site auto-generates sidebar navigation via `starlight-auto-sidebar`. After adding a new page, verify it appears in the sidebar during local dev.

---

_Before committing agent directive changes, always run `scripts/check-sync` to verify synced plugins are up-to-date._
