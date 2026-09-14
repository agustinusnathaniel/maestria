# ADR-PI-000: Reuse existing Pi ecosystem packages for subagent dispatch and workflow

## Status

Accepted

## Terminology

**Pi extension** - a `.ts`/`.js` file exporting a default function `(pi: ExtensionAPI) => void`. It hooks into Pi's lifecycle by registering tools (`pi.registerTool()`), commands (`pi.registerCommand()`), and event handlers (`pi.on()`). The extension IS the code that runs.

**Pi package** - an npm/git/local package with a `pi` manifest field in `package.json`, containing extensions, skills, prompts, themes, or other resources. The package IS the container; the extension IS the code. A package can ship multiple extensions, and an extension always lives inside a package.

## Context

The `@maestria/pi` plan (Phase 0) originally assumed building the subagent dispatch tool, workflow engine, and specialist isolation from scratch. The package-design plan (§4.5) specified a custom `subagent` tool spawning `pi` subprocesses directly via `node:child_process.spawn`.

A pre-implementation survey found a large Pi ecosystem with several subagent-dispatch packages (in-process and subprocess) and workflow/orchestration packages, actively maintained, MIT/Apache-2.0 licensed, with typed TypeScript APIs. Building from scratch would duplicate mature, tested functionality. The key differentiator of `@maestria/pi` is **spec-driven orchestration** (phase gates, agent contracts, handoff validation) plus **session tree integration**, not basic subagent dispatch.

The following options were evaluated:

| Option | Approach | Viability |
| --- | --- | --- |
| **A: @gotgenes/pi-subagents** | In-process via Pi SDK. Typed `SubagentsService` API (`spawn()`, sync `getRecord()`, `SUBAGENT_EVENTS`), `.md` agent registry, concurrency limiter, recursion guard, per-agent `tools:` restriction. | **Selected.** The programmatic dispatch API and agent registration maestria needs, with synchronous `getRecord()` for the poll loop. All 6 requirements met. |
| **B: pi-subagents (nicobailon)** | Self-contained extension; LLM `subagent` tool; `.md` agent types. No programmatic API or lifecycle events. | **Not suitable.** No programmatic spawn or sync `getRecord()`; async RPC breaks the poll loop. |
| **C: Build own dispatch** | `createAgentSession()` from scratch. | **Possible but high cost.** Undocumented SDK internals; effectively rebuilding @gotgenes. |
| **D: @tintinweb/pi-subagents** | Upstream of @gotgenes; `Symbol.for()` + event-bus RPC; `.md` types, `tools:`/`disallowed_tools:`. No typed API. | **Not suitable.** No typed programmatic API; async event-reply breaks the sync loop (why the fork exists). |
| **E: @quintinshaw/pi-dynamic-workflows** | Full DAG workflow engine: sync `runId`, `getRun()` polling, `loadAgentRegistry()`, `applyToolPolicy()`, `EventEmitter`. | **Not selected.** Meets all 6 requirements but creates dual orchestration with maestria's pipeline. Suited to v1.1 if workflow features are needed. |
| **F: pi-taskflow** | DAG engine; `.md` types, `tools:`. No programmatic spawn, sync status, or lifecycle events. | **Not suitable.** Async-only. |
| **G: @narumitw/pi-subagents** | Minimal LLM-only tool; `.md` types, `tools:`. No programmatic API or events. | **Not suitable.** No programmatic API or lifecycle events. |
| **H: @mjasnikovs/pi-task** | Task queue, 4 worker types, `/task` commands. No programmatic spawn, sync status, or events. | **Not suitable.** LLM-triggered tasks only. |
| **I: gentle-pi** | Development harness (SDD, TDD, reviews); no dispatch. | **Not suitable.** Expects subagents from other extensions. |
| **J: pi-soly** | Internal workflow management; avoids subagent dependency. | **Not suitable.** Avoids the pattern maestria needs. |

## Evaluation

### Assessment criteria

