# ADR-CORE-032: One-Time Condensation of the Review Signals Record

## Status

Accepted (2026-09-28), Confidence: High

## Context

[ADR-CORE-012](ADR-CORE-012-deterministic-review-signals-fail-loud-exit.md) is long because its revised analysis repeats the access-list flow, positive outcomes, and alternative summaries. Its unique access-list and blind-review block quotes, five-field escalation example, rejected alternatives, negative consequences, and dated divergent-claim correction remain necessary evidence. [ADR-CORE-030](ADR-CORE-030-adr-immutability-and-supersession.md) freezes accepted records; its bounded pass is complete. [ADR-CORE-031](ADR-CORE-031-editorial-pass-evidence-in-git.md) grants no further pass. The `Revised` label on ADR-CORE-012 does not exempt it from that policy.

## Decision

Authorize one content-preserving presentation rewrite of ADR-CORE-012 in this delivery only. The rewrite may combine repeated context, rationale, positive outcomes, and alternative descriptions, and shorten duplicate source inventories. It must retain every decision statement; the exact unique access-list and blind-review block quotes; the five-field escalation example; every rejected option and its distinct rationale; all negative consequences; security and trust boundaries; and the 2026-09-28 divergent-claim annotation. The editor must compare each enumerated item in the original with the revised record.

This exception also permits reciprocal links in the Supersession sections of ADR-CORE-030 and ADR-CORE-031. Those links record the relation and do not change either record's decision. The exception is exhausted by this delivery: it does not reopen ADR-CORE-030's completed pass, change ADR-CORE-012's decisions, or permit another accepted-record edit. The full pre-rewrite wording is recoverable from the immutable [baseline commit](https://github.com/agustinusnathaniel/maestria/blob/c2881341cd0739a42d8e714aedeb0b3750fa76ca/docs/adr/core/ADR-CORE-012-deterministic-review-signals-fail-loud-exit.md) and this delivery's Git diff.

## Consequences

### Positive

- Readers reach the two decisions and their unique specifications with less repeated prose.
- The scope and preservation test for this exception are explicit and reviewable.

### Negative

- Readers need Git history to recover the original prose and inspect whether condensation lost nuance.
- A mistaken equivalence judgment could erase decision evidence while leaving a plausible summary; review must compare the original and rewritten items directly.

### Neutral

- Canonical directives and runtime behavior do not change.

## Alternatives Considered

- **Leave ADR-CORE-012 unchanged.** Preserves one-file historical wording, but retains repetition that obscures the decisions.
- **Use `Revised` as permission to edit.** Rejected because it bypasses ADR-CORE-030 and ADR-CORE-031 without a bounded, explicit exception.
- **Move the unique block quotes to canonical directives.** Rejected because those directives do not contain the wording and relocation would lose the only copies without a separate behavior decision.
- **Allow a standing editorial exception.** Rejected because it would weaken the acceptance freeze beyond this one audited rewrite.

## Supersession

This record authorizes one exception to the editing policy of [ADR-CORE-030](ADR-CORE-030-adr-immutability-and-supersession.md) and [ADR-CORE-031](ADR-CORE-031-editorial-pass-evidence-in-git.md) for [ADR-CORE-012](ADR-CORE-012-deterministic-review-signals-fail-loud-exit.md). Their remaining policy stays in force; ADR-CORE-012 links back here.

## Date

2026-09-28
