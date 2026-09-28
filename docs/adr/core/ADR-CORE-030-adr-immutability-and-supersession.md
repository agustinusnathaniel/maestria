# ADR-CORE-030: ADR Immutability and Supersession

## Status

Accepted (2026-09-28), Confidence: High

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

**The bounded pass has been performed.** The single pass clause 6 authorizes was carried out in the same delivery that introduced this record, on 2026-09-28, and it exercised all three operations that clause permits: relocation, content-preserving condensation, and removal of a dated note, an implementation-notes block, or a present-status block. The ledger below names every pre-existing record the delivery edited, which section it edited, and which operation applied, so a reader can see which operation applied where. A record appears under more than one heading when more than one operation applied to it, and every removal is named here, because clause 6 conditions a removal on this ledger naming it. Two extractions are supersessions rather than clause 6 operations, because each carries a decision, and each is named in its own record's `## Supersession` section instead. The table records the pass, not the corpus: clause 3 still governs any claim about what the records currently contain, and a reader must not read this table as the set of sections a future pass may touch.

**Relocation and authoritative-source pointers.** Verbatim copied source, or a claim the record used to carry, moved to a named path. The content constraint requires the named source to be verified as holding the claim.

| Record | Section | Where the claim now lives |
| --- | --- | --- |
| [ADR-CORE-002](ADR-CORE-002-plugin-architecture.md) | `## Decision` | The hook inventory and the accepted frontmatter fields became a pointer to `packages/opencode/` `[verified]` |
| [ADR-CORE-003](ADR-CORE-003-agent-conventions.md) | `## Decision` | The triage labels and what qualifies for each became pointers to [rules.md](../../../packages/core/agent-directives/rules.md) and [reviewer.md](../../../packages/core/agent-directives/specialists/reviewer.md); the routing of each label became a pointer to [orchestrator.md](../../../packages/core/agent-directives/specialists/orchestrator.md) `[verified]` |
| [ADR-CORE-004](ADR-CORE-004-agent-prompt-template.md) | `## Context` | "The canonical directives linked above" became named links to `skills/handoff.md`, `rules.md`, and ADR-CORE-019, because the present-status block that carried the links was removed with the rest of that block |
| [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) | `## Decision` | The CLI-flags table became a pointer to `packages/core/scripts/sync.ts`, whose own help output lists the flags `[verified]` |
| [ADR-CORE-006](ADR-CORE-006-project-workflow-protocol.md) | `## Amendment 2026-09-18` | The table's per-runtime source-and-limit column became a pointer to [docs/runtime-support-matrix.md](../../runtime-support-matrix.md) (Project customization loading) `[verified]` |
| [ADR-CORE-009](ADR-CORE-009-ci-quality-gates.md) | `## Decision 1`, `## Decision 2`, `## Decision 3`, `## Decision 4`, `## Decision 6` | The script definitions, the cache step, and the workflow steps became pointers to the root `package.json`, `.github/actions/setup/action.yml`, and `.github/workflows/` `[verified]` |
| [ADR-CORE-010](ADR-CORE-010-cli-version-comparison.md) | `## Decision` | The semver pattern and the comparison and validation functions that use it became a pointer to [apps/maestria-cli/src/lib/version.ts](../../../apps/maestria-cli/src/lib/version.ts) `[verified]` |
| [ADR-CORE-012](ADR-CORE-012-deterministic-review-signals-fail-loud-exit.md) | `## Decision 1`, `## Decision 2` | No relocation was available: the block-quoted access-list, blind-review, and five-field escalation wording is absent from the canonical directives, so the quoted text stayed and each passage gained a pointer saying where it does and does not live |
| [ADR-CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md) | `## Decision` | The six-row per-runtime baseline table became a pointer to the snapshot in [docs/runtime-support-matrix.md](../../runtime-support-matrix.md) `[verified]` |
| [ADR-CORE-020](ADR-CORE-020-hybrid-package-topology.md) | `## Implementation Notes` | The three placement notes gained a sentence binding them to the Implementation binding and deferring current placement to source |
| [ADR-CR-001](../cursor/ADR-CR-001-cursor-plugin-architecture.md) | `## Decision` | The component map became prose plus a pointer to `packages/cursor/sync.config.ts`, which generates the output paths `[verified]` |
| [ADR-HM-002](../hermes/ADR-HM-002-orchestration-policy.md) | `## Amendment 2026-08-10` | The platform-limitations bullets became a pointer to the `@maestria/hermes` package as the authority on enforcement |
| [ADR-KC-001](../kimi-code/ADR-KC-001-kimi-code-architecture.md) | `## Decision` | The routing table's framing sentence became a paragraph naming the shipped orchestrator skill and its sync config as the operational copy `[verified]` |
| [ADR-OC-003](../opencode/ADR-OC-003-keyword-triggered-workflow-modes.md) | `## Decision` | The `PluginOptions` TypeScript block became a pointer to `packages/opencode/src/modes/types.ts`, which types `modes.disabledKeywords` and derives the keyword enum from the canonical keywords `[verified]` |
| [ADR-OC-005](../opencode/ADR-OC-005-orchestrator-mcp-permissions.md) | `## Context`, `## Investigation` | The orchestrator permission inventory and the Option A YAML block became pointers to `packages/opencode/agents/orchestrator.md` |
| [ADR-PI-000](../pi/ADR-PI-000-pi-ecosystem-reuse.md) | `## Implementation Notes` | Dispatch validation, the recursion guard, and graceful degradation became a pointer to `@maestria/shared-pi` and the pi adapter |
| [ADR-PI-001](../pi/ADR-PI-001-rules-injection.md) | `## Implementation Notes` | The four wiring subsections became a pointer to `packages/pi/` |
| [ADR-PI-002](../pi/ADR-PI-002-compaction-state-preservation.md) | `## Implementation Notes` | The relocation sentence now names `@maestria/shared-pi/state-core` and links ADR-CORE-025 |

