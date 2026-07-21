# Maestria Design Patterns

This document catalogs the two design patterns that every maestria platform package (`@maestria/opencode`, `@maestria/kimi-code`, `@maestria/claude-code`, etc.) implements using its platform's native primitives.

If you're porting maestria to a new platform, this is your implementation guide. Each pattern section ends with platform-specific adaptation notes that map the pattern to OpenCode's subagents, Kimi Code's AgentSwarm, or Claude Code's hooks.

---

## Pattern: Pipeline Composition

### What It Is

A sequential flow where work passes through specialized stages, each adding value and producing a structured handoff for the next. No stage does the work of another - the adventurer maps code but doesn't edit it, the builder implements but doesn't review, the reviewer validates but doesn't redesign.

The pipeline is the backbone of every non-trivial maestria workflow. It forces discipline: reconnaissance before design, design before implementation, implementation before review. Skipping a stage trades reliability for speed and must be justified explicitly.

**The maestria pipeline:**

```
Input → @adventurer (recon) → @planner or @architect (plan/design)
  → @builder (implement) → @reviewer (validate) → Output
```

Each arrow is a structured handoff, not a loose "figure it out" delegation. Planner and architect are alternatives at the same pipeline stage - the orchestrator delegates to whichever fits the task. For simple features, one suffices. For complex features, both may participate (planner scopes the work, architect evaluates approach). The output of one stage is the input briefing for the next.

### Sub-Elements

#### Handoff Contract

Every delegation crossing an agent boundary must be a complete briefing. Without this structure, agents lose context, invent assumptions, or produce output that doesn't connect to the next stage.

The contract has seven fields:

| Field                      | Purpose                                                         |
| -------------------------- | --------------------------------------------------------------- |
| **Goal**                   | What to achieve and why it matters                              |
| **Context**                | Relevant paths, constraints, prior decisions, what's been tried |
| **Requirements**           | Specific expectations and boundaries                            |
| **Known problems**         | Issues already identified, things to watch for                  |
| **Assumptions documented** | Explicit assumptions made during the task and their evidence    |
| **Success criteria**       | How to verify the work is done (the completions promise)        |
| **Next step**              | What happens after this task completes                          |

Every handoff ends with: _"If anything is unclear or ambiguous, exhaust available data first, document your assumption, and proceed."_

Example:

```
Goal: Map the auth module's session handling paths before we refactor login.
Context: /src/auth/session.ts (the main file), ADR-CORE-003 in docs/adr/core/.
  We already know the token refresh path has a race condition (issue #42).
Requirements: Trace every code path that reads or writes session state.
  Do not edit any files - read only. List files and line numbers.
Known problems: The JWT expiration check in session.ts line 89 uses wall
  clock time instead of server time, which causes intermittent failures
  across timezones.
Success criteria: A complete call graph of session operations with file
  paths, line numbers, and the race condition's entry points documented.
Next step: @architect receives this map to design the fix strategy.
```

#### Iteration Limits

Every pipeline stage must have three controls:

1. **Verifiable termination condition** - a concrete, measurable state that stops execution. Not "done when it feels right." Done when the success criteria in the handoff contract are met.

2. **Max-N hard limit** - usually 3 attempts before escalation. If a stage fails after N tries, it's not a persistence problem; it's a context, skill, or approach problem that needs human judgment.

3. **Escalation format** - a structured signal so the next stage or the human operator can take over without guessing what went wrong:

   ```
   Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.
   ```

   Example from the builder: _"Tried three implementation approaches: direct mutation (broke test isolation), event emitter (added 200 lines of glue), and a middleware hook (clean but needs a new dependency). Blocked by decision: is adding `eventemitter3` acceptable, or should we avoid new dependencies? Need architectural guidance from @architect to proceed."_

#### Pipeline Rules

1. **One atomic task per stage** - never bundle unrelated work into a single delegation. A bug fix and a feature in the same `@builder` call is a scoping violation. The constraint is conceptual (one concern per invocation), not quantitative (one file per invocation).

2. **Default pipeline is non-negotiable for non-trivial work** - any multi-file, cross-module, or new-feature task follows `adventurer → planner or architect → builder → reviewer`. Skipping a stage requires explicit justification in the handoff. Common acceptable skips: typo fix skips architecture; known codebase skips reconnaissance.

3. **Parallel fan-out is allowed for independent tasks** - max 3-5 subtasks per turn. Examples: `@adventurer` mapping auth + `@adventurer` tracing billing in parallel; `@reviewer` checking PR #7 + `@builder` fixing bug #42 + `@architect` evaluating a dependency decision.

4. **Stages are ordered by dependency** - later stages cannot proceed without earlier stages' output. The builder cannot implement what the planner hasn't scoped. The reviewer cannot validate what the builder hasn't built. This seems obvious. It gets violated when someone tries to parallelize dependent work.

### Platform Adaptation

How each platform implements this pattern:

| Platform | Primitive | Implementation |
| --- | --- | --- |
| **OpenCode** | `task()` subagents | Orchestrator delegates to specialist agents via the 7-agent pipeline. Each agent is a markdown file with frontmatter permissions. Orchestrator has `edit: deny`. Bash allow-listed for git inspection (`git status`, `git diff`, `git log`), runtime queries (`which`, `pwd`), and skill installation (`npx --yes skills@latest *`). All other commands denied. |
| **Kimi Code** | AgentSwarm with persona-per-stage | Each pipeline stage is a persona in the swarm. Handoff contracts flow as structured messages between personas. Permissions enforced via `[[permission.rules]]` blocks. |
| **Cursor** | Task subagents + skills/commands | Specialists ship as plugin `agents/*.md`; orchestrator as a skill; workflow modes as `commands/` (`fein`/`sonar`/`blitz`). Global rules via `alwaysApply` `.mdc`. Same bundle for IDE and CLI. |
| **Claude Code** | Hooks and agent extensions | Stages are implemented as hooks that load agent definitions and tool configurations per phase. Handoff contracts pass through context variables. |

---

## Pattern: Maker/Checker Split

### What It Is

The agent that produces work must not be the agent that validates it. A different agent - with fresh context and a read-only toolset - performs verification. This is the single most important reliability pattern in maestria.

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

The checker agent has `edit: deny`. It cannot modify files - only read and report. This is technical enforcement of the behavioral split. The checker _physically cannot_ become the writer.

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
| **Kimi Code** | Safety constraints + persona | Reviewer persona includes `[[permission.rules]]` block that denies file modification. Runtime enforcement via `builtin_safety_constraint`. |
| **Cursor** | Prompt-level constraints (v1) | Reviewer/adventurer/planner agents instruct read-only behavior. No per-agent tool deny API yet; hooks deferred. |
| **Claude Code** | Read-only tool access | Reviewer is spawned via `new Agent({ tools: { Edit: false, Read: true, Bash: false } })` or equivalent tool-level permission gating. No hooks can escalate write access. |
