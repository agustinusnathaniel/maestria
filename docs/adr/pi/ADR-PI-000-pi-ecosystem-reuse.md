# ADR-PI-000: Reuse existing Pi ecosystem packages for subagent dispatch and workflow

## Status

Accepted

## Terminology

**Pi extension** — a `.ts`/`.js` file that exports a default function `(pi: ExtensionAPI) => void`. It hooks into Pi's lifecycle by registering tools (`pi.registerTool()`), commands (`pi.registerCommand()`), and event handlers (`pi.on()`). The extension IS the code that runs.

**Pi package** — an npm/git/local package with a `pi` manifest field in `package.json`. A package can contain extensions, skills, prompts, themes, and other resources. The package IS the container; the extension IS the code.

A single Pi package can ship multiple extensions (e.g., `shitty-extensions` ships 14 extensions from one package). An extension always lives inside a package.

## Context

The `@maestria/pi` plan (Phase 0) originally assumed building the subagent dispatch tool, workflow engine, and specialist isolation from scratch. The design in the package-design plan (§4.5) specified a custom `subagent` tool that spawns `pi` subprocesses directly via `node:child_process.spawn`.

During a pre-implementation survey of the Pi ecosystem, we discovered:

- **4,160+ Pi packages** on `pi.dev/packages`
- **6+ subagent packages** providing subagent dispatch (in-process and subprocess)
- **3+ workflow/orchestration packages** providing DAG execution, fan-out, and agent lifecycles
- Active maintenance, MIT and Apache-2.0 licenses, and typed TypeScript APIs

Building from scratch would duplicate mature, tested, well-documented functionality. The key differentiator of `@maestria/pi` is **spec-driven orchestration** (phase gates, agent contracts, handoff validation) plus **session tree integration**, not basic subagent dispatch.

The following options were evaluated for subagent dispatch:

| Option | Approach | Viability |
| --- | --- | --- |
| **A: `@gotgenes/pi-subagents`** (21.5K) | In-process via Pi SDK. `SubagentsService` cross-extension API: `spawn()`, `getRecord()`, `SUBAGENT_EVENTS`. File-based agent type registry from `~/.pi/agent/agents/*.md`. Layered settings, recursion guard, workspace providers, concurrency limiter. | ✅ **Selected.** Provides the programmatic dispatch API (`spawn()`) and agent type registration mechanism (`.md` files) that maestria needs. 60% less code vs building from scratch. |
| **B: `pi-subagents` (nicobailon)** (92.2K) | Self-contained extension registering `subagent` tool via `pi.registerTool()`. No programmatic API exported (`getSubagentsService()` absent). Events are unexported strings. Agent types are internal registry with no custom registration mechanism. | ❌ **Not suitable.** Cannot dispatch subagents programmatically from `maestria_subagent` tool. Cannot register custom agent types (adventurer, builder, etc.). Designed for end-users calling `/subagent`, not for extension authors. Switching would require rewriting `subagent.ts` to not use programmatic dispatch. |
| **D: `@tintinweb/pi-subagents`** (23.1K) | Original upstream of `@gotgenes/pi-subagents`. Same in-process architecture, similar API surface. Published as `@tintinweb/pi-subagents` on npm. | ⚠️ **Not selected.** `@gotgenes` fork was preferred because it has a more active maintenance cadence, additional features (layered settings, workspace provider seam), and better cross-extension compatibility. The API is similar enough that switching would be straightforward if maintenance shifts. |
| **C: Build own subagent dispatch** | Use Pi SDK's `createAgentSession()` to spawn subagents directly. Implement polling, timeout, concurrency, abort, lifecycle events from scratch. No external peer dependency. | ⚠️ **Possible but higher cost.** Estimates ~200-300 lines of new code for basic dispatch, plus ongoing maintenance for edge cases (timeouts, cancellation, resource cleanup) that pi-subagents already handles. No agent type registry — would need to build one or embed prompts directly. Concurrency limits, recursion guards, and workspace isolation would need custom implementation. |

## Evaluation

### Assessment criteria

| Criterion | Weight | Why |
| --- | --- | --- |
| Programmatic API (spawn from code, not just LLM tool) | Critical | maestria_subagent tool calls service.spawn() from execute() |
| Custom agent types (our 7 specialists with role prompts) | Critical | adventurer, builder, etc. need separate system prompts |
| Tool restriction per specialist | Critical | builder=write, reviewer=read-only (maker/checker split) |
| Lifecycle event tracking | Critical | session state needs subagent start/complete/fail events |
| Synchronous spawn + status polling | Critical | spawn-and-poll loop in subagent.ts (getRecord() called every 500ms) |
| In-process (no subprocess overhead) | Hard requirement | ~0ms cold start vs 100-500ms subprocess |
| Production quality | High | timeouts, abort, error handling, concurrency limits |
| Low user friction | Medium | auto-install via CLI mitigates extra peer dep |

