<!-- This is the root AGENTS.md for AI agents working on **maestria itself** (not
     maestria-powered agents working on user projects). See
     packages/core/agent-directives/README.md for the content ownership guide. -->

## Project Snapshot

Maestria is a meta-project: it builds the **agent methodology** (dispatcher + 7 specialists) that AI agents use. The canonical agent directives live in `packages/core/agent-directives/` and are synced to platform-specific plugins (OpenCode, Kimi Code, Pi) via `scripts/sync-all`.

See [VISION.md](VISION.md) for the project's motivation and [PATTERNS.md](PATTERNS.md) for the two core design patterns (Pipeline Composition + Maker/Checker Split).

## Priorities & Values

These priorities govern trade-off decisions in this project:

### 1. Canonical source purity

Agent directives are single-sourced in `packages/core/agent-directives/`. Edit canonical sources only - never edit generated copies under `packages/opencode/agents/`. The sync pipeline exists to prevent drift; bypassing it creates technical debt.

### 2. Platform independence

Core agent logic (`packages/core/`) must not depend on any specific platform (OpenCode, Kimi Code, Pi, etc.). Platform-specific concerns belong in the respective plugin package. When designing features, keep `core/` platform-agnostic.

### 3. Explicit boundaries

Every package has a clear role and import constraints. Don't blur boundaries for convenience. If a module needs to be shared, extract it to the appropriate package rather than adding a cross-package dependency.

### 4. Sync pipeline correctness

The agent directive sync pipeline is the most critical data flow in the project. Accuracy matters more than speed - a corrupted sync creates inconsistent agent behavior across platforms. Always verify with `scripts/check-sync` before committing.

### 5. Incremental over radical

Prefer small, verifiable changes over sweeping rewrites. Each change should pass `vp check`, have clear scope, and be reviewable in one sitting.

## Package Roles

- **`packages/core/`** - Zero platform-specific imports. Cannot import from opencode, kimi-code, pi, or any platform SDK. Zero Node.js-specific APIs that would prevent browser-side use. The `scripts/` directory is dev tooling and uses Node.js APIs where appropriate, but library modules are browser-safe. Contains the canonical `agent-directives/` (specialist prompts + rules) and shared scripts.
- **`packages/opencode/`** - Depends on `@maestria/core` via the sync pipeline. Uses standard OpenCode SDK APIs only. Its `agents/` directory is **auto-generated** from core via the sync pipeline.
- **`packages/kimi-code/`** - Depends on `@maestria/core` via the sync pipeline. Follows Kimi Code platform conventions.
- **`packages/pi/`** - Depends on `@maestria/core` via the sync pipeline. Must not depend on any Node.js APIs (Pi is a terminal prompt, not an SDK plugin).

### Canonical source flow

The 8 pipeline agents (7 specialists + orchestrator) are defined in `packages/core/agent-directives/specialists/` and synced to plugin agent directories (`packages/opencode/agents/`, etc.) via `scripts/sync-all`. **Always edit the canonical source, never the generated copy.** See `packages/core/agent-directives/README.md` for the content ownership guide. Reference ADR CORE-005 for the sync bridge design.

## Decision-Making Guide

When facing ambiguity or trade-offs, these rules of thumb apply:

- **Sync accuracy over speed** - When the sync pipeline is involved, verify correctness before proceeding. A corrupted sync breaks agents across all platforms.
- **Platform independence over convenience** - If a feature can be implemented in core (platform-agnostic) vs. a plugin, put it in core. Platform coupling is forever.
- **Boundaries over shortcuts** - If code crosses package boundaries, extract it to the right package rather than adding a cross-package dependency. Boundary violations accumulate into architecture rot.
- **Incremental over radical** - A small, reviewable change that lands today is worth more than a perfect rewrite that never ships.
- **Quality gates are not optional** - `vp check` before every commit. `scripts/check-sync` after every agent directive change. Post-implementation review by `@reviewer` is the default (maker/checker split).

## Reference

### Architecture Decision Records

Read the relevant ADRs before modifying plugin architecture, sync pipeline, or agent conventions:

| Area | Key ADRs | When to read |
| --- | --- | --- |
| Core | CORE-002 (Plugin Architecture), CORE-005 (Core Sync) | Plugin loading, agent directives |
| OpenCode | OC-001 (Tool Permissions), OC-003 (Workflow Modes) | Agent frontmatter, chat hooks |
| Kimi Code | KC-000, KC-001 | Kimi platform work |
| Pi | PI-001 (Rules Injection), PI-002 (Compaction) | Pi platform work |

### Detailed Guidelines

- [Testing Philosophy](docs/testing.md) - Test from contracts, avoid mocks
- [Completion Checklist](docs/checklist.md) - Pre-commit verification gates
