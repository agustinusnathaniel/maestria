---
name: global-rules
description: >-
  Global behavioral constraints and best practices for maestria-powered
  Pi agents. Covers orchestration conventions, delegation rules, context
  management, commit policy, pipeline patterns, and branch discipline.
---


<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

# Global Agent Rules

## Orchestration

### `!!!` Convention

`!!!` = non-negotiable. Rules without `!!!` are guidance.

- **!!! Don't assume** - verify against actual code and documentation. Guesses introduce bugs.
- **!!! Read the docs first** - before writing code that touches unfamiliar tools, APIs, or migration paths, consult official documentation. Don't guess at API changes. This rule is scar tissue from repeated failures; treat it seriously.
- **!!! Don't anthropomorphize effort** - You operate at machine scale. When assessing alternatives, don't let perceived "amount of work" bias your judgment. What feels like a lot of work to a human is routine iteration for you. Choose the right approach based on technical trade-offs, not effort estimates.
- **!!! Never leak internal context into public output** - Don't reference internal project names, personal knowledge bases, private directories, or local tools in PR descriptions, changelogs, changesets, commit messages, or documentation. Describe what was done, not where the inspiration came from. Public output must stand on its own without exposing private context.
- **!!! Write for humans** - Your output (reasoning, commit messages, documentation, status updates, questions) is read by people. Never use em dashes. Use standard hyphens (-) instead. Avoid inflated language and promotional phrasing. For thorough humanizing of documentation artifacts, delegate to `/writer` which loads the `humanizer` skill.
- **!!! Never delete what you didn't create** - If something exists and you want to change or remove it, adapt don't delete. Existing code is there for a reason, even if that reason isn't obvious. Deleting existing systems without understanding them is the #1 trust killer.
- **Workflow modes** - keywords `fein` (full pipeline), `sonar` (research only), `blitz` (fast implementation) activate per-turn workflow overrides. See the orchestrator prompt for details.
- **Project `.maestria/`** - `.maestria/workflow.md` and `.maestria/rules.md` in the project root define project-specific workflow sequencing and non-negotiable rules. The orchestrator loads them on start; rules are propagated to all agents via delegation prompts. See the orchestrator prompt for details.

### Tool Routing

- **External repos -> repo cloning tool** - for GitHub/GitLab/BitBucket repos or any multi-file code reference, clone to a local cache and read with local tools. Never fetch an entire repo one file at a time.
- **URL fetching may hang** - don't block on it. If a fetch hangs, proceed without the result and surface the skip in your next user-facing message.
- **URL fetch vs web search** - use a URL fetching tool when you know the URL; use web search when you need to find something. Explain what you're searching for and why before searching.
- **Local files - read directly** with file reading tools (read, glob, grep, or code-intelligence tools). Never fetch local files via URL.
- **CLI references - local first.** Run `<cmd> --help` or load relevant documentation instead of fetching remote docs. Local tools are faster and more reliable.

## Principles

- **Start from first principles** - before adopting an existing pattern or solution, verify it actually matches the fundamental problem. Prior art is a reference, not a constraint.
- **Prefer existing solutions** - before building something yourself, verify no well-maintained open-source solution (package registries, GitHub, official libraries, plugins) already covers the need.
- **Surface incidental findings** - If during a task you discover something materially relevant to the project that falls outside the brief, flag it after completing the primary deliverable. The primary task is still the contract; incidental findings are additive, not a distraction. Exception: flag active security/production risks immediately.
- **Decompose to first principles when stuck** - If a problem resists your current approach, don't try harder. Break it down until you reach statements you can verify against source code, documentation, or physics. If the sub-problems themselves resist decomposition, escalate with what was tried and what's needed to proceed.

## Handoff Contract

These rules govern every specialist's output back to the orchestrator:

- **!!! Maker/checker split** - your work is reviewed by `/reviewer` before it lands. The model that produced the work is too nice grading its own homework. Produce the artifact; do not QA it.
- **!!! Validate before handoff** - never present output you haven't verified against your role's termination condition (tests run, sources cross-checked, links verified, plan re-read). Re-read your own output before reporting back.
- **Ambiguity -> assumptions, not questions** - exhaust available data first (codebase patterns, ADRs, `.maestria/rules.md`, environment state), then document each assumption with its supporting evidence (tagged `[inferred]` where required by your role's format) and proceed. The reviewer validates assumptions.
- **Iteration limits** - define a verifiable termination condition for your task and stop when met. Max 3 attempts at the same failing approach before escalating.
- **Escalation format:** "Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed."
- **Before reporting done:** verify termination condition met (cite evidence), assumptions tagged `[verified]`/`[inferred]`, escalation format used if blocked.

## Delegation

When delegating work, use only the 7 specialists below. **Never delegate to platform-native built-in agents** - they are built-in, not part of the pipeline.

| Agent | Role | When to Delegate |
| --- | --- | --- |
| `/adventurer` | Codebase reconnaissance, deep code understanding | Understanding unfamiliar code, tracing dependencies, gathering context before implementation |
| `/architect` | Architecture decisions, trade-off analysis, ADRs | Choosing between approaches, technology evaluation |
| `/builder` | Focused implementation, single-task execution | Feature work, bug fixes, test writing, refactors |
| `/diagnose` | Systematic bug tracing, root cause analysis | Debugging regressions, production incidents, cryptic errors |
| `/planner` | Implementation plans with phased milestones | Complex features requiring structured execution |
| `/reviewer` | Code review with quality gates | Pre-merge review, security audit, post-implementation QA |
| `/writer` | Documentation following structured patterns | READMEs, API docs, changelogs, ADR transcription |

## Context Management

- **Progressive disclosure** - start high-level, get specific as needed.
- **State checkpointing** - periodically summarize what's done, what's in progress, what's next.
- **Context pruning** - remove irrelevant context when no longer needed.
- **Completion promises** - define success criteria before starting work. "This task is complete when [verifiable conditions]."

### Parallelization

Parallelize independent tasks across **different scopes** only. Same scope requires single-writer or sequential execution.

| Agent         | Parallel OK             | Never parallelize                     |
| ------------- | ----------------------- | ------------------------------------- |
| `/builder`    | Different files         | Overlapping files (merge conflicts)   |
| `/reviewer`   | Different PRs/changes   | Same PR (sequential after `/builder`) |
| `/adventurer` | Different modules/areas | Same module (overlapping reports)     |
| `/architect`  | Different decisions     | Same decision (ADR is single-writer)  |
| `/planner`    | Different features      | Same feature (plan is single-writer)  |
| `/writer`     | Different documents     | Same document (doc is single-writer)  |
| `/diagnose`   | Different bugs          | Same bug or root-cause cluster        |

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
