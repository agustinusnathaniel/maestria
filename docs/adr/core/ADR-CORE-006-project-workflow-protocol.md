# ADR-CORE-006: Project Workflow Protocol (.maestria/)

## Status

Accepted (2026-06-24)

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
- **Precedence:** core rules (never implement routed work yourself, maker/checker split [ADR-CORE-012](ADR-CORE-012-deterministic-review-signals-fail-loud-exit.md), commit protocol, etc.) always take precedence over project instructions. If a conflict arises, the core rule wins.

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

## Amendment 2026-09-18: Cross-Host Runtime Loading

The prompt-based protocol above still applies on every host. Each runtime host now also loads both project-root files through its own mechanism; project content stays subordinate and never waives safety, authorization, or host permissions. Order is workflow then rules on every engine. Scope is project root only with no ancestor or nested lookup. Absent or empty files leave defaults unchanged. Error diagnostics name only the relative file and the failure kind, with no raw cause or content leak; symlink roots are canonicalized and the resolved target must be a regular file. Checks observe the filesystem at call time and are not an atomic snapshot, so a residual filesystem TOCTOU remains with no sandbox promise.

| Host | Root | Read-error signal | Freshness | Subagent reach | Compaction | Source and limit |
| --- | --- | --- | --- | --- | --- | --- |
| OpenCode (`@maestria/opencode`) | SDK project worktree, then worktree path, then session directory; `/` sentinel skipped | Present-but-unusable file throws in `experimental.chat.system.transform`, which propagates as a failed model call | Full content read fresh on every model call; no restart, no snapshot | Same pinned pipeline covers primary and subagent calls | Same fresh read covers post-compaction calls; a compaction note asks the summary to preserve active constraints | Pinned host v1.18.31 source inspection (`packages/opencode/src/session/llm/request.ts:70` transform trigger, `packages/opencode/src/session/instruction.ts` file-read swallow to empty, `packages/opencode/src/plugin/index.ts` trigger propagation, `packages/opencode/src/project/project.ts` worktree) plus package tests; no live model run. Separate from `config.instructions`. |
| Pi (`@maestria/pi`) | Host-selected session cwd (`ctx.cwd`) read live each turn | UI notification plus STOP banner in the returned system prompt; handler never throws because the host swallows `before_agent_start` exceptions | Full content re-read every turn; no restart and no persisted copies | Unverified whether subagent turns automatically receive the injection; delegation briefs still carry constraints | Fresh read covers post-compaction turns; no separate compaction preservation of project content | Package source (`packages/pi/src/rules.ts`, `@maestria/shared-pi/project-config` wrapper, `@maestria/shared-project-config` loader since ADR-CORE-027) citing pinned host 0.84.2 `emitBeforeAgentStart` behavior; no independent pinned-source read in this change and no live eval. |
| OMP (`@maestria/omp`) | Host-selected session cwd (`ctx.cwd`) read live each turn | UI notification plus STOP banner appended to the system prompt; handler never throws because the host swallows `before_agent_start` exceptions | Full content re-read every turn; no restart and no persisted copies | Unverified whether subagent turns automatically receive the injection; delegation briefs still carry constraints | Fresh read covers post-compaction turns; no separate compaction preservation of project content | Package source (`packages/omp/src/rules.ts`, `@maestria/shared-pi/project-config` wrapper, `@maestria/shared-project-config` loader since ADR-CORE-027) citing pinned host 17.4.0 `#runHandlerWithTimeout` behavior; no independent pinned-source read in this change and no live eval. |
| Prime (`@maestria/prime-agent`) | Host-selected session cwd (`ctx.cwd`) read live each turn | UI notification plus STOP banner in the system prompt | Full content re-read every turn; no restart and no persisted copies | Unverified whether subagent turns automatically receive the injection; delegation briefs still carry constraints | Fresh read covers post-compaction turns; no separate compaction preservation of project content | Prime-local adapter (`packages/prime-agent/src/project-config.ts`, `packages/prime-agent/src/modes.ts`) uses `@maestria/shared-project-config` for loading since ADR-CORE-027, with no `shared-pi` runtime import. Handler-error swallowing is [inferred] from Pi-lineage behavior only; no pinned Prime source was verified in this change. |
| Hermes (`maestria-hermes`) | Process working directory at call time (`os.getcwd()`), retargeted by the host CLI on session resume; closest supported signal | Visible `[MAESTRIA PROJECT CONFIG ERROR]` banner in the injected context plus a host log warning; hook runs fail-open and inject-only | Full content re-read every turn after the mode context; no restart | Injection runs through the shared turn pipeline where the hook runs; no separate child-turn guarantee is stated | Fresh read covers later turns; no persisted copies | Pinned local source `~/.hermes/hermes-agent` at `d4625b5`: `pre_llm_call` payload carries no working-directory field, and concurrent gateway sessions share one process directory. Banner advises report and wait without guaranteeing cancellation. |
| Declarative (Claude Code, Codex, Cursor, Kimi, agent-plugin) | Project root, read with host tools | Present-but-unreadable file is disclosed and needed content is requested rather than invented; no silent override run | Advisory read when not already supplied; no runtime cache | Constraints travel in delegation briefs | Constraints are re-established when missing after compaction | Canonical orchestrator prompt plus per-host sync notes (Prime sync preserves the global-rules plus project-files wording). No new plugins or hooks in this scope. |

Runtime scope ports the same contract to all appropriate host mechanisms. This amendment adds no new setup, doctor, skill-extraction, installation, or persisted state.

### Note 2026-09-22: read-only `maestria doctor` exists alongside this contract

The scope sentence above records this amendment's boundary at the time (2026-09-18). Since #323 (2026-09-22), `maestria doctor` provides read-only skill-setup diagnostics (`apps/maestria-cli/src/lib/doctor.ts`): it collects and reports per-platform state only and never installs, updates, removes, or writes records. It does not change the loading contract above; project content still stays subordinate and reaches agents through delegation briefs and host injection.

## Date

2026-06-24
