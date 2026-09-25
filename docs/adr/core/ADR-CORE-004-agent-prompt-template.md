# ADR-CORE-004: Agent Prompt Template - Skills, Handoffs, and Iteration Limits

## Status

Accepted; historical decision. Its original template has been superseded as described below.

## Current Status

The fixed five-section handoff and hard Max-N template are no longer canonical. Current directives use compact, material handoffs and progress-based repair bounds. See [`handoff.md`](../../../packages/core/agent-directives/skills/handoff.md) and [`rules.md`](../../../packages/core/agent-directives/rules.md).

The four-bucket skill prescription was replaced in 2026-08-22 by compact, per-specialist Skills sections listing verified skills; see [ADR-CORE-019](ADR-CORE-019-directive-simplification.md).

## Context

The seven agents had grown incrementally and differed in skill triggers, source annotations, output formats, iteration limits, and rules. ADR-CORE-003 established shared markers and a skill pattern, but there was still no common prompt shape. An earlier audit used HTML comments for source repositories; they were invisible in review and could drift from the visible skill name.

## Decision (historical)

The original template grouped skills by loading condition, placed source repositories inline, standardized a five-part handoff, and gave agents explicit termination and escalation rules. It also called for shared maker/checker, validation, ambiguity, and parallelization guidance. Agents received the template in stages so it could be refined against smaller examples before broader adoption.

The four skill buckets were **Always load**, **Load on trigger**, **Defer to specialist**, and **Skip if**. The handoff sections were **What was done**, **What was found**, **What was not found or is unclear**, **Verification**, and **Next step**. Iteration limits paired verifiable termination conditions with a hard Max-N cap and an explicit escalation format.

The skill buckets, fixed handoff sections, and hard iteration caps are recorded here as history rather than current requirements. Current wording and homes are maintained in the canonical directives linked above and in ADR-CORE-019.

## Consequences

The template made skill loading, source attribution, and handoffs more consistent, while the rollout introduced temporary differences between agents. It also added boilerplate to simple roles, such as an empty “Always load” section.

## Lessons Learned

- Keep source annotations visible in the skill entry; HTML comments are easy to miss and can contain typos.
- Apply a new template to a small set of agents first, then adapt it to role-specific rules.
- Rules such as “Don't delete what you didn't create” belong to the builder and reviewer, not every agent.
- Parallelization guidance needs to name each agent's scope and collision risk.

## Related Decisions

- [ADR-CORE-003](ADR-CORE-003-agent-conventions.md) established the earlier agent markers and skill convention.
- [ADR-CORE-019](ADR-CORE-019-directive-simplification.md) records the later directive simplification.

## Date

2026-06-13
