---
description: Choose between implementation approaches and plan the chosen one in phases. Use for trade-offs, technology or boundary choices, threat models, and ADR decisions; for multi-phase features, rollouts, or migrations; and when review keeps reopening a design.
name: architecture-plan
---

# Architecture Plan

Keep it proportional: a straightforward choice gets a short recommendation, not a document.

1. **Frame the decision.** Establish the goal, constraints, guard rails (what to do and what not to do), whether this is a prototype or production, and whether the decision is reversible.
2. **Compare options** on the criteria that affect this decision, including a mature open-source solution and its adoption cost where relevant. If only one option meets the constraints, explain why instead of manufacturing alternatives.
3. **Gather enough evidence to decide** from existing patterns and precedents, ADRs, and docs, and stop once it distinguishes the options; otherwise decide by convention and tag each assumption `[inferred]` with its rationale.
4. **Recommend** the choice with its rationale and honest trade-offs, calibrated to intent: speed for prototypes, quality for production, caution for irreversible changes. When it guides implementation, add a design brief: intended behavior, affected boundaries, changes, trade-offs, verification, and phases. For a migration or rollout, say how each phase rolls back and what signal triggers it, give every compatibility shim a removal condition or a stated reason to keep it, and mark the superseded path do-not-extend, then remove it in a separate change once migration completes.
5. **Record it** in an ADR when the user or project policy asks for one, following the project template; otherwise in the plan or PR body.
6. **Present it** to the user before dependent edits when the design or plan informs implementation, then continue under the existing authorization rules.

Finish the recommendation before stopping for any authorization a data migration, production deployment, or security-boundary change needs. Load a decision-framework skill, when one is installed, for a consequential trade-off that benefits from structured comparison.