| Criterion | Weight | Why |
| --- | --- | --- |
| Programmatic API (spawn from code, not just an LLM tool) | Critical | `maestria_subagent` calls `service.spawn()` from `execute()` |
| Custom agent types (our 7 specialists with role prompts) | Critical | Separate system prompts per specialist |
| Tool restriction per specialist | Critical | builder=write, reviewer=read-only (maker/checker split) |
| Lifecycle event tracking | Critical | Session state needs start/complete/fail events |
| Synchronous spawn + status polling | Critical | The spawn-and-poll loop calls `getRecord()` |
| In-process (no subprocess overhead) | Hard requirement | Avoids subprocess cold-start cost |
| Production quality | High | timeouts, abort, error handling, concurrency limits |
| Low user friction | Medium | auto-install via CLI mitigates extra peer dep |

### Option comparison

Option A is the only candidate with a typed programmatic API, synchronous spawn and status, custom agent types, per-agent tool restriction via `tools:` frontmatter, and lifecycle events, at low dependency risk and designed for extension authors. B, C, and D each fail at least one critical need.

### Verdict

**Option A: @gotgenes/pi-subagents is the best choice for maestria.**

The decisive factor is the typed programmatic API. Maestria's dispatch model needs synchronous `spawn()` returning an ID, synchronous `getRecord(id)` polling in `pollSubagent`, synchronous `abort(id)`, a typed `SubagentRecord` (`status`, `result`, `error`), and `SUBAGENT_EVENTS` lifecycle subscription.

Options B and D wrap async event-bus RPC (spawn ID on a reply channel, status as events, no synchronous `getRecord(id)`), which conflicts with maestria's spawn-then-poll loop.

Option C is a false economy: `createAgentSession()` is a low-level LLM session factory, not a managed subagent engine. A production engine needs lifecycle management, a concurrency limiter, an agent registry, per-agent tool restriction, lifecycle events, abort propagation, error recovery, and timeout cleanup - exactly what @gotgenes covers.

The fork exists because upstream (D) lacked the typed API extension authors need. Its README states: "A focused, in-process sub-agent core for pi - autonomous agents plus a typed API and lifecycle events other extensions build on."

**Tradeoffs:** lower download count than upstream but actively maintained; lags upstream on features maestria doesn't need (memory, worktree isolation, scheduling, fleet view); adds a peer dependency where Pi SDK primitives could be used, though the SDK is lower level than it appears.

**Long-term:** if the package becomes unmaintained, Option C becomes viable; the `maestria_subagent` wrapper around `service.spawn()` and the independent agent file deployment leave a clean migration seam.

### Additional packages evaluated

Six additional Pi gallery packages were evaluated in a follow-up survey (July 2026). Only `@quintinshaw/pi-dynamic-workflows` (Option E) satisfies all 6 requirements, but it is a full DAG workflow engine that would create dual orchestration with maestria's role-based pipeline. The other five fail on at least 3 requirements, most commonly missing a programmatic spawn API. The survey confirms Option A for maestria's current architecture.

## Decision

### Depend on `@gotgenes/pi-subagents` for subagent dispatch

**Package:** `@gotgenes/pi-subagents@^18.0.0` **License:** MIT **Approach:** in-process subagent spawning via Pi SDK

`@gotgenes/pi-subagents` provides:

- **In-process subagent spawning** - no subprocess overhead
- **Typed API** - TypeScript-first, with `SubagentsService` and `WorkspaceProvider` interfaces
- **Lifecycle events** - `subagents:*`, `subagents:child:*` for orchestrator hooking
- **Recursion guard** - subagents cannot spawn their own subagents (by design)
- **Workspace provider seam** - for future worktree isolation
- **Layered settings config** - package defaults with user overrides

`@maestria/pi` adds on top:

1. **Spec-driven orchestration** - each specialist's assigned spec travels with the handoff contract; phase gates validate completion before the next stage begins.
2. **Session tree integration** - each subagent invocation records its parent task ID for session tree reconstruction.
3. **Structured cross-agent context** - handoff contracts are validated before dispatch (7-field pre-check), not just advisory. _Corrected 2026-09-11: the field-level pre-check was removed; dispatch now asserts the specialist name and a non-empty task only. See the implementation note below._

