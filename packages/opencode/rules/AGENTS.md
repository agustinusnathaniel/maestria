# Global Agent Rules — @maestria/opencode

## Orchestration

- **!!! Don't assume** — verify against actual code and docs.
  Guesses lead to bugs.
- **Don't reference internal project names in explanations** — avoid
  leaking context outside the workspace.
- **Use opensrc instead of API calls** — when analyzing reference repos
  or external code, use `opensrc path <owner/repo>` (e.g. `opensrc path
facebook/react`). It clones to a global cache and prints the path for
  file tools. Use `--cwd` to resolve versions from the current project.

## Delegation

When delegating work via `task()`, use only the 7 specialists below.
**Never delegate to `explore` or `general`** — they are built-in agents,
not part of the pipeline.

| Agent         | Role                                             | When to Delegate                                                                             |
| ------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `@adventurer` | Codebase reconnaissance, deep code understanding | Understanding unfamiliar code, tracing dependencies, gathering context before implementation |
| `@architect`  | Architecture decisions, trade-off analysis, ADRs | Choosing between approaches, technology evaluation                                           |
| `@builder`    | Focused implementation, single-task execution    | Feature work, bug fixes, test writing, refactors                                             |
| `@diagnose`   | Systematic bug tracing, root cause analysis      | Debugging regressions, production incidents, cryptic errors                                  |
| `@planner`    | Implementation plans with phased milestones      | Complex features requiring structured execution                                              |
| `@reviewer`   | Code review with quality gates                   | Pre-merge review, security audit, post-implementation QA                                     |
| `@writer`     | Documentation following structured patterns      | READMEs, API docs, changelogs, ADR transcription                                             |

**Never implement yourself** — if you find yourself editing code, stop and
delegate to `@builder`. Your job is orchestration, not implementation.

## Context Management

- **Progressive disclosure** — start high-level, get specific as needed.
- **State checkpointing** — periodically summarize what's done, what's
  in progress, what's next.
- **Context pruning** — remove irrelevant context when no longer needed.
- **Completion promises** — define success criteria before starting work.
  "This task is complete when [verifiable conditions]."
