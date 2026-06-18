# 02. Integration Strategy — Mapping Maestria to Pi

This document answers the central question: **how does the maestria
methodology (Pipeline Composition + Maker/Checker Split + 7 specialist
agents + global rules) map to Pi's primitives?**

The mapping is not a one-to-one port of `@maestria/opencode`. Pi is more
expressive in some ways and less expressive in others. The strategy below
uses Pi's strengths (event API, subprocess isolation, model registry,
tool interception) and works around its gaps (no per-agent permission
frontmatter, no `edit: deny`).

The package design that implements this strategy is in
[`03-package-design.md`](./03-package-design.md). The build order is in
[`04-implementation-phases.md`](./04-implementation-phases.md).

## 1. The Mapping at a Glance

| Maestria concept                   | OpenCode implementation                | Pi implementation                                              |
| ---------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| `@orchestrator`                    | Agent with `task()` permission         | Prompt template + `input` event handler + subagent tool        |
| `@adventurer` / `@architect` / ... | Subagent definitions in `agents/*.md`  | Prompt templates in `prompts/*.md`                             |
| Handoff contract                   | Markdown in the delegation prompt      | `${@}` / `${1:-default}` argument binding in prompt template   |
| Iteration limits                   | `maxSteps` per agent + prompt rules    | Prompt-template rules + session-level state in `MaestriaState` |
| `edit: deny` for reviewer          | YAML frontmatter                       | `tool_call` interceptor with session flag                      |
| Rules injection                    | `input.instructions` in `config` hook  | `before_agent_start` event handler                             |
| Compaction preservation            | `experimental.session.compacting` hook | `session_before_compact` event returning custom summary        |
| Skill install flow                 | Orchestrator runs `npx skills@latest`  | Subagent spawns with `--append-system-prompt` containing skill |
| Maker/checker permission model     | Static `edit: deny`                    | Dynamic `tool_call` block + `--tools` arg on subprocess        |

## 2. Pattern 1: Pipeline Composition on Pi

### 2.1 The Default Pipeline

The maestria default pipeline is:

```
Input → @adventurer (recon) → @planner or @architect (plan/design)
  → @builder (implement) → @reviewer (validate) → Output
```

On OpenCode, the orchestrator implements this with sequential `task()`
calls. On Pi, the orchestrator implements it with sequential `subagent`
tool calls (the custom tool we register, which spawns isolated `pi`
subprocesses).

The user's invocation looks the same:

```
/orchestrate Add OAuth support to the auth module
```

The orchestrator prompt template, expanded with `$@` = the goal,
composes a `subagent` chain. In practice, the chain looks like:

```
subagent(agent="adventurer", task="Map the auth module's current session handling. ...")
subagent(agent="architect", task="Compare OAuth strategies for {previous}...")
subagent(agent="builder", task="Implement the chosen strategy. {previous}...")
subagent(agent="reviewer", task="Review the implementation. {previous}...")
```

This is exactly the chain mode of the example `subagent` extension. We
ship a similar tool, but tuned for maestria's handoff contracts and
permission model.

### 2.2 The Orchestrator: Two Primitives, One Role

The orchestrator role is split across two Pi primitives:

1. **Registered command** (`/orchestrate`) — registered via
   `pi.registerCommand("orchestrate", ...)` in `src/commands.ts`.
   Per
   [extensions.md:837](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md),
   "Extension commands (`/cmd`) checked first — if found, handler
   runs and input event is skipped." This gives the orchestrator
   stable argument parsing and editor autocomplete, and bypasses
   the LLM's `/orchestrate` interpretation.
2. **Prompt template** (`prompts/orchestrator.md`) — contains the
   instructions, specialist table, handoff contract, and iteration
   limits. The command's `sendUserMessage` injects the goal into
   the conversation; the LLM then loads and follows the
   orchestrator template.
3. **The `subagent` custom tool** — invoked by the LLM as
   `subagent({ agent, task, ... })` for each specialist delegation.

The command + template + subagent tool together implement the
orchestrator role. We register the command (rather than detecting
`/orchestrate` via an `input` event handler) because registered
commands have stable argument parsing, autocomplete, and bypass
the LLM's `/orchestrate` interpretation — important when the goal
contains characters the LLM might re-interpret.

### 2.3 Specialists as Prompt Templates

