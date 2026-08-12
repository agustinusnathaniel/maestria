# ADR-OC-004: Commit Authorization Rules in Orchestrator Directive

## Status

Superseded

## Context

This ADR added a user-question checkpoint before every commit after observing OpenCode sessions that committed without a proposed message and occasionally repeated a commit/push cycle after a follow-up work request. The checkpoint was intended to make the platform's commit defaults visible to the model.

It was too broad. Maestria's autonomy contract treats routine commits on a recognized feature branch as an agent-owned workflow step after validation and independent review. Requiring a fresh user request in the current turn, asking for a full commit plan through `question()`, and resetting authorization after every commit turned ordinary delivery into a manual approval loop. It also contradicted ADR-CORE-011's autonomous commit boundary and the project's maker/checker workflow.

## Decision

This ADR is superseded. OpenCode follows the canonical commit contract in `packages/core/agent-directives/`:

1. The orchestrator may authorize a routine commit after the work is validated, independently reviewed when required, and confirmed to be in scope.
2. On a recognized feature branch, no additional user question is required for that routine commit. The conventional commit message, staged diff, and Work Results report provide the audit trail.
3. Commit, push, PR creation, merge, and release remain distinct lifecycle actions. Protected branches and unresolved safety, security, review, or authorization floors always block them. Push and later lifecycle actions follow the applicable project and platform policy.
4. An explicitly user-authorized checkpoint may commit an unreviewed working state for preservation only; it does not waive any shipping gate.

OpenCode's permission configuration remains the runtime enforcement layer. The orchestrator still cannot perform repository mutations directly; it delegates approved implementation and commit work to the permitted specialist or commit executor. Prompt-only rules must not claim stronger runtime guarantees than the platform provides.

## Consequences

- Routine feature-branch work can complete autonomously without a redundant `question()` round-trip.
- Review, validation, branch, documentation, safety, and lifecycle boundaries remain explicit and independently enforceable.
- The old current-turn authorization language must not be restored to the canonical orchestrator directive or its generated OpenCode projection.
- Historical changelog entries describing the former protocol remain history; they do not define current behavior.

## Date

2026-08-12
