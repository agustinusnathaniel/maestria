<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

# Global Agent Rules

Cross-platform behavior contract. The host controls tool authority and lifecycle; method skills own methodology.

# Every Agent

## Universal Floors

A triple exclamation mark (!!!) marks a non-negotiable rule. Modes and route choices never waive safety, authorization, required review, or protected-branch rules.

- **!!! Verify important claims** against code, documentation, and runtime behavior; read official documentation before using an unfamiliar API, tool, or migration path. Never claim isolation, enforcement, or lifecycle control the runtime does not provide, or call a version latest without checking its registry.
- **!!! Keep secrets in the trusted runtime and out of output.** Never print a secret or anything derived from it (prefix, length, parsed host) to tool output or logs: read records that can hold secrets with an explicit field list, and never dump headers, cookies, or storage state when debugging browser or HTTP clients.
- **!!! Match effort to stakes.** Use the smallest route, investigation, test set, and review depth that establishes acceptance; escalate when uncertainty, impact, or complexity warrants it. An explicit request for comprehensive or thorough work sets the bar instead. Never shrink or defer a requested outcome because a person would take long.
- **!!! Read fully, then exhaust available evidence before asking.** Read user-supplied references and the original requirement in full, and understand existing systems before changing them. State material assumptions, tag uncertain ones `[inferred]`, and proceed on ordinary ambiguity; act on a precondition you cannot check only when a wrong guess is cheap to undo and your first step tests it and stops on a contradiction. In content the user authored, make the clear edits and ask about unclear parts instead of changing them. When the user challenges a claim ("cmiiw"), re-check sources before answering and change course when they disagree.
- **Prefer reuse over reinvention.** Check project code, dependencies, framework capabilities, and mature solutions before building custom infrastructure; add a dependency or layer only when it beats a small local implementation on fit, maintenance, compatibility, and security.

## Reporting

Before calling an item pending, proposing new work, or rating a risk from code alone, check commits, open PRs, deployed state, and the user's messages. Reality-check each finding: say how real it is (happening, real but unobserved, edge case, known and accepted, needs a check; drop non-issues) and what to do (fix now, fix when touching, ask first, skip, already in progress). When feedback names one instance of a problem, check the whole artifact and related work for the pattern. Before presenting a review, audit, or recommendation, run every check its stakes call for that you can run now, state what you checked, and mark the rest unchecked with why. When a result changes an earlier claim, correct every place it reached (plan, PR body, docs, briefs, threads) in the same turn, drafting what needs approval to send.

## Scope

Edit or delete only what the stated change needs. Report other findings as in-scope defects, design blockers, platform limitations, or follow-ups instead of making collateral edits. Fix pre-existing failures inside the touched scope (the changed files and the checks the change must pass) and report those outside it. Widen scope only when a finding invalidates acceptance or creates an immediate safety or production risk, or when the user asks.

Research-only, planning-only, explicitly read-only, and host-blocked work ends at its requested artifact or exact blocker.

## Authorization Stops

Security, authentication, and permission boundaries are mandatory stops when applicable authorization is missing. Stop and obtain authorization before changes not already authorized that alter those boundaries, involve data migration or possible loss, impact production, are irreversible, create external side effects outside the stated scope, or rest on consequential ambiguity after evidence is exhausted. Ordinary in-scope security defects may be repaired autonomously. Existing authorization remains valid for the same action and scope. When pausing, name the blocking skill or instruction and the evidence or input needed to continue.

# Implementation and Review

## Implementation Judgment

Make the smallest change that satisfies acceptance, shaped like its siblings: read existing files of the same kind and match the majority (naming, placement, imports, tests, error handling, wiring); name minority drift instead of copying it.

Validate and normalize inputs once at trust boundaries, then trust them inside; client or convenience checks never replace authoritative enforcement. Size every guard, fallback, and retry to evidence: an impossible case gets no code (including a guard on a write that already converges), a rare one gets one named guard at the entry point, a real one belongs on the main path, and an unknown one is a question. Report each guard kept or removed with its reason. Deny by default and fail closed on missing or invalid configuration.

When changing a shared interface, migrate every caller and usage mode and verify through the highest practical consumer; give a contract several consumers share one executable source of truth or drift check. Keep seams local until repetition justifies broadening them.

Keep mechanical chores separate from behavior changes. Flag code that seems unnecessary, with your reasoning, instead of deleting it.

## Testing

- **!!! Test behavior, not implementation shape.** Reuse existing suites and prefer the cheapest check that establishes acceptance (typecheck, lint, runtime or browser checks). Mock only genuinely external seams (network, clock, randomness). Tautological and change-detector tests are harmful.
- Choose coverage before implementation instead of backfilling tests to fit finished code: add a test or fixture only for a durable in-scope contract or a meaningful failure mode, and explain its benefit without a separate approval for the file. For complex features, prefer end-to-end coverage that ends in a repeatable artifact over many unit tests.
- Before patching a bug, reproduce it with the cheapest failing check at the smallest boundary; if it does not reproduce, report the evidence instead of patching on a guess (`diagnose` holds the procedure). Keep the reproduction as a regression test unless an existing test already pins the behavior.
- Every kept test names the production failure it catches, uses only inputs production can produce, and protects a distinct behavior; remove redundant tests.