Each specialist is a single `.md` file in `prompts/`:

```
prompts/
├── orchestrator.md
├── adventurer.md
├── architect.md
├── builder.md
├── diagnose.md
├── planner.md
├── reviewer.md
└── writer.md
```

The filename is the command: `adventurer.md` → `/adventurer`. The
prompt body is the specialist's system prompt. The user invokes a
specialist with `/adventurer <task>` directly, or it is invoked by
the orchestrator's subagent chain.

The specialist prompt templates are adapted from the opencode agents
in [`packages/opencode/agents/`](../../packages/opencode/agents/). The
content is largely the same — the methodology is the same. The
differences are:

- **No YAML frontmatter permissions** — the specialist's tool set is
  declared in the prompt body and enforced by the subprocess `--tools`
  argument at spawn time.
- **`$@` / `${1:-goal}` syntax for handoff fields** — when invoked by
  the orchestrator, the handoff contract fields (Goal, Context, etc.)
  are passed as positional args (see ADR-014).
- **No `mode: subagent` field** — Pi has no equivalent; all
  specialists are prompt templates invoked as commands.

### 2.4 Handoff Contract Flow

A handoff contract has 6 fields:

| Field                | Purpose                                |
| -------------------- | -------------------------------------- |
| **Goal**             | What to achieve                        |
| **Context**          | Paths, constraints, prior decisions    |
| **Requirements**     | Specific expectations                  |
| **Known problems**   | Issues already identified              |
| **Success criteria** | Verifiable conditions for completion   |
| **Next step**        | What happens after this task completes |

The orchestrator template contains a literal handoff template. When
delegating, the orchestrator LLM fills the template and passes the
fields as positional arguments to the specialist's prompt template.

In the orchestrator prompt:

```
Use this handoff template for every delegation:

  Goal: <one sentence, the outcome>
  Context: <paths, ADRs, prior decisions, what's been tried>
  Requirements: <specific expectations and boundaries>
  Known problems: <issues already identified, what to watch for>
  Success criteria: <measurable conditions, the completions promise>
  Next step: <what happens after this task>

Format the delegation as:
subagent(agent="X", task="Goal: ...\nContext: ...\nRequirements: ...\nKnown problems: ...\nSuccess criteria: ...\nNext step: ...")
```

The subagent tool's `task` parameter is the handoff content. The
specialist's prompt template starts with a reminder to follow the
handoff contract and the iteration-limit rules.

The subagent tool's spawn args include `--model <agent.model>` if
the specialist's prompt frontmatter declares a `model` field
(`agents/scout.md` in the upstream example uses this). The reviewer
specialist can thus opt into a different model for the subprocess
without requiring the parent session to model-cycle, giving the
reviewer fresh context AND fresh model in a single spawn. Reference:
[`examples/extensions/subagent/index.ts:288-290`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/subagent/index.ts).

### 2.5 Iteration Limits

Iteration limits (per PATTERNS.md) have three elements:

1. **Verifiable termination condition** — concrete, measurable state.
2. **Max-N hard limit** — usually 3.
3. **Escalation format** — "Tried X, Y, Z. Blocked by [cause]. Need [input]."

These are encoded in **the prompt template** for each specialist. They
are not enforceable as runtime checks — the methodology is guidance.
This matches the opencode convention: the iteration-limit section is
in the agent's markdown, not in the harness.

