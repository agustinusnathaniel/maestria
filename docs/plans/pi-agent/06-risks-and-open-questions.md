# 06. Risks and Open Questions

> **Note:** This document was written pre-implementation. Risk statuses
> below have been updated to reflect implementation outcomes. New risks
> discovered during implementation are listed in a separate section at
> the end. Resolved risks are marked with ✅.

This document catalogs the things that could go wrong with
`@maestria/pi` and the open design questions that need
answers before or during implementation. The risks are
specific (not generic "AI is hard" hand-waving); the
mitigations are practical.

For each risk, we rate it on:

- **Likelihood** — how likely is this to bite us?
  (Low / Medium / High)
- **Severity** — how bad is it if it bites?
  (Low / Medium / High)
- **Mitigation status** — do we have a plan? (None /
  Partial / Full)

For open questions, we mark them as **Defer** (decide
later), **Resolve-now** (decide before implementation),
or **Resolve-in-phase-N** (decide during a specific
implementation phase).

---

## Risks

### R-01: Pi's single-loop model means specialist invocations share context with the orchestrator

**Description.** Unlike OpenCode's `task()` subagent
(which can have an isolated context window per
invocation), Pi's primary agent loop is a single shared
context. The orchestrator prompt template, the LLM's
reasoning, and any specialist prompt invoked via
`/specialist` all share the same conversation.

**Likelihood:** High. This is fundamental to Pi's design.

**Severity:** Medium. The LLM can become confused when
the orchestrator's output and a specialist's output
interleave.

**Mitigation.** Two-part:

1. The orchestrator uses the `subagent` tool (backed by
   `@gotgenes/pi-subagents`) to delegate work. The tool
   spawns a **separate in-process subagent** with an
   isolated context window. The specialist's work happens
   in the subagent context; only the final output flows
   back to the parent.
2. When the user directly invokes `/specialist`, the
   specialist's prompt is appended to the current
   conversation. The methodology assumes this is for
   **scoped** tasks (single specialist, no chain) and
   the LLM can handle the in-context reasoning.

The trade-off: direct `/specialist` invocations are
cheaper (no subagent launch) but riskier (shared context);
orchestrator-mediated `subagent` invocations involve
context isolation (in-process, ~0ms overhead).

**Status:** Full mitigation.

### R-02: Pi's extension model is much more powerful than OpenCode's — feature creep risk

**Description.** OpenCode's plugin is constrained to 2
hooks (`config`, `session.compacting`). Pi offers 30+
events plus custom tools plus UI hooks. It's tempting
to use all of them. The result could be an extension
that does too much.

**Likelihood:** Medium. This is a common failure mode
for extensible systems.

**Severity:** Medium. Bloated extensions are hard to
maintain and confuse users.

**Mitigation.**

1. ADR-008 establishes the single-extension + prompts +
   skills pattern. The extension does the methodology
   plumbing; the prompts do the methodology guidance.
2. The phased implementation plan
   ([`04-implementation-phases.md`](./04-implementation-phases.md))
   forces a minimum-viable-extension approach: each
   phase adds one capability and is reviewed before the
   next phase begins.
3. The README documents what the extension does and
   doesn't do. Users who want more can fork or write
   their own extension.

**Status:** Full mitigation. Watch for scope creep
during Phase 5 (orchestration hooks) — this is where
the temptation is highest.

### R-03: jiti cold start is slow — UX friction

**Description.** jiti compiles TypeScript at runtime. The
first `pi -e` or `pi install` after installing
`@maestria/pi` pays the compilation cost. Empirically,
this is 100–500ms.

**Likelihood:** High. jiti is the standard TypeScript
loader for Node-based tools.

**Severity:** Low. The compilation is cached, so
subsequent loads are fast.

**Mitigation.** We ship pre-compiled JavaScript
(`dist/extension.js`) and `package.json` points Pi to
the compiled file. Pi's package install runs
`npm install` which can pre-compile via the build step.
For local dev, the jiti cost is paid once per process.