**Condensation.** Form changed, substance kept. Every item the original section enumerated still appears, as a sentence or a shorter list.

| Record | Section | What collapsed into what |
| --- | --- | --- |
| [ADR-CORE-002](ADR-CORE-002-plugin-architecture.md) | `## Decision` | Two sections became one, keeping the frontmatter shape and the `config` and compaction hooks |
| [ADR-CORE-003](ADR-CORE-003-agent-conventions.md) | `## Decision` | The triage table's three rows became a sentence naming the labels and what qualifies for each. The Next Action column was cut on the reasoning that the next actions have a canonical home in the two sections named; they do not, so the column is restored here as this record's own decision |
| [ADR-CORE-004](ADR-CORE-004-agent-prompt-template.md) | `## Context` | The history sentence was split to carry the removed block's two supersessions, so both are stated in one place |
| [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) | `## Decision`, `## Post-Implementation Evolution` | Five config-shape bullets became three grouped bullets; ten evolution subsections became four bullets, each keeping only the rationale the sections above do not already carry |
| [ADR-CORE-006](ADR-CORE-006-project-workflow-protocol.md) | `## Amendment 2026-09-18` | The seven-column table lost its evidence column, and the removed note's surviving claim folded into the closing sentence |
| [ADR-CORE-007](ADR-CORE-007-cli-package-plugin-management.md) | `## Revisions` | A nine-row table and a three-row table became two paragraphs that still carry every row |
| [ADR-CORE-008](ADR-CORE-008-cli-dependency-bundling.md) | `## Decision`, `## Revision` | Three subsections became one, keeping the four runtime packages, the `alwaysBundle` inlining and tree-shaking behavior, and the unchanged config entries; the revision note lost a clause |
| [ADR-CORE-009](ADR-CORE-009-ci-quality-gates.md) | `## Decision 4` | The four-column workflow table became a sentence carrying both workflows' triggers, and the concurrency subsection dropped the workflow filenames |
| [ADR-CORE-010](ADR-CORE-010-cli-version-comparison.md) | `## Decision`, `## Consequences` | The two-row special-values table, the validation subsection, and the four-row before/after table became sentences carrying both values, the bypass list, and all four metrics |
| [ADR-CORE-011](ADR-CORE-011-eliminate-questions-autonomy.md) | `## Post-Implementation Evolution` | Five subsections became four bullets, and the dated amendment below them is untouched |
| [ADR-CORE-013](ADR-CORE-013-model-tier-adaptive-pipeline.md) | `## Decision` | The tier table, the seven-row lever table, and the four-item hypothesis list became sentences carrying every tier, lever, and hypothesis |
| [ADR-CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md) | `## Per-runtime lifecycle rules`, `## Reverification and amendments` | The JCode and Crush rows became one row that keeps the extra Crush condition; two dated reverification paragraphs became one |
| [ADR-CORE-015](ADR-CORE-015-claude-code-package-manager-reproducibility.md) | `## Context` | The authorization section's two paragraphs became one that keeps the pin, the lockfile scope, and the boundary on the later work |
| [ADR-CORE-016](ADR-CORE-016-root-resolved-sync-tooling.md) | `## References` | Three bullets became one; the pull request that recorded the clean-CI failure is no longer cited there |
| [ADR-CORE-020](ADR-CORE-020-hybrid-package-topology.md) | `## References` | Five bullets became three |
| [ADR-CORE-021](ADR-CORE-021-ultracite-via-vite-plus.md) | `## References` | Fourteen links became four |
| [ADR-CORE-022](ADR-CORE-022-agent-plugins-portable-projection.md) | `## References` | Five links became three |
| [ADR-CORE-025](ADR-CORE-025-consumer-driven-sync-and-adapter-simplification.md) | `## Update (2026-09-11)` | Six removed-item bullets became four, and seven retained-complexity bullets became four by merging the host-boundary items; no original bullet was dropped whole |
| [ADR-CR-001](../cursor/ADR-CR-001-cursor-plugin-architecture.md) | `## Decision` | The four-row component map became one sentence naming each projection and its role |
| [ADR-HM-001](../hermes/ADR-HM-001-long-lived-goals-scope.md) | `## Reasoning` | Five subsections became four, the first two merging into one and the design-philosophy subsection absorbing the orthogonality paragraph |
| [ADR-KC-001](../kimi-code/ADR-KC-001-kimi-code-architecture.md) | `## Decision`, `## Consequences` | The routing paragraph absorbed the divergence the removed notes carried, and the Risks entry lost its pointer to the removed note |
| [ADR-OC-001](../opencode/ADR-OC-001-tool-permission-design.md) | `## Context` | The seven-row LSP rationale table became three grouped rows that still name every agent |
| [ADR-OC-003](../opencode/ADR-OC-003-keyword-triggered-workflow-modes.md) | `## Consequences` | The historical parenthetical lost its pointer to the removed note |
| [ADR-OC-005](../opencode/ADR-OC-005-orchestrator-mcp-permissions.md) | `## Investigation` | The three-mechanism table and the three naming-convention bullets became sentences carrying all three mechanisms and all three permission forms |
| [ADR-PI-000](../pi/ADR-PI-000-pi-ecosystem-reuse.md) | `## Implementation Notes` | Five subsections became two sentences under the new heading `## Dispatch Integration Constraints` |
| [ADR-PI-001](../pi/ADR-PI-001-rules-injection.md) | `## Implementation Notes` | Four subsections became one sentence under the new heading `## Injection Mechanism and Peer Dependency` |
| [ADR-PI-002](../pi/ADR-PI-002-compaction-state-preservation.md) | `## Implementation Notes` | Six subsections became two sentences under the new heading `## State Relocation and Deferred Persistence` |