### Option comparison

| Need | A: @gotgenes | B: nicobailon | C: Build own | D: @tintinweb |
| --- | --- | --- | --- | --- |
| Typed programmatic API | ✅ getSubagentsService() | ❌ RPC-only async | N/A (would build) | ❌ Symbol.for() global |
| Sync spawn + status | ✅ spawn() returns ID, getRecord() sync | ❌ async event reply | Would build | ❌ Symbol global access |
| Custom agent types | ✅ .md files in ~/.pi/agent/agents/ | ✅ .md files | Would build | ✅ .md files |
| Tool restriction | ✅ tools: frontmatter | ✅ tools: frontmatter | Would build | ✅ tools: + disallowed_tools: |
| Lifecycle events | ✅ SUBAGENT_EVENTS.\* | ❌ subagents:rpc:\* events | Would build | ✅ subagents:\* events |
| Code to write | 0 (already wired) | 200-400 lines wrapper | 800-1200+ lines engine | 100-200 lines adapter |
| Dependency risk | Low (1 dep, semver, active) | Low (active) | High (SDK internals) | Low (active) |
| Community adoption | ~446/week | ~92K total | None | ~7K/week |
| Pi ecosystem fit | Designed for extension authors | End-user tool | Non-standard | Event-bus RPC |

### Verdict

**Option A: @gotgenes/pi-subagents is objectively the best choice for maestria.**

The decisive factor is the typed programmatic API. Maestria's entire dispatch model depends on:

1. Synchronous `service.spawn("builder", task)` returning an ID immediately
2. Synchronous `service.getRecord(id)` for polling in the `pollSubagent` loop (called every 500ms)
3. Synchronous `service.abort(id)` for cancellation
4. Typed `SubagentRecord` with `status`, `result`, `error` fields
5. `SUBAGENT_EVENTS` constants for lifecycle subscription (start, complete, fail, steer)

No other option provides this without wrapping an asynchronous event protocol that breaks the synchronous spawn-and-poll loop.

Options B and D require wrapping async event-bus RPC — the spawn ID comes back on a reply channel, status is delivered as events, and there is no synchronous `getRecord(id)` equivalent. This fundamentally conflicts with how maestria's dispatch loop works: spawn synchronously, then poll every 500ms.

Option C (build own) is a false economy. The `createAgentSession()` Pi SDK primitive is a low-level LLM session factory, not a managed subagent engine. A production-worthy implementation requires: session lifecycle management, concurrency limiter with queue (up to 8), agent type registry (parse .md files with YAML frontmatter), tool restriction per agent type, lifecycle event emission, abort propagation, error handling/recovery, and timeout with cleanup. The estimated 800-1200+ lines is conservative — @gotgenes/pi-subagents itself is thousands of lines covering exactly these concerns.

The @gotgenes fork exists precisely because the upstream (D) lacked the typed API that extension authors need. Its README states: "A focused, in-process sub-agent core for pi — autonomous agents plus a typed API and lifecycle events other extensions build on." This is maestria's exact use case. The `getSubagentsService()` / `Symbol.for()` cross-extension pattern is the Pi ecosystem standard for extension-to-extension communication.

**Key tradeoffs acknowledged:**

- Lower download count than upstream (~446 vs ~7K/week) — but actively maintained (135 versions, latest 17 days ago)
- The fork lags upstream on some features (memory, worktree isolation, scheduling, fleet view) — maestria doesn't need these
- Adding an npm peer dependency for what could use Pi SDK primitives — the SDK is a lower level than claimed; a production engine is an order of magnitude more code than a thin wrapper

**Long-term consideration:** If @gotgenes/pi-subagents becomes unmaintained, Option C (build own) becomes viable. At that point, maestria would dedicate the engineering effort to build a minimal subagent engine specialized for its own dispatch patterns, rather than depending on an external package. The current integration provides a clean seam for this migration: `subagent.ts` already wraps `service.spawn()` behind the `maestria_subagent` tool abstraction, and `agents.ts` owns the agent file deployment independently of how those files are consumed.

## Decision

### Depend on `@gotgenes/pi-subagents` for subagent dispatch

**Package:** `@gotgenes/pi-subagents@^17.0.0` **License:** MIT **Approach:** In-process subagent spawning via Pi SDK

`@gotgenes/pi-subagents` provides:

- **In-process subagent spawning** via Pi SDK - no subprocess overhead
- **Typed API** - TypeScript-first, with `SubagentsService` and `WorkspaceProvider` interfaces
- **Lifecycle events** - `subagents:*`, `subagents:child:*` for orchestrator hooking
- **Recursion guard** - prevents subagents from spawning their own subagents (by design)
- **Workspace provider seam** - for future worktree isolation
- **Layered settings config** - package defaults, user overrides

