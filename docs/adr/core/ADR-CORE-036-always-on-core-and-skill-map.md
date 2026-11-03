# ADR-CORE-036: Always-On Core With a Skill Map

## Status

Accepted (2026-11-03). Confidence: medium.

## Context

`rules.md` and `specialists/main-loop.md` load on every main-session turn. After the anti-bloat pass they still held about 3,180 words, and the composed `AGENTS.md` was about 26.6 KB. Much of that text applies only to some tasks: implementation judgment and testing apply when code changes, the review briefing and triage apply when a review is sent or returns, the delegation brief applies when work is delegated, and PR slicing applies when a PR is planned. Instruction-following degrades as always-on rules grow, and the main loop already loads method skills on trigger.

[CORE-035](ADR-CORE-035-main-loop-with-one-reviewer.md) kept implementation judgment always-on because skills are often skipped. Skills are also the only channel every host loads, so a rule that must reach every host either stays always-on or ships as a skill.

## Decision

Split each directive by when it must apply:

- **Always-on core**: rules that must hold on every turn (floors, reporting, scope, authorization stops, acceptance and blind review, branch and commit safety, the canonical-source invariant, fail-loud repair, outcome, delegation checks, precedence, and the main loop's routing, modes, review core, workflow, delivery, and reporting).
- **Method skills**: task-shaped method, loaded on trigger. The new `implement` skill holds implementation judgment, reuse, the testing rules, and comments; `review-loop` (formerly `iteration-limits`) holds the reviewer briefing, triage order, and pass rules; `handoff` holds the delegation brief, failed-delegation recovery, and the cross-session tracker; `create-pull-request`, `docs-update`, `architecture-plan`, and `diagnose` take the text that only their task needs.
- **One skill map**: the main loop's Routing section names each method skill with one short trigger line, replacing scattered "load X" pointers, so the trigger is always-on even when the method is not.
- **Reviewer embedding**: the reviewer profile embeds the `implement` text, so the checker reviews against the same judgment without depending on a skill load.

`handoff` and `review-loop` are now authored skills under `skills/`, bundled like the other method skills, instead of projections of `rules.md` sections, because their text no longer lives in `rules.md`. Word budgets are re-set to the new sizes (`rules.md` 1,250, `main-loop.md` 925); a budget is a prompt to ask whether a rule must be always-on, not a reason to drop one that must.

## Consequences

- Always-on text falls from about 3,180 to about 2,150 words, and the composed `AGENTS.md` from about 26.6 KB to about 19.5 KB.
- Implementation judgment now reaches the main session only when the `implement` trigger fires. This is the risk CORE-035 named; the skill map line and the reviewer embedding are the mitigations, and a regression would show as unfamiliar code shapes or missing tests that the reviewer flags.
- `iteration-limits` is renamed `review-loop`; users who load it by name must use the new name. This is a breaking change released as a 0.x minor.
- OpenCode, Pi, and Codex users gain `handoff`, `review-loop`, and `implement` as bundled skills where they had fewer before.

## Alternatives Considered

- **Keep everything always-on and raise the budgets**: no trigger risk, but keeps every-turn text about 50% larger than the rules that must hold on every turn.
- **Move method into skills with no always-on map**: smallest core, but a skill whose trigger lives only in its description is easy to skip.
- **Keep `handoff` and `review-loop` as projections of `rules.md`**: would require keeping their text always-on, which defeats the split.

## Supersession

Amends [CORE-035](ADR-CORE-035-main-loop-with-one-reviewer.md) (implementation judgment moves from always-on rules to the `implement` skill) and the skill-ownership tiers in [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) (utility skills are authored, not projected).

## Date

2026-11-03
