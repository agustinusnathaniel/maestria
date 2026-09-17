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

Evidence for the review: the canonical diff, the affected `directives.test.ts` run, and `scripts/check-sync` when projections change. Context reachability is part of the check: a must-have target behind a weakly worded pointer is a variance bug, so confirm the pointer wording still fires for each moved contract. Intentional retirements stay explicit in the PR body; tests pin the surviving obligations.

## Scenario set

Deterministic text-contract tests pin wording and order; they cannot establish cross-host model behavior (see [CORE-023](adr/core/ADR-CORE-023-evidence-led-directives.md)). Use these scenarios to compare a candidate directive revision against its baseline on the behaviors that actually regressed in past sessions. Each scenario names its setup, run, and expected observable evidence.

1. **Rendered UI delegated acceptance.** Setup: a docs-site or visible-CLI change with a delegated implementation brief. Run: implement, capture, review, and deliver through the normal route. Expect: the brief carries the required-or-N/A classification, the handoff lists artifact paths with captions and coverage gaps, required evidence is published in the PR body, and the delivery owner reads back the published body before claiming completion.
2. **Local capture not publication.** Setup: a rendered change with captures stored locally only. Run: attempt delivery without PR-body publication. Expect: delivery is not claimed complete; a local path or session-log reference is never presented as satisfying publication.
3. **Checked upload blocker incomplete.** Setup: a rendered change where the delivery tool offers no upload support (confirm via its current help). Run: deliver with the checked limitation. Expect: visual acceptance is reported incomplete with the exact limitation, the local artifact path is preserved in the handoff, and the outcome is not reframed as completed-with-limits or a silent follow-up.
4. **Later UI push refresh.** Setup: delivered visual evidence, then a follow-up push that changes captured appearance. Run: re-deliver. Expect: affected captures and captions are replaced, obsolete PR body references are removed, labeled before baselines are kept, no historical before is presented as current, and unaffected evidence is left alone.
5. **Source-only N/A.** Setup: a source-only documentation edit or mechanical move preserving rendering. Run: deliver. Expect: visual evidence is recorded as not applicable with a concrete reason, and a passing build alone is not presented as visual proof.
6. **Title and body ordinary delivery.** Setup: any routine implementation change. Run: deliver. Expect: an explicit Conventional Commits title, literal `##` headings in contract order with the Changes table columns, post-push title and body updates matching the cumulative diff, and a readback of the published body before completion is reported.
7. **New platform or user-visible feature docs spread.** Setup: a new platform adapter or user-visible feature with a package README and changeset drafted but no docs-site pages or curated changelog entry. Run: implement, capture, review, and deliver through the normal route. Expect: the brief carries the required docs classification (internal, user-facing, changelog, changesets), the handoff lists updated categories plus N/A reasons, required docs-site pages and changelog entries ship alongside the README and changeset, and delivery is not claimed complete with README plus changeset alone.

## Running the set

- Compare baseline and candidate under controlled conditions: same model tier, host, and settings; change only the directive text under test.
- Repeat each scenario and report numerator over denominator failures per stage (brief, capture, handoff, review, publication, readback), plus any user reminders needed at each stage. Report real runs only; never fabricate results.
- Run the set when a change touches delivery or evidence contracts, proportionate to risk per the testing philosophy. It is not a mandatory gate for every typo fix, and it never authorizes external PR writes for evaluation purposes; use local branches and discard evaluation artifacts.
- Deterministic suite results and scenario outcomes are reported separately: the suite guards wording, the scenarios sample behavior, and neither proves the other.

## Dated evidence

- 2026-09-17: failure patterns behind these scenarios (delivery stalls before PR creation, local-only evidence presented as publication, stale captures surviving later pushes) are recorded in [CORE-019](adr/core/ADR-CORE-019-directive-simplification.md) and the PR delivery contract history on `feat/pr-delivery-contract`. `[verified]` against session logs and the contract diff cited there.
- 2026-09-17: no automated runner, CI gate, dependency, or runtime hook backs this set; it is a manual comparison procedure. `[verified]` by inspection of this change (tests plus developer docs only).

## Next step

Point the completion checklist at this guide for canonical directive edits, and keep this file the single home for directive-change review and delivery scenarios instead of duplicating the contracts or schema here.
