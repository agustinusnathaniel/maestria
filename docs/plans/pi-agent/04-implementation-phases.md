# 04. Implementation Phases — Phased Delivery Plan

> **Ecosystem reuse (see ADR-015):** Following the thinness audit, the
> package scope has been reduced:
>
> - Subagent runtime → depends on `@gotgenes/pi-subagents`
> - Safety patterns → inlined from Pi's `permission-gate.ts` example
> - State persistence → uses built-in `pi.appendEntry()` in v1.1
> - All tool/model APIs use Pi's built-in `setActiveTools()`, `setModel()`
>
> Estimate: ~~11~~ → ~~10~~ → **9 days**

This document is the build order. Each phase has:

- **Goal** — what we're trying to ship
- **Exit criteria** — verifiable conditions that must be met
- **Verification command** — what to run to check
- **Files touched** — what changes in this phase
- **Dependencies** — what prior phases must be complete

The phases are sequenced so that each phase produces a
working, testable artifact. We don't write phase N+1 code
until phase N passes its exit criteria.

Total estimated work: 8–12 working days of focused
implementation, plus review and iteration time.

> **CLI convention used in this document:** `pi install <pkg>` is
> the **persistent** install (adds the package to
> `~/.pi/agent/settings.json`; the package remains installed
> across sessions). `pi -e <path>` is the **transient** load (loads
> an extension for the current session only, does not modify
> settings). We use `pi install ./packages/pi` in Phase 1 (the
> package install flow) and Phase 8 (the final end-to-end test),
> and `pi -e ./packages/pi` in intermediate phases (so testing
> doesn't pollute the user's settings). `pi -p "<prompt>"` (or
> `--print`) is the non-interactive print mode used for scripted
> verification. `pi --no-extensions` loads Pi without any
> extension, useful for testing the package in isolation
> (e.g., `pi --no-extensions -e ./packages/pi` loads the
> maestria extension with no other extensions active).

## Phase 0: Research & Scoping

**Status: ✅ Complete.**

This plan.

### Goal

Establish what `@maestria/pi` is, how it maps to Pi's
primitives, and what the package will look like.

### Exit Criteria

- [x] Pi is researched (source code, docs, examples read)
- [x] Maestria methodology is mapped to Pi primitives
- [x] Package design is concrete (file tree, manifest,
      tsconfig, build)
- [x] ADRs are written for non-obvious choices
- [x] Risks and open questions are documented
- [x] This plan is reviewed by `@reviewer` and approved by
      the user

### Verification

Read each of the 8 documents in `docs/plans/pi-agent/`.
Each must be defensible against the Pi source and the existing
maestria ADRs.

### Files Touched

- `docs/plans/pi-agent/README.md` (new)
- `docs/plans/pi-agent/01-assessment.md` (new)
- `docs/plans/pi-agent/02-integration-strategy.md` (new)
- `docs/plans/pi-agent/03-package-design.md` (new)
- `docs/plans/pi-agent/04-implementation-phases.md` (this file)
- `docs/plans/pi-agent/05-architecture-decisions.md` (new)
- `docs/plans/pi-agent/06-risks-and-open-questions.md` (new)
- `docs/plans/pi-agent/07-references.md` (new)

### Dependencies

None.

---

## Phase 1: Skeleton & Install

**Status: ⏳ Not started.**

### Goal

A minimal package that loads in Pi and ships a single
"hello" prompt template. The end-to-end install loop
(local path → settings.json → command works) is verified.

### Why First

Before writing any methodology, we need to know that the
package structure works: the manifest is read, the extension
loads, the prompts are discoverable. This is the smallest
useful end-to-end test.

### Exit Criteria

- [ ] `packages/pi/` exists with the directory structure
      from [`03-package-design.md`](./03-package-design.md)
- [ ] `package.json` has the `pi-package` keyword, the `pi`
      manifest, the `files` array, and
      `@gotgenes/pi-subagents@^17.0.0` in `dependencies`
- [ ] `src/extension.ts` exists with a no-op default export
- [ ] `src/subagent.ts` exists with an adapter module wrapping
      `SubagentsService` from `@gotgenes/pi-subagents`
