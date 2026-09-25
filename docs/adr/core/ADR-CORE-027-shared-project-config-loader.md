# ADR-CORE-027: Shared Node Project Configuration Loader

## Status

Accepted (2026-09-24)

## Context

OpenCode, Prime Agent, and the Pi-family shared package each carried the same synchronous loader for `.maestria/workflow.md` and `.maestria/rules.md`. The copies implemented the root-only, workflow-then-rules contract from [ADR-CORE-006](ADR-CORE-006-project-workflow-protocol.md), including symlink containment and relative-path-only diagnostics. Host-specific code was limited to OpenCode root selection and the Pi-family session context and UI error wrapper. Keeping three copies made a security-sensitive filesystem contract vulnerable to drift.

## Decision

Move the common loader and its formatting functions into private `@maestria/shared-project-config` under `packages/shared/project-config/`. It is a narrow Node-only module with no host SDK imports. OpenCode, Prime Agent, and `@maestria/shared-pi` consume it through workspace links and continue to export their existing names explicitly. OpenCode keeps worktree precedence and the `/` worktree sentinel locally; `@maestria/shared-pi` keeps `ctx.cwd`, notification, and never-throw handling locally. The public host builds bundle the private module, following the build-time workspace dependency pattern of [ADR-CORE-020](ADR-CORE-020-hybrid-package-topology.md).

The shared tests own real-filesystem loader behavior: missing and empty entries, order and freshness, symlink roots and targets, containment, file kinds, and sanitized diagnostics. Host tests cover their wrappers and injection paths. This changes no generated directives, public package names, or project configuration semantics.

## Consequences

One implementation now governs the Node hosts' project file checks. Changes to loading semantics need one contract update, while host root selection and error presentation remain independently testable. The private package adds a workspace edge and must remain outside `@maestria/core`: core library code is browser-safe, while this loader requires `node:fs` and `node:path`. Hermes remains a separate Python implementation and retains its own runtime tests.

## Related Decisions

- [ADR-CORE-002](ADR-CORE-002-plugin-architecture.md): host adapter boundaries
- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): canonical directive ownership
- [ADR-CORE-006](ADR-CORE-006-project-workflow-protocol.md): project file loading contract
- [ADR-CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md): Prime's independent host integration
- [ADR-CORE-020](ADR-CORE-020-hybrid-package-topology.md): narrow private shared modules