### Defer `pi-crew` and `pi-dynamic-workflows` to v1.1

Both packages overlap `@maestria/pi`'s v1.1 roadmap:

- `pi-crew` (Apache-2.0) - multi-agent orchestration with DAG execution, parallel dispatch, and cost accounting
- `@quintinshaw/pi-dynamic-workflows` (MIT) - workflow fan-out with retry and state persistence

At v1, they lack spec-driven contracts, the differentiator. Re-evaluate when v1.0 spec-driven orchestration ships.

### No dependency on `pi-subagentura`

Smaller ecosystem, less active maintenance, and `@gotgenes/pi-subagents` already provides the in-process model with a stronger API.

## Consequences

- Positive: substantially less code than building the subagent tool from scratch; an adapter layer replaces subprocess management.
- Positive: proven runtime with active maintenance, mitigating sponsor-abandonment risk.
- Positive: the `SubagentsService` cross-extension API lets other Pi extensions interoperate with maestria dispatches.
- Positive: in-process execution shares session context and avoids subprocess cold-start overhead.
- Neutral: the recursion guard blocks nested subagents; maestria's orchestration correctly sits above the subagent layer.
- Negative: peer dependency on `@gotgenes/pi-subagents` (which does not bundle Pi core); it must be listed in `dependencies` with the `^18.0.0` range.
- Negative: if Pi's API changes, both packages may need updates. Mitigated by pinning to a minor range.
- Risk: `v18` is still pre-1.0 and may change. Mitigation: pin `^18.0.0`, treat it as any pre-1.0 transitive dependency, and rely on the MIT source for a fork as a last resort.

## References

- Pi ecosystem survey - `pi.dev/packages` search results (June 2026)
- `@gotgenes/pi-subagents` - `pi install npm:@gotgenes/pi-subagents`
- `pi-crew` - `pi install npm:@gotgenes/pi-crew` (deferred to v1.1)
- `@quintinshaw/pi-dynamic-workflows` (deferred to v1.1)
- `@maestria/pi` package design - Package design plan §4.5 - adapter design for @gotgenes/pi-subagents
- Risks documented in the plan's risk register - R-16 (pre-1.0 vendor dependency), R-17 (Pi API instability), O-12 (build vs adopt)

## Implementation Notes (Post-Implementation)

### @gotgenes/pi-subagents Confirmed Working

The `SubagentsService` API (`getSubagentsService()`, `spawn()`) works as documented; the package is pinned to `^18.0.0`.

### Tool Name Collision Discovered and Resolved

The package registers its own `subagent` tool; two registrations would silently conflict (last registration wins). **Resolution:** the maestria tool was renamed to `maestria_subagent`, and all prompts, commands, and tests reference it.

### Handoff Validation Pre-Check Implemented

Handoff inputs are checked before dispatch: `assertValidAgent()` rejects specialist names outside `ALLOWED_AGENTS`, and `assertNonEmptyTask()` rejects empty or whitespace-only tasks. Both live in `@maestria/shared-pi/subagent-utils`.

> Corrected 2026-09-11: the original implementation used `validateHandoff()` from the same module to parse all 7 handoff fields (Goal, Context, Requirements, Known Problems, Assumptions Documented, Success Criteria, Next Step) and reject a missing or empty field. That function, its `HANDOFF_FIELDS` constant, and its result type were removed in the consumer-driven simplification pass after an audit found no production callers. The 7-field contract remains the methodology contract in the handoff skill; it is no longer machine-validated at dispatch time.

### Recursion Guard Respected

The package's recursion guard prevents nested subagents; maestria orchestration sits above the subagent layer (orchestrator → subagent → specialist), matching the ADR's design constraint.

### Graceful Fallback

The subagent module catches errors from `@gotgenes/pi-subagents` and returns structured handoff text instead of crashing, so the package works with degraded functionality when the subagent SDK is unavailable.

## Date

2026-06-19 (ADR), 2026-06-22 (implementation notes), 2026-09-11 (dispatch validation corrections)
