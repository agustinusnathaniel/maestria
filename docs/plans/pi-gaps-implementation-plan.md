# Implementation Plan: `@maestria/pi` Gap Fixes

## Goal

Deliver a complete v0.2.0 of `@maestria/pi` by closing all identified gaps across 4 tiers: methodology-breaking fixes, feature completeness, and polish.

## Phases Overview & Dependency Graph

```
Phase 1 ──→ Phase 5 ──→ Phase 7
  │                      ↑
  ↓                      │
Phase 4 ────────────────┘
  │
  ↓
Phase 5

Phase 2 ──→ Phase 5
Phase 3 (no deps)
Phase 6 (no deps)
Phase 8 (no deps)
```

**Dependencies:**

- Phase 5 (state persistence) depends on Phase 1, 2, 4 (all code paths that mutate state must exist first)
- Phase 7 (cross-extension events) depends on Phase 1 (review events) and Phase 4 (subagent lifecycle events)
- Phases 3, 6, 8 are fully independent

**Rollback points exist after every phase** - each phase is independently verifiable.

---

## Phase 1 - Review Model Cycling (Tier 1, Gap #1)

**Effort:** Medium  
**Dependencies:** None  
**Files:** `src/state.ts`, `src/commands.ts`, `tests/commands.test.ts`, `tests/state.test.ts`

### Changes

#### 1a. Add `reviewModel` to `MaestriaState` (`state.ts`)

- Add field: `reviewModel: string | null` to the `MaestriaState` interface
- Initialize as `null` in `createInitialState()`
- Update `NEW_STATE_KEYS` array in test file to include `reviewModel`

#### 1b. Model switching in `/review` handler (`commands.ts`)

In the `/review` command handler, after saving original model and restricting tools:

1. Determine review model: use `state.reviewModel` if set, otherwise attempt to find a different-provider model via `ctx.modelRegistry.getAll()`, fall back to current model if no alternative
2. Call `await pi.setModel(reviewModel)` to switch
3. Persist via `pi.appendEntry('maestria_state', state)`

If `setModel` fails, log/notify but don't block entering review mode.

**Important:** `pi.getAllModels()` is not available in the API; use `ctx.modelRegistry.getAll()` instead (already used in `restoreOriginalState`).

#### 1c. Add `/review-model <model>` command (`commands.ts`)

```ts
pi.registerCommand('review-model', {
  description: 'Set which model to use when entering review mode',
  handler: async (args: string, ctx) => {
    if (!args.trim()) {
      ctx.ui.notify('Usage: /review-model <model-id> - set the review model');
      return;
    }
    const modelId = args.trim();
    // Validate against available models
    const models = ctx.modelRegistry.getAll();
    const model = models.find((m: { id: string }) => m.id === modelId);
    if (!model) {
      ctx.ui.notify(
        `Unknown model: "${modelId}". Available: ${models.map((m: { id: string }) => m.id).join(', ')}`,
      );
      return;
    }
    state.reviewModel = modelId;
    pi.appendEntry('maestria_state', state);
    ctx.ui.notify(`Review model set to: ${modelId}`);
  },
});
```

#### 1d. Update `restoreOriginalState` to also clear `reviewModel` (`state.ts`)

