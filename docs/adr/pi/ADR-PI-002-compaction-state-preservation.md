# ADR-PI-002: Compaction State Preservation

## Status

Accepted

## Context

Pi's compaction summarization is lossy by default: older messages are summarized and recent messages kept. maestria state must survive compaction: active task, completion promise, blockers, file references (read / modified), recent handoffs, and review state. Without preservation, the post-compaction turn has no memory and the methodology breaks.

The choices:

1. **Append to Pi's default summary** - not possible: `session_before_compact` returns a `compaction` object that **replaces** the default summary, so the maestria state must be included in the returned summary.
2. **Use the `details` field** - Pi's compaction has a `details` field for custom data, but the LLM may or may not see it.
3. **Module-scope state plus pre-compaction render** - maintain `MaestriaState` in module scope, render it to markdown on `session_before_compact`, and include the render in the returned summary.

## Decision

**Choose: Option 3 - module-scope state, render at compaction time, include in the returned summary.**

`MaestriaState` is maintained by event handlers: `before_agent_start` for `activeTask`, `tool_call` for file tracking, `subagent` tool invocations for `handoffHistory`, and `/review` for `reviewMode`.

On `session_before_compact`, the extension renders `MaestriaState` to a markdown summary returned as `compaction.summary`. The render includes ## Goal (activeTask), ## Completion Promise, ## Blockers, ## Files Modified, ## Files Read, ## Recent Handoffs, and ## Review State.

The orchestrator prompt template has a "Post-Compaction Recovery" section instructing the LLM to read this block and resume. The `details` field is also populated with the structured `MaestriaState` object for future-proofing.

**State Recovery:** advisory, not automatic; explicit orchestrator instructions mitigate misreads. Full persistence (surviving `/reload` and `/new`) requires `pi.appendEntry` and is deferred to v1.1.

## Consequences

- Positive: all methodology-relevant state survives compaction.
- Positive: state renders as plain markdown, readable by the LLM.
- Positive: the `details` field is populated for future-proofing.
- Negative: state is advisory, not enforced; the LLM may misread it.
- Negative: state doesn't survive `/reload` or `/new`.
- Negative: blockers and handoffs are textual, not structured.

## Alternatives Considered

- **Pi's default compaction** - generic; doesn't preserve maestria state.
- **Append-only state** - not possible since `compaction.summary` is wholesale replacement.
- **State persistence via `pi.appendEntry`** - would survive `/reload` but requires more code. Deferred to v1.1.

## References

- Pi `session_before_compact` event documentation
- Pi `CompactionEntry` structure documentation
- OpenCode equivalent - its compaction hook for session state management

## State Relocation and Deferred Persistence

Moved 2026-09-11: the module-scope state and its renderer live in `@maestria/shared-pi/state-core` (shared by Pi and OMP), so consumers import `state-core` directly; see [ADR-CORE-025](../core/ADR-CORE-025-consumer-driven-sync-and-adapter-simplification.md).

Full session persistence surviving `/reload` and `/new` still requires `pi.appendEntry`; deferred to v1.1 (see ADR-PI-000 for v1.1 scope).

## Date

2026-06-18 (ADR), 2026-06-23 (implementation notes)
