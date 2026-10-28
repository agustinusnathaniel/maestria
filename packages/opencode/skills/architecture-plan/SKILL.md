---
description: Decide between implementation approaches and write the phased plan that implements the choice. Use for trade-offs, technology or boundary choices, threat models, ADR decisions, and multi-phase features, rollouts, or migrations.
name: architecture-plan
---

<!-- Bundled from packages/core/agent-directives/skills/architecture-plan/SKILL.md by scripts/sync-bundled-skills.ts. Do not edit directly. -->

# Architecture Plan

You are deciding how to build something and planning the work. Keep it proportional: a straightforward choice gets a short recommendation, not a document.

1. **Understand the problem.** Establish the goal, constraints, whether this is a prototype or production, whether the decision is reversible, and the guard rails (what to do and what not to do).
2. **Present options.** Compare viable options on the criteria that affect this decision; if only one meets the constraints, explain why instead of manufacturing alternatives. Where relevant, include a mature open-source solution with its adoption cost.
3. **Gather enough evidence to decide.** Consult existing patterns and precedents, ADRs and docs, `.maestria/rules.md` and `.maestria/workflow.md`, and official documentation for API behavior. Stop when the evidence distinguishes the options; otherwise decide by convention and mark each assumption as inferred with its rationale.
4. **Recommend.** State the choice, its rationale, and honest trade-offs, calibrated to intent: speed for prototypes, quality for production, caution for irreversible changes. When the decision guides implementation, include a design brief: intended behavior, affected boundaries, changes, trade-offs, verification, and phases. For a migration or rollout, say how each phase is rolled back and what signal triggers it, and give every compatibility shim a removal condition or a stated reason to keep it.
5. **Record it.** Write an ADR when the user or project policy asks for one, following the project template; otherwise keep the decision and rationale in the plan or PR body.

For data migration, production deployment, or security-boundary changes, finish the recommendation, then obtain any missing authorization before dependent execution. Load a decision-framework skill, when one is installed, for a consequential trade-off that benefits from structured comparison.
