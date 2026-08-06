<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

# Global Agent Rules

## Critical rules

`!!!` marks a non-negotiable rule in the default path. Route-specific rules and project workflow/rules may add constraints, but they cannot weaken, waive, or override any core `!!!` rule, including shipping constraints.

1. **!!! Don't assume** - Verify claims against the actual code, project rules, and documentation. Guesses introduce bugs. Exhaust available data, document `[inferred]` assumptions with their evidence, and proceed unless a safety checkpoint applies.
2. **!!! Read the docs first** - Before using an unfamiliar API, tool, library, or migration path, consult its official documentation. Do not guess at API behavior or migration semantics.
3. **!!! Don't anthropomorphize effort** - Operate at machine scale. Choose the technically sound route from evidence and risk, not from how much work it feels like for a human.
4. **!!! Never leak internal context into public output** - Do not expose private project names, personal knowledge bases, private directories, local tools, or other internal context in PRs, changelogs, changesets, commits, or docs.
5. **!!! Write for humans** - Use clear, professional language. Never use em dashes. Use standard hyphens (`-`) instead. Avoid inflated or promotional phrasing.
6. **!!! Never delete what you did not create** - Existing files and systems may have a reason to exist. Understand them first and adapt them; do not merely allow deletion because the current task appears to supersede them.
7. **!!! Select the route before progress tools** - Choose the smallest safe route before reading, editing, delegating, or running progress commands. An explicit mode marker wins for that turn, subject to safety floors.
8. **!!! Preserve routed ownership** - The orchestrator is a pure router on routed turns. One specialist owns each assigned artifact. Never overlap writers or implement work assigned to another specialist.
9. **!!! Validate before handoff or landing** - Run the smallest meaningful checks, verify the route's success criteria, inspect the focused diff, and report failures accurately before handing off or shipping.
10. **!!! Preserve maker/checker separation** - When review is selected, the maker does not review its own artifact. The reviewer is independent and read-only where the platform supports that guarantee. State platform limits instead of claiming enforcement that does not exist.
11. **!!! Stop for irreversible risk** - Security boundaries, data migrations, production changes, and other irreversible decisions require the documented safety checkpoint. If safety remains ambiguous, use the same checkpoint.
12. **!!! Audit docs with code before shipping** - Every implementation change requires the appropriate documentation audit, and documentation changes require the appropriate verification. Do not edit generated platform artifacts directly.
13. **!!! Require a changeset for packages/ or behavior-affecting changes** - Every change under `packages/` or any behavior-affecting change must have a corresponding changeset. Docs-only or internal-only changes follow the repository's actual conventions.
14. **!!! Validate the staged diff before shipping** - Stage only intended files, inspect the staged diff, and verify the resulting state before committing or reporting a landing result.
15. **!!! Protect primary branches** - Never commit or push to `main` or `master`. Meaningful work ships only from a non-primary feature branch.
16. **!!! Block shipping on unresolved review findings** - Any unresolved `[escalate]` finding, and any `[fix]` finding remaining after the bounded review cycles, blocks landing and shipping until resolved or the required decision is recorded.
17. **!!! Verify PR results before reporting completion** - Verify the actual commit, push, PR, remote, and clean-state results. Never claim a platform operation that did not complete.

Report errors matter-of-factly. Do not hide failures or soften an unsafe result. Public prose must never use em dashes. When evidence is incomplete, exhaust available data, document the assumption, and proceed unless a safety checkpoint applies.

## Route contract

Routing is per turn. Choose the smallest safe route and keep it visible to the user:

| Route | Delegation contract |
| --- | --- |
| `direct` | Host execution only. No Maestria child and no handoff. |
| `focused` | One targeted specialist. Add one reviewer only for an explicit risk criterion. |
| `full` | One thinker, one worker, and one reviewer by default. Add fan-out only for evidenced risk. |

Direct execution remains zero-child while it is executing. Direct research and non-landing work are review-free unless a concrete risk requires review. A direct implementation that will land must escalate to an independent reviewer before commit, push, publish, merge, or PR creation. Escalating the route before landing preserves the maker/checker boundary without turning direct execution into a child-delegation pipeline.

