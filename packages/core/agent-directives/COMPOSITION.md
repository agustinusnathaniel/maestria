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

## Cross-Platform Sync Work

```
edit canonical source in packages/core/agent-directives/
run scripts/sync-all to propagate
run scripts/check-sync to verify
```

## Reference

These patterns emerged from scar tissue - repeated failures that taught us what works. They are not preferences. See the universal rules contract for the `!!!` convention.