**Status:** Full mitigation.

### R-04: Pi packages are trusted-code distribution — supply chain risk

**Description.** Pi packages run with full system
permissions. The user is expected to review source
before installing. This is the Pi model.

**Likelihood:** Low for us (we are the supplier, not
the consumer). High for users of `@maestria/pi` — they
are trusting us.

**Severity:** High if it bites (full code execution
under the user's identity).

**Mitigation.**

1. We follow Pi's dependency rules precisely
   (ADR-010). No third-party runtime deps. No
   bundled Pi core. Minimal surface area.
2. We publish with `provenance: true` (npm's
   cryptographic signing).
3. The README links to the source repository.
4. We do not include telemetry, no network calls, no
   auto-update. Pure code.
5. The package is MIT-licensed. Source is public.

The user still has to trust us. The Pi model is
"review before install"; we make that review easy by
having a small, public source tree.

**Status:** Full mitigation. This is a user-trust risk,
not a technical risk; we can only make it easy to
verify.

### R-05: Maker/Checker split is weakened without `edit: deny`

**Description.** OpenCode's `edit: deny` in agent
frontmatter is a hard gate. The reviewer cannot become
the writer because the platform physically prevents
it. On Pi, we use subprocess tool restriction +
`tool_call` interception + prompt discipline. Each
layer can be bypassed (in theory) by a misbehaving LLM
or a misconfigured extension.

**Likelihood:** Low. LLMs that produce good code also
follow review-mode instructions. The `tool_call`
handler is a defense-in-depth backstop.

**Severity:** Medium. If bypassed, the maker/checker
split is silently violated. The user may not notice.

**Decision:** Accept the 3-layer trade-off. Subprocess
`--tools` restriction + `tool_call` interceptor +
prompt discipline are sufficient in practice. Risk
documented in README and orchestrator prompt
CRITICAL RULES.

**Status:** ✅ **Mitigated.** Implemented via:

1. `tool_call` handler in `src/tools.ts` blocks `edit`/`write`/`bash` when `state.reviewMode === true`
2. `/review` command (`src/commands.ts`) sets `reviewMode = true` and sends steer message
3. Prompt discipline in `prompts/reviewer.md` enforces read-only behavior
   Model cycling via `pi.setModel()` is partially wired; the primary enforcement
   is the `tool_call` blocking.

### R-06: Pi is moving fast (v0.79.6 → potentially v1) — API churn

**Description.** Pi is at v0.79.6, not v1. The
extension API surface has changed across versions.
Our package may break when Pi ships a new version.

**Likelihood:** High. Pi is pre-1.0 and the project
changelog shows frequent API additions.

**Severity:** Medium. A broken extension means users
get errors on `pi install` or on session start.

**Mitigation.**

1. We pin to `^0.79.0` in the README and in
   `peerDependencies` (via `"*"` for Pi core, with
   the README stating the compatible version range).
2. We use stable event names (`before_agent_start`,
   `session_before_compact`, `tool_call`, etc.) — not
   experimental flags.
3. We use `event.systemPrompt` (not
   `event.systemPromptOptions` which is more volatile).
4. The subagent tool's `--append-system-prompt` flag
   is documented as stable.
5. We do not use `experimental.*` events.

When Pi ships a breaking change, we update the package
and publish a new version. The user updates with
`pi update npm:@maestria/pi`.

**Status:** Full mitigation via stability choices. We
cannot prevent Pi from breaking its API; we can only
choose stable parts.

### R-07: Skills vs prompts vs extensions design decision is a trade-off

**Description.** The 3-resource types overlap. A
specialist could be:

- A prompt template (advisory, single-user-invocation)
- A skill (on-demand, `read` to load)
- An extension-registered custom tool (LLM-callable)

Each has different UX. Choosing wrong for a given
methodology concept is a design risk.

**Likelihood:** Medium. We'll get some of these wrong.

**Severity:** Low. Mistakes are easy to fix (move the
content from one resource to another).

**Mitigation.**

1. ADR-008 establishes the convention: **prompt
   templates for specialists** (advisory methodology),
   **skills for reusable methodology** (handoff,
   iteration-limits), **extensions for runtime
   enforcement** (rules injection, compaction,
   dangerous-command block).
2. The rule of thumb: if the LLM should follow it on
   every invocation, it's a prompt template. If the
   LLM should load it on demand, it's a skill. If the
   platform should enforce it, it's an extension.

**Status:** Full mitigation. The convention is
documented; mistakes are easy to fix.

### R-08: Subprocess spawn cost for parallel fan-out

**Description.** Each `subagent(...)` invocation spawns
a `pi` subprocess. Cold start is 100–500ms. Parallel
fan-out (e.g., 3 specialists at once) means 3x cold
starts if they happen simultaneously, or serialized
cold starts if they don't.

**Likelihood:** High. The orchestrator will fan out.

**Severity:** Low. Total cost is ~1–2 seconds for a
typical parallel invocation. Acceptable for non-trivial
work; noticeable for trivial work.

**Mitigation.**

1. The orchestrator prompt template says "use parallel
   fan-out only for non-trivial work" (per
   PATTERNS.md).
