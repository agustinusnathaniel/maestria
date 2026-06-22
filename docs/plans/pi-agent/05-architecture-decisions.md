# 05. Architecture Decisions — ADRs 008–014

> **Note:** These ADRs were written pre-implementation and their
> decisions were validated (or diverged from) during implementation.
> Annotations below mark the divergences. The ADR statuses remain
> "Accepted" — the decisions still stand, but some implementation
> details changed.

This document records the non-obvious architectural decisions for
`@maestria/pi`. Each ADR follows the Michael Nygard format
(Status, Context, Decision, Consequences) consistent with the
existing maestria ADRs in [`docs/adr/`](../adr/).

Numbering: ADR-008 through ADR-014. ADR-001 through ADR-007
already exist and cover the opencode package.

| ADR     | Title                                                    | Status   | Date       |
| ------- | -------------------------------------------------------- | -------- | ---------- |
| ADR-008 | Single-extension + prompt-templates architecture         | Accepted | 2026-06-18 |
| ADR-009 | Model-cycling for maker/checker                          | Accepted | 2026-06-18 |
| ADR-010 | Bundling strategy for `@maestria/pi`                     | Accepted | 2026-06-18 |
| ADR-011 | Build tool choice (tsc vs tsdown vs unbuild vs no-build) | Accepted | 2026-06-18 |
| ADR-012 | Rules injection via `before_agent_start`                 | Accepted | 2026-06-18 |
| ADR-013 | Compaction state preservation                            | Accepted | 2026-06-18 |
| ADR-014 | Prompt-template argument binding                         | Accepted | 2026-06-18 |

---

## ADR-008: Single-extension + Prompt-templates Architecture

### Status

Accepted

### Context

Pi's plugin model offers three implementation patterns for the
maestria methodology:

1. **Multiple extensions, one per concern** — `rules.ts`,
   `compaction.ts`, `subagent.ts`, etc. as separate
   `pi -e` files or a `pi` manifest array.
2. **One monolithic extension** — a single `extension.ts` with
   all logic inline.
3. **Single extension + prompt templates + skills** — the
   extension handles the methodology plumbing (events, tool
   interception, state); specialists are prompt templates; the
   methodology that specialists reference repeatedly is
   bundled as skills.

We considered the relative trade-offs:

| Pattern                       | Pros                                                                                                                                              | Cons                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Multiple extensions           | Loose coupling, each can be enabled/disabled independently                                                                                        | More surface area, harder to maintain, version drift risk |
| Monolithic                    | Single file to read                                                                                                                               | Unwieldy, ~800 lines in one file, hard to test            |
| Single ext + prompts + skills | Matches the maestria philosophy (advisory in prompts, enforcement in extension), best separation of concerns, prompt templates are user-invokable | Requires care to keep prompt and extension synchronized   |

### Decision

**Choose: Single extension + prompt templates + skills.**

The package is:

- One TypeScript extension (`src/extension.ts`) that wires up
  event handlers, registers the `subagent` tool, and registers
  the user commands.
- 8 prompt templates in `prompts/` (orchestrator + 7
  specialists). Invoked as `/<specialist>` or as inputs to
  the subagent tool.
- 2 skills in `skills/` (handoff, iteration-limits) for
  methodology that specialists reference repeatedly.
- The internal `src/` modules (`rules.ts`, `compaction.ts`,
  `state.ts`, `subagent.ts`, `commands.ts`, `tools.ts`) are
  single-purpose modules, all wired through the single
  `extension.ts` default export.

This mirrors the structure of the opencode package, which has
a single plugin that registers 7 agents and injects rules. The
key difference is that the agents become prompt templates (no
YAML, no per-agent permissions).

### Consequences

- Positive: Methodology is encoded in human-readable
  prompts. Users can read and modify a specialist's behavior
  by editing a `.md` file. The extension enforces what must
  be enforced (rules injection, compaction, dangerous-command
  block, review mode); the prompts guide what should be
  followed.
- Positive: The 8 prompt templates are independently
  invokable. The user can call `/adventurer <task>` directly
  without going through the orchestrator. This is a stronger
  UX than opencode's `@adventurer` mention, which only works
  inside a subagent context.
- Positive: Single extension is easier to install, easier to
  update, and has a single point of failure. If something
  breaks, the user knows which package is responsible.