The `exitReviewMode` function already clears `originalModel` and `originalTools`. No changes needed - `reviewModel` should persist across review sessions (it's a preference, not a session state).

#### 1e. Update `renderMaestriaSummary` (`state.ts`)

Optionally add review model to summary when set:

```
if (state.reviewModel) {
  parts.push(`**Review Model:** ${state.reviewModel}`);
}
```

#### 1f. Tests

- Add `reviewModel` to `NEW_STATE_KEYS` in `state.test.ts`
- Test `/review` handler calls `pi.setModel()` with the configured review model
- Test `/review` handler falls back to different-provider model when no `reviewModel` configured
- Test `/review-model` validates model exists and sets `state.reviewModel`
- Test `/review-model` with unknown model shows error

### Success Criteria

- [ ] `reviewModel` field exists in `MaestriaState`, defaults to `null`
- [ ] `/review` calls `pi.setModel()` with review model (not just restricts tools)
- [ ] `/review-model <model>` sets the review model and persists it
- [ ] `/review-model` with invalid model returns error
- [ ] All existing tests still pass

### Rollback Point

Commit after 1a-1f. If `/review` model switching breaks, revert this phase. The new state field is additive and non-breaking.

---

## Phase 2 - `/handoff` Command (Tier 1, Gap #3)

**Effort:** Medium  
**Dependencies:** None  
**Files:** `src/commands.ts`, `tests/commands.test.ts`

### Changes

#### 2a. Register `/handoff <goal>` command (`commands.ts`)

```ts
pi.registerCommand('handoff', {
  description: 'Generate a structured handoff prompt for a new task context',
  handler: async (args: string, ctx) => {
    if (!args.trim()) {
      ctx.ui.notify('Usage: /handoff <goal> - describe the task context for handoff');
      return;
    }

    // Build a structured handoff document with 6 fields
    const handoffPrompt = [
      `**Goal:** ${args}`,
      '',
      '**Context:**',
      `- Mode: ${state.mode ?? 'none'}`,
      `- Active task: ${state.activeTask || 'none'}`,
      `- Specialists delegated: ${state.specialistsDelegated.join(', ') || 'none'}`,
      `- Recent handoffs: ${state.handoffHistory.length} entries`,
      `- Files modified: ${state.filesModified.join(', ') || 'none'}`,
      '',
      '**Requirements:**',
      '(fill in specific requirements)',
      '',
      '**Known problems:**',
      state.blockers.length > 0
        ? state.blockers.map((b) => `- ${b}`).join('\n')
        : '(no known problems documented)',
      '',
      '**Success criteria:**',
      '(fill in how to verify completion)',
      '',
      '**Next step:**',
      '(fill in what happens after this task)',
      '',
      '---',
      'Complete the fields above before sending.',
    ].join('\n');

    // Record in state
    state.handoffHistory = [
      { from: 'current', to: 'next', task: args, timestamp: Date.now() },
      ...state.handoffHistory,
    ].slice(0, 5);
    pi.appendEntry('maestria_state', state);

    // Send as user message - triggers a new agent turn with the handoff context
    pi.sendUserMessage(handoffPrompt, { deliverAs: 'steer' });
  },
});
```

**Design decision:** `sendUserMessage` with `deliverAs: 'steer'` is used rather than forking, because Pi may not expose `sessionManager.fork()`. This creates a steer message that the agent responds to with the handoff content as context.

#### 2b. Tests

- Test `/handoff` registers as a command
- Test `/handoff <goal>` generates output containing all 6 field headers
- Test `/handoff` without args shows usage
- Test `/handoff` records entry in handoffHistory and calls `pi.appendEntry`
- Test `/handoff` calls `pi.sendUserMessage` with `deliverAs: 'steer'`
- Update `integration.test.ts` to expect `/handoff` among registered commands

### Success Criteria

- [ ] `/handoff <goal>` generates structured prompt with all 6 fields
- [ ] State fields are interpolated into the handoff (mode, activeTask, blockers, etc.)
- [ ] `pi.sendUserMessage` is called with `steer` delivery
- [ ] Handoff is recorded in state and persisted
- [ ] Integration test registers the command

### Rollback Point

Commit after 2a-2b. The `/handoff` command is additive and has no impact on existing functionality.

---

## Phase 3 - Orchestrator Prompt Sync (Tier 1, Gap #2)

**Effort:** Small  
**Dependencies:** None  
**Files:** `prompts/orchestrator.md`

### Changes

#### 3a. Re-add "Skills for Subagents" section

Copy from `packages/opencode/agents/orchestrator.md` but remove unreachable `npx skills` install steps (Pi doesn't have `enableSkillCommands: true` like OpenCode does).

The section should include:

- **Proactive Path** - Before every `maestria_subagent()` call, identify skills
- **Reactive Path** - Subagent suggests a skill you didn't include
- **Guard Rails** - Don't memorize flags, install directly
- **Skip Behavior** - User declines? Spawn anyway
- **Project Skill Discovery** - Scan available_skills
- **Miss Handling** - If subagent can't find a skill

**Pi-specific adaptations:**

- Replace `skill` tool references with "load via Pi's skill mechanism"
- Remove `npx --yes skills@latest` install steps (Pi doesn't have this tool)
- Replace `question()` references to match Pi's API

#### 3b. Fix `maestria_subagent` tool docs

Current text says "await agent's completion" but `@gotgenes/pi-subagents` is event-driven (polling). Update to:

```
The maestria_subagent() tool spawns a subagent and polls for completion.
The spawn is synchronous (returns an ID), then the tool polls until the
subagent reaches a terminal status (completed, steered, aborted, stopped, error).
Status updates are delivered via the tool's onUpdate callback.
```

#### 3c. Re-add Human-in-the-Loop section

```
## Human-in-the-Loop

Always use the `question` tool when you need user input. Do not output
questions as plain text - the `question` tool creates an interactive
prompt that pauses execution and waits for a response.

Propose actions and wait for approval for:

- Database migrations
- Production deployments
- Security changes
- Architecture decisions
- Ambiguity flags from subagents
- Any decision where the user's preference matters

Exception: Status updates and progress reports are text output, not questions.
```

#### 3d. Re-add Anti-Patterns section

```
## Anti-Patterns

- **Agent ping-pong** - agents endlessly passing work back and forth
- **Coordination overhead** - spending more time coordinating than working
- **Unclear ownership** - multiple agents assuming responsibility for same task
- **Silent failures** - agent failing without notifying others
- **Builder bias** - defaulting to @builder when a more specialized specialist fits
- **Auto-committing** - committing after every work cycle without asking
```

#### 3e. Update delegation docs

- Replace all `subagent()` references with `maestria_subagent()` to match the registered tool name
- Update "Parallel Fan-Out" docs to show `maestria_subagent()` calls instead of `subagent()`/`task()`
- Update commit protocol to use `maestria_subagent()` instead of `task()`

### Success Criteria

- [ ] "Skills for Subagents" section present (no `npx skills` references)
- [ ] Tool docs accurately describe event-driven polling (not "await completion")
- [ ] "Human-in-the-Loop" section present
- [ ] "Anti-Patterns" section present
- [ ] All delegation examples use `maestria_subagent()` not `subagent()`/`task()`
- [ ] Comment at top still says `<!-- Source: packages/opencode/agents/orchestrator.md - keep in sync -->`

### Rollback Point

Commit after 3a-3e. This is a prompt-only change; `git checkout -- packages/pi/prompts/orchestrator.md` restores original.

---

## Phase 4 - Subagent Parallel/Chain Modes (Tier 2, Gap #4)

**Effort:** Large  
**Dependencies:** None (but will need to update tests from Phase 1 for any state changes)  
**Files:** `src/subagent.ts`, `tests/subagent.test.ts`

### Changes

#### 4a. Add `tasks` array parameter to `maestria_subagent` tool

Current parameter schema:

```ts
parameters: Type.Object({
  agent: Type.String(),
  task: Type.String(),
});
```

New schema (backward-compatible with single dispatch):

```ts
parameters: Type.Object({
  agent: Type.Optional(Type.String()),
  task: Type.Optional(Type.String()),
  tasks: Type.Optional(
    Type.Array(
      Type.Object({
        agent: Type.String(),
        task: Type.String(),
      }),
    ),
  ),
  mode: Type.Optional(
    Type.Union([Type.Literal('parallel'), Type.Literal('chain'), Type.Literal('single')]),
  ),
});
```

Validation rules:

- `mode='single'` (default): `agent` and `task` are required; `tasks` ignored
- `mode='parallel'`: `tasks` is required (2-8 items); `agent`/`task` ignored
- `mode='chain'`: `tasks` is required (2+ items); `agent`/`task` ignored

#### 4b. Add `MAX_PARALLEL_TASKS` constant

```ts
const MAX_PARALLEL_TASKS = 8;
```

#### 4c. Implement parallel dispatch

When `mode === 'parallel'`:

1. Validate 2 <= tasks.length <= MAX_PARALLEL_TASKS
2. Dispatch all tasks to `service.spawn()` in a loop
3. Collect all spawned IDs
4. Poll all IDs simultaneously (use `Promise.all` on individual poll promises)
5. Aggregate results into a single response
6. Record all handoffs in state

#### 4d. Implement chain dispatch

When `mode === 'chain'`:

1. Validate tasks.length >= 2
2. Spawn first task
3. Wait for completion, capture result
4. For each subsequent task, replace `{previous}` placeholder in `task` string with previous result
5. Spawn next task, wait, capture
6. Continue until all tasks complete
7. Return final result

#### 4e. Update `execute` function signature

Current signature handles single dispatch. Refactor to:

1. Normalize inputs: if `tasks` is provided, use it; otherwise create a single-element `[{ agent, task }]`
2. Route to the appropriate dispatcher based on `mode`
3. Return aggregated/handled result

#### 4f. Tests

- Test single dispatch still works (backward compat)
- Test parallel dispatch with 3 tasks
- Test parallel dispatch with >8 tasks throws error
- Test parallel dispatch with 1 task throws error
- Test chain dispatch with 2 tasks
- Test chain dispatch with `{previous}` placeholder substitution
- Test chain dispatch with 1 task throws error
- Test validation: `mode='chain'` without `tasks` throws

### Success Criteria

- [ ] `tasks` array parameter accepted alongside existing `agent`/`task`
- [ ] Parallel mode dispatches 2-8 tasks concurrently
- [ ] Chain mode pipes results through `{previous}` placeholder
- [ ] Backward compatible - existing single-agent calls unchanged
- [ ] `MAX_PARALLEL_TASKS = 8` exported
- [ ] All handoffs recorded in state

### Rollback Point

Commit after 4a-4f. The tool definition is backward compatible - existing `maestria_subagent({ agent, task })` calls work identically.

---

## Phase 5 - State Persistence Consistency (Tier 2, Gap #5)

**Effort:** Small  
**Dependencies:** Phase 1, Phase 2, Phase 4 (needs all mutation paths to exist)  
**Files:** `src/extension.ts`, `src/commands.ts`, `src/modes.ts`, `src/subagent.ts`, `tests/`

### Changes

#### 5a. Audit all state mutation paths

Review every `Object.assign(state, ...)` and direct state mutation for persistence calls:

| Location | Current Persistence | Action |
| --- | --- | --- |
| `commands.ts` - `/orchestrate` handler | None (restores from review) | Add `pi.appendEntry` |
| `commands.ts` - `/review` handler | Has `pi.appendEntry` | ✅ OK |
| `commands.ts` - `/restore-model` handler | None (clears review via `restoreOriginalState`) | Add `pi.appendEntry` |
| `commands.ts` - `/review-model` handler | Has `pi.appendEntry` (from Phase 1) | ✅ OK |
| `commands.ts` - `/handoff` handler | Has `pi.appendEntry` (from Phase 2) | ✅ OK |
| `modes.ts` - mode commands | None (sets `state.mode`) | Add `pi.appendEntry` |
| `subagent.ts` - handoff recording | Has `pi.appendEntry` | ✅ OK |
| `subagent.ts` - subagent status updates | No (mutates `state.subagentStatus` directly) | Add `pi.appendEntry` on terminal status changes |

#### 5b. Create persistence helper

Add a helper function to `state.ts`:

```ts
export function persistState(pi: ExtensionAPI, state: MaestriaState): void {
  pi.appendEntry('maestria_state', { ...state });
}
```

This ensures consistent entry shape.

#### 5c. Fix missing persistence calls

- `commands.ts` `/orchestrate`: Add `persistState(pi, state)` after state mutation
- `commands.ts` `/restore-model`: Add `persistState(pi, state)` after state mutation
- `modes.ts` mode commands: Add `persistState(pi, state)` after `state.mode = keyword`
- `subagent.ts`: Add `persistState(pi, state)` in subagent status update callbacks (started, completed, failed, steered)

#### 5d. Tests

- Add test for `/orchestrate` persisting state
- Add test for `/restore-model` persisting state
- Add test for mode commands persisting state
- Add test for subagent status updates persisting state
- Add unit test for `persistState` helper

### Success Criteria

- [ ] Every mutation path calls `pi.appendEntry` or `persistState`
- [ ] Persistence helper exists in `state.ts`
- [ ] Subagent status mutations persist on start/completion/failure
- [ ] All existing tests pass

### Rollback Point

Commit after 5a-5d. Each persistence call is additive and non-breaking.

---

## Phase 6 - `isToolCallEventType` Refactor (Tier 2, Gap #6)

**Effort:** Small  
**Dependencies:** None  
**Files:** `src/tools.ts`, `tests/tools.test.ts`

### Changes

#### 6a. Import `isToolCallEventType` (`tools.ts`)

```ts
import { isToolCallEventType } from '@earendil-works/pi-coding-agent';
```

#### 6b. Replace fragile `event.toolName` checks

In the `tool_call` handler, replace:

```ts
if (state.reviewMode && DESTRUCTIVE_TOOLS.has(event.toolName)) {
```

With typed guards:

```ts
if (state.reviewMode) {
  if (
    isToolCallEventType('edit', event) ||
    isToolCallEventType('write', event) ||
    isToolCallEventType('bash', event)
  ) {
    return {
      block: true,
      reason: 'Review mode is active. Report findings, do not edit.',
    };
  }
}
```

Replace the dangerous pattern check:

```ts
if (isToolCallEventType('bash', event)) {
  const command = event.input.command;
  // ... pattern checking
}
```

#### 6c. Update `DESTRUCTIVE_TOOLS` set

Remove the set if no longer needed, or keep for clarity. The set can remain as a documentation mechanism but the actual blocking uses `isToolCallEventType`.

#### 6d. Tests

- Test `installToolInterceptors` uses `isToolCallEventType` calls (test via `event.toolName` matching - the function still returns the same result shape)
- Verify backward compatibility: all existing tests pass unchanged

### Success Criteria

- [ ] `isToolCallEventType` imported from `@earendil-works/pi-coding-agent`
- [ ] All `event.toolName` string comparisons replaced with typed guards
- [ ] `DESTRUCTIVE_TOOLS` set updated or removed
- [ ] All existing tests pass

### Rollback Point

Commit after 6a-6d. Pure refactor with identical behavior.

---

## Phase 7 - Cross-extension Events via `pi.events` (Tier 3, Gap #7)

**Effort:** Medium  
**Dependencies:** Phase 1 (review mode), Phase 4 (subagent lifecycle)  
**Files:** `src/commands.ts`, `src/subagent.ts`, `src/state.ts`, `tests/`

### Changes

#### 7a. Define event type constants

Add to `subagent.ts` or a new `events.ts`:

```ts
export const MAESTRIA_EVENTS = {
  REVIEW_ACTIVATED: 'maestria:review:activated',
  REVIEW_DEACTIVATED: 'maestria:review:deactivated',
  SUBAGENT_STARTED: 'maestria:subagent:started',
  SUBAGENT_COMPLETED: 'maestria:subagent:completed',
} as const;
```

#### 7b. Emit review events in commands

In `/review` handler (`commands.ts`), after successful model switch:

```ts
pi.events?.emit(MAESTRIA_EVENTS.REVIEW_ACTIVATED, {
  originalModel,
  reviewModel,
});
```

In `/restore-model` handler, after restoration:

```ts
pi.events?.emit(MAESTRIA_EVENTS.REVIEW_DEACTIVATED, {
  originalModel,
  reviewModel,
});
```

In `/orchestrate` handler when exiting review mode:

```ts
pi.events?.emit(MAESTRIA_EVENTS.REVIEW_DEACTIVATED, {
  originalModel: state.originalModel,
});
```

#### 7c. Emit subagent lifecycle events

In the `SUBAGENT_EVENTS.STARTED` handler in `subagent.ts`:

```ts
pi.events?.emit(MAESTRIA_EVENTS.SUBAGENT_STARTED, { id, type });
```

In the `SUBAGENT_EVENTS.COMPLETED` handler:

```ts
pi.events?.emit(MAESTRIA_EVENTS.SUBAGENT_COMPLETED, {
  id,
  type: existing?.type,
  status: 'completed',
});
```

Note: `pi.events` is already used for subagent lifecycle subscriptions. We're now also _emitting_ maestria-specific events so other extensions can react.

#### 7d. Event naming convention

Use `maestria:<domain>:<action>` as the event naming pattern to avoid collisions with Pi's built-in events.

#### 7e. Tests

- Test review mode emits `maestria:review:activated` event
- Test review mode exit emits `maestria:review:deactivated` event
- Test subagent start emits `maestria:subagent:started` event
- Test subagent completion emits `maestria:subagent:completed` event
- Test that `pi.events` availability is guarded (existing null-check pattern)

### Success Criteria

- [ ] `MAESTRIA_EVENTS` constants defined
- [ ] Review activation emits `maestria:review:activated`
- [ ] Review deactivation emits `maestria:review:deactivated`
- [ ] Subagent started emits `maestria:subagent:started`
- [ ] Subagent completed emits `maestria:subagent:completed`
- [ ] `pi.events?.emit()` guarded (safe when `pi.events` is undefined)

### Rollback Point

Commit after 7a-7e. Events are additive and non-breaking.

---

## Phase 8 - Build/Provenance Cleanup (Tier 3, Gap #8)

**Effort:** Small  
**Dependencies:** None  
**Files:** `package.json`, `tests/integration.test.ts`

### Changes

#### 8a. Add provenance to publishConfig (`package.json`)

```json
"publishConfig": {
  "access": "public",
  "provenance": true
}
```

#### 8b. Add `pi-package` keyword (`package.json`)

```json
"keywords": ["pi-package", "maestria", "agent-orchestration"]
```

(The `keywords` field doesn't exist yet - add it.)

#### 8c. Integration test scaffold

Create `tests/integration.test.ts` additions - the file already exists. Add test cases:

```ts
it('package.json has publishConfig.provenance', () => {
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf-8'));
  expect(pkg.publishConfig?.provenance).toBe(true);
});

it('package.json has pi-package keyword', () => {
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf-8'));
  expect(pkg.keywords).toContain('pi-package');
});
```

### Success Criteria

- [ ] `publishConfig.provenance: true` in package.json
- [ ] `pi-package` keyword in package.json
- [ ] Integration test validates both metadata fields
- [ ] `vp check` and `vp test` pass

### Rollback Point

Commit after 8a-8c. Metadata changes and test additions are safe.

---

## Verification Strategy

### Per-phase verification

Each phase has its own success criteria checklist (inlined above). Run:

```bash
vp check    # Format + lint + type check
vp test     # Run all tests
```

After each phase, both commands must pass cleanly.

### Integration smoke test

After all phases complete, run the full suite:

```bash
vp check && vp test
```

And verify the extension loads by checking `dist/extension.mjs` was generated.

### Manual spot checks

1. Start a Pi session with `@maestria/pi` installed
2. `/review-model gpt-4o` - should confirm model set
3. `/review audit auth module` - should switch model and restrict tools
4. `/restore-model` - should restore original
5. `/handoff implement user auth` - should generate structured prompt
6. `/orchestrate build feature` - should exit review mode
7. `maestria_subagent({ tasks: [...], mode: 'parallel' })` - test parallel dispatch
8. `maestria_subagent({ tasks: [...], mode: 'chain' })` - test chain dispatch

---

## Assumptions

1. **`isToolCallEventType` is stable** - Assumed to be the correct typed guard function exported from `@earendil-works/pi-coding-agent`. The version we checked (0.79.9) exports it.
2. **`ctx.modelRegistry.getAll()` is the correct API for model enumeration** - Already used in `restoreOriginalState`, so this is validated.
3. **`pi.events.emit()` signature** - Assumed to match `EventBus.emit(event: string, data: unknown): void` pattern (based on the `createEventBus` export).
4. **`pi.sendUserMessage()` with `steer` delivery is the correct handoff mechanism** - Pi may not expose `sessionManager.fork()` to extensions. Steer messages are the closest alternative.
5. **`pi.getAllModels()` is not available** - We use `ctx.modelRegistry.getAll()` instead.
6. **Backward compatibility is required** - The `maestria_subagent` tool must remain named exactly `maestria_subagent` and support existing `{ agent, task }` calls unchanged.
7. **Review model preference should persist across sessions** - `reviewModel` is not cleared by `exitReviewMode`; it's a user preference, not session state.

---

## What Was NOT Planned / Is Unclear

1. **Model cycling in `/restore-model`** - The current `restoreOriginalState` already calls `pi.setModel()` with the original model. The gap is that `/review` never calls `pi.setModel()` to switch _to_ a review model. This is fixed in Phase 1.
2. **`pi.getAllModels()` exploration** - Not available in the API. Using `ctx.modelRegistry.getAll()` as established pattern.
3. **Fork vs. steer for `/handoff`** - Forking a Pi session requires `sessionManager.fork()` which may not be exposed to extensions. Using `sendUserMessage` with `steer` as the safest cross-version approach.
4. **Subagent service ability for parallel dispatch** - The `@gotgenes/pi-subagents` service exposes `service.spawn()` which returns synchronously. We assume spawning multiple in sequence, then polling all concurrently, will work. If `service.spawn()` has side effects that prevent concurrent agents, chain mode becomes the only viable multi-agent pattern.

---

## Next Step

Delegate execution to `@orchestrator` who will dispatch each phase to the appropriate specialist (`@builder` for implementation, `@adventurer` if deeper API exploration is needed).
