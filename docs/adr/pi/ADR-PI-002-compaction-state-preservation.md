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

`MaestriaState` lives in the Pi adapter (`packages/pi/src/state.ts`) and is maintained by event handlers: `before_agent_start` for `activeTask`, `tool_call` for file tracking, `subagent` tool invocations for `handoffHistory`, and `/review` for `reviewMode`.

On `session_before_compact`, the extension renders `MaestriaState` to a markdown summary returned as `compaction.summary`. `renderMaestriaSummary` in `state.ts` owns the rendered fields (goal, completion promise, blockers, files, recent handoffs, mode, and review state among them).

The main loop's directives tell the model to read this block and resume. The `details` field is also populated with the structured `MaestriaState` object for future-proofing.

The adapter also writes the state as a `maestria_state` session entry with `pi.appendEntry` and restores it from the last valid entry on the branch, so it survives reloads. State recovery is advisory, not automatic; the main loop's instructions to read the block mitigate misreads.

## Consequences

- Positive: all methodology-relevant state survives compaction.
- Positive: state renders as plain markdown, readable by the LLM.
- Positive: the `details` field is populated for future-proofing.
- Negative: state is advisory, not enforced; the LLM may misread it.
- Negative: blockers and handoffs are textual, not structured.

## Alternatives Considered

- **Pi's default compaction** - generic; doesn't preserve maestria state.
- **Append-only state** - not possible since `compaction.summary` is wholesale replacement.

## References

- Pi `session_before_compact` event documentation
- Pi `CompactionEntry` structure documentation
- OpenCode equivalent - its compaction hook for session state management

## Date

2026-06-18 (ADR), 2026-06-23 (implementation notes)
