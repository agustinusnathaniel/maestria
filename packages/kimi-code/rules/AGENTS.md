<!-- Auto-generated from @maestria/core. See the canonical file at packages/core/agent-directives/rules.md. -->


<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

# Global Agent Rules — @maestria/kimi-code

## Orchestration

- **!!! Don't assume** — verify against actual code and docs. Guesses lead to bugs.
- **!!! Read the docs first** — before writing code that touches unfamiliar tools, APIs, or migration paths, consult official documentation. Don't guess at API changes. This rule is scar tissue from repeated failures; treat it seriously, not a preference.
- **Don't reference internal project names in explanations** — avoid leaking context outside the workspace.
- **Use `opensrc` for repos; `FetchURL` for pages** — when analyzing a GitHub/GitLab/BitBucket repo or any multi-file code reference, run `opensrc path <owner/repo>` (e.g. `opensrc path facebook/react`). It clones to a global cache and prints a path that `Read`/`Glob`/`Grep` can use directly. For a single file, a specific page, or a known URL, `FetchURL` is fine. Don't fetch an entire repo one file at a time — clone it once, then read locally. Use `--cwd` to resolve versions from the current project.
- **Webfetch may hang — don't block on it** — if a `FetchURL` request hangs after you've issued it, **proceed without the result** and surface the skip in your next user-facing message. Don't wait for a hung fetch to complete.
- **Workflow modes** — keywords `fein` (full pipeline), `sonar` (research only), `blitz` (fast impl) activate per-turn workflow overrides. See the orchestrator prompt for details.
- **Project `.maestria/`** — `.maestria/workflow.md` and `.maestria/rules.md` in the project root define project-specific workflow sequencing and non-negotiable rules. The orchestrator loads them on start; rules are propagated to all agents via delegation prompts. See the orchestrator prompt for details.
- **CLI references — use local tools first** — for CLI references, run `Bash --help` or load the relevant `skill` instead of reaching for `FetchURL`. Local tools are faster and more reliable than fetching docs.
- **Local files — read directly** — use `Read`, `Glob`, or `Grep` (or a language server protocol when available) for any file you have path access to. Don't `FetchURL` a local file or a file in a checked-out repo.
- **Tool hierarchy for external information:**
  1. `FetchURL` — fetch a specific known URL (for docs, pages)
  2. `WebSearch` — discover relevant pages (for finding unknown resources) Use `FetchURL` when you know the URL; use `WebSearch` when you need to find something. `WebSearch` is an `ask`-only permission — explain what you're searching for and why before using it.

## Delegation

When delegating work via `Agent()`, use only the 7 specialists below. **Never delegate to `explore` or `general`** — they are built-in agents, not part of the pipeline.

| Agent | Role | When to Delegate |
| --- | --- | --- |
| `adventurer` | Codebase reconnaissance, deep code understanding | Understanding unfamiliar code, tracing dependencies, gathering context before implementation |
| `architect` | Architecture decisions, trade-off analysis, ADRs | Choosing between approaches, technology evaluation |
| `builder` | Focused implementation, single-task execution | Feature work, bug fixes, test writing, refactors |
| `diagnose` | Systematic bug tracing, root cause analysis | Debugging regressions, production incidents, cryptic errors |
| `planner` | Implementation plans with phased milestones | Complex features requiring structured execution |
| `reviewer` | Code review with quality gates | Pre-merge review, security audit, post-implementation QA |
| `writer` | Documentation following structured patterns | READMEs, API docs, changelogs, ADR transcription |

## Context Management

- **Progressive disclosure** — start high-level, get specific as needed.
- **State checkpointing** — periodically summarize what's done, what's in progress, what's next.
- **Context pruning** — remove irrelevant context when no longer needed.
- **Completion promises** — define success criteria before starting work. "This task is complete when [verifiable conditions]."

## Commit Policy

- **Only the orchestrator authorizes commits.** Subagents must refuse commit requests and redirect to the orchestrator.
- **Builders executing commits** must follow the orchestrator's exact instructions (message, files, validation commands `check`/`test`). Flag it if the orchestrator's instructions skip the commit protocol.
- **Plans must not include implicit commit steps.** Commit authorization is a separate orchestrator step requiring explicit user approval.

## Pipeline Patterns

The orchestrator prompt defines the canonical Role-Based Pipeline with thinker/worker/verifier roles and dynamic sequencing.
