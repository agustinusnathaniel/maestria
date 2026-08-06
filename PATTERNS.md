# Maestria Design Patterns

Maestria adapts two patterns to each platform's native primitives. Route, context, and tool enforcement are platform-specific and must not be inferred from the pattern alone. Canonical hard rules take precedence over project `.maestria` rules; project rules may add constraints but cannot waive core floors.

## Pattern: Pipeline Composition

### What It Is

Pipeline composition gives each specialist one concern and passes a structured result to the next owner when delegation is justified. It is not a ceremony that every task must run.

| Route | Composition |
| --- | --- |
| `direct` | Host execution. No child or handoff during execution. |
| `focused` | One targeted specialist. One reviewer before landing when it will land, or when concrete risk requires review. |
| `full` | One thinker -> one worker -> one independent reviewer by default. |

Direct is the default for simple, familiar, low-risk work. Focused is the default for ordinary work needing one owner. Full is for complex or high-risk work and explicit `fein` requests. Extra thinkers, workers, parallel branches, or review lenses require concrete evidence of an additional risk. Do not add startup reconnaissance or require recon/design before every builder task.

Direct research and non-landing work remain review-free unless risk requires review. Direct implementation that will land escalates to a review-capable route before commit, push, publish, merge, or PR creation. Direct execution itself remains zero-child. Focused research and non-landing work follow the same conditional review rule. Full always retains independent review.

### Route Selection

Select the specialist that owns the concern:

- `@adventurer` - unfamiliar-code reconnaissance and tracing
- `@architect` - architecture decisions and trade-offs
- `@builder` - one atomic implementation task
- `@diagnose` - root-cause analysis for failures and regressions
- `@planner` - multi-step implementation plans
- `@reviewer` - independent quality and correctness review
- `@writer` - documentation and structured prose

Do not bundle unrelated concerns or overlap write ownership. `sonar` selects one research specialist and stops before implementation. `blitz` selects direct execution and never delegates to a Maestria child. Platform route gates may enforce these boundaries differently; do not claim guarantees a platform does not provide.

### Handoff Contract

Direct turns have no handoff. A focused handoff contains five fields:

1. **Goal**
2. **Context/scope**
3. **Constraints/assumptions**
4. **Success criteria**
5. **Next step**

Full and cross-agent work uses seven fields:

1. **Goal**
2. **Context**
3. **Requirements**
4. **Known problems**
5. **Assumptions documented**
6. **Success criteria**
7. **Next step**

For ambiguity, exhaust available data, document assumptions with evidence, and proceed. Stop only for a migration/data, production, security, irreversible, or safety-ambiguity checkpoint, or when the success criteria cannot be met.

### Review Protocol

The reviewer receives the original requirements, acceptance criteria, and diff. The reviewer does not receive the maker's handoff, implementation summary, self-assessment, test-results narrative, or prior builder access list. This is blind review against non-maker signals.

Review findings are triaged as `[fix]`, `[dismiss]`, or `[escalate]`. Full-route review allows up to three bounded fix/review cycles. Unresolved `[fix]` findings after the third cycle block landing and fail loud with the attempted approaches, remaining findings, last diff delta, and required input. Any unresolved `[escalate]` finding blocks landing until its required decision is recorded. Do not silently ship the last attempt or expand the pipeline indefinitely.

Use multiple review lenses only for evidenced multi-concern, security, performance, or large-diff risk. Use one reviewer for ordinary full work and scale expensive or slow models down to one review pass.

### Iteration Limits

Every loop has:

1. A verifiable termination condition.
2. A hard limit of three attempts.
3. An escalation signal:

   ```
   Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.
   ```

After two consecutive user rejections of the current approach, stop that approach and escalate rather than iterating a third time on it.

### Autonomous Shipping

An ordinary implementation request authorizes the orchestrator's autonomous route-scoped shipping flow unless the user explicitly limits it to research-only, no-commit, or no-ship. Specialists may commit, push, or create a PR only when the orchestrator delegates the exact operation, files, message, and validation. Direct root work follows the same flow. Human checkpoints are restricted to data migrations, production, security, irreversible decisions, and safety ambiguity.

Before shipping, inspect status, focused diff, recent history, branch, and worktrees. Every change under `packages/` or any behavior-affecting change requires a changeset; docs-only or internal-only changes follow the repository's actual conventions. Audit internal docs/ADRs, user-facing docs, and changelog entries. Compose a conventional commit message, stage only intended files, verify the staged and clean state, and commit and push meaningful work only on a non-primary feature branch. Never use `main` or `master`. Create or update a PR with Summary, Changes or Work Results, Testing, and Breaking Changes. Worktrees are isolated and proceed after inspection. Preserve unrelated work on unrecognized branches and ask only when ownership or safety remains ambiguous.

## Pattern: Maker/Checker Split

### What It Is

When a route selects a reviewer, the agent that produces the artifact is not the agent that validates it. Full includes one reviewer by default. Focused landing work includes one reviewer before landing. Direct execution has no child review during execution, but a direct artifact that will land must escalate to a review-capable route first.

The reviewer checks the original requirements, acceptance criteria, and diff, not the maker's self-assessment. The boundary is strongest where the platform enforces read-only tools and separate context, and advisory elsewhere.

### Completions Promise

Define success criteria before work begins:

```
This task is complete when [verifiable conditions].
```

The reviewer checks this promise rather than substituting a new subjective definition of done.

### Permission Enforcement

Platform enforcement varies:

| Platform | Enforcement |
| --- | --- |
| **OpenCode** | Route gates and reviewer permissions can enforce bounded tools and read-only review. |
| **Kimi Code** | Review-only behavior depends on configured session permissions. |
| **Cursor** | Read-only agent settings can block write tools. |
| **Claude Code** | Agent tool configuration can omit editing tools. |
| **Pi** | Reviewer role guidance and platform dispatch affect isolation. |
| **Oh My Pi** | Native task behavior and role guidance affect isolation. |

Do not claim technical maker/checker enforcement where the platform provides only prompt guidance.
