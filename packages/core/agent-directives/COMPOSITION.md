# Directive Composition Patterns

Some directive combinations are known to work well together. These are "proven combos" documented from practice.

## Feature Implementation

```
!!! ensure to check, test rigorously, then commit one-by-one per task under the separate commit protocol
kindly update documentation
commit, split if applicable
```

## Quality-First Development

```
leverage any relevant skills and documentation
!!! verify before handoff - never present broken code
!!! run full check suite before committing
```

## Autonomous Mode

```
exhaust data before asking questions
document assumptions with evidence
proceed - reviewer will validate
validate each logical unit autonomously; commit only under the separate commit protocol and its authorization
```

## Focused Autonomy

```
pick the smallest safe route; defaults are finite and counted: `direct` zero dispatches, `focused` one owning specialist plus only its required reviewer, `full` one thinker, one integrated worker batch, one general reviewer, `sonar` one owning read-only specialist plus at most one distinct read-only specialist; each planned child gets one initial dispatch and at most one recovery dispatch
keep the primary outcome, non-goals, and termination condition; declare explicit budgets only for fan-out, non-default children, or repair extensions
on an unavailable, malformed, or timed-out delegation: record it terminal blocked or failed first, then at most one recovery dispatch for the same child with a corrected brief when the cause is identifiable, otherwise one bounded transport retry; intentional cancellation is terminal and never retried; if recovery fails, preserve the delta and stop dependent work while independent read-only exploration and reporting continue; never mutate directly
transient provider or transport failures are not repair progress and consume no repair budget, but every attempt counts against dispatch-attempt accounting
a greeting, status check, or continuation is the same work unit; only a changed outcome restarts it
review stays blind; unresolved findings block landing
```

## Cross-Platform Sync Work

```
edit canonical source in packages/core/agent-directives/
run scripts/sync-all to propagate
run scripts/check-sync to verify
```

## Reference

These patterns emerged from scar tissue - repeated failures that taught us what works. They are not preferences. See the universal rules contract for the `!!!` convention.
