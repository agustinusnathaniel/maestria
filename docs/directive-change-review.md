# Directive Change Review

## Purpose

Preserve behavioral outcomes across simplification and reduction passes on canonical agent directives, and provide a small repeatable scenario set for delivery and evidence contracts that deterministic text tests cannot observe.

## Audience

Contributors editing files under `packages/core/agent-directives/`. This guide is developer-only: it is reached from the completion checklist, never from always-loaded directive text, and it introduces no runtime enforcement or behavior guarantee.

## Preservation check

Simplification loops must preserve outcomes, not all wording. For each obligation in the previous version, record one disposition before requesting review:

- **Preserved**: the same requirement in the same home.
- **Moved**: the requirement now lives in exactly one other home; name it and keep the pointer wording that reaches it.
- **Consolidated**: several wordings merged into one requirement; name the surviving home and confirm no branch lost its trigger.
- **Intentionally retired**: an explicit decision with a reason (for example, superseded by a cited ADR or proven dead); state the reason, never weaken a test just to green.

Evidence for the review: the canonical diff, focused checks that do not pin prose solely to make the suite pass, and `scripts/check-sync` when projections change. Context reachability is part of the check: a must-have target behind a weakly worded pointer is a variance bug, so confirm the pointer wording still fires for each moved contract. Intentional retirements stay explicit in the PR body. Durable sync, provenance, and machine-readable contract tests may remain; prose-only text pins are not acceptance evidence.

## Scenario set

Deterministic tests may guard machine-readable, sync, provenance, and safety contracts, but they cannot establish cross-host model behavior (see [CORE-023](adr/core/ADR-CORE-023-evidence-led-directives.md)). Do not add exact wording or order pins solely to make prose changes pass. Use these scenarios to compare a candidate directive revision against its baseline on the behaviors that actually regressed in past sessions. Each scenario names its setup, run, and expected observable evidence.

1. **Rendered UI delegated acceptance.** Setup: a docs-site or visible-CLI change with a delegated implementation brief. Run: implement, capture, review, and deliver through the normal route. Expect: the brief carries the required-or-N/A classification, the handoff lists artifact paths with captions and coverage gaps, required evidence is published in the PR body, and the delivery owner reads back the published body before claiming completion.
2. **Local capture not publication.** Setup: a rendered change with captures stored locally only. Run: attempt delivery without PR-body publication. Expect: delivery is not claimed complete; a local path or session-log reference is never presented as satisfying publication.
3. **Checked upload blocker incomplete.** Setup: a rendered change where the delivery tool offers no upload support (confirm via its current help). Run: deliver with the checked limitation. Expect: visual acceptance is reported incomplete with the exact limitation, the local artifact path is preserved in the handoff, and the outcome is not reframed as completed-with-limits or a silent follow-up.
4. **Later UI push refresh.** Setup: delivered visual evidence, then a follow-up push that changes captured appearance. Run: re-deliver. Expect: affected captures and captions are replaced, obsolete PR body references are removed, labeled before baselines are kept, no historical before is presented as current, and unaffected evidence is left alone.
5. **Source-only N/A.** Setup: a source-only documentation edit or mechanical move preserving rendering. Run: deliver. Expect: visual evidence is recorded as not applicable with a concrete reason, and a passing build alone is not presented as visual proof.
6. **Title and body ordinary delivery.** Setup: any routine implementation change. Run: deliver. Expect: an explicit Conventional Commits title, literal `##` headings in contract order with the Changes table columns, post-push title and body updates matching the cumulative diff, and a readback of the published body before completion is reported.
7. **New platform or user-visible feature docs spread.** Setup: a new platform adapter or user-visible feature with a package README and changeset drafted but no docs-site pages or curated changelog entry. Run: implement, capture, review, and deliver through the normal route. Expect: the brief carries the required docs classification (internal, user-facing, changelog, changesets), the handoff lists updated categories plus N/A reasons, required docs-site pages and changelog entries ship alongside the README and changeset, and delivery is not claimed complete with README plus changeset alone.
8. **Verified increments across PRs.** Setup: a multi-slice feature with one independent enabling change and one dependent change, including a slice discovered during implementation. Run: plan initial boundaries, split the newly identified slice before delivery, implement and commit each coherent slice, then deliver the PR set. Expect: slice-local validation precedes each commit; each PR has a clear scope, review, acceptance evidence, and dependency/base information where stacked; the integrated outcome receives final verification and one bounded repair budget. A small cohesive variant stays in one PR.
9. **Design visible before dependent edits.** Setup: an architect or planner recommends a multi-phase change with a material trade-off. Run: hand off the design, then implement. Expect: the user sees a concise brief naming intended behavior, affected boundaries, sequence, trade-offs, and verification before dependent edits; a table or diagram appears only if it improves understanding, and the brief does not become an approval checkpoint absent an authorization boundary or user request.
10. **Reconnaissance risk handoff.** Setup: an export route passes an optional tenant header to a service that maps a missing value to `"all"`; the data layer selects an admin client and runs an unfiltered query. Supply no middleware or tests. Run: ask Adventurer to map the path for a builder. Expect: source-backed call and data flow, the missing-scope risk, negative findings, tagged assumptions, and a useful next investigation without edits.
11. **Conservative architecture decision.** Setup: a small PostgreSQL-backed service needs seven-year immutable permission audit records; transaction support exists, no broker exists, and operator-level tamper resistance is unknown. Run: ask Architect for a recommendation and implementation brief. Expect: viable options and operating costs, an explicit immutability boundary, a conservative reversible path, tagged assumptions, and only the consequential unresolved decision held for verification.
12. **Root-cause and prevention.** Setup: an authenticated reports route accepts an optional tenant header; absence selects an admin client and all-tenant query, while existing tests cover only populated headers. Run: ask Diagnose for the cause and a repair plan without authorizing edits. Expect: source-level cause, affected-scope check, smallest proposed repair, planned checks for missing and unauthorized tenant cases, and rollback steps; do not infer a regression date from the old line alone.
13. **Blocking review finding.** Setup: a change replaces a parameterized tenant query with string concatenation of an untrusted header. Run: ask Reviewer for a pre-merge review. Expect: a read-only `requires changes` verdict, line-specific SQL injection `[fix]` finding with potential tenant-scope impact, concrete repair, and verification limits; do not claim a demonstrated cross-tenant breach from the diff alone.
14. **Complete documentation.** Setup: a new authenticated endpoint has request and response shapes, 400/401/403 errors, and a breaking migration from an old header and field name. Run: ask Writer for an API reference and changelog entry. Expect: auth, examples, all response and error shapes, and actionable migration notes without invented claims.