- Positive: Skills can be referenced by name in any prompt
  template without code-level coupling.
- Negative: The prompt templates and the extension must stay
  in sync. If the extension's `subagent` tool changes its
  parameter shape, the orchestrator prompt must be updated.
  We mitigate by having the orchestrator prompt reference
  the tool's argument syntax explicitly and by treating the
  tool's `description` as a stable contract.
- Negative: Users who want to disable a specific specialist
  cannot do so via package filtering (the prompts array is
  one entry). They can use settings.json's `prompts` filter
  to disable individual templates. Documented in the
  README.
- Negative: The extension file gets larger than the opencode
  one (~500–800 lines vs. 200). Mitigated by single-purpose
  modules.

### References

- [`02-integration-strategy.md`](./02-integration-strategy.md)
- [`03-package-design.md`](./03-package-design.md)
- [`docs/adr/ADR-002-plugin-architecture.md`](../adr/ADR-002-plugin-architecture.md) — the opencode
  equivalent, applied to Pi

> **Note (June 2026):** ADR-002's "custom parser in ~120 lines" (the
> `parseFrontmatter` function) has been replaced on main with the
> `yaml@^2.7.0` library (v0.3.7). The opencode package is now shorter
> than the ~189 lines cited in the plan.

### Date

2026-06-18

---

## ADR-009: Model-Cycling for Maker/Checker Split

### Status

Accepted — fully implemented

> **Note:** Model cycling is implemented in `src/commands.ts` (the `/review`
> command) and `src/tools.ts` (the `tool_call` interceptor that blocks
> destructive tools when `reviewMode` is active). The implementation is
> slightly simpler than the plan: model switching via `pi.setModel()` is
> not yet wired (the `/review` command sets a `reviewMode` flag and sends
> a steer message). The tool-call blocking (`tool_call` returning
> `{ block: true }`) is the primary enforcement mechanism.

### Context

The maker/checker split says the agent that produces work
must not be the agent that validates it. The reason is
commitment bias, context blindness, and toolset overlap.

On Pi, there is no native "fresh agent" primitive. Three
alternatives were considered for review:

1. **Same model, fresh context, restricted tools** — the
   reviewer is invoked in the same session but with a fresh
   system prompt and no `edit`/`write` tools. Cheap, but
   same model = same biases.
2. **Same model, different process, restricted tools** — the
   reviewer is spawned as a subprocess (the subagent
   pattern). Fresh context window, restricted tools, but
   same model. Better than (1) for context isolation.
3. **Different model, fresh process, restricted tools** —
   the `/review` command switches the active model to a
   different provider, then spawns the reviewer. Maximum
   separation: different training, different biases, fresh
   context, restricted tools.

Pi's `ctx.modelRegistry` and `ctx.model` make option (3)
implementable in ~30 lines. Option (1) requires no model
registry code but loses the bias-difference benefit. Option
(2) is the default subagent pattern.

### Decision

**Choose: Model-cycling for `/review`, subprocess + restricted
tools for the orchestrator's reviewer specialist.**

The two cases:

- **Orchestrator's `subagent({ agent: "reviewer" })` calls** —
  use the same model as the parent session, but spawn as
  subprocess with `--tools read,grep,find,ls` (no edit,
  no write, no bash). This is the standard specialist
  pattern. Fresh context window via the subprocess.
- **User-invoked `/review <target>` command** — switch the
  active model to a different provider (configurable via
  `maestria.reviewModel` in settings.json) for the duration
  of the review turn, then switch back. This is the "fresh
  perspective" the methodology asks for. The model cycle
  is the differentiator from opencode.

The `/review` command is a thin wrapper around the model
cycle: save current model, switch to review model, set
`state.reviewMode = true`, send the user message, then
restore the model and clear `reviewMode` after the turn.

The orchestrator prompt template explicitly says "after
`@builder`, dispatch `@reviewer`" (per the opencode
orchestrator's CRITICAL RULE #9). The reviewer's tool
restriction is the `--tools` argument to the subprocess.

### Consequences

- Positive: Maximum methodology fidelity. The reviewer has
  fresh context, restricted tools, AND a different model
  for user-initiated reviews. All three biases are
  mitigated.
- Positive: The orchestrator's reviewer call is still
  cheap (no model cycle, just subprocess spawn).
