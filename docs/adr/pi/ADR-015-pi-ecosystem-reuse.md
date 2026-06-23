# ADR-015: Reuse existing Pi ecosystem packages for subagent dispatch and workflow

## Status

Accepted

## Context

The `@maestria/pi` plan (Phase 0) originally assumed building the
subagent dispatch tool, workflow engine, and specialist isolation from
scratch. The design in
the package-design plan (§4.5)
specified a custom `subagent` tool that spawns `pi` subprocesses
directly via `node:child_process.spawn`.

During a pre-implementation survey of the Pi ecosystem, we discovered:

- **4,160+ Pi packages** on `pi.dev/packages`
- **6+ subagent packages** providing subagent dispatch (in-process and subprocess)
- **3+ workflow/orchestration packages** providing DAG execution, fan-out,
  and agent lifecycles
- Active maintenance, MIT and Apache-2.0 licenses, and typed TypeScript APIs

Building from scratch would duplicate mature, tested, well-documented
functionality. The key differentiator of `@maestria/pi` is
**spec-driven orchestration** (phase gates, agent contracts, handoff
validation) plus **session tree integration**, not basic subagent
dispatch.

The following packages were evaluated:

| Package                             | Downloads/mo | Approach                    | Viability                                         |
| ----------------------------------- | ------------ | --------------------------- | ------------------------------------------------- |
| `@gotgenes/pi-subagents`            | 21.5K        | In-process via Pi SDK       | ⭐ Selected                                       |
| `@tintinweb/pi-subagents`           | 23.1K        | In-process (original)       | Similar; `@gotgenes` fork preferred for typed API |
| `pi-subagents` (nicobailon)         | 92.2K        | Unknown (likely subprocess) | Most popular; not evaluated in depth              |
| `pi-subagentura`                    | ~500         | In-process                  | Smaller, less maintained                          |
| `pi-crew`                           | 12.4K        | Multi-agent orchestration   | Evaluated; defers to v1.1                         |
| `@juicesharp/rpiv-pi`               | 11.4K        | Skill-based dev workflow    | Different approach; overlaps in scope             |
| `@quintinshaw/pi-dynamic-workflows` | 11.3K        | Workflow fan-out            | Evaluated; defers to v1.1                         |

## Decision

### Depend on `@gotgenes/pi-subagents` for subagent dispatch

**Package:** `@gotgenes/pi-subagents@^17.0.0`
**License:** MIT
**Approach:** In-process subagent spawning via Pi SDK

`@gotgenes/pi-subagents` provides:

- **In-process subagent spawning** via Pi SDK — no subprocess overhead
- **Typed API** — TypeScript-first, with `SubagentsService` and
  `WorkspaceProvider` interfaces
- **Lifecycle events** — `subagents:*`, `subagents:child:*` for
  orchestrator hooking
- **Recursion guard** — prevents subagents from spawning their own
  subagents (by design)
- **Workspace provider seam** — for future worktree isolation
- **Layered settings config** — package defaults, user overrides

`@maestria/pi` adds on top:

