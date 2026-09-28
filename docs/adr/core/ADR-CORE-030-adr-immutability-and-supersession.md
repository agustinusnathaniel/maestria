# ADR-CORE-030: ADR Immutability and Supersession

## Status

Accepted (2026-09-28), Confidence: High. Extended by [ADR-CORE-031](ADR-CORE-031-editorial-pass-evidence-in-git.md) for archival of the completed pass ledger; the remaining policy is unchanged.

## Context

`docs/adr/` holds hand-authored records arranged in prefix-scoped subdirectories by [ADR-CORE-000](ADR-CORE-000-adr-structure.md). No tool validates record structure: the format rules are prose in [docs/guides/doc-format.md](../../guides/doc-format.md), `.github/workflows/ci.yml` applies `paths-ignore: docs/**` to its `pull_request` trigger, and `scripts/sync-all` and `scripts/check-sync` do not read `docs/adr/`. A change confined to this directory therefore runs no repository gate.

Three properties of the corpus are in tension.

**In-place amendment is permitted and widely used.** Until this record superseded it on 2026-09-28, the `New ADRs` section of [docs/guides/doc-format.md](../../guides/doc-format.md) stated that historical ADRs are not rewritten to match the template and that their original context, decision, consequences, and date are preserved when revised. At the time of this decision, dated in-place amendment, revision, and post-implementation blocks occupied roughly 494 lines across 18 records in `docs/adr/`. That is a dated snapshot of the directory as it stood on 2026-09-28, and its extent depends on where a block starts and stops. Representative examples:

- `ADR-CORE-005`, Post-Implementation Evolution
- `ADR-CORE-011`, Post-Implementation Evolution
- `ADR-PI-002`, State Relocation and Deferred Persistence
- `ADR-OC-001`, two amendments dated 2026-09-24, since extracted as [ADR-OC-006](../opencode/ADR-OC-006-pi-omp-read-only-bash-boundary.md) and [ADR-OC-007](../opencode/ADR-OC-007-normalized-read-only-git-boundary.md)
- `ADR-HM-002`, amendment dated 2026-08-10, since extracted as [ADR-HM-004](../hermes/ADR-HM-004-role-neutral-child-trust-policy.md)

**Those blocks mostly restate mutable state, and some have diverged from the repository.** The following were found on 2026-09-28 `[verified]`:

- `ADR-CORE-009` named `.github/workflows/release-kimi-code.yml` twice, in the `actions/cache` change and again in the shared setup action, while the workflows directory contained only `ci.yml` and `release.yml`.
- `ADR-CORE-009` stated in its CI timeout entry that `release.yml` used a longer timeout than `ci.yml`, and both workflows set `timeout-minutes: 10`.
- `ADR-CORE-009` named a `prebuild:ci` script in its Change and Cost entries and in the paired script block, while the root `package.json` defined only `prebuild`.
- `ADR-CORE-009` quoted `pnpm exec vp run --filter @maestria/docs sync` as a `ci.yml` step, while the workflow ran `pnpm sync:docs`.

**One contract has two homes.** `ADR-CORE-012` block-quoted the reviewer access-list and blind-review rule text inside Decision 1 while the same record named a canonical home for it in its Context, and at the time of this decision the duplication was recorded here and left for a separate bounded pass rather than migrated by this record. The same delivery resolved it under clause 7: a divergent-claim annotation in that record's Assumptions states that the canonical directives carry none of the block-quoted text, that the block quotes in Decisions 1 and 2 are therefore the only copies, and that the text stays in the record `[verified]`.

The tension is between three considerations. The opening of [docs/guides/doc-format.md](../../guides/doc-format.md) states that the goal is "recoverable reasoning, not uniform document length", which is an argument for retaining in-place history: the reasoning behind a superseded choice is only recoverable if the superseded text survives. Against that, the corpus has grown large enough that an appended block changes the cost of reading a record and leaves a reader reconciling two generations of text. And a record that states a falsehood is not recoverable reasoning whatever its length: a reader cannot distinguish a frozen truth from a frozen error, and the error is indistinguishable from the surrounding record.

## Decision