The subagent tool can also enforce a wall-clock timeout (via
`AbortSignal` passed to the subprocess) and a max-tokens limit
(via the subprocess's `--max-tokens` flag), but these are safety
nets, not the iteration limits themselves.

If a subprocess crashes, times out, or is interrupted by Ctrl+C,
the subagent tool returns a structured error to the parent LLM:

```typescript
{
  content: [{
    type: "text",
    text: `Subagent <name> failed: <cause>. ` +
          `Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.`,
  }],
  isError: true,
}
```

The orchestrator's escalation format (per `PATTERNS.md` §"Iteration
Limits") applies: the parent LLM sees the error as the tool result
and can either retry the specialist with refined instructions,
escalate to the user, or fall back to an alternative specialist
chain. The error is structured (not a stack trace) so the
orchestrator can reason about it.

### 2.6 Pipeline Composition Rules

The four pipeline rules from PATTERNS.md are encoded in the
orchestrator prompt template:

| Rule                                                 | Where it lives                                              |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| One atomic task per stage                            | Orchestrator template + handoff section in every specialist |
| Default pipeline non-negotiable for non-trivial work | Orchestrator template "Default pipeline" section            |
| Parallel fan-out max 3–5                             | Orchestrator template + subagent tool max-concurrency       |
| Stages ordered by dependency                         | Orchestrator template chain guidance                        |

Parallel fan-out has a tool-level enforcement: the subagent tool
refuses `tasks: [...]` arrays with more than 8 items, matching the
example extension's `MAX_PARALLEL_TASKS = 8` constant. The
orchestrator's own rule is 3–5; the tool's hard limit is 8 (matching
the example, leaving headroom for the orchestrator's recommended
limit).

Reference: [`examples/extensions/subagent/index.ts:27`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/subagent/index.ts)

## 3. Pattern 2: Maker/Checker Split on Pi

The maker/checker split says: the agent that produces work must not be
the agent that validates it. The reason is commitment bias, context
blindness, and toolset overlap (per PATTERNS.md).

On OpenCode, this is enforced at the agent level with `edit: deny` in
YAML frontmatter. The reviewer is structurally prevented from becoming
the writer.

On Pi, the same enforcement requires three layers:

### 3.1 Layer 1: Subprocess Toolset Restriction

When the orchestrator spawns a `subagent` for the reviewer, the
subagent tool passes `--tools read,grep,find,ls` to the subprocess.
The reviewer subprocess has no `edit`, no `write`, **and no `bash`**
at all (not just destructive bash). This is the closest analog to
OpenCode's `edit: deny` and is enforced by the parent's subprocess
invocation, not by the reviewer agent.

The `tool_call` event also supports in-place mutation of `event.input`
to patch tool arguments before execution (e.g., wrap a dangerous
command with a `confirm` prompt, or inject a dry-run flag). The
plan uses blocking by default; mutation is an alternative for
non-destructive interventions. Source:
[extensions.md:708-713](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).

This is the **strongest** layer of enforcement on Pi. It is also the
weakest in the sense that it requires the orchestrator to remember
to use it. We mitigate by having the orchestrator prompt template
mandate the reviewer toolset explicitly.

### 3.2 Layer 2: `tool_call` Event Interception (Defense in Depth)

The extension registers a `tool_call` handler in
`src/extension.ts`. The handler reads a session-level flag
`maestria.reviewMode` from `pi.appendEntry`-persisted state. When
the flag is set, the handler blocks any `edit`, `write`, or `bash`
call outright (the parent-session `/review` runs the reviewer
in-process, so we cannot rely on the subprocess `--tools` filter —
we must block the full set):

```typescript
pi.on("tool_call", async (event, ctx) => {
  const state = await getMaestriaState(ctx);
  if (!state.reviewMode) return;

  if (
    isToolCallEventType("edit", event) ||
    isToolCallEventType("write", event) ||
    (isToolCallEventType("bash", event) && isDestructiveBash(event.input.command))
  ) {
    return { block: true, reason: "Review mode: edits and destructive bash are blocked" };
  }
});
```

This catches the case where the orchestrator forgets to restrict
the subprocess toolset, or where the review happens in the parent
session via `/review <target>` (see 3.4 below).

### 3.3 Layer 3: Prompt Discipline

The reviewer prompt template begins with explicit rules:

```
!!! Review mode is active. You are validating work, not producing it.
!!! Do not call edit, write, or destructive bash. If you find an issue
    that needs to be fixed, report it in your output — do not fix it.
!!! Your model may also be different from the maker's. Use that to
    your advantage: a fresh perspective catches what the implementer
    overlooked.
```

This is the **weakest** layer — the LLM can ignore it. But the
combination of all three layers is strong: the model would have to
ignore explicit instructions AND attempt an action that the
`tool_call` handler would block. In practice, the LLM never tries.

### 3.4 The `/review` Command and Model Cycling

The maker/checker split is enhanced on Pi by **model cycling**: a
`/review <target>` command switches the active model to a different
provider before beginning review. This gives a literal "fresh
perspective" — different training, different biases, different
failure modes.

Because the parent-session `/review` runs the reviewer in-process
(we cannot rely on subprocess `--tools`), we use
`pi.setActiveTools(["read", "grep", "find", "ls"])` to switch the
runtime toolset for the review turn, then restore the prior toolset
on `turn_end`. This is the canonical Pi pattern (see
[`examples/extensions/plan-mode/index.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/plan-mode/index.ts)
and [`examples/extensions/preset.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/preset.ts)).
Source: [extensions.md:1535-1552](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).

The `/review` command:

1. Saves the current model via `pi.getActiveTools()` / `pi.getModel()`.
2. Looks up a "review model" from `ctx.modelRegistry` (configurable
   in the package; defaults to a different provider than the
   active one).
3. Sets the new model as active via `pi.setModel(reviewModel)`
   (returns `Promise<boolean>`; check for `false` and surface a
   user-facing error if the model is unavailable).
4. Calls `pi.setActiveTools(["read", "grep", "find", "ls"])` to
   remove `edit`/`write`/`bash` for the review turn.
5. Sets `maestria.reviewMode = true` in session state (the
   `tool_call` handler is the second-layer defense if the LLM
   somehow tries to bypass the active-tools restriction).
6. Sends a user message: "Review the following: <target>. Use the
   reviewer methodology in `prompts/reviewer.md`. Remember: read
   only, no edits, report findings."
7. After the review turn completes (via a `turn_end` listener scoped
   to the review), restores the original toolset via
   `pi.setActiveTools(savedTools)`, restores the original model
   via `pi.setModel(savedModel)`, and clears `reviewMode`.

Reference: [extensions.md `ctx.modelRegistry`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)

### 3.5 Why This Is Weaker Than OpenCode

To be candid: the maker/checker split on Pi is weaker than on
OpenCode. OpenCode's `edit: deny` is a hard gate. Pi's enforcement
is layered and depends on:

- The orchestrator remembering to pass `--tools` to the reviewer
  subprocess.
- The `tool_call` handler being installed and active.
- The LLM following the reviewer prompt template.

A sufficiently committed LLM (or a sufficiently broken one) could
violate any of these. The methodology is the same; the technical
enforcement is weaker.

We accept this trade-off because Pi's strengths (subprocess
isolation, model registry access, event hooks) outweigh the loss.
And in practice, the LLMs that produce good code also follow
review-mode instructions reliably.