**Removal.** A dated note, a present-status block, or the corrected note on a removed field. Clause 6 admits a removal only when the removed text restates shipped state or records a correction to it, carries no decision statement, rationale, alternative, negative consequence, security boundary, or failure-mode inventory, and is named here.

| Record | Section | What was removed, and why it qualified |
| --- | --- | --- |
| [ADR-CORE-001](ADR-CORE-001-global-rules-scope.md) | after `## Decision` | `## Filtering History (This Session)`. It recorded one session's application of the filter, the patterns it excluded, and the single pattern that session added, and no decision; the filter, its destinations, and its worked examples all remain in `## Decision` |
| [ADR-CORE-002](ADR-CORE-002-plugin-architecture.md) | `## Decision` | `### Current implementation note (2026-09-01)`, a dated note on the declared hook count. It restated shipped state and deferred to the package manifest |
| [ADR-CORE-004](ADR-CORE-004-agent-prompt-template.md) | before `## Context` | `## Current Status`, a present-status block naming the current handoff and skill homes. Its two claims survive as named links in `## Context` |
| [ADR-CORE-006](ADR-CORE-006-project-workflow-protocol.md) | `## Amendment 2026-09-18` | `### Note 2026-09-22: read-only maestria doctor exists alongside this contract`. The note's still-true part, read-only diagnostics that never install or write, folded into the closing sentence; the rest was shipped state |
| [ADR-CORE-013](ADR-CORE-013-model-tier-adaptive-pipeline.md) | `## Decision` | `### Unit 1 implementation status (2026-09-10)`, a dated note on which unit shipped. The unit-2 hypothesis below it is retained in full, including its `MAESTRIA_TIER` non-implementation claim |
| [ADR-KC-001](../kimi-code/ADR-KC-001-kimi-code-architecture.md) | `## Decision`, `## Consequences` | Two dated 2026-09-22 notes and the Risks parenthetical that pointed at the second. Both notes restated shipped state and recorded no decision, and the annotation on that record's Status line restores the two claims they carried |
| [ADR-OC-003](../opencode/ADR-OC-003-keyword-triggered-workflow-modes.md) | before `## Context`, `## Decision` | `## Current Status` and its dated 2026-09-22 note, each restating shipped state and recording no decision |
| [ADR-OC-005](../opencode/ADR-OC-005-orchestrator-mcp-permissions.md) | `## Context`, `## Decision` | The first sentence of `### Current State`, a permission inventory now held by a pointer, and the `Reviewed 2026-09-10` note, which restated shipped state |
| [ADR-PI-000](../pi/ADR-PI-000-pi-ecosystem-reuse.md) | `## Implementation Notes` | The `> Corrected 2026-09-11:` note on the 7-field handoff pre-check. Its still-true part, that the handoff contract stays methodology owned by the handoff skill and is no longer machine-validated at dispatch, survives in the section that replaced it |

