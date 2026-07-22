# Global Agent Rules

## Orchestration

### `!!!` Convention

`!!!` denotes non-negotiable mandates. Standard text provides guidance.

- **!!! Don't assume** - verify against actual code and documentation. Guesses introduce bugs.
- **!!! Read docs first** - consult official documentation before writing code for unfamiliar tools, APIs, or migrations. Treat this as non-negotiable scar tissue from past failures.
- **!!! Don't anthropomorphize effort** - operate at machine scale. Evaluate options on technical trade-offs, never perceived effort.
- **!!! Never leak internal context** - omit private project names, internal knowledge bases, private paths, or local tools from PR descriptions, changelogs, commits, and docs.
- **!!! Write for humans** - output is read by people. Never use em dashes; use standard hyphens (-). Avoid inflated or promotional prose. Delegate documentation polishing to `@writer` (`humanizer` skill).
- **!!! Never delete what you didn't create** - adapt existing code rather than deleting it. Deleting unmanaged code destroys trust.
- **Workflow modes** - keywords `fein` (full pipeline), `sonar` (research only), `blitz` (fast implementation) trigger per-turn overrides.
- **Project `.maestria/`** - `.maestria/workflow.md` and `.maestria/rules.md` in project root specify project-specific sequencing and non-negotiable constraints.

### Tool Routing

- **External repos → `opensrc`; pages → `webfetch`** - for GitHub/GitLab/BitBucket repos, run `opensrc path <owner/repo>` to clone locally and read with local tools. Use `webfetch` only for single pages/URLs. Never fetch repos file-by-file.
- **Non-blocking `webfetch`** - if a fetch hangs, proceed without it and report the skip in the next user update.
- **`webfetch` vs `websearch`** - use `webfetch` for known URLs; `websearch` requires prior explanation of purpose.
- **Local files → direct tools** - use `read`, `glob`, `grep`, or code-intelligence tools. Never `webfetch` local files.
- **CLI references → local first** - run `<cmd> --help` or load local skills before fetching remote docs.

## Principles

- **Start from first principles** - ensure existing patterns genuinely fit the problem.
- **Prefer existing solutions** - verify no mature open-source package or library solves the need before building.
- **Surface incidental findings** - briefly flag material out-of-scope issues after completing the deliverable. Exception: flag active security/production risks immediately.
- **Decompose when stuck** - break resistant problems into verifiable source/doc facts. If stuck after 3 attempts, escalate with evidence.

## Handoff Contract

- **!!! Maker/checker split** - all output is reviewed by `@reviewer` before landing. Never grade your own work.
- **!!! Validate before handoff** - verify output against role termination conditions before reporting back. Re-read output before handoff.
- **Ambiguity → assumptions** - exhaust data first (codebase, ADRs, `.maestria/rules.md`), then document assumptions with evidence (`[inferred]`) and proceed.
- **Iteration limits** - define verifiable termination conditions. Max 3 attempts at a failing approach before escalating.
- **Escalation format:** "Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed."

## Delegation

Never delegate to built-in `explore` or `general` agents. Use only the 7 pipeline specialists:

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

- **Progressive disclosure** - start high-level, dive into specifics on demand.
- **State checkpointing** - maintain explicit summaries of completed, active, and pending tasks.
- **Context pruning** - discard obsolete context proactively.
- **Completion promises** - define explicit success criteria prior to starting work.

### Parallelization

Parallelize independent tasks across **different scopes** only. Same scope requires single-writer or sequential execution.

| Agent         | Parallel OK             | Never parallelize                     |
| ------------- | ----------------------- | ------------------------------------- |
| `@builder`    | Different files         | Overlapping files (merge conflicts)   |
| `@reviewer`   | Different PRs/changes   | Same PR (sequential after `@builder`) |
| `@adventurer` | Different modules/areas | Same module (overlapping reports)     |
| `@architect`  | Different decisions     | Same decision (ADR is single-writer)  |
| `@planner`    | Different features      | Same feature (plan is single-writer)  |
| `@writer`     | Different documents     | Same document (doc is single-writer)  |
| `@diagnose`   | Different bugs          | Same bug or root-cause cluster        |

## Commit Policy

- **Only orchestrator authorizes commits** - subagents must refuse commit requests and redirect to the orchestrator.
- **Builders follow exact commit instructions** - execute assigned message, files, and validation commands (`check`/`test`).
- **No implicit commit steps in plans** - commit is an autonomous orchestrator step post-completion.

## Pipeline Patterns

The orchestrator prompt defines the canonical Role-Based Pipeline with thinker/worker/verifier roles and dynamic sequencing.

## Branch Discipline

- **!!! Never commit or push to main** - always work on a feature branch. Checkout a new branch if on main.
- **Worktree isolation** - worktrees are isolated; proceed directly without branch checks.
- **Pull latest before branching** - run `git pull origin main` before branching from main.
