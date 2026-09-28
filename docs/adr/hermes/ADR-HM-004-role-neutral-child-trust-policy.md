# ADR-HM-004: Role-Neutral Child Trust Policy for Hermes Delegation

## Status

Accepted (2026-08-10), Confidence: High

## Context

This decision was taken inside [ADR-HM-002](ADR-HM-002-orchestration-policy.md) and extracted into its own record on 2026-09-28 under [ADR-CORE-030](../core/ADR-CORE-030-adr-immutability-and-supersession.md), because it decides a different subject from that record: the child-trust boundary, not the orchestrator's delegation default. The 2026-08-10 date is the date the decision was made. Extracting it changed neither the decision, its rationale, nor its consequences.

The Revision in ADR-HM-002 matched the native subagent-start child-role value to the seven Maestria specialist names and gave each match that specialist's tool set. Hermes' native delegated-child roles are `leaf` and `orchestrator` topology roles only, not specialist identities, and no authenticated channel binds a child to a specialist with write capability, so the grant was unsupported. This record supersedes the role-based child-permission elements of that Revision.

The runtime is the authority for whether this policy is currently enforced. Verify the enforcement surface against the `@maestria/hermes` package and its sync configuration rather than against any text here, including this record.

## Decision

1. **Native Hermes child roles are topology roles, not Maestria specialists.** A delegated child's native role is `leaf` (default) or `orchestrator` only; the Maestria specialist names are orchestrator routing identities, not tool-granting child identities.
2. **User/delegation text cannot grant capabilities.** Capabilities come only from trusted native lifecycle state; `[MAESTRIA_ROLE: ...]`-style markers neither create a role mapping nor relax any allowlist.
3. **Delegated children receive a fixed read/research/LLM-only policy.** A child may use read/research tools and LLM reasoning only: no write, execution, shell, further delegation, or OpenCode, regardless of the routed specialist name.
4. **Top-level direct sessions retain normal direct behavior only with trusted native binding.** Trust comes only from recognized native lifecycle state (session start on a non-child platform, or a validated turn-to-session binding); ambiguous, invalid, or ended child state fails closed and never inherits direct or write access.
5. **Sonar and direct blitz have literal positive allowlists that fail closed:** immutable sets where unknown, renamed, and new tools are denied by default.
6. **Review/landing enforcement is advisory.** No native review-state or landing gate exists; reviewer dispatch for non-trivial work is directive guidance.
7. **Lifecycle: session end is per-turn and resumable; finalize, reset, and subagent stop are terminal trust boundaries.** A stopped or ended child has role and trust cleared; a reused id starts clean and needs a fresh trusted event.
8. **Role-specific delegated builder writes are deferred until Hermes provides an authenticated capability channel.** Until then children have no write/execute/shell/delegate/OpenCode capability; code changes run on a trusted top-level fein session, not a delegated `builder`.

## Security Boundaries

A child's native role never grants write/execute/shell/delegate/OpenCode capability; user/delegation text never grants capability; ambiguous, invalid, or ended child state fails closed; sonar and direct-blitz allowlists are literal, so unknown, renamed, and new tools are denied. The former `maestria-roles.json` overrides are no longer loaded, so a stale override cannot re-introduce write capability. Role-specific delegated builder writes stay deferred until Hermes provides an authenticated capability channel provably binding a child to an authorized capability.

These boundaries constrain the parts of [ADR-HM-002](ADR-HM-002-orchestration-policy.md) that remain in force there, so that record states them as well. The runtime, not either record, is the authority on whether each boundary is mechanically enforced or merely configured.

## Consequences

### Positive

- Child escalation is eliminated: a native child-role value matching a specialist name no longer grants write, execute, shell, delegate, or OpenCode capability.
- Children have a single uniform surface rather than a per-role one, so a routing decision cannot widen a child's tools.
- Spoofing is constrained to trusted native lifecycle state, because text cannot create a role mapping.

### Negative

- Delegated builders cannot write on Hermes, so implementation falls to a trusted top-level fein session. This weakens builder-reviewer separation for code work.
- Allowlists still require maintenance as Hermes adds or renames tools, and tool names are matched literally.

### Neutral

- Direct blitz remains narrower than a reader may expect, since even simple edits run through a builder or a fein session. That narrowing is inherited from the Revision in ADR-HM-002, not introduced here.
- Review and landing enforcement stays advisory, because no native Hermes review-state or landing gate exists.

## Assumptions

- `[verified]` The `@maestria/hermes` package carries the native child-role set, the session trust mapping, and the sync configuration that states the delegation boundary.
- `[verified]` No authenticated channel binds a delegated child to a write-capable specialist identity.
- `[inferred]` Deferring delegated builder writes, rather than granting a scoped write capability to a recognized role, is the smaller risk. The alternative is re-tested if Hermes adds an authenticated capability channel.

## Alternatives Considered

- **Keep role-based child permissions** (the model the Revision in ADR-HM-002 adopted): rejected because Hermes' native child roles are topology roles, so matching them to specialist names granted a capability nothing authenticated. The side-by-side comparison of the two models is retained in [ADR-HM-002](ADR-HM-002-orchestration-policy.md) under What this supersedes.
- **Grant a scoped write capability to a recognized child role:** deferred rather than rejected, pending the authenticated capability channel named in Decision 8.

## Platform Limitations

- The native delegated-child roles recorded in Context are a runtime fact, not a stable interface. Re-verify them against the Hermes adapter before relying on this decision.
- There is no native review-state or landing gate, so item 6 is directive guidance rather than a mechanical check.
- Enforcement depends on the subagent-start session-to-trust mapping firing. A missed start leaves the child in an unknown state, which fails closed rather than granting access.
- Tool names are matched literally, so a Hermes rename requires updating the allowlist map.

## Verification

Confirm the current enforcement surface against the `@maestria/hermes` package: the native child-role set, the subagent-start trust recording, and the pre-tool-call policy applied to a delegated child. A change to any of those is a change to the premise of this record.

## Related Decisions

- [Testing Philosophy](../../testing.md): behavior-test selection and evidence requirements.

## Supersession

Supersedes the role-based child-permission elements of the Revision in [ADR-HM-002](ADR-HM-002-orchestration-policy.md), which keeps its original context, decision, consequences, and date. Items 1-3 and 7-8 of that Revision, the top-level direct-access rules, the direct-blitz and sonar allowlists, the advisory review enforcement, and the ignored user-text markers remain in force there. The comparison table between the two policies is retained in that record, which names this record as the successor on its Status line.

## Date

2026-08-10