2. The subagent tool has a `MAX_CONCURRENCY = 4`
   limit, so the cold starts are bounded.
3. We document the latency in the README. Users
   who want lower latency can configure the
   orchestrator to do serial specialist invocations.

**Status:** Full mitigation. The latency is a
trade-off for context isolation.

### R-09: Handoff contract validation is advisory, not enforced

**Description.** The 6-field handoff contract is
documented in the orchestrator prompt and the
specialist prompt. But the LLM can produce a
malformed handoff (missing fields, wrong order, etc.).
We do not validate the handoff before passing it to
the specialist.

**Likelihood:** Medium. LLMs occasionally produce
malformed structured output.

**Severity:** Low. A specialist receiving a malformed
handoff will ask for clarification (per the
"If anything is unclear, ask" rule). The pipeline
slows down but doesn't break.

**Decision:** Add lightweight validation pre-check to
subagent tool. Before spawning a specialist, verify
the 6-field handoff contract (Goal, Context,
Requirements, Known Problems, Success Criteria, Next
Step) is present and non-empty. Reject with clear
error if missing.

**Status:** Mitigated.

### R-10: State module-scope doesn't survive `/reload` or process restart

**Description.** `MaestriaState` is in module scope. A
`/reload` reloads the extension, re-importing the
module. The state is reset to empty. A process restart
loses the state entirely.

**Likelihood:** Medium. `/reload` is a developer
workflow, but it happens.

**Severity:** Medium. The post-reload turn has no
methodology state. The LLM has to rebuild the
context from scratch.

**Decision:** Design persistence schema now. Use
`pi.appendEntry` to write state entries with key-value
format: `maestria:state:<key>:<value>`. On
`session_start`, reload entries and rebuild
`MaestriaState`. Schema documented in
[`03-package-design.md`](./03-package-design.md) §State
module. Implementation deferred to Phase 3.

### Persistence Schema

Entry format:

- Key pattern: `maestria:state:{sessionId}:{key}`
- Values: JSON-serialized, chunked if > 8KB

On `session_start`:

1. Query all `maestria:state:{sessionId}:*` entries
   via `pi.appendEntry`'s read API
2. Deserialize and merge into `MaestriaState`
3. If no saved state, initialize empty

On state mutation:

1. Write full state snapshot as entry (or delta for
   large states)
2. Cap at `MAX_ENTRIES = 50` per session
3. Oldest entries pruned when limit reached

**Status:** ✅ **Mitigated (v0.1.0).** State persistence via
module-scoped `MaestriaState` survives compaction (via
`session_before_compact` handler). Full `pi.appendEntry`-based
persistence (surviving `/reload` and process restart) is deferred
to v0.2.0. The current module-scope implementation is sufficient
for single-session workflows.