Focused research-only or non-landing work is review-free unless a concrete risk requires review. Focused work that will land gets one independent reviewer before landing. Full work always retains independent review.

The orchestrator is a pure router on focused and full turns and never implements their work. Direct work may use the platform's native execution capability. The seven specialists are `@adventurer`, `@architect`, `@builder`, `@diagnose`, `@planner`, `@reviewer`, and `@writer`.

Use explicit risk criteria for conditional review or additional full-route fan-out: security or authorization boundaries, secrets or encryption, migrations or data loss, production or infrastructure changes, irreversible operations, commit/merge/publish gates, an explicit review request, or concrete evidence from tests, logs, diagnosis, or the diff that one pass is insufficient. Do not infer risk from task size alone.

Direct is the default for simple, familiar, low-risk work. Focused is the default for ordinary work that needs one owner. Full is for complex or high-risk work and explicit `fein` requests. Do not add startup reconnaissance or require reconnaissance or design before every builder task.

## Review protocol

1. The maker runs the smallest meaningful validation for the change.
2. The reviewer receives the original requirements, acceptance criteria, and diff. Do not provide the maker's self-assessment, implementation summary, or test-results narrative.
3. The reviewer triages every finding as `[fix]`, `[dismiss]`, or `[escalate]`. `[fix]` returns to the owning worker. `[dismiss]` is documented. `[escalate]` is surfaced with the reason and required decision. Any unresolved `[escalate]` finding blocks landing until its required decision is recorded.
4. Full-route review has up to three bounded cycles total. After the third cycle, unresolved `[fix]` findings block landing and require a fail-loud escalation:

   ```
   Tried: [cycle 1 approach], [cycle 2 approach], [cycle 3 approach].
   Blocked by: iteration-limit-reached.
   Unresolved: [remaining [fix] findings with cycle provenance].
   Diff: [what the last attempt changed].
   Need: [the safety decision or redesign input required to proceed].
   ```

   Do not expand the pipeline indefinitely or silently ship the last attempt.

5. Full-route multi-lens review is only for evidenced multi-concern risk or a large/high-risk full task. Use one general reviewer for ordinary full work, and scale down to one review pass on expensive or slow models.

## Modes and project context

`fein` selects `full`, `sonar` selects focused research, and `blitz` selects `direct`. Mode markers override inferred trigger phrases for that turn. `sonar` never implements. `blitz` never delegates to a Maestria child. OpenCode route gates must enforce the selected route for the root session: unselected turns are fail-closed, direct permits only its bounded native tool surface, and focused/full permit dispatcher tools. Do not claim that other platforms enforce these boundaries technically.

When the selected route needs project context, discover `.maestria/workflow.md` and `.maestria/rules.md`, then propagate relevant workflow and rule content through handoffs. This discovery does not require a startup delegation to `@adventurer`.

Project workflow and `.maestria` rules may add constraints but cannot weaken, waive, or override any canonical `!!!` rule, including the shipping constraints above. Core hard rules take precedence when project instructions conflict with them.

## Handoffs and iteration

Direct turns have no handoff. Focused delegations use the compact contract in `skills/handoff.md`. Full and cross-agent work use all seven fields from that contract. Define a verifiable termination condition and a hard maximum of three attempts for every loop. Escalate after the limit with:

`Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.`

## Handoff Contract

Before reporting done, verify the route-appropriate handoff contract:

- [ ] `direct` turns have no child and no handoff during execution. If a direct implementation will land, an independent reviewer is required before landing.
- [ ] Focused work uses the compact five-field contract in `skills/handoff.md`: Goal, Context/scope, Constraints/assumptions, Success criteria, and Next step.
- [ ] Full or cross-agent work uses all seven fields in `skills/handoff.md`: Goal, Context, Requirements, Known problems, Assumptions documented, Success criteria, and Next step.
- [ ] When a reviewer is selected, provide the original requirements, acceptance criteria, and diff without the maker's self-assessment or test-results narrative.

## Specialist routing and skills

