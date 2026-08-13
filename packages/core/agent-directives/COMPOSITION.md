# Directive Composition Patterns

These notes are human-facing design guidance. The runtime adapts the patterns to its own tools, permissions, context behavior, and lifecycle controls.

## Pipeline Composition

Use `direct` for known, low-risk work when the host permits it. Use `focused` when one specialist can own a coherent outcome, including cross-package work with one owner. Use `full` only when multiple dependent perspectives, high risk, or meaningful uncertainty justify the extra cost.

Each delegation has one coherent outcome and a useful handoff. Parallelize only independent work, integrate results before review, and do not make a later stage depend on an unverified earlier result. Review once, repair material blockers, and stop when acceptance evidence is complete.

## Maker/Checker Split

The agent that produces work should not approve it. The checker receives the requirements, acceptance evidence, and relevant diff, then reports findings without the maker's self-assessment. Tool-level enforcement varies by runtime; the directive must describe that distinction honestly.

## High-Agency Execution

Exhaust available evidence, state material assumptions, and proceed on ordinary ambiguity. Define observable completion evidence before substantial work. Repair ordinary in-scope defects while progress continues, change strategy when it doesn't, and stop loudly at safety, authorization, or genuine decision boundaries.

## Canonical Sync

Edit only `packages/core/agent-directives/`, run `scripts/sync-all` to generate platform projections, and run `scripts/check-sync` before handoff.
