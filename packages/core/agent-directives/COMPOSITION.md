# Directive Composition Patterns

Composition follows the selected route, while hard rules remain in force on every route.

## Route selection

```
direct  -> host execution; no child or handoff during execution
focused -> one targeted specialist; one reviewer before landing when it will land
full    -> one thinker -> one worker -> one independent reviewer
```

Direct research and non-landing work remain review-free unless concrete risk requires review. Direct implementation that will land escalates to a review-capable route before landing, without adding a child to direct execution. Focused research and non-landing work are likewise review-free unless risk requires it. Full retains independent review by default.

Do not add startup reconnaissance, mandatory design, or automatic review to smaller routes. Add fan-out or multi-lens review only for evidenced risk, and scale expensive or slow full routes down to one review pass.

## Handoffs and safety

Direct turns have no handoff. Focused work uses the compact five-field handoff. Full or cross-agent work uses the seven-field handoff. Exhaust data, document `[inferred]` assumptions, and proceed unless a data migration, production, security, irreversible, or safety-ambiguity checkpoint applies. Every loop has a verifiable termination condition and a maximum of three attempts. Review findings use `[fix]`, `[dismiss]`, and `[escalate]` triage; unresolved `[fix]` findings after three cycles fail loud and block landing, and any unresolved `[escalate]` finding blocks landing until its required decision is recorded.

## Autonomous shipping

An ordinary implementation request authorizes the orchestrator's autonomous route-scoped commit, push, and PR flow unless the user limits it to research-only, no-commit, or no-ship. Specialists may perform those operations only when the orchestrator delegates the exact operation, files, message, and validation. Direct root work follows the same flow. Every change under `packages/` or any behavior-affecting change requires a changeset; docs-only or internal-only changes follow the repository's actual conventions. Inspect status, diff, history, branch, and worktrees; audit internal docs, user-facing docs, and changelogs; stage only intended files; use a conventional message; and ship meaningful work only from a non-primary feature branch. Never use `main` or `master`. Create or update a PR with Summary, Changes or Work Results, Testing, and Breaking Changes. Human checkpoints are limited to migrations/data, production, security, irreversible decisions, and safety ambiguity.

## Cross-platform sync work

Edit canonical sources in `packages/core/agent-directives/`, then use the sync pipeline to propagate and verify changes when generated outputs are in scope. Never edit generated plugin files directly. Route gates and maker/checker enforcement vary by platform, so describe guarantees accurately.

## Reference

See `rules.md` and `specialists/orchestrator.md` for the complete hard-rule, review, handoff, and shipping contracts.