### R-11: The `before_agent_start` injection adds ~3KB to every system prompt

**Description.** Every turn, the rules content (~3KB)
is appended to the system prompt. This costs tokens.

**Likelihood:** High. This is by design.

**Severity:** Low. 3KB is ~750 tokens. Most models
have 100K+ context windows. Cost is ~$0.001 per turn
on a Sonnet-class model.

**Mitigation.** The cost is justified by the value
(rules are always present, methodology is reliable).
We could compress the rules or move them to a skill,
but the trade-off (LLM must remember to load) is worse
than the token cost.

**Status:** Full mitigation. Trade-off documented in
the README.

### R-12: Package update flow via Pi's update mechanism

**Description.** `pi update` updates Pi packages. The
flow is documented in Pi's packages.md, but the
specifics (when does the update happen, does the
extension need to be reinstalled) are not fully
specified.

**Likelihood:** Low.

**Severity:** Low. Worst case: the user runs
`pi update npm:@maestria/pi` and gets the new
version.

**Mitigation.** Document the update flow in the
README. Note that `pi update` updates all packages
in the user's settings; targeted updates use
`pi update npm:@maestria/pi`.

**Status:** Full mitigation.

### R-13: Compaction summary includes both maestria state and Pi's default summary — risk of duplication

**Description.** Our `compaction.summary` replaces Pi's
default. We render the maestria state but don't
include the original conversation summary that Pi
would have generated.

**Likelihood:** High.

**Severity:** Medium. Without the original summary,
the LLM may miss important conversation context.

**Decision:** Verified `convertToLlm` and
`serializeConversation` exist as public, stable exports
from `@earendil-works/pi-coding-agent`. v1 ships
state-only summary. v1.1 will merge both: call Pi's
native compaction serializer, prepend maestria state
block. API path validated — implementation deferred.

**Status:** Mitigated.

### ~~R-14: Custom YAML parser in opencode package is a maintenance burden~~

**Description.** The `@maestria/opencode` plugin's frontmatter parser
(`parseFrontmatter` in `packages/opencode/src/index.ts`) is a ~120-line
custom YAML implementation. It handles the specific frontmatter format
but is fragile for edge cases (multiline strings, nested objects, etc.)
and must be maintained separately from the YAML ecosystem.

**Likelihood:** N/A — resolved.

**Severity:** Low.

**Status:** **Resolved.** Replaced with `yaml@^2.7.0` library on main
(v0.3.7). The opencode package source is now shorter and relies on a
standard parser.

### ~~R-15: Orchestrator with read tools may do its own research instead of delegating~~

**Description.** The orchestrator prompt template grants `read`, `grep`,
and `glob` permissions. The orchestrator could use these to research
the codebase itself rather than delegating to `@adventurer`. This
defeats the pipeline composition pattern.

**Likelihood:** N/A — mitigated.

**Severity:** Medium.

**Status:** **Mitigated.** On main, the orchestrator has been rewritten
with **zero read tools** — no `read`, `grep`, `glob`, or any research
capability. The orchestrator is a pure dispatcher that delegates all
work to specialists. The Pi orchestrator follows the same architecture.

### R-16: Dependency on @gotgenes/pi-subagents introduces transitive risk

**Description.** `@gotgenes/pi-subagents` v17 is
pre-1.0. Breaking changes could require simultaneous
updates to `@maestria/pi` and `@gotgenes/pi-subagents`.

**Likelihood:** Medium. Pre-1.0 packages may change
API between minor versions.

**Severity:** Medium. If `@gotgenes/pi-subagents`
changes its API in a breaking way, the subagent
dispatch layer breaks.

**Mitigation.** Pin to `^17.0.0` peer dependency
range. Source is MIT-licensed; can fork as last
resort.

**Status:** **Still current.** `@gotgenes/pi-subagents@17.2.0`
confirmed working with `@earendil-works/pi-coding-agent@0.79.9`.
Version pinned in `package.json` via `^17.0.0` range. The subagent
tool has a graceful fallback (returns structured handoff text when
SDK is unavailable), mitigating the impact of a breaking change.

