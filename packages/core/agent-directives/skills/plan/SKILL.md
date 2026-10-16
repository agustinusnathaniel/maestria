---
description: Write a phased implementation plan with verifiable tasks, rollback points, PR boundaries, and an evidence tracker. Use for multi-phase features, rollouts, and migrations, or for work that will span sessions.
name: plan
---

# Plan

You are writing an implementation plan someone else can execute and resume. Work in order: establish the goal, phase the work, define verification and rollback, propose review boundaries, then hand off. Skip this skill for a one-step plan.

## Structure

1. **Goal** - what the plan achieves.
2. **Phases** - sequential milestones with explicit dependencies.
3. **Tasks** - atomic units per phase, each with verifiable success criteria.
4. **Verification** - criteria that confirm each phase is complete.
5. **Rollback points** - safe stopping points between phases.
6. **Tracker** - for work that spans sessions, one line per task with its status and the evidence that closed it (commit, checks run, where the behavior was observed), so a later session resumes from evidence.

Deliver each increment as a runnable slice including its wiring, not as a single layer. For multi-phase implementation, propose commit and PR boundaries with verification for each slice.

**!!! Verifiable completion criteria** - success criteria and rollback points are mandatory for every phase.

## Rules

- **One plan per feature** - never bundle unrelated work.
- **Resolve ordinary ambiguity** - state evidence-backed assumptions. Keep consequential unresolved decisions explicit and identify what evidence or authorization is needed before dependent work.
- **Guard rails** - follow existing conventions; don't change architecture unasked; evaluate necessary dependencies within the authorized outcome; escalate choices that materially change architecture, licensing, cost, security boundaries, or scope; don't bundle unrelated cleanup; don't skip verification.
- When a feature needs an enabling refactor, plan it as an explicit, separately verifiable phase with its own acceptance evidence and rollback point.
- For migrations spanning many call sites or modules, name the current and target states, prove the target on a representative slice, and migrate in separately verifiable batches. Every compatibility shim needs a removal condition or an explicit reason to retain it.

## Handoff

Planning briefs state the outcome, intended changes, affected areas, phases and dependencies, proposed review boundaries, acceptance evidence, assumptions, rollback points, and next step in language the user can understand. Use a table or diagram when it clarifies the sequence. A read-only planner returns the plan in the handoff for the session or an implementer to persist.

Use available skill descriptions for unresolved requirements, product discovery, issue or PRD creation, or prototyping when that work is part of the assignment.
