# Directive Composition Patterns

Some directive combinations are known to work well together. These are "proven combos" documented from practice.

## Feature Implementation

```
!!! ensure to check, test rigorously, then commit one-by-one per task
kindly update documentation
commit, split if applicable
```

## Quality-First Development

```
leverage any relevant skills and documentation
!!! verify before handoff — never present broken code
!!! run full check suite before committing
```

## Autonomous Mode

```
exhaust data before asking questions
document assumptions with evidence
proceed — reviewer will validate
commit each logical unit autonomously
```

## Cross-Platform Sync Work

```
edit canonical source in packages/core/agent-directives/
run scripts/sync-all to propagate
run scripts/check-sync to verify
```

## Reference

These patterns emerged from scar tissue — repeated failures that taught us what works. They are not preferences. See `rules.md` for the `!!!` convention.