`@maestria/pi` adds on top:

1. **Spec-driven orchestration** - Each specialist's assigned spec (from the orchestrator's workflow DAG) is passed alongside the handoff contract. Phase gates validate that each specialist completes its spec before the next stage begins.
2. **Session tree integration** - Each subagent invocation records its parent task ID for session tree reconstruction.
3. **Structured cross-agent context** - Handoff contracts are validated before dispatch (6-field pre-check), not just advisory.

### Defer `pi-crew` and `pi-dynamic-workflows` to v1.1

Both packages offer orchestration features that overlap with `@maestria/pi`'s v1.1 roadmap:

- `pi-crew` (12.4K downloads/mo, Apache-2.0) - multi-agent orchestration with DAG execution, parallel dispatch, and cost accounting
- `@quintinshaw/pi-dynamic-workflows` (11.3K downloads/mo, MIT) - workflow fan-out with retry and state persistence

At v1, these overlap with `@maestria/pi`'s orchestration layer but don't provide spec-driven contracts, which is the differentiator. Re-evaluate when v1.0 spec-driven orchestration ships.

### No dependency on `pi-subagentura`

Smaller ecosystem, less active maintenance, and `@gotgenes/pi-subagents` already provides the in-process model with a stronger API.

## Consequences

- Positive: ~60% less code to write compared to building the subagent tool from scratch. The `subagent.ts` module shrinks from ~400 lines (subprocess management) to ~100 lines (adapter layer).
- Positive: Proven runtime with 21.5K monthly downloads and active maintenance. Mitigates the risk of sponsor abandonment.
- Positive: `SubagentsService` cross-extension API enables other Pi extensions to interoperate with `@maestria/pi`'s subagent dispatches.
- Positive: In-process model means shared session context and no cold-start subprocess overhead (~0ms vs 100-500ms).
- Neutral: Recursion guard prevents subagents from spawning their own subagents - `@maestria/pi`'s orchestration sits above the subagent layer, which is the correct architecture.
- Negative: Peer dependency on `@gotgenes/pi-subagents` (which does not bundle Pi core). Must be listed in `dependencies` with `^17.0.0` range.
- Negative: If Pi's API changes, both `@gotgenes/pi-subagents` and `@maestria/pi` may need updates. Mitigated by pinning to a minor range.
- Risk: `@gotgenes/pi-subagents` v17 is pre-1.0; API may change. Mitigation: pin to `^17.0.0` and treat as any pre-1.0 transitive dependency. Source is MIT-licensed; can fork as last resort.

## References

- Pi ecosystem survey - `pi.dev/packages` search results (June 2026)
- `@gotgenes/pi-subagents` - `pi install npm:@gotgenes/pi-subagents`
- `pi-crew` - `pi install npm:@gotgenes/pi-crew` (deferred to v1.1)
- `@quintinshaw/pi-dynamic-workflows` (deferred to v1.1)
- `@maestria/pi` package design - Package design plan §4.5 - adapter design for @gotgenes/pi-subagents
- Risks documented in the plan's risk register - R-16 (vendor dependency on a pre-1.0 package), R-17 (API instability from Pi ecosystem changes), and O-12 (whether to build vs adopt subagent dispatch)

## Implementation Notes (Post-Implementation)

### ✅ `@gotgenes/pi-subagents@17.2.0` Confirmed Working

The package was tested with `@earendil-works/pi-coding-agent@0.79.9`. The `SubagentsService` API (`getSubagentsService()`, `spawn()`) works as documented. Version pinned to `^17.0.0` in `package.json`.

### ⚠️ Tool Name Collision Discovered and Resolved

`@gotgenes/pi-subagents` v17 registers its own `subagent` tool. If `@maestria/pi` also registered a tool named `subagent`, Pi would silently pick one (last registration wins), breaking one or both.

**Resolution:** The maestria tool was renamed to `maestria_subagent`. All prompts, commands, and tests reference `maestria_subagent`.

### ✅ Handoff Validation Pre-Check Implemented

As designed in the ADR, `src/subagent.ts` implements `validateHandoff()` which checks all 6 handoff fields (Goal, Context, Requirements, Known Problems, Success Criteria, Next Step) before dispatching. Rejects with clear error if a field is missing.

### ✅ Recursion Guard Respected

`@gotgenes/pi-subagents` has a recursion guard preventing subagents from spawning their own subagents. The maestria orchestration sits above the subagent layer (orchestrator → subagent → specialist, not nested). This is the correct architecture and matches the ADR's design constraint.

### 📝 Graceful Fallback

The `subagent.ts` module catches errors from `@gotgenes/pi-subagents` and returns a structured handoff text instead of crashing. This means the package works (with degraded functionality) even if the subagent SDK is unavailable.

## Date

2026-06-19 (ADR), 2026-06-22 (implementation notes)