**Extraction to a successor record.** Not a clause 6 operation, because the extracted text records a decision.

| Record | Extracted to | What stayed behind, and why |
| --- | --- | --- |
| [ADR-OC-001](../opencode/ADR-OC-001-tool-permission-design.md) | [ADR-OC-006](../opencode/ADR-OC-006-pi-omp-read-only-bash-boundary.md) and [ADR-OC-007](../opencode/ADR-OC-007-normalized-read-only-git-boundary.md) | The two failure inventories and the host-enforcement boundary, because they constrain permission claims this record still makes about its own entries |
| [ADR-HM-002](../hermes/ADR-HM-002-orchestration-policy.md) | [ADR-HM-004](../hermes/ADR-HM-004-role-neutral-child-trust-policy.md) | The comparison table and the security boundaries, because they state how the Revision relates to the policy that replaced it and constrain the parts still in force |

**Other edits in the same delivery, made under clauses 2, 4, 5, and 7 rather than as a clause 6 operation.**

- Status annotations, including one in an Assumptions section: [ADR-CORE-008](ADR-CORE-008-cli-dependency-bundling.md), [ADR-CORE-009](ADR-CORE-009-ci-quality-gates.md), [ADR-CORE-012](ADR-CORE-012-deterministic-review-signals-fail-loud-exit.md), [ADR-CORE-028](ADR-CORE-028-behavior-first-testing-and-evidence-preserving-reduction.md), [ADR-HM-003](../hermes/ADR-HM-003-credential-safe-subprocess-boundary.md), [ADR-KC-001](../kimi-code/ADR-KC-001-kimi-code-architecture.md), [ADR-OC-001](../opencode/ADR-OC-001-tool-permission-design.md), [ADR-OC-002](../opencode/ADR-OC-002-opensrc-vs-webfetch-guidance.md), [ADR-PI-000](../pi/ADR-PI-000-pi-ecosystem-reuse.md).
- `## Supersession` sections, with the successor named in both directions: [ADR-CORE-000](ADR-CORE-000-adr-structure.md), [ADR-CORE-018](ADR-CORE-018-documentation-standard.md), [ADR-CORE-019](ADR-CORE-019-directive-simplification.md), [ADR-CORE-023](ADR-CORE-023-evidence-led-directives.md), [ADR-CORE-028](ADR-CORE-028-behavior-first-testing-and-evidence-preserving-reduction.md), [ADR-HM-002](../hermes/ADR-HM-002-orchestration-policy.md), [ADR-KC-001](../kimi-code/ADR-KC-001-kimi-code-architecture.md), [ADR-OC-001](../opencode/ADR-OC-001-tool-permission-design.md). ADR-HM-002's title note and Status line name ADR-HM-004, and ADR-KC-001's revision history became its `## Supersession` section.
- Topical relations trimmed to the five-link cap: ADR-CORE-005, ADR-CORE-007, ADR-CORE-011, ADR-CORE-019, ADR-CORE-020, ADR-CORE-024, ADR-CORE-025, ADR-CORE-028, ADR-HM-003.
- Reference lists trimmed: ADR-CORE-012, ADR-CORE-016, ADR-CORE-020, ADR-CORE-021, ADR-CORE-022, ADR-PI-000.
- Section-level cleanups: ADR-CORE-012 lost ten horizontal rules from its frozen sections, and ADR-CORE-020 gained one sentence in `## Implementation Notes`.
- Two departures a reader should see. ADR-CORE-009 is the one record where clause 7 was not followed: its four false claims were replaced in place rather than retained and annotated, at Decision 1 and Decision 2 (`prebuild:ci`), Decision 3 (`release-kimi-code.yml`), Decision 4 (the timeout note), and Decision 6 (the quoted docs sync command). Its Status annotation says so. ADR-CORE-015 is `Superseded` rather than `Accepted`, so clause 6 does not reach it, yet its Context authorization paragraph was condensed in the same delivery; the ledger names it because it records what the delivery did, not only what clause 6 licensed.

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

## Date

2026-09-28