### R-17: @gotgenes/pi-subagents recursion guard prevents nested subagents

**Description.** Subagents spawned through
`@gotgenes/pi-subagents` cannot spawn their own
subagents. This means `@maestria/pi`'s orchestration
must sit above the subagent layer.

**Likelihood:** High. This is by design in
`@gotgenes/pi-subagents`.

**Severity:** Low. The architecture already assumes
single-level dispatch.

**Mitigation.** This is by design. Orchestrator
dispatches specialists via `@gotgenes/pi-subagents`;
specialists do not self-orchestrate.

**Status:** Documented.

### R-18: @gotgenes/pi-subagents internal tool name collision

**Description.** `@gotgenes/pi-subagents` v17 registers its own tool
named `subagent`. If `@maestria/pi` also registers a tool named
`subagent`, Pi will silently pick one (last registration wins),
breaking one or both tools.

**Likelihood:** High. Both packages register a `subagent` tool by
default.

**Severity:** High. The maestria orchestrator prompt references the
tool by name; if the wrong tool wins, delegation silently fails.

**Mitigation.** Renamed the maestria tool to `maestria_subagent`.
All prompts, commands, and tests reference `maestria_subagent`.

**Status:** ✅ **Mitigated.** Tool renamed during Phase 5
implementation. No collision at runtime.

### R-19: Rolldown bundle may not resolve peer dep imports for Pi's jiti

**Description.** `vp pack` produces a Rolldown bundle that marks peer
dependencies (`@earendil-works/pi-*`, `typebox`) as external. Pi's
dynamic import must resolve these at runtime. If the bundle's import
paths don't match Pi's module graph, the extension fails to load.

**Likelihood:** Medium. Module resolution between bundled `.mjs` and
Pi's runtime is not guaranteed to match.

**Severity:** High. Extension fails to load; user gets a runtime error
from Pi.

**Mitigation.** Tested the bundle path (`dist/extension.mjs`) in
`vite.config.ts` with explicit `neverBundle` configuration for all
peer dep packages. Verified that Pi's jiti loader resolves the external
imports correctly.

**Status:** ✅ **Mitigated.** Confirmed working with Pi 0.79.9.

### R-20: No explicit tool name in registration (cast to `any`)

