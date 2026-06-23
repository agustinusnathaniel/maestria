# ADR-OC-004: Commit Authorization Rules in Orchestrator Directive

## Status

Accepted

## Context

ADR-CORE-001 established the principle that commit behavior belongs to OpenCode's
built-in defaults and should not be duplicated in `@maestria/opencode`'s agent
files or global rules:

> _"OpenCode defaults handle commit behavior... Duplicating them in our rules
> creates maintenance burden and drift risk."_ (ADR-CORE-001, Decision Table —
> "Exclude" row)

In practice, this proved insufficient. The orchestrator agent (the LLM acting
as dispatcher) skipped or ignored OpenCode's default commit rules approximately
80-90% of the time, resulting in:

1. **Commits without proposed messages** — The orchestrator committed changes
   without presenting the commit message or commit plan to the user for approval.
2. **Auto-committing after work cycles** — After a user-initiated commit, the
   next "do work" instruction silently triggered another commit+push cycle
   without re-confirmation, even though the user had not issued a new "commit"
   instruction.

The failure pattern was not a gap in OpenCode's defaults but a model-behavior
problem: the LLM consistently failed to follow multi-step commit protocols when
they were only implicit in the platform's default behavior. Explicit, prominent,
step-by-step instructions embedded in the orchestrator prompt were required.

## Goals

1. Ensure the orchestrator always presents the full proposed commit message
   and commit plan to the user via `question()` before any git work begins.
2. Prevent auto-committing after a completed commit cycle — each commit
   requires a fresh, explicit user instruction in the current turn.
3. Ensure push requires separate per-push user confirmation, not derived
   from earlier commit approval.
4. Reinforce the commit policy across all subagents via global rules so the
   builder, planner, and other agents understand and respect the protocol.

## Non-Goals

1. **Does NOT modify OpenCode's built-in commit behavior or permission model.**
   The `@builder` agent's `"*": ask` permission for git commands remains the
   enforcement layer. This ADR only adds instructional rules to the prompt.
2. **Does NOT add programmatic enforcement.** No CI checks, pre-commit hooks,
   or schema validations are introduced. Compliance depends on the LLM
   following the directive.
3. **Does NOT change the builder agent's permissions or prompt.** The builder
   executes what the orchestrator delegates; it does not independently decide
   to commit.
4. **Does NOT apply to other OpenCode plugins or configurations outside
   `@maestria/opencode`.**

## Decision

Add commit authorization rules at two levels:

### Level 1: Orchestrator Directive (`agents/orchestrator.md`)

**CRITICAL RULE #3** was strengthened with:

- "Never commit without explicit user request in the current turn"
- "After a commit completes, the next turn starts with ZERO commit authorization"
- "'Do work' is NOT a commit request — changing files and committing are
  separate instructions"

A new **COMMIT PROTOCOL** section was added with a 5-step checklist:

1. Inspect — check git status via `@adventurer`
2. Propose — present full commit message inline in `question()` — **!!! Do NOT skip**
3. Execute — delegate to `@builder` with exact message + `vp check` + `vp test`
4. Stop — report, do not chain another commit; dispatch `@reviewer` per rule #8
5. Push — ask separately (commit approval ≠ push authorization)

The auto-committing anti-pattern was marked `!!!` as the most commonly
violated rule, with cross-references to rule #3 and the protocol.

### Level 2: Global Rules (`rules/AGENTS.md`)

A new **Commit Policy** section was added visible to all subagents:

- Only the orchestrator authorizes commits
- Subagents must refuse commit requests and redirect to the orchestrator
- Builders must flag it if the orchestrator's instructions skip the protocol
- Plans must not include implicit commit steps

## Consequences

### Positive

- The orchestrator now has an explicit, unskippable 5-step protocol that
  forces it to present the commit message before any git work begins
- "ZERO authorization" language after each commit resets the authorization
  state, preventing auto-committing on follow-up work instructions
- Push requires separate per-push confirmation, decoupled from commit approval
- All subagents see the commit policy in global rules, creating a second layer
  of reinforcement

### Negative

- The orchestrator directive grew from 277 to 295 lines (+6.5%), adding token
  overhead to every session
- The global rules file grew from 57 to 67 lines (+17.5%)
- ADR-CORE-001's "exclude commit behavior" principle is partially reversed for this
  specific use case, creating a tension between the two records
- No programmatic enforcement — compliance still depends on the LLM following
  the directive

### Risks

- The additional directive text may be skipped by future model versions that
  handle commits differently, making the protocol dead weight
- Mitigation: The protocol is structured as a numbered checklist with `!!!`
  critical markers, making it harder to skip than free-form prose

## Lessons Learned

- ADR-CORE-001's assumption that "OpenCode defaults handle commit behavior" was
  correct in principle but insufficient in practice. The LLM's failure to follow
  implicit defaults was the root cause, not a flaw in the defaults themselves.
- Future agent prompt changes should be validated against actual model behavior
  before assuming good-faith instruction following.
- The "exclude if covered by OpenCode defaults" filter from ADR-CORE-001 should be
  softened to: "exclude if OpenCode defaults are consistently followed in
  practice." If a default is routinely ignored, add explicit rules.

## Date

2026-06-22
