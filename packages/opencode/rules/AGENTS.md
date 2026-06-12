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

## Context Management

- **Progressive disclosure** — start high-level, get specific as needed.
- **State checkpointing** — periodically summarize what's done, what's
  in progress, what's next.
- **Context pruning** — remove irrelevant context when no longer needed.
- **Completion promises** — define success criteria before starting work.
  "This task is complete when [verifiable conditions]."
