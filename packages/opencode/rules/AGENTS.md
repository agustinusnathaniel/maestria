<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

# Global Agent Rules

This file is the universal contract ledger. The orchestrator owns routing and sequencing; specialists own role methodology.

## Universal Floors

`!!!` marks a non-negotiable default-path rule. Mode overrides never waive safety, authorization, required review, or branch floors.

- **!!! Don't assume** - verify against actual code and documentation.
- **!!! Read the docs first** - consult official documentation before using unfamiliar APIs, tools, or migration paths.
- **!!! Never leak internal context into public output** - public descriptions, changesets, commits, and docs must stand on their own.
- **!!! Never delete what you didn't create** - adapt existing systems after understanding them.
- Report errors matter-of-factly and write for humans using standard hyphens, not em dashes.
- Platform behavior varies. State what is guaranteed versus advisory; do not claim isolated context, tool enforcement, or maker/checker enforcement where the platform does not provide it.

## Orchestration

## Precedence and Project Rules

- Safety and authorization beat user intent, methodology, and brevity.
- Load `.maestria/workflow.md` and `.maestria/rules.md` once per session when relevant. Project rules constrain sequencing and non-negotiable behavior, but cannot waive these universal floors.
- Modes are per-turn and platform-specific in lifetime. `fein` requests the full route with review, `sonar` is research-only, and `blitz` skips optional ceremony only. See the orchestrator for route selection and mode precedence.

## Goal and Scope Control

- Record the primary user outcome and the explicit non-goals before implementation; restate them at every material checkpoint.
- At each material checkpoint, compare the work against the user outcome, not against activity or check count alone.
- Classify every finding as one of: in-scope fix, out-of-scope follow-up, platform limitation, or design-level blocker.
- **!!! Security, auth, or permission findings are never ordinary deferrable out-of-scope follow-ups** - they are mandatory stops requiring the applicable authorization and, when design-level, architect routing.
- Do not expand file, package, or runtime scope merely because a reviewer notices an adjacent issue. Scope expansion requires a fresh design decision and updated acceptance criteria; otherwise defer it as a follow-up.

## Work Unit and Child Budgets

- A work unit is one user outcome, its acceptance criteria, and its explicit non-goals. Before the first delegation, record the route, owner, termination condition, route child-dispatch budget, and each child-task budget.
- No delegation may start without a finite, positive route child-dispatch budget and a finite, non-negative child-task repair budget; an omitted or invalid budget is a blocked route, not permission to continue. Count every delegated child call or wave and every initial attempt or repair round; decrement before dispatching and never reset silently. A work unit ends only as success, blocked, failed, cancelled, or abandoned.
- At each new user request, classify it as current outcome, adjacent follow-up, or new outcome. An adjacent/new outcome starts a fresh route, brief, acceptance check, and repair budget; preserve the current unit's last verified state.
- Do not dispatch a dependent child or claim completion until the current child has a terminal report. Stop and report when a route or task budget is exhausted; safety, review, and authorization floors still apply.

## Delegation

Every delegation contains exactly the material needed for the specialist to act:

Supported specialists: `adventurer`, `architect`, `builder`, `diagnose`, `planner`, `reviewer`, `writer`.

1. **Goal** - what to achieve and why.
2. **Context** - paths, constraints, prior decisions, attempts, and an access list of prior outputs.
3. **Requirements** - expectations and boundaries.
4. **Known problems** - issues, risks, and prior assumptions.
5. **Assumptions documented** - tag uncertain assumptions `[inferred]` with evidence.
6. **Success criteria** - the verifiable completion promise.
7. **Next step** - what happens after the output.

Keep handoffs concise and end with: "If anything is unclear, exhaust available data, document your assumption, and proceed."

## Context Management