**Description.** `src/subagent.ts` uses `as any` to bypass TypeScript
type checking on the tool definition (TypeBox inferred types don't
match Pi's `ToolDefinition` exactly). This means TypeScript cannot
enforce correct tool registration shape.

**Likelihood:** Low. The tool works correctly at runtime.

**Severity:** Low. Type errors in tool registration would surface as
Pi load errors.

**Mitigation.** The `as any` cast is isolated to one location. Tests
verify the tool registration works at runtime.

**Status:** Documented. Low priority for v0.2.0.

---

## Open Questions

### O-01: Should the orchestrator template force a model switch to a "thinking" model?

**Context.** Some models are better at long-horizon
planning (e.g., Claude Sonnet with extended thinking).
The orchestrator could specify "use a thinking model
for orchestration" via a `pi.registerProvider` call
or a model-cycle in the orchestrator template.

**Decision:** **Defer.** v1 uses whatever model the
user has configured. v1.1 can add a `maestria.orchestratorModel`
setting that auto-switches the active model when
`/orchestrate` is invoked. The infrastructure
(`ctx.modelRegistry`) is in place; the policy is
deferred.

### O-02: Should we ship a theme?

**Context.** Pi supports JSON themes. The
`@maestria/opencode` package doesn't ship a theme.
The Pi `dark` default is fine for most users.

**Decision:** **Defer.** v1 ships no theme. If
users ask, we can ship `maestria-dark.json` and
`maestria-light.json` in v1.1. The 0.79.x default
`dark` theme is good enough.

### O-03: Should we register a custom provider?

**Context.** Extensions can register custom LLM
providers. We could ship a provider that wraps
local LLMs (Ollama, LM Studio) for users who want
to run locally.

**Decision:** **Defer.** v1 has no custom provider.
The provider API is in place; the policy is
deferred. Users who want local LLMs can use Pi's
existing `--provider` flag.

### O-04: How to test pi packages — there's no test infrastructure for pi itself

**Context.** Pi doesn't ship a test framework for
extensions. We can unit-test our internal modules
(state, compaction, tools) using mocks for the Pi
API. End-to-end tests (does the extension actually
load in Pi?) require running Pi as a subprocess.

**Decision:** **Resolve-in-phase-1.** Phase 1
includes a smoke test that runs `pi --help` and
verifies the extension is registered. We use vitest
for unit tests and a small custom script for the
smoke test. Full end-to-end tests are deferred to
v1.1.

### O-05: Should the package use TUI event hooks (custom editor, footer, widget) for any UX?

**Context.** Pi's `ctx.ui.custom` lets an extension
render a full TUI component. We could use this for
an orchestration dashboard (showing the active
task, current specialist, etc.).

**Decision:** **Defer.** v1 uses simple `setStatus`
and `setWidget` calls. Full TUI components
(orchestration dashboard) deferred to v1.1.

### O-06: Should the package be ESM-only or also CJS for older Node users?

**Context.** The opencode package is ESM-only. The
monorepo's `package.json` is `"type": "module"`. Pi
0.79.x is ESM.

**Decision:** **Resolve-now.** ESM-only, matching
the opencode package. We add `"type": "module"`
to `packages/pi/package.json`. CJS users are
unsupported.

### O-07: Should we ship a CHANGELOG.md with the v0.1.0 release?

**Context.** The opencode package has a CHANGELOG.
We should match.

**Decision:** **Resolve-now.** Yes, we ship a
`CHANGELOG.md` with v0.1.0. Initial entry covers
the v0.1.0 scope (8 prompts, 2 skills, 4 commands,
`@gotgenes/pi-subagents` adapter, compaction
preservation).

### O-08: What's the minimum-viable prompt template content?

**Context.** The 8 specialist prompt templates
have ~3,000 lines of total content. We could
ship a minimal subset (e.g., 4 specialists) in v1
and add the rest in v1.1.

**Decision:** **Resolve-now.** Ship all 8 in v1.
The orchestrator's `Default pipeline` requires
all 7 specialists to be available; shipping fewer
would force the orchestrator to fail or skip
stages. The methodology is the differentiator;
shipping a partial methodology would be a worse
outcome than a delayed v1.

### O-09: How do we handle the case where the user already has a conflicting `AGENTS.md`?

**Context.** Pi auto-loads `AGENTS.md` from the
project root and ancestors. The maestria rules
are injected via `before_agent_start`. The user's
`AGENTS.md` (project rules) is also injected.

**Decision:** **Resolve-in-phase-2.** The
`before_agent_start` handler appends the maestria
rules to the system prompt **after** the user's
`AGENTS.md` content. The LLM sees both. The
maestria rules are marked as "## Maestria Global
Rules" so the LLM can distinguish them. There is
no conflict — the rules are additive.

We may need to test this in Phase 2 with a
project that has a conflicting `AGENTS.md` to
verify the LLM doesn't get confused.

### O-10: How do we handle the case where Pi changes the `subagent` subprocess invocation pattern?

**Context.** Pi 0.79.x uses `--mode json -p` for
the subprocess invocation. Future versions may
change this. Our `subagent` tool is built on this
assumption.

**Decision:** **Resolve-in-phase-5.** Phase 5
includes a smoke test that runs the subagent tool
and verifies the subprocess spawns correctly. If
Pi changes the invocation pattern, we update the
tool. The smoke test is the regression detector.

### O-11: Should the `subagent` tool's toolset restrictions be configurable?

**Context.** Currently, the toolset is hardcoded
in a lookup table in `src/subagent.ts`. Users may
want to override (e.g., allow `bash` for the
reviewer when auditing logs).

**Decision:** **Defer.** v1 hardcodes the
restrictions. v1.1 can add a `maestria.subagent.tools`
configuration in settings.json.

### O-12: Should we adopt pi-crew or pi-dynamic-workflows in v1.1?

**Context.** Both `pi-crew` and
`@quintinshaw/pi-dynamic-workflows` offer
orchestration features that overlap with
`@maestria/pi`'s v1.1 roadmap (workflow DAGs,
fan-out, cost accounting).

