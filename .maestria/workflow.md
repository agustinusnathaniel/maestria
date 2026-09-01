# Maestria Project Workflow

This file defines the project-specific delegation sequence for the maestria monorepo. The orchestrator reads this file and follows its sequencing guidance. Subagent-level conventions are propagated via delegation prompt "Access list" and "Context" sections.

## Sequencing

### 1. Understand project context

Use direct execution for familiar, low-risk work. Delegate to `@adventurer` when the codebase is unfamiliar, the change crosses package boundaries, or the next decision depends on reconnaissance:

- Read `README.md` for product overview and high-level architecture
- Read `AGENTS.md` for project-specific agent conventions (this is the root AGENTS.md, not .maestria/)
- Read `PATTERNS.md` for core design patterns (Pipeline Composition + Maker/Checker Split)
- Read `VISION.md` for project motivation and philosophy
- Check recent commits (`git log --oneline -20`) and diff (`git diff --name-only HEAD~5..HEAD`)
- Read `package.json` and `pnpm-workspace.yaml` for workspace layout and scripts
- Map only the relevant package boundaries. The main areas are `packages/core/` (canonical directives and sync tooling), `packages/*/` (platform projections), `apps/docs/` (Astro + Starlight), `scripts/` (repository tooling), and `docs/adr/` (architecture decisions).

### 2. Understand the Problem

- Read the linked issue, PR description, or task thoroughly
- Identify the acceptance criteria. If evidence cannot resolve consequential ambiguity, request clarification before implementation. For ordinary ambiguity, state the assumption and proceed.
- Determine which package(s) are affected: core, agent-plugin, opencode, kimi-code, pi, omp, cursor, hermes, prime-agent, claude-code, codex, docs, or scripts
- Map the problem to existing abstractions (sync pipeline, specialist prompts, modes, ADRs) before inventing new ones
- Read `CONTRIBUTING.md` for comprehensive development guidance if the task involves unfamiliar areas

### 3. Read Relevant ADRs

Read any ADR relevant to the change before implementing. Delegate that reading to `@adventurer` when the ADR set is large or unfamiliar:

| Scope                                            | Location              |
| ------------------------------------------------ | --------------------- |
| Monorepo-level (structure, conventions, sync)    | `docs/adr/core/`      |
| OpenCode plugin (modes, permissions, commits)    | `docs/adr/opencode/`  |
| Kimi Code plugin (distribution, architecture)    | `docs/adr/kimi-code/` |
| Cursor plugin (architecture)                     | `docs/adr/cursor/`    |
| Hermes plugin (distribution, orchestration)      | `docs/adr/hermes/`    |
| Pi and OMP extensions (rules, compaction, reuse) | `docs/adr/pi/`        |

If the change introduces a new architectural pattern, dependency, or structural change, create an ADR with `Status`, `Context`, `Goals`, `Non-Goals`, `Decision`, `Consequences`, `Assumptions`, `Alternatives Considered`, and `Date`. Follow [the documentation format guide](../docs/guides/doc-format.md).

### 4. Be Pragmatic - Reuse Before Reinventing

When delegating to `@builder`, include these principles:

- Search the existing codebase for utilities, patterns, or tasks that already solve similar problems
- Check `packages/core/agent-directives/` for existing specialist prompts that can serve as a reference
- Check `packages/core/scripts/` for sync pipeline utilities before writing new ones
- Check `packages/*/sync.config.ts` for existing sync configuration patterns
- Prefer wrapping, composing, or extending existing directives over adding new ones
- If introducing a new dependency, justify it in reasoning and ensure it aligns with the project's philosophy (lightweight, platform-independent, no runtime bloat)

### 5. Implement and Test

Delegate to `@builder` with these requirements:

**Quality pipeline (run the smallest gate that covers the change):**

```bash
pnpm check                 # full local gate: build, format, lint, and tests
pnpm typecheck             # explicit type-check gate
pnpm check:ci              # CI-oriented gate, including package builds and tests
pnpm --filter @maestria/docs build  # docs changes: build and validate internal links
```

Use the individual `pnpm typecheck`, `pnpm test`, `pnpm build`, or `pnpm lint` scripts when narrowing a failure. Do not use a nonexistent `pnpm ready` script.

**Sync pipeline verification (MANDATORY after any agent directive change):**

```bash
bash scripts/check-sync
```

A corrupted sync breaks agents across all platforms. If check-sync fails, run:

```bash
bash scripts/sync-all
```

Then re-verify with `scripts/check-sync`.

**Test expectations:**

- Tests are colocated with packages (e.g., `packages/core/tests/`, `packages/opencode/tests/`)
- Add or update tests for any new behavior, especially for:
  - New specialist prompts or directive changes in `packages/core/tests/`
  - Mode detection changes in `packages/opencode/tests/`
  - Plugin behavior changes in the respective package's tests
- Ensure changes are **idempotent** - running the same operation twice produces the same result
- For mode detection changes, verify both keyword detection and deactivated-mode behavior

### 6. Commit Conventions

Before delegating commit work to `@builder`, include these conventions:

**Changeset:** Required for user-facing changes. Run:

```bash
pnpm changeset
```

Bump type rules:

- **`minor`**: only for actual new features or user-facing additions (`feat` commits)
- **`patch`**: everything else - refactors, fixes, chores, docs, tests, tooling
- **`major`**: breaking changes only

**Commit messages:** Follow Conventional Commits:

| Type       | Changeset bump | When to use                                  |
| ---------- | -------------- | -------------------------------------------- |
| `feat`     | minor          | Actual new feature or user-facing capability |
| `fix`      | patch          | Bug fix                                      |
| `refactor` | patch          | Restructuring, no new behavior               |
| `chore`    | patch          | Maintenance, tooling, deps                   |
| `docs`     | patch          | Documentation                                |
| `test`     | patch          | Tests                                        |
| `style`    | patch          | Formatting                                   |

Only `feat` warrants a minor bump - all others are patch.

Split into multiple commits if the change spans unrelated concerns (e.g., core directive change + plugin mode change + docs update should be separate commits).

### 7. Update Documentation

If the change affects behavior, architecture, or user-facing features, delegate to `@writer` or `@builder` for doc updates:

- **ADRs:** Create or update in the appropriate `docs/adr/` subdirectory (core/, opencode/, kimi-code/, cursor/, hermes/, or pi/)
- **Publishable docs:** Update the Astro Starlight site in `apps/docs/src/content/docs/`:
  - Core agents or pipeline changes → `apps/docs/src/content/docs/core/`
  - OpenCode plugin changes → `apps/docs/src/content/docs/opencode/`
  - Kimi Code plugin changes → `apps/docs/src/content/docs/kimi-code/`
  - Pi and OMP changes → `apps/docs/src/content/docs/pi-omp/`
  - Cursor changes → `apps/docs/src/content/docs/cursor/`
  - Hermes changes → `apps/docs/src/content/docs/hermes/`
  - Claude Code changes → `apps/docs/src/content/docs/claude-code/`
  - Codex changes → `apps/docs/src/content/docs/codex/`
  - Prime Agent changes → `apps/docs/src/content/docs/prime-agent/`
  - Portable Agent Plugin changes → `apps/docs/src/content/docs/agent-plugin/`
- **Preview doc changes locally:** `pnpm dev`
- **Verify:** `pnpm --filter @maestria/docs build` must pass; it builds the site and validates internal links.

## Precedence

Core rules (delegate don't implement, maker/checker split, commit protocol, etc.) always take precedence over these project workflow instructions. If a conflict arises, the core rule wins.
