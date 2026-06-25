# ADR-CORE-006: Project Workflow Protocol (.maestria/)

## Status

Accepted - 2026-06-24

## Context

The orchestrator prompt defines three built-in workflow modes (`fein`, `sonar`, `blitz`) that control the delegation pipeline. However, these modes are:

1. **Hardcoded** - defined in TypeScript per platform, requiring code changes to add or modify
2. **Generic** - apply the same pipeline regardless of project conventions
3. **Pipeline-only** - control delegation order but not project-specific practices (testing, commits, documentation, dependency management)

Projects like the maestria monorepo have detailed conventions beyond what a mode keyword can express: which commands to run, which ADRs to read, how to commit, where tests live. There was no mechanism for projects to encode these conventions into agent behavior without either bloating the core directives or forking the platform.

## Decision

Add a lightweight protocol where projects define workflow instructions in `.maestria/workflow.md` (relative to project root). The orchestrator checks for this file via `@adventurer` delegation and follows its sequencing guidance.

### Protocol Design

**File locations:**

- `.maestria/workflow.md` - Delegation sequencing for the orchestrator. Tells it what to delegate and in what order.
- `.maestria/rules.md` - Project-specific non-negotiable (`!!!`) rules that supplement the core `rules.md` for all agents. Propagated via delegation prompts.

**Loading mechanism:** The orchestrator delegates to `@adventurer` to check for these files when starting work on a project. The file contents stay in conversation history across turns. If history is compacted, the orchestrator reloads them on the next turn.

**Usage in delegations:**

- Workflow context goes into the "Access list" and "Context" sections of delegation prompts
- Project rules go into the "Known problems" section of delegation prompts
- The orchestrator never implements work itself - it sequences and delegates

**Precedence:** Core rules (delegate don't implement, maker/checker split, commit protocol, etc.) always take precedence over project instructions. If a conflict arises, the core rule wins.

### Canonical Source Changes

Two files in `packages/core/agent-directives/` were modified:

- `specialists/orchestrator.md` - Added "Project Workflows (.maestria/)" section
- `rules.md` - Added awareness bullet under Orchestration

### Project Instance

The maestria monorepo itself now includes `.maestria/workflow.md` and `.maestria/rules.md` as a reference implementation. Any project using maestria's agent directives can create these files to customize agent behavior.

## Consequences

### Positive

- **No platform code changes** - The protocol is implemented entirely in the orchestrator prompt. It works identically across OpenCode, Pi, Kimi Code, and any future platform.
- **No bloat** - The orchestrator prompt grew by ~24 lines. Project-specific content stays in the project, not in core.
- **Opt-in** - Projects that don't create `.maestria/` files see no change in behavior.
- **Extensible** - The `.maestria/` namespace can grow to include custom modes, specialist overrides, or other project-specific configuration without changing the loading protocol.
- **Standard namespace** - `.maestria/` follows the convention of `.github/`, `.vscode/`, `.husky/`, etc. Each tool owns its namespace.

### Negative

- **Delegation overhead** - The first turn on a project requires an `@adventurer` delegation to load the workflow file. Subsequent turns rely on conversation history.
- **No machine-readable config** - The protocol is prompt-based, not code-based. Platforms cannot programmatically read `.maestria/` configuration. This is acceptable for v1; a machine-readable format (e.g., `config.json`) can be added later.
- **Sync dependency** - If the orchestrator prompt's `.maestria/` section drifts from the documentation, users get inconsistent guidance. The docs build pipeline (`pnpm build`) catches build errors but not semantic drift.

## Alternatives Considered

### AGENTS.md reference

Add a paragraph telling the orchestrator to "pay attention to AGENTS.md" for project instructions. Rejected because AGENTS.md content is injected by the platform and may not be reliably available in the orchestrator's context. Also no namespace isolation.

### Skill-based workflows

Package the workflow as an orchestrator-level skill. Rejected because "orchestrator skills" don't exist as a concept - skills currently load for subagents only. Would require new infrastructure.

### Custom mode keywords

Extend the mode system to support user-defined keywords discovered from a `.maestria/modes/` directory. Rejected as over-engineered - requires TypeScript changes across 3+ platforms, type system relaxation, and a registry API. The prompt-based protocol solves the same problem with zero code.

## Related Decisions

- ADR-OC-003: Keyword-Triggered Workflow Modes - The existing mode system that this protocol complements but does not replace
- ADR-CORE-005: Shared Agent Directives Core Sync - The sync pipeline that propagates the orchestrator prompt changes to all platforms

## Date

2026-06-24