1. **Freeze on acceptance.** Once a record reaches `Accepted`, its original Context, Decision, Consequences, Assumptions, Alternatives Considered, and Date are frozen. They are never reopened.
2. **Two in-place changes remain permitted.** A Status transition to `Deprecated` or `Superseded`, and a status annotation: a one-line annotation naming the successor, or a dated divergent-claim annotation recording what drifted and naming the authoritative source, which clause 7 permits. Nothing else in a frozen section changes.
3. **A record asserts what was decided and why.** It never asserts the current inventory of code, workflows, files, scripts, or host versions. Current state is verified against source, the canonical directives (`packages/core/agent-directives/`), and [docs/runtime-support-matrix.md](../../runtime-support-matrix.md).
4. **Lifecycle relations are two-way.** Whole-record relations live on the Status line. Partial or extending relations get a `## Supersession` section that links both directions.
5. **Topical relations stay small and one-way.** `Related Decisions` links are one-way, capped at five, and admitted only when a competent reader would reach a materially different decision without them. A record may not cite a topical relation it does not constrain. A record may not contain a directory or registry listing of other records.
6. **One bounded editorial pass, covering relocation, content-preserving condensation, and removal of a note that restates shipped state.** Authorized by this record and not as a standing licence, a single pass may do any of three things to an accepted record, and in all three the decision, rationale, and consequences must be unchanged. It may relocate verbatim copied source out of a record to a linked canonical path, but only when the copied content is present at the named path. It may condense the presentation of a frozen section, which means changing the form and not the substance: a table becomes prose, rows are regrouped, or several subsections collapse into one sentence. It may remove a dated note, an implementation-notes block, or a present-status block, on three conditions: the removed text restates shipped state rather than recording a decision, it carries no decision statement, rationale, alternative, negative consequence, security boundary, or failure-mode inventory, and the pass ledger names the removal. This third operation is condensation of that content to nothing, so it loses no decision content, and it is available precisely because such a block holds no decision to lose. A block that records a decision, however dated, is not removable this way and is extracted into a successor record instead. Anything beyond those three operations requires a new record.

   **The content constraint on condensation.** No decision statement, no rationale, no alternative, no negative consequence, and no security or trust boundary may be dropped. Every item the original section enumerated must still be present in the record, whether as a table row, a list item, or a sentence, so a reviewer decides compliance by enumerating what the original section enumerated and matching each item in the condensed text, not by judging style. Any claim the condensation moves out of the record must be replaced by a pointer to a named canonical source that has been verified to contain that claim. A pointer to a source that does not contain the content is data loss, not a relocation, and is the failure mode this clause exists to prevent. Condensation licenses no new claim, no inferred rationale, and no invented alternative: a record that never recorded a rejected alternative must say so rather than acquire one after acceptance.

7. **False claims are annotated, not deleted.** A record containing a factually false claim resolves it by annotation, and in both forms the false text is retained rather than deleted. When the decision no longer holds, the Status transitions to `Deprecated` or `Superseded` and the annotation names the successor record carrying the corrected decision. When the decision still holds and only the implementation detail drifted, the record stays in force and the annotation records what diverged and names the source that is authoritative, because a successor record would misstate the standing of a decision that remains in force. In both forms the frozen text is left exactly as written, so a reader can tell a frozen error from a frozen truth and follow the annotation to the current state.

