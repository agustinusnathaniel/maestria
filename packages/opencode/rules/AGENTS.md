# Global Agent Rules — @maestria/opencode

These rules encode patterns learned from experience. They apply to every
session — project-agnostic, tool-agnostic, model-agnostic.

## Core Principles

- **!!! Don't delete what you didn't create** — adapt, don't remove.
  If something exists, preserve it. Ask before removing.
- **!!! Validate before handoff** — test, verify, then show.
  Never present broken code. Always ensure it works before handing back.
- **!!! Read official docs first** — especially during migrations.
  Don't guess at API changes. Read documentation.
- **!!! Leverage available skills** — use the `skill` tool to discover
  and load methodology guides before raw tool calls. Skills encode
  project knowledge and take priority over general patterns.
- **!!! Ask before removing or overwriting** — if something exists and you
  want to change or remove it, ask first.
- **!!! Commit solo** — no co-authored-by lines in commit messages.
- **!!! Commit and push only when asked** — do not commit unless the
  user explicitly requests it. After a commit, do not make further
  changes and commit again without asking. Never push without
  explicit permission — even if you pushed earlier in the same session.
- **!!! Document diagnostic work** — save findings as knowledge artifacts
  so they can be referenced later.

## Workflow Directives

- **Check-Test-Commit** — Test rigorously after each change, commit one-by-one
  per task. Never batch unrelated changes into one commit.
- **Split commits by area** — When changing multiple areas, commit separately:
  `git add -p` to stage selectively.
- **Run checks before committing** — lint, typecheck, build, test.
  Never commit without verification.
- **One atomic task per subagent** — never bundle unrelated work in a single
  delegation. Each subagent gets exactly one thing to do.
- **Maker/checker split** — A different agent should review the work.
  The agent that wrote the code should not be the one that QA's it.

## Quality Gates

- **!!! Don't assume** — verify against actual code and documentation.
  Guesses lead to bugs.
- **!!! Don't oversimplify** — analysis findings should maintain depth.
  Don't reduce complex findings to shallow summaries.
- **Don't reference internal project names in explanations** — when describing
  patterns or sources, use generic descriptions. Avoid naming specific internal
  projects or repositories that could leak context outside the workspace.
- **Ensure test coverage** — new functionality should have tests.
- **Ensure no naming conflicts** — new function names must not overlap with
  reference repositories.

## Agent Orchestration Patterns

These patterns are available as subagents (@-mention them):

- `@architect` — Architecture decisions with decision matrices.
  Use when choosing between options, evaluating trade-offs.
- `@builder` — Focused implementation agent for atomic tasks.
  Use for targeted fixes, feature implementation, refactors.
- `@diagnose` — Systematic 6-step regression tracing.
  Use for cryptic errors, regressions, production bugs.
- `@planner` — Create detailed implementation plans with phased milestones.
  Use for complex features requiring multi-phase execution before building.
- `@reviewer` — Code review with quality gates.
  Use before merging, after implementation.
- `@writer` — Documentation following structured patterns.
  Use for README, API docs, architecture docs.
- `@orchestrator` — Manager for complex multi-step tasks.
  Use for features spanning multiple domains or requiring 3+ steps.

## Context Management

- **Progressive disclosure** — Start high-level, get specific as needed.
  Don't dump everything at once.
- **State checkpointing** — In long sessions, periodically summarize:
  what's done, what's in progress, what's next.
- **Context pruning** — Remove irrelevant context when it's no longer needed.
- **Completion promises** — Define success criteria before starting work.
  "This task is complete when [verifiable conditions]."

## Knowledge Base

When working on project-specific tasks:

- Check for relevant KB entries in the project's knowledge base
- Read detailed documentation pages rather than guessing patterns
- Document new findings back to the KB
- Check for workspace-level AGENTS.md or CLAUDE.md files — project-specific
  instructions work alongside these global rules