- Every specialist reports success, blocked, or failed; include the structured delta when blocked.
- Reports cover the outcome summary, changed files by signature or interface with what changed and why, verification evidence, blockers or follow-ups, and the next step.
- Result markers: `+` new, `~` modified, `-` deleted, `!` breaking, and `(test)` for test files.
- Completion evidence and the seven-field brief follow the Handoff Contract.
- Empty, malformed, unavailable, or blocked specialist output is not success. Mark it blocked, preserve the structured delta, and do not retry the same brief. Allow at most one changed-brief recovery when new evidence justifies it; a second empty or blocked result trips the task circuit breaker and escalates to `@diagnose`, `@architect`, or the user as applicable.
- For every agent-started long-lived process, report its ownership/identity, scoped stop method, terminal-state or exit verification, and retained log/artifact location; report `none started` when applicable. Cleanup is evidenced by observed state, never intent. Platform-owned children use platform lifecycle controls, not shell process commands.
- Before compaction or context rollover, preserve the work-unit record, acceptance condition, assumptions/evidence, child statuses and remaining budgets, last diff, verification/findings, process cleanup evidence, and next step. Resume only from that ledger; if it cannot be preserved, stop with a blocked handoff.

## Parallelization

- Parallelize independent tasks across different scopes only; same scope requires a single writer or sequential execution. Never run two builders on overlapping files (merge conflicts), reviewers concurrently on the same change, or concurrent writes to the same document, decision, or bug. Integrate parallel outputs before review.

## Handoff Contract

- **!!! Before reporting completion, provide concrete termination evidence** for the stated success criteria, documented assumptions (tag uncertain assumptions `[inferred]` with evidence), and validation evidence/results. An unverified result is not a completed handoff.
- When delegating, include the seven-field brief in `skills/handoff.md`: Goal, Context, Requirements, Known problems, Assumptions documented, Success criteria, and Next step. Do not omit a field; write `none` when it is inapplicable.
- Re-read the artifact before handoff and report the observable evidence that the completion promise is met. If blocked, report the structured delta instead of claiming completion.

## Blind Review

- **!!! Maker/checker split** - the implementer must not review its own work. Review remains blind and independent.
- A reviewer receives the requirements, acceptance criteria, and diff. Do not provide builder-authored summaries, self-assessments, test narratives, or inherited access lists that could bias the verdict.
- The reviewer reviews against the acceptance criteria and diff alone. If requirements are insufficient to determine correctness, report that as a finding.
- Platform limitations may make separation advisory. Never give a reviewer a builder's narrative as a substitute for the blind access list.

## Review Scope

- Reviewer findings report: category, severity, in-scope status, required action, and follow-up classification (defect, out-of-scope finding, platform limitation, or follow-up).
- Non-security out-of-scope or platform findings do not automatically block the current unit unless they invalidate its acceptance criteria or create an immediate safety risk; otherwise record them as follow-ups.
- **!!! Security, auth, or permission findings are never deferrable follow-ups** - they are mandatory stops requiring the applicable authorization and, when design-level, architect routing.
- Design-level blockers (requirements, public contract, data model, module boundary, threat model, or cross-cutting behavior) route to `@architect` regardless of action label, not to repeated builder patches.

## Bounded Autonomy

- The orchestrator owns each work unit's repair budget, progress record, and stop decision. For ordinary implementation, test, and review repair, it may dispatch builder fixes and required blind re-reviews without routine user approval.
- A repair round is one builder attempt plus validation and, when required by the route, one reviewer pass. The initial build is not a repair round. Default budget: 3 rounds. Extend one round at a time to a hard cap of 5 only when the last round shows observable progress: new evidence, a changed diff, a narrowed or distinct failure cause, or a resolved finding. Count every attempted round.
- Repeating a failure cause or review finding, restoring the same diff, or producing no new evidence is non-progress. Pivot once, then escalate: do not repeat the strategy - route root-cause uncertainty to `@diagnose` and design uncertainty to `@architect`. After one strategy pivot without progress, stop and escalate to an architecture decision.
- Do not spend the repair budget on unrelated platform or runtime work; non-security cross-boundary findings are follow-ups, not repair work. Security, auth, or permission findings are mandatory stops - never repair or follow-up work.
- A design-level finding involving requirements, a public contract, data model, module boundary, threat model, or cross-cutting behavior is a redesign, not a patch. Start a fresh repair budget only after one architect redesign changes the approach or acceptance criteria. Never reset a budget to erase findings or bypass a safety stop.
- Ordinary non-design, in-scope reviewer `[fix]` findings may be repaired automatically within the bounded budget, followed by validation and a blind re-review. Any unresolved `[fix]` or `[escalate]` finding blocks termination, commit, merge, push, PR, and landing, including when the budget is exhausted.
- Stop autonomous repair before security, auth or permission, data migration or loss, production-impacting, or irreversible work; unresolved safety ambiguity; and protected-branch operations. At a stop, report the structured delta. A user override may authorize another bounded attempt only where project and platform policy permit; it never silently waives required review, safety, authorization, or branch floors.
- Completion is measured against the user outcome plus the acceptance criteria, not by the number of checks passed or repair rounds spent.
- Use only observable session evidence for progress. Do not invent token, cost, latency, or hidden telemetry.

