# ADR-PI-002: Compaction State Preservation

## Status

Accepted

## Context

Pi's compaction summarization is lossy by default. When the context window fills up, the older messages are summarized and recent messages are kept. The maestria methodology has state that must survive compaction:

- The active task (user's current goal)
- The completion promise ("This task is complete when...")
- Blockers
- File references (read / modified)
- Recent handoffs (who handed off to whom, with what)
- Review state (is review mode active? what model?)

Without preservation, the post-compaction turn has no memory of these. The methodology breaks.

The choices:

1. **Append to Pi's default summary** - Pi's `session_before_compact` returns a `compaction` object that **replaces** the default summary. We can't append; we must include the maestria state in our returned summary.
2. **Use the `details` field** - Pi's compaction has a `details` field for custom data. The LLM may or may not see this.
3. **Module-scope state plus pre-compaction render** - the extension maintains `MaestriaState` in module scope, renders it to markdown on `session_before_compact`, and includes the render in the returned summary.

## Decision

**Choose: Option 3 - module-scope state, render at compaction time, include in the returned summary.**

The `MaestriaState` is maintained by event handlers (`before_agent_start` for `activeTask`, `tool_call` for file tracking, `subagent` tool invocations for `handoffHistory`, `/review` command for `reviewMode`).

On `session_before_compact`, the extension renders `MaestriaState` to a markdown summary and returns it as the `compaction.summary` field. The render includes:

- ## Goal (activeTask)
- ## Completion Promise
- ## Blockers
- ## Files Modified
- ## Files Read
- ## Recent Handoffs
- ## Review State

The orchestrator prompt template has a "Post-Compaction Recovery" section that tells the LLM to read this block and resume from the saved state.

The `details` field is also populated with the structured `MaestriaState` object, for future-proofing.

**State Recovery:** Recovery is advisory, not automatic. The LLM reads the state block from the compaction summary and resumes. Explicit instructions in the orchestrator prompt mitigate misreads.

For full session persistence (survives `/reload` and `/new`), `pi.appendEntry` would be needed. This is deferred to v1.1.

## Consequences

- Positive: All methodology-relevant state survives compaction.
- Positive: State rendered as plain markdown, readable by LLM.
- Positive: `details` field populated for future-proofing.
- Negative: State is advisory, not enforced. LLM may misread.
- Negative: State doesn't survive `/reload` or `/new`.
- Negative: Blockers and handoffs are textual, not structured.

## Alternatives Considered

- **Pi's default compaction** - generic, doesn't preserve maestria state.
- **Append-only state** - not possible since `compaction.summary` is wholesale replacement.
- **State persistence via `pi.appendEntry`** - would survive `/reload` but requires more code. Deferred to v1.1.

## References

- Pi `session_before_compact` event - `session_before_compact` event docs
- Pi `CompactionEntry` structure - Pi compaction API docs
- OpenCode equivalent - `packages/opencode/src/index.ts` (compaction hook for session state management)

## Implementation Notes (Post-Implementation)

### ✅ `MaestriaState` Module-Scope Object Implemented

Module-scope `MaestriaState` object implemented in `packages/pi/src/state.ts`. The object tracks all 7 fields (activeTask, completionPromise, blockers, filesRead, filesModified, handoffHistory, reviewMode) and is importable across the extension.

### ✅ State Renderer Produces Markdown Summary

The `renderState()` function in `packages/pi/src/state.ts` produces a markdown summary with all 7 fields. Each field renders as a level-2 heading followed by its content, with lists for blockers, file references, and handoffs.

### ✅ Rendered Summary Returned as `compaction.summary`

On `session_before_compact`, the rendered markdown is returned as the `compaction.summary` field. This replaces the default Pi compaction summary entirely with maestria-aware state.

### ✅ `details` Field Populated with Structured State

The raw `MaestriaState` object is also serialized into the `compaction.details` field for future-proofing - enabling structured access if Pi's compaction API evolves to support `details`-based recovery.

### ✅ Orchestrator Prompt Includes "Post-Compaction Recovery" Section

The orchestrator prompt template (`packages/pi/src/prompts/orchestrator.md`) includes a "Post-Compaction Recovery" section that instructs the LLM to:

1. Read the state block from the compaction summary
2. Restore the active task
3. Acknowledge the completion promise
4. Re-establish blockers and file references
5. Resume the last handoff context

### ⏳ `pi.appendEntry`-Based Persistence Deferred to v1.1

Full session persistence that survives `/reload` and `/new` requires `pi.appendEntry` to write state to the session log. This is deferred to v1.1 (see ADR-PI-000 for v1.1 scope and timeline).

## Date

2026-06-18 (ADR), 2026-06-23 (implementation notes)
