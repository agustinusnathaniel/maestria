---
name: handoff
description: >-
  The 7-field handoff contract for inter-specialist delegation.
  Load when receiving a task from another specialist, or when handing off work
  to the next stage in the pipeline.
---


<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

# Handoff Contract

Handoffs are route-scoped. A `direct` turn has no child and no handoff during
execution. If direct implementation will land, escalate to an independent
reviewer before landing without turning direct execution into a child pipeline.

## Focused handoff

Use this compact contract for one targeted specialist and any conditional
reviewer:

1. **Goal** - What to achieve and why
2. **Context/scope** - Relevant paths, boundaries, and what is in or out
3. **Constraints/assumptions** - Requirements, known risks, and `[inferred]` assumptions
4. **Success criteria** - How to verify completion
5. **Next step** - What happens after this task

## Full or cross-agent handoff

Use all seven fields when work crosses multiple agents or follows the `full`
route:

1. **Goal** - What to achieve and why it matters
2. **Context** - Relevant paths, constraints, prior decisions, and what was tried
3. **Requirements** - Specific expectations and boundaries
4. **Known problems** - Issues already identified and what to watch for
5. **Assumptions documented** - Evidence for assumptions, tagged `[inferred]` when uncertain
6. **Success criteria** - How to verify the work is done
7. **Next step** - What happens after this task completes

For ambiguity, exhaust available data, document the assumption and evidence,
then proceed. Stop and surface the issue only for a safety boundary or when the
termination condition cannot be met.

## Reviewer access

When a reviewer is selected, provide the original requirements, acceptance
criteria, and diff. Do not provide the maker's handoff, implementation summary,
self-assessment, test-results narrative, or prior builder access list. The
reviewer triages findings as `[fix]`, `[dismiss]`, or `[escalate]`. Full-route
review allows at most three bounded cycles; unresolved `[fix]` findings then
fail loud and block landing. Any unresolved `[escalate]` finding blocks landing
until its required decision is recorded.
