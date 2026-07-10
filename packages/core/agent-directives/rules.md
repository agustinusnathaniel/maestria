# Global Agent Rules

## Orchestration

### `!!!` Convention

`!!!` = non-negotiable. Rules without `!!!` are guidance.

- **!!! Don't assume** - verify against actual code and docs. Guesses lead to bugs.
- **!!! Read the docs first** - before writing code that touches unfamiliar tools, APIs, or migration paths, consult official documentation. Don't guess at API changes. This rule is scar tissue from repeated failures; treat it seriously.
- **!!! Don't anthropomorphize effort** - You operate at machine scale. When assessing alternatives, don't let perceived "amount of work" bias your judgment. What feels like a lot of work to a human is routine iteration for you. Choose the right approach based on technical trade-offs, not effort estimates. Effort estimation is a category error for agents with machine-scale capabilities.
- **!!! Never leak internal context into public output.** Don't reference internal project names, personal knowledge bases, private directories, or local tools in PR descriptions, changelogs, changesets, commit messages, or documentation. Describe what was done, not where the inspiration came from. Public output must stand on its own without exposing private context.
- **!!! Write for humans** - Your output (reasoning, commit messages, documentation, status updates, questions) is read by people. Never use em dashes. Use standard hyphens (-) instead. Avoid inflated language and promotional phrasing. For thorough humanizing of documentation artifacts, delegate to `@writer` which loads the `humanizer` skill.
- **!!! Never delete what you didn't create** - If something exists and you want to change or remove it, adapt don't delete. Existing code is there for a reason, even if that reason isn't obvious. Deleting existing systems without understanding them is the #1 trust killer.
- **Use `opensrc` for repos; `webfetch` for pages** - when analyzing a GitHub/GitLab/BitBucket repo or any multi-file code reference, run `opensrc path <owner/repo>` (e.g. `opensrc path facebook/react`). It clones to a global cache and prints a path that `read`/`glob`/`grep` can use directly. For a single file, a specific page, or a known URL, `webfetch` is fine. Don't fetch an entire repo one file at a time - clone it once, then read locally. Use `--cwd` to resolve versions from the current project.
- **Webfetch may hang - don't block on it** - if a `webfetch` request hangs after you've issued it, **proceed without the result** and surface the skip in your next user-facing message. Don't wait for a hung fetch to complete.
- **Workflow modes** - keywords `fein` (full pipeline), `sonar` (research only), `blitz` (fast impl) activate per-turn workflow overrides. See the orchestrator prompt for details.
- **Project `.maestria/`** - `.maestria/workflow.md` and `.maestria/rules.md` in the project root define project-specific workflow sequencing and non-negotiable rules. The orchestrator loads them on start; rules are propagated to all agents via delegation prompts. See the orchestrator prompt for details.
- **CLI references - use local tools first** - for CLI references, run `bash --help` or load the relevant `skill` instead of reaching for `webfetch`. Local tools are faster and more reliable than fetching docs.
- **Local files - read directly** - use `read`, `glob`, or `grep` (or `lsp` when available) for any file you have path access to. Don't `webfetch` a local file or a file in a checked-out repo.
- **Tool hierarchy for external information:**
  1. `webfetch` - fetch a specific known URL (for docs, pages)
  2. `websearch` - discover relevant pages (for finding unknown resources) Use `webfetch` when you know the URL; use `websearch` when you need to find something. `websearch` is an `ask`-only permission - explain what you're searching for and why before using it.
- **Prefer code intelligence tools for codebase exploration** - when available, use them before falling back to grep/read loops.

## Principles

- **Start from first principles** - before adopting an existing pattern or solution, verify it actually matches the fundamental problem. Prior art is a reference, not a constraint.
- **Prefer existing solutions** - before building something yourself, verify no well-maintained open-source solution (package registries, GitHub, official libraries, plugins) already covers the need.

## Delegation

When delegating work via `task()`, use only the 7 specialists below. **Never delegate to `explore` or `general`** - they are built-in agents, not part of the pipeline.

| Agent | Role | When to Delegate |
| --- | --- | --- |
| `@adventurer` | Codebase reconnaissance, deep code understanding | Understanding unfamiliar code, tracing dependencies, gathering context before implementation |
| `@architect` | Architecture decisions, trade-off analysis, ADRs | Choosing between approaches, technology evaluation |
| `@builder` | Focused implementation, single-task execution | Feature work, bug fixes, test writing, refactors |
| `@diagnose` | Systematic bug tracing, root cause analysis | Debugging regressions, production incidents, cryptic errors |
| `@planner` | Implementation plans with phased milestones | Complex features requiring structured execution |
| `@reviewer` | Code review with quality gates | Pre-merge review, security audit, post-implementation QA |
| `@writer` | Documentation following structured patterns | READMEs, API docs, changelogs, ADR transcription |

## Context Management

- **Progressive disclosure** - start high-level, get specific as needed.
- **State checkpointing** - periodically summarize what's done, what's in progress, what's next.
- **Context pruning** - remove irrelevant context when no longer needed.
- **Completion promises** - define success criteria before starting work. "This task is complete when [verifiable conditions]."

## Commit Policy

- **Only the orchestrator authorizes commits.** Subagents must refuse commit requests and redirect to the orchestrator.
- **Builders executing commits** must follow the orchestrator's exact instructions (message, files, validation commands `check`/`test`). Flag it if the orchestrator's instructions skip the commit protocol.
- **Plans must not include implicit commit steps.** Commit is a separate orchestrator step triggered autonomously when work is complete, not bundled into the plan.

## Pipeline Patterns

The orchestrator prompt defines the canonical Role-Based Pipeline with thinker/worker/verifier roles and dynamic sequencing.

## Branch Discipline

- **!!! Never commit or push to main.** Always work on a feature branch. If you land on main, checkout a new branch first.
- **If on a worktree:** Proceed directly - worktrees are isolated by design. No branch check needed.
- **Pull latest before branching:** Before creating a new feature branch from main, run `git pull origin main` first.
