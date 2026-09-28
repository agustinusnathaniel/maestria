# ADR-CORE-031: Keep Editorial Pass Evidence in Git

## Status

Accepted (2026-09-28), Confidence: High

## Context

[ADR-CORE-030](ADR-CORE-030-adr-immutability-and-supersession.md) froze accepted decisions and authorized one editorial pass over older records. Its Decision section then retained an itemized account of that completed pass. The ledger documents which files changed in a particular delivery; it is evidence of execution, not a rule for future ADRs. The immutable [delivery commit](https://github.com/agustinusnathaniel/maestria/commit/1255f2a9d52f7e8028e94dbd50f393acff993a36) preserves both the full ledger and the edits it describes.

Keeping the ledger in the standing ADR makes its policy harder to read and duplicates the versioned delivery record. Removing it without a stable pointer would make the completed pass harder to audit. The ledger also disclosed two departures: ADR-CORE-009 replaced four false implementation claims instead of retaining and annotating them under clause 7, and the pass condensed a Context paragraph in the already-superseded ADR-CORE-015 outside clause 6. These are historical exceptions, not precedent.

## Decision

1. Replace the completed-pass ledger in ADR-CORE-030 with a concise pointer to the immutable delivery commit. The pass date and its completion remain stated in the ADR.
2. Supersede only clause 6's requirement that the current ADR body name each removed block. The original version at the linked commit remains the ledger for that completed pass. The preservation constraints in clause 6 still apply to that pass.
3. Permit this one-time removal from ADR-CORE-030's accepted Decision section. Its policy, rationale, alternatives, consequences, and lifecycle remain unchanged. This decision grants no further editorial pass over accepted records; later changes still follow ADR-CORE-030's status and supersession rules.

## Consequences

### Positive

- The standing lifecycle policy is shorter and easier to find.
- The complete pass evidence remains inspectable beside its exact Git diff.

### Negative

- Auditing the 2026-09-28 pass now requires access to the linked Git history.

### Neutral

- No generated directive, runtime behavior, or future ADR-editing permission changes.

## Alternatives Considered

- **Keep the full ledger in ADR-CORE-030.** Preserves one-file reading, but keeps delivery accounting inside the standing decision.
- **Move the ledger to another live document.** Preserves a repository page, but adds a second maintained file for historical evidence already in Git.
- **Delete the ledger without a pointer.** Shorter, but readers could not reliably recover which removals the pass authorized.

## Supersession

Extends [ADR-CORE-030](ADR-CORE-030-adr-immutability-and-supersession.md) only for the location of the completed pass ledger and the one-time removal stated above. All other decisions in that record remain in force. [ADR-CORE-032](ADR-CORE-032-one-time-condensation-of-review-signals-record.md) authorizes a separate one-time rewrite of ADR-CORE-012; it does not change this ledger decision.

## Date

2026-09-28
