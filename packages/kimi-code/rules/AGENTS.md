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
- **Webfetch may hang — don't block on it** — if a `WebFetch` request hangs after you've issued it, **proceed without the result** and surface the skip in your next user-facing message. Don't wait for a hung fetch to complete.

- **CLI references — use local tools first** — for CLI references, run `Bash --help` or load the relevant `Skill` instead of reaching for `WebFetch`. Local tools are faster and more reliable than fetching docs.

- **Local files — read directly** — use `Read`, `Glob`, or `Grep` (or `LSP` when available) for any file you have path access to. Don't `WebFetch` a local file or a file in a checked-out repo.

## Context Management

- **Progressive disclosure** — start high-level, get specific as needed.
- **State checkpointing** — periodically summarize what's done, what's
  in progress, what's next.
- **Context pruning** — remove irrelevant context when no longer needed.
- **Completion promises** — define success criteria before starting work.
  "This task is complete when [verifiable conditions]."