- [ ] Implement handoff validation pre-check:
      `validateHandoff(handoff: string): {valid: boolean, errors: string[]}`
- [ ] `tsc` produces `dist/extension.js` without errors
- [ ] `prompts/hello.md` exists with a simple "say hello to
      $1" template
- [ ] `pi install ./packages/pi` succeeds
- [ ] In an interactive Pi session, `/hello world` expands
      to "Hello, world!"
- [ ] `pi list` shows `@maestria/pi` is installed
- [ ] `vp check` and `vp test` pass on the new package
- [ ] Publish to npm for install-proof-of-life:
      `pi install npm:@maestria/pi@0.1.0`

### Verification

```bash
# From packages/pi/
npm run build
ls -la dist/extension.js

# From any directory
pi install ./packages/pi
pi list | grep maestria
# In an interactive session, type /hello world and verify
# the prompt expands to "Hello, world!"
```

> Note: `pi -e` loads an extension, not a prompt; we cannot use it
> to test prompt expansion. The verification is the interactive
> `/hello` invocation (or a vitest test that asserts the template
> content, see Phase 2 for the pattern).

The exact content of `prompts/hello.md` is:

```markdown
---
description: Say hello to someone
argument-hint: '[name]'
---

Hello, ${1:-world}!
```

### Files Touched

- `packages/pi/package.json` (new — includes
  `@gotgenes/pi-subagents@^17.0.0` in `dependencies`)
- `packages/pi/tsconfig.json` (new)
- `packages/pi/README.md` (new — minimal, links to monorepo)
- `packages/pi/.gitignore` (new — `dist/`, `node_modules/`)
- `packages/pi/src/extension.ts` (new — no-op)
- `packages/pi/src/subagent.ts` (new — adapter wrapping
  `@gotgenes/pi-subagents` + `validateHandoff`)
- `packages/pi/prompts/hello.md` (new — content above)
- `packages/pi/scripts/build-rules.ts` (new — placeholder,
  not yet wired to anything)

### Dependencies

None. `@gotgenes/pi-subagents` is an npm dependency installed
via `pi install` (Phase 1 verification).

### Estimated Time

0.5 day.

---

## Phase 2: Global Rules Injection

**Status: ⏳ Not started.**

### Goal

The `before_agent_start` handler injects the rules content
from `rules/AGENTS.md` into the system prompt. Verified by
inspecting the system prompt in a running Pi session.

### Exit Criteria

- [ ] `src/rules.ts` exists with `installRulesInjection(pi, content)`
- [ ] `src/rules-content.ts` is generated from
      `rules/AGENTS.md` at build time
- [ ] `src/extension.ts` calls `installRulesInjection` with
      the generated content
- [ ] `rules/AGENTS.md` is a copy of
      `packages/opencode/rules/AGENTS.md` (possibly with
      orchestrator-table updates), including the 3 new
      directives: webfetch may hang, CLI refs via bash --help,
      local files read directly
- [ ] In a running Pi session, the system prompt contains
      the rules content
- [ ] `ctx.getSystemPrompt().includes("Maestria Global Rules")`
      returns `true` from a test handler

### Verification

```bash
# Build
npm run build

# Unit test asserts the rules injection includes the
# maestria content (follows the pattern in
# packages/opencode/tests/index.test.ts)
npm test -- tests/rules.test.ts
```

A test in `tests/rules.test.ts` asserts:

- `installRulesInjection(pi, MAESTRIA_RULES_CONTENT)` registers a
  `before_agent_start` handler on the `pi` mock.
- The handler returns `{ systemPrompt: ... + rulesContent }` where
  `rulesContent.includes("Maestria Global Rules")` is `true`.

The test pattern (adapted from
[`packages/opencode/tests/index.test.ts`](../../packages/opencode/tests/index.test.ts))
injects a mock `pi` object with `on(event, handler)`, calls
`installRulesInjection`, then invokes the captured handler with a
synthetic event and asserts the returned system prompt contains the
rules.

### Files Touched

- `packages/pi/rules/AGENTS.md` (new — copy from opencode)
- `packages/pi/src/rules.ts` (new)
- `packages/pi/src/extension.ts` (update to call
  `installRulesInjection`)