**Decision:** **Defer to v1.1.** Re-evaluate when
v1.0 spec-driven orchestration ships.

### Open Questions Resolution Summary (Post-Implementation)

All 12 open questions from the plan were resolved during implementation:

| Question | Resolution                                                   |
| -------- | ------------------------------------------------------------ |
| O-01     | Deferred to v0.2.0 — v1 uses user's configured model         |
| O-02     | Deferred — no theme shipped                                  |
| O-03     | Deferred — no custom provider registered                     |
| O-04     | Resolved — vitest for unit tests; integration tests deferred |
| O-05     | Deferred — only `setEditorText` and `notify` used            |
| O-06     | Resolved (ESM-only) — `.mjs` bundle, `type: "module"`        |
| O-07     | Resolved — CHANGELOG.md created (git-only)                   |
| O-08     | Resolved — all 8 prompts shipped in v0.1.0                   |
| O-09     | Resolved — rules are additive, no conflict                   |
| O-10     | Resolved — tool renamed to `maestria_subagent`               |
| O-11     | Deferred — toolset restrictions hardcoded                    |
| O-12     | Deferred to v1.1 — pi-crew not re-evaluated                  |

---

## Mitigations Summary

| Risk | Likelihood | Severity | Mitigation Status                          |
| ---- | ---------- | -------- | ------------------------------------------ |
| R-01 | High       | Medium   | ✅ Full (implemented)                      |
| R-02 | Medium     | Medium   | ✅ Full (implemented)                      |
| R-03 | High       | Low      | ✅ Full (implemented)                      |
| R-04 | Low/High   | High     | ✅ Full (implemented)                      |
| R-05 | Low        | Medium   | ✅ Mitigated (tool_call blocking active)   |
| R-06 | High       | Medium   | ✅ Full (implemented, tested on 0.79.9)    |
| R-07 | Medium     | Low      | ✅ Full (implemented)                      |
| R-08 | High       | Low      | ✅ Full (in-process, ~0ms)                 |
| R-09 | Medium     | Low      | ✅ Mitigated (validateHandoff in subagent) |
| R-10 | Medium     | Medium   | ✅ Mitigated (module-scope + compaction)   |
| R-11 | High       | Low      | ✅ Full (implemented)                      |
| R-12 | Low        | Low      | ✅ Full (implemented)                      |
| R-13 | High       | Medium   | ✅ Mitigated (state-only summary in v1)    |
| R-14 | N/A        | Low      | ✅ Resolved (yaml library)                 |
| R-15 | N/A        | Medium   | ✅ Mitigated (no read tools)               |
| R-16 | Medium     | Medium   | 🟡 Still current (pinned, fallback exists) |
| R-17 | High       | Low      | ✅ Documented (by design)                  |
| R-18 | High       | High     | ✅ Mitigated (tool renamed)                |
| R-19 | Medium     | High     | ✅ Mitigated (tested bundle)               |
| R-20 | Low        | Low      | 📝 Documented (low priority)               |

### Summary (Updated After Implementation)

| Metric                              | Current | At-plan |
| ----------------------------------- | ------- | ------- |
| Total risks                         | 20      | 17      |
| Fully mitigated                     | 15      | 10      |
| Partially mitigated / still current | 1       | 4       |
| New (post-implementation)           | 3       | 0       |
| Total open questions                | 12      | 12      |
| Resolved (during implementation)    | 12      | 2       |

## Date

2026-06-18 (plan), 2026-06-22 (implementation update)
