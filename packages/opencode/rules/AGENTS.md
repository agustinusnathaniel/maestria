# Global Agent Rules — @maestria/opencode

## Commit & Push

- **!!! Commit and push only when asked** — do not commit unless the
  user explicitly requests it. After a commit, do not make further
  changes and commit again without asking. Never push without
  explicit permission — even if you pushed earlier in the same session.
- **Split commits by area** — when changing multiple areas, commit
  separately using `git add -p`.
- **Run checks before committing** — lint, typecheck, build, test.
  Never commit without verification.

## Orchestration

- **Maker/checker split** — a different agent should review the work.
  The agent that wrote the code should not QA it.
- **!!! Don't assume** — verify against actual code and docs.
  Guesses lead to bugs.
- **Don't reference internal project names in explanations** — avoid
  leaking context outside the workspace.
- **Use opensrc instead of API calls** — when analyzing reference repos
  or external code, use `opensrc path <owner/repo>` (e.g. `opensrc path
facebook/react`). It clones to a global cache and prints the path for
  file tools. Use `--cwd` to resolve versions from the current project.

## Context Management

- **Progressive disclosure** — start high-level, get specific as needed.
- **State checkpointing** — periodically summarize what's done, what's
  in progress, what's next.
- **Context pruning** — remove irrelevant context when no longer needed.
- **Completion promises** — define success criteria before starting work.
  "This task is complete when [verifiable conditions]."