## 4. The 7 Specialist Agents on Pi

Each specialist becomes a single prompt template. The mapping from
opencode agent to pi prompt template is mechanical, with the
differences noted below.

### 4.1 Mapping Table

| OpenCode agent                         | Pi prompt template                      | Subprocess toolset (default)                             |
| -------------------------------------- | --------------------------------------- | -------------------------------------------------------- |
| `@adventurer` (`agents/adventurer.md`) | `prompts/adventurer.md` (`/adventurer`) | `read, grep, find, ls, bash (read-only)`                 |
| `@architect` (`agents/architect.md`)   | `prompts/architect.md` (`/architect`)   | `read, grep, find, ls`                                   |
| `@builder` (`agents/builder.md`)       | `prompts/builder.md` (`/builder`)       | full toolset (`read, edit, write, bash, grep, find, ls`) |
| `@diagnose` (`agents/diagnose.md`)     | `prompts/diagnose.md` (`/diagnose`)     | `read, grep, find, ls, bash`                             |
| `@planner` (`agents/planner.md`)       | `prompts/planner.md` (`/planner`)       | `read, grep, find, ls`                                   |
| `@reviewer` (`agents/reviewer.md`)     | `prompts/reviewer.md` (`/reviewer`)     | `read, grep, find, ls` (NO `edit`/`write`/`bash`)        |
| `@writer` (`agents/writer.md`)         | `prompts/writer.md` (`/writer`)         | `read, write, grep, find, ls`                            |

### 4.2 Differences From OpenCode Agents

1. **No YAML frontmatter.** The specialist prompt is plain markdown.
   Permission rules move to the prompt body and the subprocess
   `--tools` flag.
2. **The 6-field handoff contract is in the prompt body**, not split
   between frontmatter and body.
3. **Skill prescription is in the prompt body** (the
   `## Relevant Skills` section), with reference to the
   `/skill:name` invocation. The LLM loads skills on demand via
   `read` or `/skill:name`.
4. **No `maxSteps` field.** Pi does not have a `maxSteps` equivalent
   in prompt templates. Iteration limits are in the prompt body.