1. **Spec-driven orchestration** — Each specialist's assigned spec
   (from the orchestrator's workflow DAG) is passed alongside the
   handoff contract. Phase gates validate that each specialist
   completes its spec before the next stage begins.
2. **Session tree integration** — Each subagent invocation records
   its parent task ID for session tree reconstruction.
3. **Structured cross-agent context** — Handoff contracts are
   validated before dispatch (6-field pre-check), not just advisory.

### Defer `pi-crew` and `pi-dynamic-workflows` to v1.1

Both packages offer orchestration features that overlap with
`@maestria/pi`'s v1.1 roadmap:

- `pi-crew` (12.4K downloads/mo, Apache-2.0) — multi-agent
  orchestration with DAG execution, parallel dispatch, and cost
  accounting
- `@quintinshaw/pi-dynamic-workflows` (11.3K downloads/mo, MIT) —
  workflow fan-out with retry and state persistence

At v1, these overlap with `@maestria/pi`'s orchestration layer but
don't provide spec-driven contracts, which is the differentiator.
Re-evaluate when v1.0 spec-driven orchestration ships.

### No dependency on `pi-subagentura`

Smaller ecosystem, less active maintenance, and `@gotgenes/pi-subagents`
already provides the in-process model with a stronger API.

## Consequences

- Positive: ~60% less code to write compared to building the subagent
  tool from scratch. The `subagent.ts` module shrinks from ~400 lines
  (subprocess management) to ~100 lines (adapter layer).
- Positive: Proven runtime with 21.5K monthly downloads and active
  maintenance. Mitigates the risk of sponsor abandonment.
- Positive: `SubagentsService` cross-extension API enables other Pi
  extensions to interoperate with `@maestria/pi`'s subagent
  dispatches.
- Positive: In-process model means shared session context and no
  cold-start subprocess overhead (~0ms vs 100-500ms).
- Neutral: Recursion guard prevents subagents from spawning their own
  subagents — `@maestria/pi`'s orchestration sits above the subagent
  layer, which is the correct architecture.
- Negative: Peer dependency on `@gotgenes/pi-subagents` (which does
  not bundle Pi core). Must be listed in `dependencies` with
  `^17.0.0` range.
- Negative: If Pi's API changes, both `@gotgenes/pi-subagents` and
  `@maestria/pi` may need updates. Mitigated by pinning to a minor
  range.
- Risk: `@gotgenes/pi-subagents` v17 is pre-1.0; API may change.
  Mitigation: pin to `^17.0.0` and treat as any pre-1.0 transitive
  dependency. Source is MIT-licensed; can fork as last resort.

## References

- Pi ecosystem survey — `pi.dev/packages` search results (June 2026)
- `@gotgenes/pi-subagents` — `pi install npm:@gotgenes/pi-subagents`
- `pi-crew` — `pi install npm:@gotgenes/pi-crew` (deferred to v1.1)
- `@quintinshaw/pi-dynamic-workflows` (deferred to v1.1)
- `@maestria/pi` package design —
  Package design plan §4.5 — adapter design for @gotgenes/pi-subagents
- Risks documented in the plan's risk register — R-16 (vendor dependency on a pre-1.0 package), R-17 (API instability from Pi ecosystem changes), and O-12 (whether to build vs adopt subagent dispatch)

## Implementation Notes (Post-Implementation)

### ✅ `@gotgenes/pi-subagents@17.2.0` Confirmed Working

The package was tested with `@earendil-works/pi-coding-agent@0.79.9`.
The `SubagentsService` API (`getSubagentsService()`, `spawn()`) works
as documented. Version pinned to `^17.0.0` in `package.json`.

### ⚠️ Tool Name Collision Discovered and Resolved

`@gotgenes/pi-subagents` v17 registers its own `subagent` tool. If
`@maestria/pi` also registered a tool named `subagent`, Pi would
silently pick one (last registration wins), breaking one or both.

**Resolution:** The maestria tool was renamed to `maestria_subagent`.
All prompts, commands, and tests reference `maestria_subagent`.

### ✅ Handoff Validation Pre-Check Implemented

As designed in the ADR, `src/subagent.ts` implements
`validateHandoff()` which checks all 6 handoff fields (Goal, Context,
Requirements, Known Problems, Success Criteria, Next Step) before
dispatching. Rejects with clear error if a field is missing.

### ✅ Recursion Guard Respected

`@gotgenes/pi-subagents` has a recursion guard preventing subagents
from spawning their own subagents. The maestria orchestration sits
above the subagent layer (orchestrator → subagent → specialist, not
nested). This is the correct architecture and matches the ADR's
design constraint.

### 📝 Graceful Fallback

The `subagent.ts` module catches errors from `@gotgenes/pi-subagents`
and returns a structured handoff text instead of crashing. This means
the package works (with degraded functionality) even if the subagent
SDK is unavailable.

## Date

2026-06-19 (ADR), 2026-06-22 (implementation notes)
