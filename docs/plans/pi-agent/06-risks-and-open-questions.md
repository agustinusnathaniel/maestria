# 06. Risks and Open Questions

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

1. The orchestrator uses the `subagent` custom tool to
   delegate work. The tool spawns a **separate `pi`
   subprocess** with an isolated context window. The
   specialist's work happens in the subprocess; only the
   final output flows back to the parent.
2. When the user directly invokes `/specialist`, the
   specialist's prompt is appended to the current
   conversation. The methodology assumes this is for
   **scoped** tasks (single specialist, no chain) and
   the LLM can handle the in-context reasoning.

The trade-off: direct `/specialist` invocations are
cheaper (no subprocess) but riskier (shared context);
orchestrator-mediated `subagent` invocations are more
expensive (subprocess) but safer (isolated context).

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

**Mitigation.** Three layers (see
[`02-integration-strategy.md` §3](./02-integration-strategy.md)):

1. Subprocess toolset restriction (`--tools
read,grep,find,ls`) — the strongest layer.
2. `tool_call` event interceptor — defense in depth.
3. Prompt discipline — advisory.

In practice, all three hold. The risk is a future Pi
API change that makes one layer ineffective.

**Status:** Partial mitigation. We accept the trade-off.
Documented in the README and in the orchestrator
prompt's CRITICAL RULES.

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

**Mitigation.**

1. The handoff contract is in the handoff skill
   (`/skill:handoff`), which the LLM loads on demand.
2. The specialist prompt template starts with "If
   anything is unclear or ambiguous, ask before
   proceeding."
3. We can add a `subagent` tool pre-check that
   validates the handoff has 6 sections (with a soft
   warning) in a future version. For v1, this is
   advisory.

**Status:** Partial mitigation. We accept the
advisory-only approach for v1.

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

**Mitigation.**

1. We use `pi.appendEntry` to persist a minimal state
   snapshot. On `session_start`, we read the entries
   and rebuild the state.
2. This is deferred to v1.1. For v1, we accept the
   reset on `/reload` and document it.

**Status:** Partial mitigation. v1 is fine for
non-`/reload` users; v1.1 adds persistence.

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

**Mitigation.** **v1 (partial):** We render the maestria state
as a markdown block and append a pointer to "see session
for full history" rather than the full auto-summary. The
state is capped at `MAX_FILE_REFS = 10` for `filesRead` /
`filesModified` and at the last 5 handoffs (see
[`02-integration-strategy.md` §6](./02-integration-strategy.md)).
This keeps the summary small but loses some conversation
context.

**v1.1 (full):** Use the `convertToLlm` and
`serializeConversation` helpers from
`@earendil-works/pi-coding-agent` to produce Pi's default
LLM-summarization of the messages-to-summarize, then
prepend the maestria state and append the "see session
for full history" pointer. The custom-compaction example
at
[`examples/extensions/custom-compaction.ts:54,90-99`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-compaction.ts)
shows the pattern.

**Status:** Partial mitigation. v1 ships the
state-only summary; v1.1 adds the LLM-summarization
fallback.

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
custom subagent tool, compaction preservation).

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

---

## Mitigations Summary

| Risk | Likelihood | Severity | Mitigation Status          |
| ---- | ---------- | -------- | -------------------------- |
| R-01 | High       | Medium   | Full                       |
| R-02 | Medium     | Medium   | Full                       |
| R-03 | High       | Low      | Full                       |
| R-04 | Low/High   | High     | Full                       |
| R-05 | Low        | Medium   | Partial                    |
| R-06 | High       | Medium   | Full                       |
| R-07 | Medium     | Low      | Full                       |
| R-08 | High       | Low      | Full                       |
| R-09 | Medium     | Low      | Partial                    |
| R-10 | Medium     | Medium   | Partial                    |
| R-11 | High       | Low      | Full                       |
| R-12 | Low        | Low      | Full                       |
| R-13 | High       | Medium   | Partial (v1) / Full (v1.1) |

## Open Questions Summary

| Question | Status                    |
| -------- | ------------------------- |
| O-01     | Defer                     |
| O-02     | Defer                     |
| O-03     | Defer                     |
| O-04     | Resolve-in-phase-1        |
| O-05     | Defer                     |
| O-06     | Resolve-now (ESM-only)    |
| O-07     | Resolve-now (yes)         |
| O-08     | Resolve-now (all 8 in v1) |
| O-09     | Resolve-in-phase-2        |
| O-10     | Resolve-in-phase-5        |
| O-11     | Defer                     |

## Date

2026-06-18