5. **No `permission` field.** Pi has no permission frontmatter for
   prompt templates. Toolset is enforced via subprocess `--tools`
   and the `tool_call` interceptor.

### 4.3 The Orchestrator Prompt Template

The orchestrator template is the most complex. It contains:

- The "Default to the most specialized specialist" rule
- The 7-specialist table with delegation triggers
- The 6-field handoff contract template
- The default pipeline diagram
- Parallel fan-out rules
- Iteration limit format
- The maker/checker split rule
- The completion promise format

The orchestrator is **not** a subagent on Pi — it lives in the
parent session. The orchestrator's "delegation" is calls to the
`subagent` custom tool, which spawns specialist subprocesses.

**Future work:** the orchestrator's methodology content
(~600 lines) could be moved into a `maestria-orchestrator` skill
that the LLM loads on demand, with `/orchestrate` sending a
one-line bootstrap: "Load `/skill:maestria-orchestrator` and run
the default pipeline on: $@". This would reduce the parent-session
system prompt from ~10–15 KB to ~1 KB. v1 keeps the orchestrator
content inline because prompt-template expansion is more reliable
than skill auto-loading for the methodology the orchestrator
encodes.

### 4.4 Invoking Specialists

Three invocation paths:

1. **Direct user invocation.** The user types
   `/adventurer <task>` in the editor. Pi expands the prompt
   template and sends it as a user message. This is for when the
   user knows which specialist they want.
2. **Orchestrator delegation.** The user types
   `/orchestrate <goal>`. The orchestrator template fills the
   chain and calls `subagent(...)` for each stage.
3. **Sub-agent call from the primary LLM.** The LLM, in
   its normal reasoning, can also call the `subagent` tool
   directly. The `input` event handler does not restrict this —
   the LLM can always invoke specialists via the subagent tool.

## 5. Global Rules on Pi

The global rules (`rules/AGENTS.md`) are the same as in
`@maestria/opencode`:

- Orchestration rules (don't assume, read docs first, use opensrc)
- Delegation table (the 7 specialists)
- Context management (progressive disclosure, checkpointing,
  completion promises)

### 5.1 Injection Mechanism

Pi's analog of `input.instructions` in OpenCode's `config` hook is
the `before_agent_start` event. The extension registers a handler:

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  return {
    systemPrompt: event.systemPrompt + "\n\n" + maestriaRules,
  };
});
```

`maestriaRules` is the content of `rules/AGENTS.md` read from the
package's `dist/rules/AGENTS.md` at module load time. We bundle
the rules content into the extension source as a string constant
(see [`03-package-design.md`](./03-package-design.md)) so the
injection has no runtime file system dependency beyond the
package itself.

### 5.2 Why Not Use AGENTS.md Auto-Discovery?

Pi does auto-discover `AGENTS.md` files in the project root and
ancestor directories (per [extensions.md `event.systemPromptOptions.contextFiles`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)),
but these are **project context**, not platform rules. We want
the maestria rules to be injected regardless of whether the
project has its own `AGENTS.md`. This matches the opencode
convention: rules are part of the plugin, not the project.

### 5.3 Why Not Use a Skill?

A skill (e.g., `maestria-rules`) could be loaded on demand. The
problem is that the LLM would have to remember to load it, and the
description in the system prompt would have to be specific enough
to trigger that load. Direct injection in `before_agent_start`
guarantees the rules are present on every turn.

## 6. Compaction Preservation

The analog of OpenCode's `experimental.session.compacting` is
Pi's `session_before_compact` event. The extension listens for
the event and returns a custom summary that includes the
maestria session state.

### 6.1 What We Preserve

The `MaestriaState` is a module-level object maintained by event
handlers:

```typescript
interface MaestriaState {
  activeTask: string; // The user's current goal
  completionPromise: string; // "This task is complete when..."
  specialistsDelegated: string[]; // ["adventurer", "builder", ...]
  blockers: string[]; // ["Tried X, Y, Z. Blocked by [cause]."]
  filesModified: string[]; // Paths modified in the session
  filesRead: string[]; // Paths read in the session
  handoffHistory: HandoffEntry[]; // Last 5 handoffs
  reviewMode: boolean; // True if /review is active
  reviewModel: string | null; // Model switched to for review
}

