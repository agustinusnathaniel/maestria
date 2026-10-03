# ADR-CORE-006: Project Workflow Protocol and Loading Boundary

## Status

Accepted (2026-06-24), Confidence: High. Extended 2026-09-18 for runtime loading and 2026-09-24 for the shared Node loader; consolidated 2026-10-03.

## Context

Generic workflow modes cannot express each project's verification, commit, dependency, and documentation conventions. Putting those conventions in shared methodology bloats every consumer's context; forking the integration duplicates maintenance. Projects need optional local instructions without owning another pipeline implementation.

The original protocol relied on prompt-level discovery and delegation. Runtime loading later exposed host-specific root selection, failure signaling, and child-context reach. Sharing duplicated filesystem checks is useful only when those host differences remain explicit.

## Decision

### Project-local content

Read `.maestria/workflow.md` for sequencing, followed by `.maestria/rules.md` for project constraints, at the project root only. Absent or empty files leave defaults unchanged. Safety, authorization, and host permissions retain precedence; project content cannot waive them. Carry binding constraints into delegation briefs and re-establish missing context after compaction.

This complements built-in modes rather than introducing custom keyword discovery, a workflow engine, or another persisted state store. The [canonical orchestrator](../../../packages/core/agent-directives/specialists/orchestrator.md) owns advisory loading and routing; current operational guidance stays in the project's files.

### Runtime boundary

Runtime hosts reread full content at model/turn time so edits do not require a restart or stale persisted copies. Root selection and read-error behavior are host-specific:

| Host | Root authority | Present-but-unusable file |
| --- | --- | --- |
| OpenCode | SDK worktree, then worktree path, then session directory; skip `/` sentinel | Throw from the system transform, failing the model call |
| Pi, OMP, Prime | Host-selected session cwd | Notify and inject a STOP banner; throwing is unsafe where the host swallows hook exceptions |
| Hermes | Process cwd at call time, retargeted by host resume | Inject an error banner and log a warning; the hook is inject-only and fail-open |
| Declarative hosts | Project root through host tools | Disclose unreadability and request needed content instead of inventing or silently overriding it |

Diagnostics expose only relative file and failure kind, never raw cause or content. Canonicalize symlink roots and require regular-file targets with containment checks. Reads observe the filesystem at call time rather than an atomic snapshot; residual TOCTOU remains, with no sandbox promise.

OpenCode's pinned pipeline covered primary and child model calls. Pi-family child injection was unverified, and Hermes had no separate child-turn guarantee; delegation briefs must still carry constraints. Fresh runtime reads cover later/post-compaction turns without promising durable project-content persistence. Current host versions, source evidence, and verification limits live in the [runtime support matrix](../../runtime-support-matrix.md).

### Shared implementation

Use a narrow private Node loader under `packages/shared/project-config/`, bundled into public host builds, for the common filesystem contract. Host adapters keep root selection and error presentation. The loader imports no host SDK and stays outside browser-safe core because it requires Node filesystem APIs. Hermes retains a separate native Python implementation.

Shared real-filesystem tests own missing/empty files, order, freshness, symlinks, containment, file kinds, and safe diagnostics. Host tests own wrappers and injection. These checks establish the adapter boundary rather than an untested live-host guarantee.

## Consequences

- Project conventions stay local and opt-in while shared methodology remains portable.
- Shared filesystem checks reduce security-sensitive drift without erasing host failure behavior.
- Fresh reads cost I/O, and host-specific error handling adds wrappers and a private workspace edge.
- Prompt-only hosts depend on agent behavior; banners do not mechanically stop execution, and not every child receives automatic injection.
- Readability and containment checks reduce accidental exposure but cannot remove filesystem races or establish a sandbox.

## Alternatives Considered

- **Rely only on AGENTS.md references:** rejected because platform-injected project context was not reliably reachable by the orchestrator and had no separate workflow namespace.
- **Package project workflows as orchestrator skills:** rejected in the original design because it needed new loading infrastructure instead of two project files.
- **Discover custom mode keywords:** rejected because it requires cross-platform registries and type/config expansion for a problem local prose solves.
- **Keep duplicated Node loaders:** rejected because identical security-sensitive filesystem checks can diverge; share the contract and preserve host wrappers.
- **Move the loader into core or share it with Python:** rejected by browser-safe core and native host boundaries.

## Related Decisions

- [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): shared directive projection.
- [CORE-019](ADR-CORE-019-directive-simplification.md): ownership and authorization precedence.
- [CORE-020](ADR-CORE-020-hybrid-package-topology.md): narrow private sharing.
- [OC-003](../opencode/ADR-OC-003-keyword-triggered-workflow-modes.md): the mode system this protocol complements.

## Date

2026-06-24; consolidated 2026-10-03.