**The bounded pass was completed on 2026-09-28.** Its itemized ledger and exact edits are preserved in the [delivery commit](https://github.com/agustinusnathaniel/maestria/commit/1255f2a9d52f7e8028e94dbd50f393acff993a36). [ADR-CORE-031](ADR-CORE-031-editorial-pass-evidence-in-git.md) supersedes only clause 6's in-record ledger requirement; no further editorial pass is authorized.

## Consequences

### Positive

- The original context, decision, and rationale of a record stay readable as written, so the reasoning behind a superseded choice remains recoverable.
- Mutable state has one authoritative home (source, the canonical directives, the runtime support matrix) and is verified there, so a stale inventory cannot accumulate inside a record.
- A change of mind produces a reviewable diff of intent rather than an appended block that a reader must reconcile against earlier text.
- Correcting a false claim becomes a visible annotation instead of a quiet edit, naming either the successor record or the authoritative source, so the error and the correction are both on the record.

### Negative

- Migrating to this policy costs real authoring effort: each accreted block must be classified as decision material, state inventory, or session-scoped content, then either extracted into a successor record or replaced with a pointer.
- A frozen record cannot be corrected in place. A factual fix costs either a successor record, a status transition, and two links, or a divergent-claim annotation that leaves the false text standing beside the correction. Both are more ceremony than editing a sentence, and both are deliberate: the error stays visible.
- A reader who wants present state must follow a link. A reader who does not follow the link reads history, and has no signal in the frozen text that it is history.
- Clause 6 is a judgement call, and a wrong call silently edits history. A relocation can carry away content that was holding decision weight; a condensation can drop it, and dropping it is the worse case, because the condensed section still reads as a complete record while an item it enumerated is simply gone. Nothing inside the condensed text marks the difference: a reader who does not hold the original cannot tell a faithful condensation from a lossy one, and the loss is visible only to someone comparing against the original.
- Compliance is a review responsibility, not a gate. With no format linter and no CI path coverage for `docs/**`, a record can violate every clause here and still merge.

### Neutral

- Whole-record and partial relations both stay inside the record, so lifecycle remains readable without a registry or a generated index.
- The `Related Decisions` cap changes link counts only in records as they are migrated; existing links are not removed retroactively.
- Clause 6 changes presentation, not substance, and is not a re-decision: it applies only where the decision, rationale, and consequences are unchanged, whether that means relocating copied source to a path that already holds it, re-forming a frozen section so a table becomes prose, rows are regrouped, or several subsections collapse into one sentence, or removing a note that restates shipped state and records no decision. A condensed section and the section before condensation assert the same decision.

## Assumptions

- `[verified]` `docs/adr/` is hand-authored. No script, sync config, or `vite.config.ts` task reads or generates it; `scripts/sync-all` and `scripts/check-sync` do not cover it.
- `[verified]` The false claims named in Context were verified absent from the repository on 2026-09-28: the workflow file list, the `timeout-minutes` values in `ci.yml` and `release.yml`, the scripts in the root `package.json`, and the steps in `ci.yml`. `ADR-CORE-009` has since been repaired and no longer carries them.
- `[inferred]` The amendment blocks are predominantly extensions of an adjacent surface rather than corrections to the original decision. Confirmed by reading the blocks in `ADR-OC-001` (both 2026-09-24 blocks decided a shared Pi/OMP policy outside ADR-OC-001's own subject, and are now carried by [ADR-OC-006](../opencode/ADR-OC-006-pi-omp-read-only-bash-boundary.md) and [ADR-OC-007](../opencode/ADR-OC-007-normalized-read-only-git-boundary.md)), `ADR-HM-002` (the 2026-08-10 amendment superseded part of the Revision, not the 2026-07-17 decision, and is now carried by [ADR-HM-004](../hermes/ADR-HM-004-role-neutral-child-trust-policy.md)), and `ADR-PI-002` (every paragraph records a relocation or a deferral). Not universal: `ADR-CORE-011`'s "Permission modes" entry under Post-Implementation Evolution does correct the original decision, which is the case clause 7 covers. `[inferred]` because the remaining files were not each read in full.
- `[inferred]` A reader who meets a stale inventory is worse off than a reader who follows one link to the current source. No measurement supports this; it rests on the confirmed absences above.
- `[inferred]` The roughly 494-line, 18-record figure in Context is a dated snapshot taken on 2026-09-28, not a current count. Its extent depends on where a block starts and stops; a wider heading pattern yields 536 lines across 16 records.

## Alternatives Considered

- **Keep in-place amendment and correct only the current facts.** Rejected because it treats the symptom. The false claims are fixed, but the record still carries mutable state, and the next amendment reintroduces the same failure in a new file.
- **Freeze everything, including corrections.** Rejected because a known-false statement in a log defeats the log: a reader cannot tell a frozen error from a frozen truth, and would be right to trust both equally. Clause 7 is the narrow exception that keeps the error visible and names its replacement.
- **Revert the condensations to keep the freeze absolute, or permit content-preserving condensation.** The two are the same choice seen from opposite ends. Reverting pays for the absolute freeze in reader cost: the tables, row groupings, and merged subsections the pass condensed would be restored, and the reader of a migrated record would keep reconciling accreted text against the original, which is the cost the freeze exists to remove. Content-preserving condensation was chosen instead, so the freeze is more porous than clause 1 alone leaves it, and the porosity is bounded by the clause 6 content constraint rather than by reviewer taste. That is the weaker guarantee of the two: a condensation that drops content is indistinguishable from a faithful one to anyone who does not hold the original text, and only the constraint and the pass ledger stand between the two.
- **Generate an index of the decision graph.** Rejected because `docs/adr/` is not a generated projection, so an index would need a new sync path that does not exist, and a stale generated index silently lies while looking authoritative. Clause 5's prohibition on a registry listing follows the same reasoning.
- **Add a format linter or CI gate for `docs/adr/`.** Rejected as out of scope. Structural enforcement catches shape, not truthfulness, and a record can satisfy every structural rule while naming a workflow file that does not exist. Recorded so the omission is deliberate rather than an oversight.

## Supersession

- [ADR-CORE-000](ADR-CORE-000-adr-structure.md): extended, not replaced. It keeps its original context, decision, consequences, and date, and continues to own subdirectory layout, prefixes, and file naming. This record adds the lifecycle of a record's content after acceptance.
- [ADR-CORE-018](ADR-CORE-018-documentation-standard.md): extended, not replaced. It keeps its original context, decision, consequences, and date, and continues to own the documentation standard. This record supersedes two parts of [docs/guides/doc-format.md](../../guides/doc-format.md) that ADR-CORE-018 established: the required ADR field list, and the permission to revise a historical ADR.
- [ADR-CORE-031](ADR-CORE-031-editorial-pass-evidence-in-git.md): supersedes only clause 6's requirement to keep the completed-pass ledger in this record. The ledger and exact edits remain in the linked immutable commit.

## Date

2026-09-28