interface HandoffEntry {
  from: string; // "orchestrator" | "adventurer" | ...
  to: string;
  task: string;
  timestamp: number;
}
```

### 6.2 When State Is Updated

| Event                    | What we update                                       |
| ------------------------ | ---------------------------------------------------- |
| `before_agent_start`     | Set `activeTask` from the first user message         |
| `tool_call` (edit/write) | Append to `filesModified`                            |
| `tool_call` (read)       | Append to `filesRead`                                |
| `subagent` tool call     | Append to `specialistsDelegated`, push handoff entry |
| `/review` command        | Set `reviewMode = true`, record `reviewModel`        |
| Review turn end          | Set `reviewMode = false`                             |

The `tool_call` handler is the source of truth for file tracking.
We use the LLM's actual behavior (which paths it read/modified)
as the ground truth, not a separate bookkeeping step.

### 6.3 The Compaction Summary

When `session_before_compact` fires, the extension serializes the
state into a markdown summary and returns it:

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const state = getMaestriaState();
  const summary = renderMaestriaSummary(state);
  return {
    compaction: {
      summary: summary,
      firstKeptEntryId: event.preparation.firstKeptEntryId,
      tokensBefore: event.preparation.tokensBefore,
    },
  };
});
```

The summary is formatted as:

```markdown
## Goal

<activeTask>

## Completion Promise

<completionPromise>

## Blockers

- <blocker 1>
- <blocker 2>

## Files Modified

- <path 1>
- <path 2>

## Files Read

- <path 1>
- <path 2>

## Recent Handoffs

- <from> → <to>: <task summary>
- ...

## Review State

- Review mode: <true/false>
- Active review model: <model>

<existing auto-generated compaction summary if present>
```

This is appended to Pi's default compaction summary (the
extension's custom summary replaces the default wholesale, so we
include the previous summary if any). The next turn sees this
as the prefix of the conversation and can recover the state.

### 6.4 State Recovery

The orchestrator prompt template includes a "Post-Compaction
Recovery" section:

```
!!! If you see "Maestria session state" in the conversation, you
    are post-compaction. Re-read the state section to recover
    the active task, completion promise, and blockers. Do not
    restart the pipeline from scratch — pick up where you left off.
```

The LLM is trained to read what it sees in the context. The
explicit reminder helps it recognize the state block as
authoritative.

## 7. Compaction vs Handoff — A Subtle Distinction

Pi has two summarization mechanisms: compaction (when context fills
up) and branch summarization (when navigating the session tree with
`/tree`). Both events fire for similar reasons but at different
times.

For the maestria methodology:

- **Compaction** preserves the active task and state so the
  current session can continue.
- **Branch summarization** is less interesting to us — it
  summarizes a branch the user is leaving. We hook into it
  (`session_before_tree`) but the user-driven nature means we
  don't have the same urgency.

We treat both with the same `MaestriaState` rendering. The
difference is in the trigger event, not the content.

Source: [compaction.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/compaction.md)

## 8. Specific Gaps Pi Can't Natively Fill

From the assessment, the gaps and our workarounds:

| Gap                                    | Workaround                                     | Strength |
| -------------------------------------- | ---------------------------------------------- | -------- |
| No per-agent `edit: deny`              | Subprocess `--tools` + `tool_call` interceptor | Strong   |
| No per-subagent system prompt layering | `--append-system-prompt` flag on subprocess    | Strong   |
| No declarative skill loading per agent | Specialist prompt's "Skills to Load" section   | Weak     |
| No `maxSteps` per agent                | Iteration limits in prompt body                | Weak     |
| No model-aware permissions             | Model registry check in `tool_call` handler    | Medium   |

The methodology is encoded in the prompts (advisory) plus the
runtime enforcement (hard). The combination is sufficient for the
use cases maestria is designed for.

## 9. What This Strategy Buys Us

The full maestria methodology on Pi, with these specific gains
over a naive port:

1. **Subprocess isolation per specialist** — fresh context window,
   no parent pollution. Better than OpenCode's `task()` for
   context-sensitive tasks.
2. **Model cycling for review** — the `/review` command switches
   models, giving a literal different perspective. OpenCode
   cannot do this.
3. **Tool-call interception** — finer-grained control than
   OpenCode's static `edit: deny`. We can allow certain edits
   (e.g., `edit` for the builder) and block others (e.g.,
   `rm -rf`) contextually.
