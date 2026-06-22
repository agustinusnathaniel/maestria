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
- **Use `opensrc` for repos; `WebFetch` for pages** — when analyzing a
  GitHub/GitLab/BitBucket repo or any multi-file code reference, run
  `opensrc path <owner/repo>` (e.g. `opensrc path facebook/react`).
  It clones to a global cache and prints a path that `Read`/`Glob`/`Grep`
  can use directly. For a single file, a specific page, or a known
  URL, `WebFetch` is fine. Don't fetch an entire repo one file at a
  time — clone it once, then read locally. Use `--cwd` to resolve
  versions from the current project.
- **Webfetch may hang — don't block on it** — if a `WebFetch` request hangs after you've issued it, **proceed without the result** and surface the skip in your next user-facing message. Don't wait for a hung fetch to complete.

- **CLI references — use local tools first** — for CLI references, run `Bash --help` or load the relevant `Skill` instead of reaching for `WebFetch`. Local tools are faster and more reliable than fetching docs.

- **Local files — read directly** — use `Read`, `Glob`, or `Grep` (or `LSP` when available) for any file you have path access to. Don't `WebFetch` a local file or a file in a checked-out repo.
- **Workflow modes** — keywords `fein` (full pipeline), `sonar` (research only),
  `blitz` (fast impl) activate per-turn workflow overrides. See the
  orchestrator prompt for details.
- **Tool hierarchy for external information:**
  1. `WebFetch` — fetch a specific known URL (for docs, pages)
  2. `WebSearch` — discover relevant pages (for finding unknown resources)
     Use `WebFetch` when you know the URL; use `WebSearch` when you need to find
     something. Explain what you're searching for and why before using it.

## Delegation

When delegating work via `Agent()` (single item) or `AgentSwarm()` (≥3 uniform items),
use only the 7 specialist personas below. Each maps to a subagent type
(`coder`, `explore`, or `plan`) via the orchestrator's routing table.

| Persona      | Subagent Type | Role                                             | When to Delegate                                                                             |
| ------------ | ------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `adventurer` | `explore`     | Codebase reconnaissance, deep code understanding | Understanding unfamiliar code, tracing dependencies, gathering context before implementation |
| `architect`  | `coder`       | Architecture decisions, trade-off analysis, ADRs | Choosing between approaches, technology evaluation                                           |
| `builder`    | `coder`       | Focused implementation, single-task execution    | Feature work, bug fixes, test writing, refactors                                             |
| `diagnose`   | `coder`       | Systematic bug tracing, root cause analysis      | Debugging regressions, production incidents, cryptic errors                                  |
| `planner`    | `plan`        | Implementation plans with phased milestones      | Complex features requiring structured execution                                              |
| `reviewer`   | `coder`       | Code review with quality gates                   | Pre-merge review, security audit, post-implementation QA                                     |
| `writer`     | `coder`       | Documentation following structured patterns      | READMEs, API docs, changelogs, ADR transcription                                             |

## Context Management

- **Progressive disclosure** — start high-level, get specific as needed.
- **State checkpointing** — periodically summarize what's done, what's
  in progress, what's next.
- **Context pruning** — remove irrelevant context when no longer needed.
- **Completion promises** — define success criteria before starting work.
  "This task is complete when [verifiable conditions]."

## Commit Policy

- **Only the orchestrator authorizes commits.** Subagents must refuse
  commit requests and redirect to the orchestrator.
- **Builders executing commits** must follow the orchestrator's exact
  instructions (message, files, `vp check`/`vp test`). Flag it if the
  orchestrator's instructions skip the commit protocol.
- **Plans must not include implicit commit steps.** Commit authorization
  is a separate orchestrator step requiring explicit user approval.
