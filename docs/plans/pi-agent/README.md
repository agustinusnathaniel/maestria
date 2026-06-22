# `@maestria/pi` — Planning Document Set

This directory contains the planning documents for adding `@maestria/pi` to the
maestria monorepo. `@maestria/pi` is the Pi-coding-agent adaptation of the
maestria methodology (Pipeline Composition + Maker/Checker Split + 7 specialist
agents + global rules).

This is a research and planning document set that was written **before** implementation
began. The package is now implemented and published as `@maestria/pi@0.1.0`.
Implementation details that diverged from the plan are annotated throughout this
document set with `> **Note:** Plan diverged` callouts. See the actual code at
[`packages/pi/`](../../packages/pi/) for the authoritative source.

## Status

**Implemented (v0.1.0).** Published 2026-06-22. The package is shipping and
available at `pi install npm:@maestria/pi`.

- **Date drafted:** 2026-06-18
- **Date implemented:** 2026-06-22
- **Published version:** `@maestria/pi@0.1.0`
- **Pi target:** `@earendil-works/pi-coding-agent@^0.79` (confirmed working with 0.79.9)
- **Status in VISION.md:** Shipping (updated from Exploring)

## TL;DR

The maestria methodology maps cleanly to Pi's primitives, but the mapping is
**not** a one-to-one port of `@maestria/opencode`. The core insight from
research: Pi's event-based extension model and its existing `subagent`
extension pattern (now available as `@gotgenes/pi-subagents`, the in-process subagent runtime) provide a **more
expressive substrate** than OpenCode's two-hook plugin model — at the cost of
more code to maintain.

The plan:

1. **One TypeScript extension** (`src/extension.ts`) registered as a Pi package,
   with `before_agent_start` for global-rules injection, `session_before_compact`
   for state preservation, and `input` for orchestrator routing.
2. **Eight prompt templates** (orchestrator + 7 specialists) shipped in
   `prompts/`, invoked as `/orchestrator`, `/adventurer`, `/planner`, etc.
3. **One subagent tool backed by `@gotgenes/pi-subagents`** (in-process,
   typed API, lifecycle events) providing Pipeline Composition dispatch
   and a `/orchestrate` command for orchestrated execution with
   parallel/chain modes.
4. **Tool-call interception** for the maker/checker split — `tool_call` event
   blocks destructive operations during a review session.
5. **Compaction hooks** preserve task state (active file, blockers, completion
   promise) across session compactions.
6. **Two skills** shipped in `skills/` for handoff contracts and iteration
   limits — methodology that specialists load on demand.

Net effect: the user installs one npm package, gains the full maestria
methodology on Pi, and the methodology is encoded in the agent's system prompt
plus prompt templates plus a custom subagent delegation tool.

## Quick Reference