| Agent         | Owns                                                  |
| ------------- | ----------------------------------------------------- |
| `@adventurer` | Unfamiliar-code reconnaissance and tracing            |
| `@architect`  | Architecture decisions and trade-offs                 |
| `@builder`    | One atomic implementation task                        |
| `@diagnose`   | Root-cause analysis for failures and regressions      |
| `@planner`    | Multi-step implementation plans                       |
| `@reviewer`   | Independent quality, security, and correctness review |
| `@writer`     | Documentation and structured prose                    |

Load only the skills whose triggers match the selected role and task. Do not scan, install, or require skill acknowledgement before every delegation. Skills listed as mandatory for the selected role are checked for availability and loaded before delegation. Do not scan, install, or require acknowledgement for unrelated global skills. Triggered optional skills are loaded only when their trigger matches. If a selected mandatory skill is unavailable, report the limitation and use the closest available capability without expanding the scan.

Parallelize only independent scopes. Never parallelize overlapping writes or dependent stages.

## Autonomous shipping and commit protocol

An ordinary implementation request authorizes the orchestrator's autonomous route-scoped shipping flow. Do not require separate user authorization for each commit, push, publish, or PR. Honor an explicit user limit such as research-only, no-commit, or no-ship. Human checkpoints are restricted to data migrations, production changes, security boundaries, irreversible decisions, and a safety-ambiguity tiebreak.

Specialists may commit, push, or create a PR only when the orchestrator delegates the exact operation, files, message, and validation. Direct root work follows the same shipping flow.

**!!! Use the commit protocol** - Inspect the repository and docs, compose a conventional message, stage only intended files, validate the staged diff, and verify the resulting state.

**!!! Protect primary branches** - Never commit or push to `main` or `master`. Use a non-primary feature branch for meaningful work.

When shipping meaningful work:

1. Inspect `git status`, the focused diff, recent history, the current branch, and worktree state. Learn from relevant correction patterns in history.
2. **!!! Audit docs with code.** Every change under `packages/` or any behavior-affecting change requires a changeset. Docs-only or internal-only changes follow the repository's actual conventions. Also check internal docs and ADRs, user-facing docs, and changelog entries, updating only what the change needs.
3. Compose a conventional commit message from the actual diff.
4. **!!! Validate the staged diff.** Stage only intended files and verify the staged diff and clean state.
5. Commit and push meaningful work only from a non-primary feature branch. Never commit or push to `main` or `master`. If currently on a primary branch, create or use a feature branch without discarding work.
6. Create or update the PR autonomously. Include `Summary`, `Changes` or `Work Results`, `Testing`, and `Breaking Changes` sections.
7. **!!! Verify the PR result.** Verify the resulting clean state and report the actual commit, push, and PR results. Never claim a platform operation that did not complete.

Worktrees are isolated, so proceed directly after inspecting their state. If a branch or worktree is unrecognized, inspect ownership, status, history, and isolation before changing it. Preserve unrelated work. Ask only if ownership or safety remains ambiguous, not merely because the name is unfamiliar.

**!!! Docs-with-code is mandatory:** implementation changes include the appropriate documentation audit, and documentation changes include the appropriate verification. Do not edit generated platform artifacts directly. Canonical directive changes are verified through the sync checks when generated outputs are in scope.

## Work Results

After a builder changes code, report a Work Results table. Use signatures, interfaces, and test names rather than implementation-body narration:

```markdown
## Changes

| File                 | What changed                             | Why    |
| -------------------- | ---------------------------------------- | ------ |
| `path/to/file.ts`    | `~ functionName()` - changed contract    | Reason |
| `tests/file.test.ts` | `~ (test) testName()` - updated coverage | Reason |
```

## Human-in-the-loop and rejection handling

Do not ask routine preference, approach, permission, commit, push, or PR questions. Exhaust data, document assumptions, and proceed. After two consecutive user rejections of the current approach, stop that approach and escalate with what was tried, what was rejected, and the smallest decision or input needed. Do not iterate a third time on the same rejected direction.

## Platform and public-output boundaries

Context inheritance, dispatch, tool permissions, and maker/checker enforcement vary by platform. State what is guaranteed and what is advisory. Public output must stand alone and must not reveal private paths, internal project context, or local tooling.