- `packages/pi/scripts/build-rules.ts` (update — generate
  `src/rules-content.ts`)
- `packages/pi/src/rules-content.ts` (generated, gitignored)
- `packages/pi/tests/rules.test.ts` (new)

### Dependencies

Phase 1.

### Estimated Time

0.5 day.

---

## Phase 3: Compaction Preservation

**Status: ⏳ Not started.**

### Goal

The `session_before_compact` event returns a custom summary
that includes the `MaestriaState`. Verified by triggering a
compaction in a test session and inspecting the saved summary.

### Exit Criteria

- [ ] `src/state.ts` exists with `MaestriaState` interface and
      CRUD helpers
- [ ] `src/compaction.ts` exists with the
      `session_before_compact` and `session_before_tree` handlers
- [ ] `renderMaestriaSummary(state)` produces a markdown
      string with all 6 sections (Goal, Completion Promise,
      Blockers, Files Modified, Files Read, Recent Handoffs)
- [ ] In a running Pi session, the compaction summary contains
      the maestria state
- [ ] Unit tests pass for state CRUD, handoff trimming,
      summary rendering

### Verification

```bash
# Tests
npm test -- tests/state.test.ts tests/compaction.test.ts
```

```bash
# Live test: start a session, fill the context, /compact
pi -e ./packages/pi
# After compaction, /maestria-status should still show state
```

### Files Touched

- `packages/pi/src/state.ts` (new)
- `packages/pi/src/compaction.ts` (new)
- `packages/pi/src/extension.ts` (update — install
  compaction handlers)
- `packages/pi/tests/state.test.ts` (new)
- `packages/pi/tests/compaction.test.ts` (new)

### Dependencies

Phase 1.

### Estimated Time

1 day.

---

## Phase 4: Prompt Templates

**Status: ⏳ Not started.**

### Goal

Author the 8 prompt templates (orchestrator + 7 specialists)
in `prompts/`. Each is invoked as a `/<name>` command and
expands to the specialist's methodology.

### Exit Criteria

- [ ] All 8 `.md` files exist in `prompts/`:
      `orchestrator.md`, `adventurer.md`, `architect.md`,
      `planner.md`, `builder.md`, `diagnose.md`,
      `reviewer.md`, `writer.md`
- [ ] Each prompt has YAML frontmatter with `description`
      and (for the orchestrator) `argument-hint`. The
      `description` is required for editor autocomplete UX
      (per `prompt-templates.md:32`).
- [ ] Each prompt body follows the 4-bucket skill prescription
      (per [`docs/adr/ADR-004-agent-prompt-template.md`](../adr/ADR-004-agent-prompt-template.md))
- [ ] Each prompt body has the 5-section handoff contract
- [ ] Each prompt body has the iteration-limits section
- [ ] Each prompt body has the 4 standard rules bullets
- [ ] In a running Pi session, `/adventurer <task>` expands
      to the adventurer prompt and the LLM responds in
      adventurer methodology
- [ ] All 8 prompts are loadable, no parse errors

#### Example: orchestrator.md frontmatter

```markdown
---
description: Run the maestria default pipeline on a goal. Use when the
  user types `/orchestrate <goal>` or when the LLM needs to delegate to
  multiple specialists in sequence.
argument-hint: '<goal>'
---
```

The 6 other specialist templates follow the same shape (without
`argument-hint` unless they take a single positional arg). The
body content is adapted from
[`packages/opencode/agents/<specialist>.md`](../../packages/opencode/agents/).

### Verification

```bash
# Live test each prompt
pi -e ./packages/pi
# Type: /adventurer Find the auth module
# Type: /builder Add a /healthz endpoint
# Type: /orchestrate Add OAuth support
# etc.
```

```bash
# Frontmatter validation (per Agent Skills spec)
# Name rules: 1-64 chars, lowercase, hyphens
# Description: max 1024 chars
# No special characters in name

# Use a small script to validate all 8 files
node scripts/validate-prompts.mjs
```

### Files Touched

- `packages/pi/prompts/orchestrator.md` (new — adapted from
  opencode orchestrator)