| Item                       | Value                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| Package name               | `@maestria/pi`                                                                                  |
| Published version          | `0.1.0` (initial release)                                                                       |
| Pi version target          | `^0.79.0` (confirmed with 0.79.9)                                                               |
| License                    | MIT                                                                                             |
| Type                       | ESM, bundled `.mjs`                                                                             |
| `keywords`                 | `["pi-package", "maestria", "ai", "agents", "coding-agent"]`                                    |
| Build tool                 | `vp pack` (Rolldown bundle, **not** `tsc` — see divergence note below)                          |
| Number of TS source files  | 9 (extension, rules, compaction, state, subagent, commands, tools, **modes**, rules-content)    |
| Number of prompt templates | 8 (orchestrator + 7 specialists)                                                                |
| Number of skills           | 2 (handoff, iteration-limits) — v1 scope                                                        |
| Themes                     | 0 (skip in v1)                                                                                  |
| Custom provider registered | No                                                                                              |
| Custom tools registered    | 1 (`subagent` → renamed to `maestria_subagent` to avoid collision)                              |
| Custom commands registered | 4 (`orchestrate`, `review`, `maestria-status`, plus 3 workflow modes: `fein`, `sonar`, `blitz`) |
| Peer dependencies          | `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `typebox`                           |
| Third-party deps           | `@gotgenes/pi-subagents@^17.0.0` (see ADR-015)                                                  |
| Compaction state           | Active task, mode, completion promise, blockers, handoff history                                |
| Postinstall script         | None (pure plugin, consistent with all `@maestria/*` packages)                                  |
| Files published to npm     | `dist`, `prompts`, `rules`, `skills`, `README.md`, `LICENSE`                                    |

> **Note — divergences from plan:**
>
> - Build tool: plan specified `tsc`; implementation uses `vp pack` (Rolldown) which produces `dist/extension.mjs`
> - Tool name: plan specified `subagent`; renamed to `maestria_subagent` to avoid collision with `@gotgenes/pi-subagents` internal tool
> - Modes module: `src/modes.ts` was added to the plan — implements `/fein`, `/sonar`, `/blitz` workflow mode commands
> - `rules/` directory IS included in the `files` array (plan said exclude; included because Pi resolves rule files from the package directory)
> - `CHANGELOG.md` is NOT included in the `files` array (plan said include; omitted to keep the published package minimal — CHANGELOG is in the git repo)
> - `publishConfig.provenance` is NOT set (plan said `true`; deferred to a future release when npm provenance build infrastructure is in place)
> - Node engine: actual requires `>=22.12.0` (plan said `>=22.19.0`)

## How to Read This Plan

If you are reviewing this plan, read in this order:

1. **[This README](./README.md)** — what this is, the TL;DR, and the key
   conclusions.
2. **[`01-assessment.md`](./01-assessment.md)** — Pi's architecture, the
   4-resource model, the extension API. If you don't know Pi, start here.
3. **[`02-integration-strategy.md`](./02-integration-strategy.md)** — the core
   mapping: how each maestria pattern becomes Pi primitives. This is the
   answer to "can we even do this?"
4. **[`03-package-design.md`](./03-package-design.md)** — the file layout,
   the `package.json` manifest, the `tsconfig.json`. This is the answer to
   "what does the package look like?"
5. **[`04-implementation-phases.md`](./04-implementation-phases.md)** — the
   phased build order, exit criteria, and verification commands. This is
   the answer to "how do we build it?"
6. **[`05-architecture-decisions.md`](./05-architecture-decisions.md)** — 7
   ADRs (ADR-008 through ADR-014) explaining the non-obvious choices. This
   is the answer to "why this and not that?"
7. **[`06-risks-and-open-questions.md`](./06-risks-and-open-questions.md)** —
   the things that could go wrong and the open design questions. This is
   the answer to "what could bite us?"
8. **[`07-references.md`](./07-references.md)** — the source material. The Pi
   docs, the relevant example extensions, the existing maestria ADRs cited
   throughout.

## Key Conclusions

These are the conclusions a reader should take away after 10 minutes with
this plan. Each is defended in detail in the linked document.

1. **Pi's plugin model is more expressive than OpenCode's.** The 30+
   lifecycle events, the subagent-via-subprocess pattern, the model registry
   access, and the tool_call interception together let us encode more of the
   maestria methodology than the opencode two-hook model allows. The price
   is more code and more surface area to maintain.

2. **Pi's "no native subagent" problem has an answer — reuse the ecosystem.**
   Pi's single primary agent loop does not have an OpenCode-style `task()`
   subagent primitive, but the Pi ecosystem has `@gotgenes/pi-subagents`
   (MIT, v17, 21.5K downloads/mo), an in-process subagent runtime with
   typed API and lifecycle events. Rather than building our own from
   scratch, `@maestria/pi` wraps `@gotgenes/pi-subagents` with handoff
   validation and spec-driven orchestration metadata. See ADR-015.

3. **The maker/checker split is harder on Pi.** OpenCode's `edit: deny` in
   agent frontmatter is a hard technical gate. Pi's equivalent is the
   `tool_call` event with `{ block: true }` for destructive operations,
   gated by session metadata. We use a `/review` command that switches the
   active toolset (blocking `edit`/`write`/`bash`) plus a `tool_call` handler
   as a defense-in-depth backstop. Review is not as strong as OpenCode's
   permission model, but it is good enough to catch the common failure
   modes.

4. **Compaction preservation is straightforward but stateful.** The
   `session_before_compact` event in Pi is the analog of OpenCode's
   `experimental.session.compacting`. We return a custom summary that
   includes the maestria session state, so the next turn can recover.
   The state we preserve is: active task, completion promise, blockers,
   file references, last handoff recipient.

5. **The 7 specialists become 7 prompt templates.** Each specialist is a
   `.md` file in `prompts/`, registered as a Pi prompt template (invoked
   as `/adventurer`, `/builder`, etc.). The orchestrator is also a prompt
   template, invoked as `/orchestrate <goal>`, which composes a chain of
   `subagent` tool invocations.

6. **Global rules inject via `before_agent_start`.** This is the analog of
   OpenCode's `input.instructions` injection. The rules content lives in
   `rules/AGENTS.md` inside the npm package and is read at runtime. This
   keeps rules versioned with the package.

7. **Build with `vp pack` (Rolldown), not `tsc` as planned.** The implementation
   uses `vp pack` to produce a single `dist/extension.mjs` bundle that Pi's
   dynamic import can consume directly. `tsc` would require additional module
   resolution. See ADR-011 for the divergence rationale. The build artifact
   is a single ~35KB `.mjs` file with sourcemap.

8. **Skills ship for handoff contracts and iteration limits.** These are
   methodology that the specialists reference repeatedly. Bundling them
   removes a runtime dependency on the user installing them separately,
   and keeps the methodology self-contained. Domain skills (TDD, ADRs,
   etc.) are still not bundled — that's a non-goal.

9. **Themes are skipped in v1.** They add maintenance without methodology
   value. The 0.79.x default `dark` theme is fine; we can ship a theme
   later if users ask.

10. **The package is conservative about its peer-dependency surface.** The
    Pi core packages (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`,
    `typebox`) go in `peerDependencies` with `"*"` range. We do not bundle
    them. We do not bring in third-party runtime deps. This minimizes
    the supply chain risk that Pi packages are designed to communicate
    to the user.

## Cross-References

| Document                                                             | Purpose                                                    |
| -------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`01-assessment.md`](./01-assessment.md)                             | Pi architecture, 4-resource model, extension API surface   |
| [`02-integration-strategy.md`](./02-integration-strategy.md)         | Maestria → Pi mapping: patterns, agents, rules, compaction |
| [`03-package-design.md`](./03-package-design.md)                     | File tree, `package.json` manifest, `tsconfig.json`        |
| [`04-implementation-phases.md`](./04-implementation-phases.md)       | 8-phase build order, exit criteria, verification           |
| [`05-architecture-decisions.md`](./05-architecture-decisions.md)     | 7 ADRs (008–014) — non-obvious choices                     |
| [`06-risks-and-open-questions.md`](./06-risks-and-open-questions.md) | Risks, mitigations, open design questions                  |
| [`07-references.md`](./07-references.md)                             | Source files, doc URLs, example extensions                 |

## Related Maestria Artifacts

- [`VISION.md`](../../VISION.md) — project motivation, non-goals, package table
- [`PATTERNS.md`](../../PATTERNS.md) — Pipeline Composition + Maker/Checker Split
  patterns
- [`packages/opencode/`](../../packages/opencode/) — the reference
  implementation; this plan adapts its conventions
- [`docs/adr/ADR-002-plugin-architecture.md`](../adr/ADR-002-plugin-architecture.md) —
  the opencode plugin architecture decision; this plan extends the same
  pure-plugin philosophy to Pi
- [`docs/adr/ADR-006-tool-permission-design.md`](../adr/ADR-006-tool-permission-design.md) —
  the opencode permission model; this plan adapts the equivalent
  `tool_call` interception on Pi

## Implementation Milestone

All 8 phases are complete. See [`04-implementation-phases.md`](./04-implementation-phases.md)
for the updated status table.

| Phase | Description             | Status  | Notes                                                              |
| ----- | ----------------------- | ------- | ------------------------------------------------------------------ |
| 0     | Research & Scoping      | ✅ Done | Planning documents                                                 |
| 1     | Skeleton & Install      | ✅ Done | Package loads, `/fein`/`/sonar`/`/blitz` commands work             |
| 2     | Global Rules Injection  | ✅ Done | `before_agent_start` injects rules                                 |
| 3     | Compaction Preservation | ✅ Done | State survives session compaction                                  |
| 4     | Prompt Templates        | ✅ Done | 8 prompts, 2 skills                                                |
| 5     | Orchestration Hooks     | ✅ Done | Subagent tool renamed to `maestria_subagent` (collision avoidance) |
| 6     | Maker/Checker           | ✅ Done | Model cycling + tool_call blocking                                 |
| 7     | Skills                  | ✅ Done | Handoff + iteration-limits                                         |
| 8     | Polish & Publish        | ✅ Done | Build via `vp pack` (diverged from plan: `tsc`)                    |

## Date

2026-06-18 (plan drafted), 2026-06-22 (implementation complete)