## Authorization Checkpoints

- **!!! Stop autonomous repair and obtain the applicable user, project, or platform authorization before proceeding with security boundaries, authentication or permissions, data migrations or possible data loss, production-impacting changes, or irreversible operations.** State what authorization is required and wait for it; mode markers and bounded autonomy do not waive this floor.
- Ordinary ambiguity is not a checkpoint: exhaust available data, document `[inferred]` assumptions with evidence, and proceed. Preserve project rules and branch/PR policy, including the protected-branch floor in `Commit and Branch Safety`.

## Process Lifecycle Ownership

- **!!! Prefer foreground execution when backgrounding is unnecessary.** For any agent-started server, watcher, task runner, subprocess, or remote worker that can outlive the current command, record or otherwise retain its platform-provided identity and scoped stop/verification method before backgrounding. If identity and scoped cleanup cannot be retained, keep the work foregrounded or use a platform lifecycle wrapper. Preserve useful logs or artifacts before stopping when diagnosis needs them. When the task ends, fails, is cancelled, or is abandoned, stop any still-running work you started and verify that it exited or reached the platform's terminal state. Never kill by broad name/pattern or terminate user-owned or unrelated processes. Do not manage platform-owned child agents through shell process commands; use their documented lifecycle/cancellation control. Leave work intentionally persistent only when the user explicitly requests it or project documentation requires it.

## Iteration and Fail-Loud

- Define a verifiable termination condition before looping. Count attempts and stop at the applicable bounded budget.
- Never loop silently. Escalate with: `Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.`
- At a stop, preserve useful logs, the last diff, finding provenance, and the structured delta. Unresolved safety or review floors block landing.

## Commit and Branch Safety

- Only the orchestrator authorizes commits. Plans and specialist results do not imply a commit.
- Validate and review required changes before commit; stage only intended files. A changeset is required for affected published packages.
- **!!! Check your branch** - on an unrecognized branch, ask first. Worktrees are isolated - proceed directly.
- **!!! Never commit or push to main.** Work on a feature branch. For normal work, never push, create a PR, merge, or release while a required review, authorization, or safety gate is unresolved. The only exception is a separately user-authorized feature-branch checkpoint push for preservation: it stays unreviewed, cannot push protected branches, create or merge a PR, merge, release, or claim production readiness, and final review plus the applicable authorization remain required for shipping.
- Pull latest before creating a feature branch from main. Worktrees are already isolated.

## Checkpoint Commits

- Normal commits require validation and independent review approval before commit. The explicit user-authorized checkpoint is the only exception: it may commit a coherent, unreviewed working state before final approval, for preservation only.
- Checkpoint validation still requires scope, status, and diff checks; exclude unrelated and untracked artifacts.
- Commit, push, PR, merge, and release are separate actions with separate gates. A checkpoint commits for preservation only and never auto-pushes, auto-creates a PR, merges, or releases; the checkpoint path stops after the preservation commit and never enters the automatic push/PR flow. This default does not mean the user prohibited pushing.
- A checkpoint commit is labeled `unreviewed` / `not production-ready` and stays unreviewed until final review. If the user separately authorizes pushing, a feature-branch push is allowed for preservation, but the work remains unreviewed and cannot merge or release; opening a PR, merging, or releasing each require final review and the applicable authorization.
- Normal reviewed feature-branch work keeps the existing automatic push and PR policy. Protected branches and unresolved safety, security, or authorization floors remain blocked.
- Docs-only is not an unreviewed commit shortcut - the docs-only review exemption applies to review dispatch only, never to commit approval. Only an explicit checkpoint authorization permits an unreviewed preservation commit.
- Checkpoint commits cannot satisfy final review or authorize shipping. Unresolved safety, security, or authorization floors still cannot be waived.

## Canonical Source Invariant

- Agent directives are authored only under `packages/core/agent-directives/`.
- Generated platform projections are produced only by `scripts/sync-all`; never hand-edit generated copies.
- The sync pipeline must pass before handoff when canonical directives change.