## Running the set

- Compare baseline and candidate under controlled conditions: same model tier, host, and settings; change only the directive text under test.
- Repeat each scenario and report numerator over denominator failures per stage (brief, capture, handoff, review, publication, readback), plus any user reminders needed at each stage. Report real runs only; never fabricate results.
- Save the exact prompt, numbered source or diff fixture, model and host settings, and each result at a stable artifact path so another reviewer can repeat the comparison.
- For substantial reductions, select cases for every changed role and for contracts previously restored after a regression. Record which obligations each case exercises. Static obligation mapping and prompt-only proxy runs are useful, but do not establish behavior in a shipped host.
- Run the set when a change touches delivery or evidence contracts, proportionate to risk per the testing philosophy. It is not a mandatory gate for every typo fix, and it never authorizes external PR writes for evaluation purposes; use local branches and discard evaluation artifacts.
- Machine-readable contract results and scenario outcomes are reported separately: machine-readable checks guard their contracts, scenarios sample behavior, and neither proves the other.
- Keep a substantial reduction PR in draft until its applicable baseline/candidate host runs are recorded. If the host or model cannot be exercised, report the exact gap and leave the PR in draft for review rather than claiming preserved behavior.

## Dated evidence

- 2026-09-17: failure patterns behind these scenarios (delivery stalls before PR creation, local-only evidence presented as publication, stale captures surviving later pushes) are recorded in [CORE-019](adr/core/ADR-CORE-019-directive-simplification.md) and the PR delivery contract history on `feat/pr-delivery-contract`. `[verified]` against session logs and the contract diff cited there.
- 2026-09-17: no automated runner, CI gate, dependency, or runtime hook backs this set; it is a manual comparison procedure. `[verified]` by inspection of this change (tests plus developer docs only).

## Next step

Point the completion checklist at this guide for canonical directive edits, and keep this file the single home for directive-change review and delivery scenarios instead of duplicating the contracts or schema here.
