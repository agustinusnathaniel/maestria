# ADR-CORE-006: Project Workflow Protocol (.maestria/)

## Status

Accepted - 2026-06-24

## Context

The orchestrator prompt defines three built-in workflow modes (`fein`, `sonar`, `blitz`) that control the delegation pipeline. These modes are:

1. **Hardcoded** - defined in TypeScript per platform, requiring code changes to add or modify
2. **Generic** - apply the same pipeline regardless of project conventions
3. **Pipeline-only** - control delegation order but not project-specific practices (testing, commits, documentation, dependency management)

Projects such as the maestria monorepo have detailed conventions beyond a mode keyword: which commands to run, which ADRs to read, how to commit, where tests live. Projects had no way to encode these into agent behavior without bloating the core directives or forking the platform.

## Decision

Add a lightweight protocol where projects define workflow instructions in `.maestria/workflow.md` (relative to project root). The orchestrator checks for this file via `@adventurer` delegation and follows its sequencing guidance.

### Protocol Design

- `.maestria/workflow.md` - delegation sequencing for the orchestrator: what to delegate and in what order.
- `.maestria/rules.md` - project-specific non-negotiable (`!!!`) rules that supplement the core `rules.md` for all agents, propagated via delegation prompts.
- **Loading mechanism:** the orchestrator delegates to `@adventurer` to check for these files at project start. Contents stay in conversation history; if history is compacted, the orchestrator reloads them next turn.
- **Usage in delegations:** workflow context goes into the "Access list" and "Context" sections of delegation prompts; project rules go into the "Known problems" section. The orchestrator does not implement work routed to a specialist - it sequences and delegates; direct-route turns run on the host.
- **Precedence:** core rules (never implement routed work yourself, maker/checker split, commit protocol, etc.) always take precedence over project instructions. If a conflict arises, the core rule wins.

### Canonical Source Changes

The orchestrator prompt gained a "Project Workflows (.maestria/)" section, and the canonical rules file gained an awareness bullet under Orchestration.

### Project Instance

The maestria monorepo includes `.maestria/workflow.md` and `.maestria/rules.md` as a reference implementation; any project using maestria's agent directives can do the same to customize agent behavior.

## Consequences

### Positive

- **No platform code changes** - the protocol is implemented entirely in the orchestrator prompt and works identically across OpenCode, Pi, Kimi Code, and any future platform.
- **No bloat** - project-specific content stays in the project, not in core.
- **Opt-in** - projects that don't create `.maestria/` files see no change in behavior.
- **Extensible** - the `.maestria/` namespace can grow to include custom modes, specialist overrides, or other project-specific configuration without changing the loading protocol.
- **Standard namespace** - `.maestria/` follows the convention of `.github/`, `.vscode/`, `.husky/`, etc.; each tool owns its namespace.

### Negative

- **Delegation overhead** - the first turn on a project requires an `@adventurer` delegation to load the workflow files; subsequent turns rely on conversation history.
- **No machine-readable config** - the protocol is prompt-based, not code-based; platforms cannot programmatically read `.maestria/` configuration. Acceptable for v1; a machine-readable format (e.g., `config.json`) can be added later.
- **Sync dependency** - if the orchestrator prompt's `.maestria/` section drifts from the documentation, users get inconsistent guidance. The docs build catches build errors but not semantic drift.

## Alternatives Considered

### AGENTS.md reference

Add a paragraph telling the orchestrator to "pay attention to AGENTS.md" for project instructions. Rejected because platform-injected AGENTS.md content may not be reliably available in the orchestrator's context, and there is no namespace isolation.

### Skill-based workflows

Package the workflow as an orchestrator-level skill. Rejected because "orchestrator skills" don't exist as a concept - skills load for subagents only - and it would require new infrastructure.

### Custom mode keywords

Extend the mode system to support user-defined keywords discovered from a `.maestria/modes/` directory. Rejected as over-engineered (TypeScript changes across 3+ platforms, type system relaxation, a registry API); the prompt-based protocol solves the same problem with zero code.

## Related Decisions

- ADR-OC-003: Keyword-Triggered Workflow Modes - the existing mode system that this protocol complements but does not replace
- ADR-CORE-005: Shared Agent Directives Core Sync - the sync pipeline that propagates the orchestrator prompt changes to all platforms

## Date

2026-06-24
