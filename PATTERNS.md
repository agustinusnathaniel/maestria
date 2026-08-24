# Maestria Design Patterns

This document catalogs the two design patterns that Maestria adapts to each platform's native primitives. The patterns are shared; their dispatch, context, and tool enforcement are not identical.

If you're porting maestria to a new platform, this is your implementation guide. Each pattern section ends with platform-specific adaptation notes that map the pattern to OpenCode's subagents, Kimi Code's AgentSwarm, or Claude Code's hooks.

---

## Pattern: Pipeline Composition

### What It Is

A sequential flow where work passes through specialized stages, each adding value and producing a structured handoff for the next. No stage does the work of another - the adventurer maps code but doesn't edit it, the builder implements but doesn't review, the reviewer validates but doesn't redesign.

The pipeline is the backbone of a full Maestria workflow. It forces discipline: reconnaissance before design, design before implementation, implementation before review. Select the full pipeline when those stages add enough information or risk reduction to justify their model and latency cost. Direct execution or one specialist is valid for smaller or better-understood work.

**The maestria pipeline:**

```
Input → @adventurer (recon) → @planner or @architect (plan/design)
  → @builder (implement) → @reviewer (validate) → Output
```

Each arrow carries a concise, material handoff, not a loose "figure it out" delegation. Planner and architect are alternatives at the same pipeline stage - the orchestrator delegates to whichever fits the task. For simple features, one suffices. For complex features, both may participate (planner scopes the work, architect evaluates approach). The output of one stage is the input briefing for the next.

### Sub-Elements

#### Handoff Contract

Every delegation crossing an agent boundary should be a concise, outcome-oriented brief containing whatever the recipient needs to act: relevant context and constraints, acceptance evidence, material assumptions or blockers, and the next step. This is guidance, not a fixed schema; omit empty parts, keep the brief proportional to the task, and reference existing artifacts instead of copying history.

Example:

```
Outcome: Map the auth module's session handling paths before we refactor login.
Context and constraints: /src/auth/session.ts (the main file) and ADR-CORE-003
  in docs/adr/core/. Trace every code path that reads or writes session state;
  do not edit files. We already know the token refresh path has a race condition
  (issue #42), and session.ts line 89 uses wall-clock rather than server time.
Acceptance/evidence: Return a complete call graph with file paths, line numbers,
  and the race condition's entry points documented.
Next step: @architect receives this map to design the fix strategy.
```

#### Iteration Limits

Every substantial pipeline stage needs three controls:

1. **Verifiable termination condition** - a concrete, measurable state that stops execution. Not "done when it feels right." Done when the success criteria in the handoff contract are met.

2. **Bounded attempts** - normally three repair rounds, extended only when the latest attempt shows observable progress. Repeated causes or no new evidence require a strategy change or escalation.

3. **Escalation format** - a structured signal so the next stage or the human operator can take over without guessing what went wrong:

   ```
   Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.
   ```

   Example from the builder: _"Tried three implementation approaches: direct mutation (broke test isolation), event emitter (added 200 lines of glue), and a middleware hook (clean but needs a new dependency). Blocked by decision: is adding `eventemitter3` acceptable, or should we avoid new dependencies? Need architectural guidance from @architect to proceed."_

#### Pipeline Rules

1. **One atomic task per stage** - never bundle unrelated work into a single delegation. A bug fix and a feature in the same `@builder` call is a scoping violation. The constraint is conceptual (one concern per invocation), not quantitative (one file per invocation).

2. **Full pipeline when selected** - a multi-file, cross-module, or new-feature task may follow `adventurer → planner or architect → builder → reviewer` when the task's risk or uncertainty justifies it. Skipping stages is expected for direct and focused routes. The handoff should state why the selected route is appropriate.

3. **Parallel fan-out is allowed for independent tasks** - keep the fan-out bounded by usefulness and host limits. Examples: `@adventurer` mapping auth and tracing billing in parallel; `@reviewer` checking PR #7, `@builder` fixing bug #42, and `@architect` evaluating a dependency decision.

4. **Stages are ordered by dependency** - later stages cannot proceed without earlier stages' output. The builder cannot implement what the planner hasn't scoped. The reviewer cannot validate what the builder hasn't built. This seems obvious. It gets violated when someone tries to parallelize dependent work.

### Platform Adaptation

Runtime authority varies by host: OpenCode and Kimi Code use dispatcher-style orchestrator authority; OMP and Pi enforce dispatcher behavior in workflow-mode sessions; Hermes is direct-capable by default; and Cursor and Claude Code depend more on host/session permissions. The adapter must describe the actual tool and context boundaries without assuming stronger enforcement than the runtime provides.

How each platform implements this pattern:

| Platform | Primitive | Implementation |
| --- | --- | --- |
| **OpenCode** | `task()` subagents | Orchestrator delegates to specialist agents via the 7-agent pipeline. Each agent is a markdown file with frontmatter permissions. Orchestrator has `read` and `edit` denied, and Bash denied except `npx --yes skills@latest *` for skill installation. Git inspection and runtime queries are delegated to `@adventurer`, which allow-lists read-only shell and git commands. All other shell commands are denied. |
| **Kimi Code** | AgentSwarm with persona-per-stage | Seven roles map onto three native profiles. Persona boundaries are advisory by default; `[[permission.rules]]` can enforce review-only behavior, but those rules apply to the session rather than one subagent. |
| **Cursor** | Task subagents + skills/commands | Specialists ship as plugin `agents/*.md`; orchestrator as a skill; workflow modes as `commands/` (`fein`/`sonar`/`blitz`). Global rules via `alwaysApply` `.mdc`. Same bundle for IDE and CLI. |
| **Claude Code** | Hooks and agent extensions | Stages are implemented as hooks that load agent definitions and tool configurations per phase. Handoff contracts pass through context variables. |
| **Pi** | `maestria_subagent` | Dispatch uses `@gotgenes/pi-subagents`. Subagents inherit parent context, so role prompts do not guarantee clean context isolation. |
| **Oh My Pi** | native `task()` plus wrapper | OMP has a distinct dispatch path and tool behavior. Do not assume Pi's dispatch limits or lifecycle transfer to OMP. |

---

## Pattern: Maker/Checker Split

### What It Is

The agent that produces work should not be the agent that validates it. In a full pipeline, a different agent performs verification. The strength of that boundary depends on the platform: OpenCode enforces it at the tool layer, while other platforms may provide only persona guidance unless users configure review-only permissions or sessions.

The KB (from `loop-engineering.mdx`) puts it bluntly: _"The model that wrote the code is too nice grading its own homework."_ The model that produced a result has committed to it - every subsequent reasoning step is biased toward confirming correctness, not finding flaws. A fresh agent, seeing the work for the first time, catches what the implementer overlooked.

The maker/checker split applies recursively to _itself_: a fresh model decides if the work is done, not the one that did the work.

### Sub-Elements

#### Completions Promise

Success criteria defined _before_ work begins. The template:

```
This task is complete when [verifiable conditions].
```

Examples:

- _"This task is complete when all tests pass, the new `/sessions` endpoint returns HTTP 201 with a valid session token, and the existing session tests are green."_

- _"This task is complete when the refactored module has the same public API, all existing tests pass unchanged, and test coverage is ≥ 90%."_

The completions promise is what makes the reviewer's job mechanical instead of interpretive. The reviewer checks the promise, not their opinion. If the criteria are met, the task passes. If the criteria are wrong, the fix is in the promise, not in the reviewer's subjective judgment.

#### Permission Enforcement

In OpenCode, the checker agent has `edit: deny`. It cannot modify files - only read and report. This is technical enforcement of the behavioral split. Other platforms must be treated according to their own enforcement guarantees.

OpenCode implementation (from `orchestrator.md` frontmatter):

```yaml
permission:
  edit: deny
  bash:
    '*': deny
```

The reviewer can run `git status`, `git diff`, `git log` for context, but cannot stage, commit, create files, or modify anything. The review artifact is text - findings, severity levels, and recommendations - that flows back into the pipeline.

#### Why This Matters

Self-review fails for three reasons, each documented from real sessions:

1. **Commitment bias** - the producing model has already decided the output is correct. Its "review" is a confirmation exercise, not a critical one.

2. **Context blindness** - the producing model is deep in implementation details and misses higher-level issues (architecture drift, edge cases, boundary conditions). A fresh agent sees the forest, not just the tree.

3. **Toolset overlap** - if the reviewer has write access, it will eventually use it. The `edit: deny` enforcement is not about trust; it's about removing temptation. An agent with write access that finds a minor issue will fix it, violating the split.

### Platform Adaptation

| Platform | Primitive | Implementation |
| --- | --- | --- |
| **OpenCode** | `edit: deny` in frontmatter | Reviewer agent YAML sets `permission.edit: deny` and restricts bash to git inspection only. No write tool access at the agent definition level. |
| **Kimi Code** | Safety constraints + persona | Reviewer behavior is advisory by default. Review-only sessions can deny Write/Edit with `[[permission.rules]]`, but the session-wide rules also affect builder and writer work. |
| **Cursor** | Two-layer enforcement (v1) | Runtime `readonly: true` flag on adventurer/planner/reviewer agents blocks write tools (Write, StrReplace, Delete). Prompt-level instructions serve as a backup layer. |
| **Claude Code** | Read-only tool access | Reviewer is spawned via `new Agent({ tools: { Edit: false, Read: true, Bash: false } })` or equivalent tool-level permission gating. No hooks can escalate write access. |
| **Pi** | Read-only role guidance plus platform dispatch | Context inheritance and platform configuration affect isolation. Do not treat a reviewer persona as automatic tool-level enforcement. |
| **Oh My Pi** | Native task dispatch and role guidance | OMP has distinct dispatch and context behavior. A direct session does not automatically create a maker/checker pair. |
