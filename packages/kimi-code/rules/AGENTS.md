# Global Agent Rules — @maestria/kimi-code

## Orchestration

- **!!! Don't assume** — verify against actual code and docs.
  Guesses lead to bugs.
- **!!! Read the docs first** — before writing code that touches
  unfamiliar tools, APIs, or migration paths, consult official
  documentation. Don't guess at API changes. This rule is scar
  tissue from repeated failures, not a preference.
- **Don't reference internal project names in explanations** — avoid
  leaking context outside the workspace.
- **Use `opensrc` for repos; `webfetch` for pages** — when analyzing a
  GitHub/GitLab/BitBucket repo or any multi-file code reference, run
  `opensrc path <owner/repo>` (e.g. `opensrc path facebook/react`).
  It clones to a global cache and prints a path that `Read`/`Glob`/`Grep`
  can use directly. For a single file, a specific page, or a known
  URL, `WebFetch` is fine. Don't fetch an entire repo one file at a
  time — clone it once, then read locally. Use `--cwd` to resolve
  versions from the current project.

## Delegation

When delegating work via the `Agent` or `AgentSwarm` tool, dispatch one of
the 7 specialist personas (loaded via the `Skill` tool) into the prompt
of the appropriate Kimi Code subagent (`coder`, `explore`, or `plan`).
**Never dispatch a raw subagent without a persona** — the personas carry
the methodology and constraints (reviewer doesn't edit, adventurer is
read-only, etc.).

| Specialist   | Role                                             | When to Delegate                                                                             |
| ------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `adventurer` | Codebase reconnaissance, deep code understanding | Understanding unfamiliar code, tracing dependencies, gathering context before implementation |
| `architect`  | Architecture decisions, trade-off analysis, ADRs | Choosing between approaches, technology evaluation                                           |
| `builder`    | Focused implementation, single-task execution    | Feature work, bug fixes, test writing, refactors                                             |
| `diagnose`   | Systematic bug tracing, root cause analysis      | Debugging regressions, production incidents, cryptic errors                                  |
| `planner`    | Implementation plans with phased milestones      | Complex features requiring structured execution                                              |
| `reviewer`   | Code review with quality gates                   | Pre-merge review, security audit, post-implementation QA                                     |
| `writer`     | Documentation following structured patterns      | READMEs, API docs, changelogs, ADR transcription                                             |

For ≥3 uniform independent items, use `AgentSwarm` (one `prompt_template`
across many `items`). For 1–2 items or stateful work, use a single `Agent`
call. The orchestrator skill (auto-loaded at session start) carries the
full routing table and the swarm methodology.

## Context Management

- **Progressive disclosure** — start high-level, get specific as needed.
- **State checkpointing** — periodically summarize what's done, what's
  in progress, what's next.
- **Context pruning** — remove irrelevant context when no longer needed.
- **Completion promises** — define success criteria before starting work.
  "This task is complete when [verifiable conditions]."