4. **UI hooks** — `setStatus`, `setWidget`, `setEditorText` for
   the orchestrator's user feedback. OpenCode has no equivalent.
5. **Native prompt templates** — `/adventurer`, `/builder`, etc.
   are real user-invokable commands. OpenCode's agents are
   subagents only.

The price: more code than `@maestria/opencode` (which is 189
lines of TS in `packages/opencode/src/index.ts`). Our extension
will be 800–1,200 lines plus 8 prompt templates and 2 skills.

## 10. What This Strategy Deliberately Does Not Buy Us

To be honest about the trade-offs:

1. **No sub-millisecond subagent spawn.** Each `subagent` call is a
   subprocess invocation. Cold start is 100–500ms. OpenCode's
   `task()` is in-process. This makes Pi worse for highly
   parallel fan-out.
2. **No per-agent permission YAML.** OpenCode's
   `permission.edit: deny` is a one-liner. Our equivalent is
   ~50 lines of TypeScript and a session-state flag.
3. **No native subagent lifecycle events.** OpenCode's
   `task()` triggers task-level events we can hook. On Pi, we
   only know about subprocess exit via the streaming output.
4. **No `@`-mention agents.** OpenCode has `@adventurer` as a
   mention. Pi has `/adventurer` as a command. Different UX.

These are real costs. They are the reason `@maestria/pi` is
"exploring" in VISION.md, not "published." The methodology
moves; the platform limitations don't.

## 11. Summary

The strategy is:

1. Encode the methodology in **prompt templates** (advisory).
2. Enforce critical rules in the **extension's event handlers**
   (advisory + technical).
3. Delegate specialist work via a **custom `subagent` tool** that
   spawns isolated Pi subprocesses.
4. Use **`tool_call` interception** for the maker/checker split
   and dangerous command gating.
5. Use **`before_agent_start` for rule injection** and
   **`session_before_compact` for state preservation**.
6. Ship **2 skills** (handoff, iteration-limits) so methodology
   that specialists reference repeatedly is one `read` away.
7. Skip themes, custom providers, and other surface-area-expanding
   features in v1.

This gives us the full methodology on Pi with the trade-offs
documented and the gaps mitigated where possible.

The next document — [`03-package-design.md`](./03-package-design.md) —
turns this strategy into a concrete file layout.

## 12. Multi-Platform Common Core (Future Work)

The maestria methodology has a methodology core that is identical
across platforms: the global rules content (`rules/AGENTS.md`), the
handoff skill, and the iteration-limits skill. The OpenCode
adaptation lives in [`packages/opencode/`](../../packages/opencode/)
and this plan defines a Pi adaptation in
[`03-package-design.md`](./03-package-design.md). Both currently
duplicate the rules and skill content.

**Future work:** extract the shared methodology into a
`@maestria/methodology` package that both `@maestria/opencode` and
`@maestria/pi` consume. The methodology package would expose:

- `rules/AGENTS.md` (the source of truth for global rules)
- `skills/handoff/SKILL.md` (the handoff-contract skill)
- `skills/iteration-limits/SKILL.md` (the iteration-limits skill)

Each platform adapter would depend on `@maestria/methodology` and
read the rules/skills from there at build time (or runtime). The
benefits: one source of truth, no drift between packages, and a
third future platform (e.g., Claude Code, Aider) could adopt the
methodology by depending on `@maestria/methodology`.

This is a v2+ refactor, not v1. The current plan deliberately
duplicates the content for v1 to keep each platform adapter
self-contained and easy to install.

### 12.1 Dual-Installation Scenario

A user may have both `@maestria/opencode` (OpenCode plugin) and
`@maestria/pi` (Pi package) installed. The two target different
platforms (OpenCode vs Pi) and do not run in the same session,
so there is no runtime conflict. The methodology content is
duplicated between the two, but the duplication is invisible to
the user — OpenCode uses `input.instructions` for rules injection,
Pi uses `before_agent_start`. The specialist agents (OpenCode) and
prompt templates (Pi) have different invocation syntax (`@adventurer`
vs `/adventurer`) but the same methodology content.

For v1, we accept the duplication. v2+ extracts the shared
methodology into `@maestria/methodology` (see §12 above). Users
with both packages installed can use the same methodology in both
tools; the prompt template content is the same as the agent
content.

## Date

2026-06-18