- Positive: User can configure the review model per
  project via `maestria.reviewModel` in settings.json.
- Negative: Model cycle adds latency to `/review` (a
  single tool call to switch models). On most providers
  this is sub-100ms.
- Negative: The review model defaults to a "different
  provider" heuristic, which is opinionated. Users may
  want a specific model, not just a different provider.
  We expose `maestria.reviewModel` for explicit
  configuration.
- Negative: Some users may not want model cycling at all
  (e.g., cost-sensitive setups). The setting can be
  configured to skip cycling by setting
  `maestria.reviewModel` to the current model — this
  degenerates to option (2).

### References

- [`02-integration-strategy.md` §3](./02-integration-strategy.md)
- Pi `ctx.modelRegistry` —
  [extensions.md:919-921](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- Pi custom-compaction example showing model switching —
  [`examples/extensions/custom-compaction.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-compaction.ts)

### Date

2026-06-18

---

## ADR-010: Bundling Strategy for `@maestria/pi`

### Status

Accepted

### Context

Pi's `packages.md` is explicit about the dependency rules:

> Third party runtime dependencies belong in `dependencies`
> in `package.json`. ... Pi bundles core packages for
> extensions and skills. If you import any of these, list
> them in `peerDependencies` with a `"*"` range and do not
> bundle them: `@earendil-works/pi-ai`,
> `@earendil-works/pi-agent-core`,
> `@earendil-works/pi-coding-agent`,
> `@earendil-works/pi-tui`, `typebox`.
>
> Other pi packages must be bundled in your tarball. Add
> them to `dependencies` and `bundledDependencies`, then
> reference their resources through `node_modules/` paths.
> Pi loads packages with separate module roots, so
> separate installs do not collide or share modules.

We import from these Pi core packages:

- `@earendil-works/pi-coding-agent` (for `ExtensionAPI`,
  `isToolCallEventType`, etc.)
- `@earendil-works/pi-ai` (for `StringEnum` if needed)
- `typebox` (for tool parameter schemas)

We do not depend on any third-party packages in v1. We do
not depend on any other Pi package.

The choices to evaluate:

1. List all three in `peerDependencies` with `"*"` range.
2. List all three in `dependencies` (risk: version conflict
   with Pi's bundled versions).
3. List none and rely on type-only imports (TypeScript
   `import type` and `verbatimModuleSyntax`).

### Decision

**Choose: Option 1 — `peerDependencies` with `"*"` range.**

```json
{
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-ai": "*",
    "typebox": "*"
  }
}
```

We use `import type` for type-only imports (idiomatic in
the opencode package). For runtime imports, the actual
modules are resolved at runtime by Pi's jiti loader, which
finds them via the host installation.

The `"*"` range signals to npm that we are compatible with
any version of the peer. This is what Pi wants — the
package should work with any 0.79.x install. The actual
version compatibility is enforced by Pi's bundled
versions at runtime.

### Consequences

- Positive: We don't ship a copy of Pi core packages.
  Smaller package, no risk of version mismatch.
- Positive: We work with any Pi version that has the
  imports we use. (Documented as `^0.79.0` in the README.)
- Positive: The `peerDependencies` declaration signals to
  npm that the user must have these installed (which they
  do, via Pi).
- Negative: `npm install` in a fresh environment without
  Pi installed would fail. This is acceptable because
  `@maestria/pi` is only meaningful when Pi is installed.
  Documented in the README.
- Negative: Type checking requires the packages to be
  available at dev time. We list them in
  `devDependencies` (resolved via pnpm catalog).

### References

- Pi packages docs —
  [packages.md:165-186](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)
- [`03-package-design.md` §2](./03-package-design.md#2-packagejson)

### Date

2026-06-18

---

## ADR-011: Build Tool Choice (tsc vs tsdown vs unbuild vs no-build)

### Status

**Accepted (implementation diverged)**

> **Note — implementation divergence:** The actual implementation uses
> **`vp pack` (Rolldown)**, not `tsc`. Rationale added below. The ADR
> analysis (options, trade-offs) remains valid; the decision changed
> during implementation based on practical experience.

### Context

Pi loads TypeScript at runtime via jiti. We could ship
`./src/extension.ts` directly and skip the build step.

The choices:

1. **No build** — ship `./src/extension.ts` as the
   extension. Jiti compiles on first import.
2. **`tsc` to `dist/`** — compile to `dist/extension.js`
   with `.d.ts` files. Consistent with the opencode
   package.
3. **`tsdown`** — Rolldown-based bundler, used by Vite+.
   Faster than `tsc`, produces a single bundle.
4. **`unbuild`** — used by many npm packages, supports
   multiple entry points.

We considered:

| Choice    | Pros                                    | Cons                                                     |
| --------- | --------------------------------------- | -------------------------------------------------------- |
| No build  | Zero build step, source is the artifact | Slow cold start (jiti compile), no types, no source maps |
| `tsc`     | Same as opencode, types, small output   | Slower than bundlers, multiple output files              |
| `tsdown`  | Single bundle, fast, modern             | Newer tool, requires more config, package gets bundled   |
| `unbuild` | Supports multiple entry points          | Larger config, more dependencies                         |

### Decision

**Plan chose: `tsc` to `dist/`, consistent with `@maestria/opencode`.**

**Implementation chose: `vp pack` (Rolldown/tsdown) to `dist/extension.mjs`.**

The implementation divergence was driven by:

1. **Pi loads a single extension entry point.** `vp pack` produces a single
   `dist/extension.mjs` that Pi's dynamic import can consume directly. `tsc`
   would produce multiple output files (one per source module), requiring
   Pi to resolve module paths across the bundle.
2. **Module resolution complexity.** `tsc` output imports peer dependencies
   (`@earendil-works/pi-*`, `typebox`) as ESM imports. The Rolldown bundle
   marks them as external, producing clean `import` statements that Pi's
   runtime resolves. No import-map or path-mapping needed.
3. **Faster builds.** Rolldown is ~10x faster than `tsc` for this project
   size (~1s vs ~10s).
4. **Smaller output.** Single 35KB `.mjs` file vs ~14 files totaling ~50KB.
   The bundle loads faster (one file open vs many).

The `vp check` integration in the monorepo already works with `vp pack`
output (the check task runs `tsc --noEmit` for type checking and
`oxlint` for linting; the build task is separate).

### Consequences

**Implementation consequences (updated from plan):**

- Positive: Single `dist/extension.mjs` file — Pi's dynamic import resolves
  it immediately. No module path resolution needed.
- Positive: Faster builds (~1s vs ~10s for `tsc`).
- Positive: `vp pack` is the standard Vite+ build command. Consistent with
  the monorepo's toolchain.
- Negative: No `.d.ts` files in the published package. Type hints are
  available at dev time via `tsc --noEmit`. Users who import `@maestria/pi`
  directly get no IDE completion — but the package is not designed for
  programmatic consumption (it's a Pi extension).
- Negative: The bundle is harder to debug (minified source in a single file).
  Sourcemaps are included (`extension.mjs.map`).
- The original plan's negative (inconsistency with opencode's `tsc`) is now
  moot — `@maestria/opencode` uses `tsc` for different architectural
  reasons, and the two packages are built differently because their
  platforms have different loading expectations.

### Alternatives Considered

**`tsdown`** (now known as `vp pack`) — chosen in implementation. The
Vite+ default bundler was actually simpler than `tsc` for this use case
because it produces a single entry file that Pi can consume directly.

**`tsc`** — the plan's choice. Would require additional module resolution
configuration in Pi. The multi-file output adds no value for a single-entry
extension.

### References

- [`03-package-design.md` §7](./03-package-design.md#7-build-strategy) (updated)
- [`packages/pi/vite.config.ts`](../../packages/pi/vite.config.ts)
- [`packages/pi/tsconfig.json`](../../packages/pi/tsconfig.json) (`noEmit: true`)

### Date

2026-06-18 (ADR), 2026-06-22 (implementation)

---

## ADR-012: Rules Injection via `before_agent_start`

### Status

Accepted

### Context

The maestria methodology has global rules that apply to
every agent (orchestration rules, delegation table,
context management). These rules must be present in the
system prompt on every turn.

The choices for injection:

1. **`before_agent_start` event handler** — append rules
   to `event.systemPrompt` on every agent start.
2. **Ship a separate `AGENTS.md` and rely on Pi's
   auto-discovery** — Pi auto-discovers `AGENTS.md` in
   the project root and ancestor directories, including
   it as context.
3. **Bundle the rules as a skill (`/skill:maestria-rules`)**
   — load on demand.
4. **Modify the parent system prompt via the agent's
   `SYSTEM.md`** — Pi supports `--system-prompt` for
   custom system prompts.

We considered the trade-offs:

| Choice                   | Pros                                                                       | Cons                                                                                     |
| ------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `before_agent_start`     | Always present, regardless of project state, controlled by package version | Adds rules content to system prompt (3KB+), even when the user is on a non-maestria task |
| AGENTS.md auto-discovery | Project-controlled, no extension needed                                    | Project may not have `AGENTS.md`, drift between package version and project rules        |
| Skill on demand          | Smaller system prompt, methodology loaded when needed                      | LLM may forget to load, no guarantee of presence                                         |
| SYSTEM.md                | Project-controlled, can be more elaborate                                  | Requires per-project setup, not part of the package                                      |

### Decision

**Choose: `before_agent_start` event handler, with the
rules content bundled into the extension as a string
constant.**

The rules content lives in `rules/AGENTS.md` (source)
and `dist/rules-content.js` (generated, embedded as
`MAESTRIA_RULES_CONTENT` string). The extension's
`installRulesInjection` function subscribes to
`before_agent_start` and appends:

```
\n\n## Maestria Global Rules\n\n{content}
```

to the system prompt on every turn.

This is the closest analog to OpenCode's
`input.instructions` injection (per
[`ADR-002`](../adr/ADR-002-plugin-architecture.md)) and
to the `system.transform` hook that the opencode README
references.

The rules content (as of `@maestria/opencode@0.3.8`) includes:

- **Orchestration** — don't assume, read docs first, use opensrc
- **Delegation** — 7-specialist table
- **Context management** — progressive disclosure, checkpointing
- **Webfetch may hang** — proceed without result, surface the skip
- **CLI references** — use `bash --help` or skill first
- **Local files** — read directly, don't `webfetch`

### Consequences

- Positive: Rules are always present. No risk of LLM
  forgetting to load a skill.
- Positive: Rules are versioned with the package.
  Updating the package updates the rules.
- Positive: The injection is unconditional — works in
  any project, any session.
- Positive: The rules content is a build-time embed
  (no runtime file system read at extension load).
- Negative: Adds ~3KB to every system prompt. This is
  small relative to typical model context windows
  (100KB+) but non-zero.
- Negative: Cannot be turned off without removing the
  extension. Users who want to disable rules would
  have to uninstall the package.
- Negative: If the rules content is wrong, it's wrong
  in every session. No per-project override.

### Alternatives Considered

**Pi's AGENTS.md auto-discovery** is tempting because
it's "just there" once the project has an `AGENTS.md`.
But the maestria rules are package methodology, not
project context. The user should not have to maintain
the rules in their project; the package is the source
of truth.

**Skills on demand** is the lightest-weight option but
relies on the LLM loading the skill. In practice, this
is unreliable for methodology that's supposed to be
universal.

**SYSTEM.md** is a per-project configuration. The
maestria rules should be the same across all projects
for users who install the package.

### References

- [`02-integration-strategy.md` §5](./02-integration-strategy.md)
- [`docs/adr/ADR-001-global-rules-scope.md`](../adr/ADR-001-global-rules-scope.md) — what belongs
  in global rules
- [`docs/adr/ADR-002-plugin-architecture.md`](../adr/ADR-002-plugin-architecture.md) — opencode's
  rules injection pattern
- Pi `before_agent_start` event —
  [extensions.md:494-528](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

### Date

2026-06-18

---

## ADR-013: Compaction State Preservation

### Status

Accepted

### Context

Pi's compaction summarization is lossy by default. When
the context window fills up, the older messages are
summarized and the recent messages are kept. The
maestria methodology has state that must survive
compaction:

- The active task (user's current goal)
- The completion promise ("This task is complete when...")
- Blockers
- File references (read / modified)
- Recent handoffs (who handed off to whom, with what)
- Review state (is review mode active? what model?)

Without preservation, the post-compaction turn has no
memory of these. The methodology breaks.

The choices:

1. **Append to Pi's default summary** — Pi's
   `session_before_compact` returns a `compaction` object
   that **replaces** the default summary. We can't
   append; we must include the maestria state in our
   returned summary.
2. **Use the `details` field of the `compaction` object**
   — Pi's compaction has a `details` field for custom
   data. The LLM may or may not see this.
3. **Module-scope state plus pre-compaction render** —
   the extension maintains `MaestriaState` in module
   scope, renders it to markdown on `session_before_compact`,
   and includes the render in the returned summary.

### Decision

**Choose: Option 3 — module-scope state, render at
compaction time, include in the returned summary.**

The `MaestriaState` is maintained by event handlers
(`before_agent_start` for `activeTask`, `tool_call` for
file tracking, `subagent` tool invocations for
`handoffHistory`, `/review` command for `reviewMode`).

On `session_before_compact`, the extension renders
`MaestriaState` to a markdown summary and returns it as
the `compaction.summary` field. The render includes:

- ## Goal (activeTask)
- ## Completion Promise
- ## Blockers
- ## Files Modified
- ## Files Read
- ## Recent Handoffs
- ## Review State

The orchestrator prompt template has a "Post-Compaction
Recovery" section that tells the LLM to read this block
and resume from the saved state.

The `details` field is also populated with the structured
`MaestriaState` object, in case future Pi versions make
`details` visible to the LLM.

### State Recovery

Recovery is advisory, not automatic. The LLM reads the
state block from the compaction summary and resumes. If
the LLM misreads or ignores the state, the methodology
fails. We mitigate with explicit instructions in the
orchestrator prompt.

For full session persistence (state survives even
`/reload` and `/new`), we would need to use
`pi.appendEntry` to persist the state. This is deferred
to a later phase — see
[`06-risks-and-open-questions.md`](./06-risks-and-open-questions.md)
for the trade-off discussion. **v1.1** will replace the
markdown-blob state preservation with `pi.appendEntry`-based
state persistence, which is the proper Pi primitive for state
that survives compaction without LLM context bloat. Source:
[extensions.md:1371-1386](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).

### Consequences

- Positive: All methodology-relevant state survives
  compaction.
- Positive: The state is rendered as plain markdown,
  which the LLM can read and reason about.
- Positive: The `details` field is populated for
  future-proofing.
- Negative: State is advisory, not enforced. The LLM
  may misread or ignore the post-compaction state. We
  mitigate with explicit prompt instructions.
- Negative: The state doesn't survive `/reload` or
  `/new` — those are full session resets. The state is
  rebuilt from scratch on the next turn.
- Negative: The state doesn't survive across multiple
  compactions in the same session — well, it does,
  because the state is module-scope and persists across
  compactions, but if the LLM starts a new turn with a
  fresh mind, the rendered state is the only signal.
- Negative: Blockers and handoffs are textual
  (markdown), not structured. The LLM has to parse them.

### Alternatives Considered

**Pi's default compaction** is generic and doesn't
preserve our state. Not useful for our methodology.

**Append-only state** would be cleaner if Pi allowed
it, but it doesn't — `compaction.summary` is
wholesale replacement.

**State persistence via `pi.appendEntry`** would
survive `/reload` and `/new` but requires more code
and a parsing step. We defer this.

### References

- [`02-integration-strategy.md` §6](./02-integration-strategy.md)
- Pi `session_before_compact` event —
  [compaction.md:269-339](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/compaction.md)
- Pi `CompactionEntry` structure —
  [compaction.md:119-141](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/compaction.md)
- OpenCode equivalent —
  [`packages/opencode/src/index.ts:179-185`](../../packages/opencode/src/index.ts)

### Date

2026-06-18

---

## ADR-014: Prompt-Template Argument Binding

### Status

Accepted

### Context

The handoff contract has 6 fields (Goal, Context,
Requirements, Known problems, Success criteria, Next
step). These need to flow from the orchestrator
(generated by the LLM at delegation time) to the
specialist (received as the prompt template's `$1`, `$2`,
etc. arguments).

Pi's prompt-template argument syntax is:

| Syntax              | Meaning                |
| ------------------- | ---------------------- |
| `$1`, `$2`, ...     | Positional arg N       |
| `$@` / `$ARGUMENTS` | All args joined        |
| `${1:-default}`     | Arg 1 or default       |
| `${@:N}`            | Args from Nth position |
| `${@:N:L}`          | L args starting at N   |

Source: [prompt-templates.md:67-95](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/prompt-templates.md)

The choices:

1. **Use `$@` for the whole handoff as a single string.**
   The orchestrator passes the entire handoff contract as
   one argument. The specialist template includes `$@`
   directly.
2. **Use `$1`, `$2`, ..., `$6` for the 6 handoff fields.**
   The orchestrator passes each field as a separate
   argument. The specialist template references each by
   number.
3. **Use named placeholders via `${1:-goal}` style.** The
   specialist template has labeled placeholders for
   readability.

### Decision

**Choose: Option 1 — single `$@` argument, with the
structured handoff as a markdown block.**

The orchestrator prompt template says:

> When delegating, format the delegation as:
>
> ```
> subagent(agent="X", task="<handoff contract as markdown>")
> ```
>
> The handoff contract is a single markdown block with
> 6 sections (Goal, Context, Requirements, Known
> problems, Success criteria, Next step).

The specialist prompt templates start with:

```markdown
You have received a handoff. The contract is:

$@

Follow the handoff contract. If anything is unclear or
ambiguous, ask before proceeding.
```

The LLM parses the 6 sections from the markdown. This
matches the opencode convention (where the orchestrator
fills a markdown template and the specialist receives
the whole thing).

We chose `$@` over `$1`...`$6` because:

- **Resilience to field reordering.** If we add a 7th
  field to the contract (e.g., "Priority"), we don't
  have to renumber all 6 placeholders.
- **LLM compatibility.** `$@` is one substitution; the
  LLM gets a complete block. With `$1`...`$6`, the LLM
  has to be careful about argument ordering when
  generating the delegation.
- **Readability.** The specialist template is easier to
  read with a single `$@` placeholder.

We also support the optional `${1:-default}` style for
specialists that need a single-argument invocation (e.g.,
`/adventurer <task>` where `<task>` is the only
required field).

### Argument Hint Frontmatter

Each specialist prompt template has YAML frontmatter:

```yaml
description: <one-line description, max 1024 chars>
argument-hint: <goal> # or <target>, or <topic>, depending on specialist
```

The `argument-hint` is for the editor's autocomplete UX.
The LLM is told via the prompt body what arguments to
expect.

### Consequences

- Positive: Handoff contract is a single coherent block.
  The specialist sees all 6 fields in context.
- Positive: Adding fields to the contract doesn't
  require specialist template updates.
- Positive: The orchestrator template explicitly
  documents the format, reducing the chance of
  malformed delegations.
- Negative: The LLM has to parse the 6 sections from
  the markdown. This is reliable for modern LLMs but
  not for older models.
- Negative: Specialists cannot use individual fields
  via `$1`, `$2`, etc. If a specialist needs only
  the "Goal", it has to parse the markdown to extract
  it. We mitigate by having the specialist prompt
  body say "extract the Goal from the contract above."

### Alternatives Considered

**`$1`...`$6` arguments** would give each specialist
direct access to individual fields. But the LLM has
to be careful about ordering, and adding a 7th field
would require renumbering. Not worth the complexity.

**Named placeholders** like `${goal}`, `${context}` are
not supported by Pi's argument syntax. We would have
to implement our own substitution layer in the
extension, which adds complexity.

### References

- [`02-integration-strategy.md` §2.4](./02-integration-strategy.md)
- Pi prompt-template arguments —
  [prompt-templates.md:67-95](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/prompt-templates.md)
- Handoff contract fields — [`PATTERNS.md` §"Handoff Contract"](../../PATTERNS.md)
- OpenCode equivalent: the orchestrator agent
  documents the handoff format in its prompt body —
  [`packages/opencode/agents/orchestrator.md`](../../packages/opencode/agents/orchestrator.md)

### Date

2026-06-18

---

## Cross-References

| ADR     | Files Affected                                                 |
| ------- | -------------------------------------------------------------- |
| ADR-008 | All of `src/`, all of `prompts/`, all of `skills/`             |
| ADR-009 | `src/commands.ts`, `src/state.ts`, `src/extension.ts`          |
| ADR-010 | `package.json`                                                 |
| ADR-011 | `tsconfig.json`, `package.json`, `scripts/build-rules.ts`      |
| ADR-012 | `src/rules.ts`, `src/extension.ts`, `rules/AGENTS.md`          |
| ADR-013 | `src/state.ts`, `src/compaction.ts`, `prompts/orchestrator.md` |
| ADR-014 | All of `prompts/` (frontmatter + body)                         |

## Date

2026-06-18