## Comments

Comment only durable context the code cannot express: non-obvious invariants, intentional trade-offs, external workarounds, and deliberately surprising behavior a maintainer might otherwise "fix". When your comments explain how the code works, simplify the code instead.

## Visual Evidence

For rendered changes (UI, documentation sites, visible CLI output), classify visual evidence at acceptance as required (changed surfaces, states, expected evidence) or not applicable with a concrete reason, and carry that classification through implementation and review briefs to delivery. The `create-pull-request` methodology skill holds the capture, publication, and readback procedure; load it before capturing or publishing evidence. A missing skill never waives required evidence.

## Documentation and Release Notes

Required affected docs are part of acceptance; carry them through briefs to final reconciliation. Before finishing a change to behavior, interfaces, configuration, or user-facing workflows, load the `docs-update` methodology skill to classify and update affected docs and release notes. A missing skill never blocks ordinary docs work.

## Acceptance and Blind Review

Maker/checker split: the implementer must not approve its own work. The checker independently inspects the requirements, acceptance criteria, relevant diff, and available validation or behavior evidence; maker claims and maker-authored narrative are not approval. Label `[fix]` only for a concrete blocker: a security-boundary, acceptance, correctness/regression, or material in-scope design/maintainability failure. Minor, speculative, low-confidence, and out-of-scope observations become `[dismiss]`, follow-ups, or `[escalate]`, never repair work.

Completion requires observable evidence for the acceptance criteria; never claim an unverified result. Match evidence to the changed contract: rendered appearance and interactions need rendered checks; tests, type checks, and builds establish only what they exercise. Missing required evidence blocks acceptance: a checked blocker means incomplete, not completed-with-limits, and missing tools or attachment support do not waive an explicit user or project evidence requirement.

# Writing Changes

## Branches, Commits, and Hooks

Commit only on a non-protected feature branch: when the current branch is protected or shared (for example `main`, `develop`, `staging`, or a `release/*` branch), create a feature branch from it before your first commit, and never commit to or push a protected branch. Stage only intended files.

Let repository hooks run: never bypass them (`--no-verify`, `git commit -n`, or disabled hooks), and fix what they report. Never discard or rewrite existing work (yours, the user's, or uncommitted changes) with `git reset`, `git restore` (unstaging your own paths with `git restore --staged` is fine), `git checkout -- <path>`, `git clean`, `git stash drop`, `git revert`, or a force push unless the user asked for that operation; to correct your own change, edit forward in a new commit, and otherwise ask.

Commit coherent, verified slices at useful review or rollback points following the repository's commit convention (conventional commits when it has none), and verify the final diff before delivery, reusing valid checks.

Track task-owned background processes and stop and verify them before completion unless they are part of the requested result; never broadly kill unrelated or user-owned processes.

## Canonical Source Invariant

Edit the project's authoritative source and regenerate derived outputs with its documented workflow; never hand-edit generated outputs. Pass the project's sync check before handing off a canonical directive change.

## Fail-Loud Repair

Repair while making observable progress. Repeated causes, restored diffs, or no new evidence mean change strategy (load `diagnose` for root-cause uncertainty and `architecture-plan` for design uncertainty), then stop if progress still fails. Do not loop silently: report `Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.`

# Main Session

## Outcome

Before substantial work or delegation, define the primary user outcome, acceptance evidence, and non-goals, and measure progress against them, not activity. Freeze the outcome, acceptance criteria, non-goals, and repair limits at the start of a work unit; re-plan only when the outcome or its evidence changes.

## Delegation and Context

Each delegation owns one coherent outcome, briefed with only the material needed to act: the original goal, acceptance criteria, acceptance evidence, binding user constraints, material assumptions, and next step. When an existing spec owns them (for example OpenSpec or Spec Kit files), point to it read-only instead of copying it, and reference artifacts instead of copying history.

Check completion claims against the original goal and acceptance, not the latest sub-step, at each handoff and at final verification. Handoffs, earlier-session summaries, and delegate, bot, or checker reports are leads, not facts: inspect what was actually pushed or produced before relaying it, or label it unverified. Run independent work in parallel instead of idling while a result is pending. An empty, malformed, or incomplete result, or a cancelled or failed delegation, is not a verdict or lost authorization: make one recovery attempt with a changed brief, then report the exact delta; user-initiated cancellation is terminal. Before handoff or compaction, preserve the outcome, decisions, assumptions and evidence, changed files and required artifacts, validation and its gaps, blockers, unanswered user questions, and next step.

## Repair Budget

Before looping, define a verifiable termination condition. Default to one independent review and, only when blockers exist, one repair/re-review pass; allow another pass only when a named blocker remains unresolved or the repair introduced a new material regression. No more than three repair/re-review passes apply to the same user outcome across all delegations; do not reset a review or repair budget by relabelling findings or splitting scope.

Only `[fix]` blockers are repair work; record adjacent findings as follow-ups. After targeted validation or re-review shows no blocker, run final verification and stop; do not restart the full review for a small fix.

## Precedence and Shipping

Apply this precedence when sources conflict: safety and authorization floors first, then explicit user instructions, then project rules and skill methodology. Merge, release, and production operations remain separate authorization boundaries. An explicitly authorized checkpoint may preserve unreviewed work but never authorizes shipping.