- `packages/pi/prompts/adventurer.md` (new)
- `packages/pi/prompts/architect.md` (new)
- `packages/pi/prompts/planner.md` (new)
- `packages/pi/prompts/builder.md` (new)
- `packages/pi/prompts/diagnose.md` (new)
- `packages/pi/prompts/reviewer.md` (new)
- `packages/pi/prompts/writer.md` (new)
- `packages/pi/scripts/validate-prompts.mjs` (new — CI script)
- `packages/pi/tests/prompts.test.ts` (new — parse + validate
  each prompt's frontmatter)

### Dependencies

Phase 2 (rules injection working). Phase 4 doesn't depend on
compaction, but it's nice to have the rules in the system
prompt when testing specialist prompts.

### Estimated Time

3 days. Most of the time is content adaptation from the
opencode agents, not coding.

---

## Phase 5: Orchestration Hooks

**Status: ⏳ Not started.**

### Goal

Wire the `subagent` custom tool (backed by
`@gotgenes/pi-subagents`), the `/orchestrate` command,
and the handoff recording. The orchestrator can now delegate
to specialists via the in-process subagent runtime.

> **Scope reduction (ADR-015):** This phase no longer builds
> the subagent tool from scratch. Instead, it integrates
> `@gotgenes/pi-subagents` for subagent dispatch and implements
> the handoff contract pre-check on top. Estimated code: ~100
> lines (vs ~400 for a custom subprocess implementation).
>
> **Convergent with main:** The orchestrator prompt on main now has **zero read
> tools** (no `read`, `grep`, `glob`). It is a pure dispatcher. The Pi
> orchestrator follows the same pattern: it delegates via `subagent(...)` calls
> and does no methodology work in the parent session. The 7 CRITICAL RULES
> (streamlined from 10) and the "dispatcher" mandate are consistent with this
> architecture.

### Exit Criteria

- [ ] `src/subagent.ts` integrates `@gotgenes/pi-subagents`
      for subagent dispatch
- [ ] Handoff contract pre-check function
      (`validateHandoff`) is implemented in the dispatch
      pipeline — verifies all 6 fields present and non-empty,
      rejects with clear error if malformed
- [ ] Spec-driven orchestration is wired on top of subagent
      lifecycle events (`subagents:*`)
- [ ] The tool supports single, parallel (max 8), and chain
      modes (with `{previous}` substitution)
- [ ] The tool records handoffs in `MaestriaState`
- [ ] The tool blocks tasks with agents that don't exist in
      the allowed list
- [ ] `src/commands.ts` exists with `/orchestrate` (sends
      user message triggering orchestrator)
- [ ] In a running Pi session: - `/orchestrate <goal>` triggers the orchestrator
      template - The orchestrator's `subagent({ agent, task })` calls
      succeed - The handoff history is visible via
      `/maestria-status`

### Verification

```bash
# Unit test (mocked pi API)
npm test -- tests/subagent.test.ts

# Live test
pi -e ./packages/pi
# /orchestrate Find the auth module's session handling
# Expect: orchestrator template expands, LLM calls
# subagent(adventurer, ...), subagent spawns in-process,
# handoff recorded
```

### Files Touched

- `packages/pi/src/subagent.ts` (new — ~100 lines adapter
  layer, reduced from ~400 lines subprocess approach)
- `packages/pi/src/commands.ts` (new — `/orchestrate`,
  `/maestria-status`)
- `packages/pi/src/extension.ts` (update — install subagent
  tool and commands)
- `packages/pi/tests/subagent.test.ts` (new)

### Dependencies

Phase 1 (pi-subagents dependency installed), Phase 3 (state
module), Phase 4 (orchestrator prompt template, but the
subagent tool doesn't depend on the prompt content).

### Estimated Time

1 day. The adapter layer is ~100 lines plus validation logic,
significantly less than the original ~400 line subprocess
tool.

---

## Phase 6: Maker/Checker Enforcement

**Status: ⏳ Not started.**

### Goal

The maker/checker split is enforced via three layers:
subprocess toolset restriction, `tool_call` interception,
and prompt discipline. The `/review` command switches the
active model for review turns.

### Exit Criteria

- [ ] `src/tools.ts` exists with the `tool_call` interceptor
- [ ] The interceptor blocks `edit` / `write` / destructive
      `bash` when `state.reviewMode === true`
- [ ] The interceptor always blocks dangerous patterns
      (`rm -rf`, `dd if=`, `> /dev/sda`, `chmod -R 777 /`) with a user
      confirm — inlined from Pi's `permission-gate.ts` example
- [ ] `src/commands.ts` adds the `/review` command
- [ ] The `/review` command:
  1. Saves the current model
  2. Switches to `maestria.reviewModel` (or a different
     provider if unset)
  3. Sets `state.reviewMode = true`
  4. Sends the user message
  5. Restores the model and clears `reviewMode` after the
     turn
- [ ] In a running Pi session:
  - `/review` with an active `edit` tool available cannot
    make edits
  - The model switches during review (visible in the
    status line)
  - The reviewer prompt template is used

### Verification

```bash
# Unit tests
npm test -- tests/tools.test.ts
```

```bash
# Live test
pi -e ./packages/pi
# /review src/auth/session.ts
# Attempt: edit a file
# Expect: blocked with "Review mode is active"
# Status: model switched to a different provider
```

### Files Touched

- `packages/pi/src/tools.ts` (new — ~80 lines)
- `packages/pi/src/commands.ts` (update — add `/review`)
- `packages/pi/src/extension.ts` (update — install tool
  interceptors)
- `packages/pi/tests/tools.test.ts` (new)

### Dependencies

Phase 3 (state for `reviewMode` flag), Phase 5 (commands
file), Phase 4 (reviewer prompt template).

### Estimated Time

0.5 days. Safety patterns are inlined into `src/tools.ts`
(instead of a separate `src/safety.ts`), reducing scaffolding
and test overhead.

---

## Phase 7: Skills & Methodology

**Status: ⏳ Not started.**

### Goal

Bundle the 2 methodology skills (handoff, iteration-limits)
so specialists have on-demand access without requiring user
installation. Plus the `/handoff` command that generates a
new-session handoff prompt.

### Exit Criteria

- [ ] `skills/handoff/SKILL.md` exists, follows the Agent
      Skills spec
- [ ] `skills/iteration-limits/SKILL.md` exists, follows the
      spec
- [ ] In a running Pi session, the skills appear in the
      system prompt's "Available skills" list
- [ ] The handoff skill loads via `/skill:handoff` and
      `/skill:iteration-limits`
- [ ] `/handoff <goal>` generates a handoff prompt and
      creates a new session with the prompt in the editor
- [ ] The specialist prompt templates reference the skills
      correctly (e.g., "Load `/skill:handoff` before
      writing a handoff")

### Verification

```bash
# Skill frontmatter validation
node scripts/validate-skills.mjs

# Live test
pi -e ./packages/pi
# /skill:handoff
# Expect: full SKILL.md body loaded
# /handoff "Continue with phase 2"
# Expect: new session with handoff prompt in editor
```

### Files Touched

- `packages/pi/skills/handoff/SKILL.md` (new)
- `packages/pi/skills/iteration-limits/SKILL.md` (new)
- `packages/pi/src/commands.ts` (update — add `/handoff`)
- `packages/pi/scripts/validate-skills.mjs` (new)
- `packages/pi/tests/skills.test.ts` (new — frontmatter
  validation)

### Dependencies

Phase 5 (commands file), Phase 4 (specialist prompts that
reference the skills).

### Estimated Time

1 day.

---

## Phase 8: Polish & Publish

**Status: ⏳ Not started.**

### Goal

The package is documented, tested, and ready for npm
publication via the changesets workflow.

### Exit Criteria

- [ ] `README.md` is comprehensive (matches the opencode
      package's README depth)
- [ ] `CHANGELOG.md` has the v0.1.0 entry
- [ ] All tests pass: `npm test` from `packages/pi/`
- [ ] Linting passes: `vp check` from `packages/pi/`
- [ ] Type checking passes: `tsc --noEmit`
- [ ] Build succeeds: `npm run build`
- [ ] A changeset is added: `.changeset/<random>.md` with
      `@maestria/pi` minor bump
- [ ] `vp check` passes at the monorepo root
- [ ] `vp run -r test` passes at the monorepo root
- [ ] Manual end-to-end test:
  1. `pi install ./packages/pi`
  2. In interactive Pi: `/orchestrate Add a /healthz endpoint`
  3. Verify: orchestrator delegates, subprocesses spawn,
     review happens, completion promise is checked
- [ ] `npm publish` from `packages/pi/` (or via changesets
      release flow)

### Verification

```bash
# From monorepo root
vp check
vp run -r test
vp run -r build

# From packages/pi/
npm run build
npm test
npm pack    # Verify the tarball contains the right files
tar -tzf maestria-pi-0.1.0.tgz | head -30

# Live test (the full integration test)
pi install ./packages/pi
# ... full /orchestrate flow ...
```

### Files Touched

- `packages/pi/README.md` (full rewrite)
- `packages/pi/CHANGELOG.md` (new — v0.1.0 entry)
- `packages/pi/LICENSE` (copy from monorepo root `../../LICENSE`)
- `.changeset/<random>.md` (new)
- `packages/pi/src/extension.ts` (final polish)
- `packages/pi/src/*.ts` (any final fixes)
- `packages/pi/tests/*.test.ts` (any final coverage)

### Dependencies

All prior phases.

### Estimated Time

1.5 days.

---

## Total Estimated Effort

| Phase | Days | Cumulative |
| ----- | ---- | ---------- |
| 0     | Done | 0          |
| 1     | 0.5  | 0.5        |
| 2     | 0.5  | 1.0        |
| 3     | 1.0  | 2.0        |
| 4     | 3.0  | 5.0        |
| 5     | 1.0  | 6.0        |
| 6     | 0.5  | 6.5        |
| 7     | 1.0  | 7.5        |
| 8     | 1.5  | 9.0        |

**Total: 9 working days of focused implementation.**
(Reduced from 11 following ADR-015, then from 10 after
safety.ts consolidation inlining patterns into tools.ts.)

This is a rough estimate. Phase 4 (prompt templates) is the
most variable — if the opencode agent content can be
mechanically adapted, it's 1 day; if it requires rewriting
for Pi's prompt-template syntax, it's 3–4 days.

## Critical Path

The critical path (phases that gate other phases):

```
Phase 1 → Phase 2 → Phase 4 → Phase 5 → Phase 6 → Phase 8
```

Phase 3 (compaction) and Phase 7 (skills) can run in parallel
with the critical path after their dependencies are met.

## Review Checkpoints

After each phase, the user (or `@reviewer`) reviews the
output. The phase is "done" only after the review passes.

| Phase | Review Focus                                                         |
| ----- | -------------------------------------------------------------------- |
| 1     | Does the package install and load in Pi?                             |
| 2     | Are the global rules visible in the system prompt?                   |
| 3     | Does the compaction summary include maestria state?                  |
| 4     | Are all 8 prompts well-formed and aligned with opencode methodology? |
| 5     | Does the subagent tool actually spawn and stream?                    |
| 6     | Is the maker/checker split enforced?                                 |
| 7     | Do the skills load on demand?                                        |
| 8     | Is the package ready for npm publish?                                |

## Rollback Plan

Each phase is independently revertible. If a phase introduces
a regression, we revert that phase's commits and re-plan.

Phase 1 is the most critical to get right — if the package
doesn't install, no subsequent phase matters. We verify the
install path end-to-end before moving on.

## Success Metrics (Post-Publish)

After the package is published, we measure:

1. **Install success rate** — `pi install npm:@maestria/pi`
   succeeds on a clean Pi 0.79.x install.
2. **Prompt expansion rate** — all 8 `/<specialist>` commands
   expand correctly.
3. **Subagent delegation rate** — `/orchestrate <goal>` results
   in at least one `subagent(...)` tool call.
4. **Review mode enforcement** — `/review` followed by an
   `edit` attempt is blocked.
5. **Compaction recovery** — a session compacted mid-task can
   resume after the compaction summary is loaded.

These are user-facing tests in the README, plus a
`tests/integration.test.ts` that runs them against a real Pi
process (deferred to a later phase if Pi's test infrastructure
doesn't support it).

## Date

2026-06-18
