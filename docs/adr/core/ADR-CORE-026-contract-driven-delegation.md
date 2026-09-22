# ADR-CORE-026: Contract-Driven Delegation

## Status

Accepted (2026-09-22)

## Context

Earlier Pi and OMP material calls the orchestrator model **Spec-Driven Delegation** (see [ADR-PI-000](../pi/ADR-PI-000-pi-ecosystem-reuse.md) and the Pi and OMP reference page). That name misleads: readers expect a spec file format, a spec tool, or a mandatory spec dependency. What the system actually passes between specialists is a compact handoff contract (outcome, context, acceptance or evidence, assumptions, next step), validated lightly at dispatch (specialist name plus non-empty task only, per the ADR-PI-000 correction). The 7-field shape survives as methodology guidance in the handoff skill, not as machine validation.

Separately, a new optional `spec-contract` skill now carries persistent intent across multi-step work. It detects an owning spec when one exists (OpenSpec, Spec Kit, or similar), references it read-only, and otherwise carries a small inline header. Without a terminology decision, the two ideas blur: the delegation contract, the optional intent header, and external spec formats look like one mandatory system.

## Goals

- Rename the delegation model to **contract-driven delegation**: spec-aware but format-agnostic, with persistent intent refs when they reduce risk.
- Keep the delegation contract generic (a short header, historically 7 slots) with no mandatory spec dependency.
- Scope the `spec-contract` skill to one optional, advisory helper with no storage ownership and no new specialist.
- Preserve history: the old term remains as a historical alias, not a second model.

## Non-Goals

- No change to dispatch mechanics, phase gates, maker/checker split, or session tree behavior.
- No new specialist, no new required skill load, no mandatory spec format.
- No ownership of external spec files and no auto-sync of intent state.
- No retrofit of every historical mention in one pass; updates land where the term defines behavior.

## Decision

1. **Rename to contract-driven delegation.** Delegation passes a compact material contract between specialists. It is spec-aware (it can point at an owning spec) but format-agnostic (it never requires one). The phrase "Spec-Driven Delegation" is retained only as a historical alias in this ADR and in notes attached to renamed headings.
2. **Generic header, optional skill.** The contract header keeps the historical slot shape (intent, requirements, constraints, decisions, acceptance, current task, refs and blockers) as advisory guidance. The `spec-contract` skill carries that header across steps only when persistent intent would reduce risk; absence is normal and tiny single-step work skips it.
3. **Detect, interoperate, delegate, borrow only.** The skill detects the owning truth (OpenSpec paths first, then Spec Kit shape, else inline header), references it read-only, and never modifies owning files outside the owning workflow. It interoperates with external specs and delegates phase and review work to the existing pipeline; it owns no storage and adds no specialist.
4. **Borrowed patterns (from prior art).** The skill borrows only these portable moves: mark ambiguity explicitly (`[inferred]` or unknown); analyze read-only at the owning source; converge with append-only notes, never silent rewrites; point reviewers at the owning checklist; split work into phased tasks with per-phase acceptance; frame each step as current truth plus delta plus verified implementation.
5. **Rejected carries (deliberately not borrowed).** No mandatory spec dependency; no vendored schemas; no auto-sync of intent; no storage ownership; no new specialist or dispatcher role; no machine-validated fixed field count at dispatch; no rewriting the owning spec from the header.

## Consequences

- Positive: the name matches the mechanism (handoffs, not spec files), so new readers stop looking for a spec tool.
- Positive: tiny changes stay cheap (header stays in-thread or is skipped) while complex work can still pin intent.
- Positive: core stays lean (one optional skill, no new role, no storage) and external specs keep ownership of their truth.
- Negative: two terms coexist during migration; old pages and ADRs still say Spec-Driven until touched.
- Neutral: historical ADR text is preserved; clarifying notes point here instead of rewriting history.

## Assumptions

- [verified] Dispatch validates specialist name and non-empty task only; the 7-field pre-check was removed (ADR-PI-000 correction, 2026-09-11).
- [verified] The `spec-contract` skill is advisory, loaded only when relevant, with no auto-sync and no storage ownership (skill body, checked 2026-09-22).
- [inferred] Readers encountering the old term benefit more from a short alias note than from a bulk rename.

## Alternatives Considered

- **Keep Spec-Driven Delegation:** rejected because the name promises spec files the system does not require, and it collides with the new skill's narrower intent-carrying job.
- **Mandate the spec-contract header on every handoff:** rejected because it taxes tiny changes and recreates the removed machine-validated gate by convention.
- **Vendor OpenSpec or Spec Kit schemas:** rejected because it couples core to external formats; detection plus read-only pointers interoperate without the dependency.
- **Add a spec-owner specialist:** rejected because ownership already lives with the external spec workflow and the existing planner, builder, and reviewer roles.

## Verification

- `vp check` passes on the integrated result.
- `git diff --check` is clean and no new text emits U+2014.
- `scripts/check-sync` passes when canonical sources changed (this ADR plus user-docs edits alone require no sync; canonical skill and directive edits on this branch carry their own sync proof).

## Related Decisions

- [ADR-PI-000](../pi/ADR-PI-000-pi-ecosystem-reuse.md): origin of the Spec-Driven term and the dispatch validation correction.
- [CORE-019](ADR-CORE-019-directive-simplification.md): lean directives and proportional process.
- [CORE-023](ADR-CORE-023-evidence-led-directives.md): evidence-led verification and `[inferred]` tagging.
- [CORE-025](ADR-CORE-025-consumer-driven-sync-and-adapter-simplification.md): removal of the machine-validated handoff symbols.

## Date

2026-09-22
