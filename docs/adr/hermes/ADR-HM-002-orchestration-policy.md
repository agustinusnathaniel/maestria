# ADR-HM-002: Hermes Orchestrator Policy - Direct Default, Bounded Modes, Role-Neutral Child Trust

> **Title note (2026-08-10).** The original title named the role-based child-permission model in the [Revision (2026-08-10)](#revision-2026-08-10-bounded-direct-execution-and-role-gated-delegation); that model is superseded by the role-neutral policy in [Amendment (2026-08-10)](#amendment-2026-08-10-approved-role-neutral-child-trust-policy), which the title now reflects. "Role-Gated Delegation" survives only as a historical marker in the Revision.

## Status

Accepted (2026-07-17). Revised (2026-08-10) - supersedes the single-thread default and unrestricted main-session tool access described in the original decision below. Amended (2026-08-10) - the approved role-neutral child trust policy supersedes the role-based child-permission elements of the Revision below.

> The original 2026-07-17 policy is superseded by [Revision (2026-08-10)](#revision-2026-08-10-bounded-direct-execution-and-role-gated-delegation), whose role-based child-permission elements are in turn superseded by the role-neutral child trust policy in [Amendment (2026-08-10)](#amendment-2026-08-10-approved-role-neutral-child-trust-policy). The original Context and Decision remain historical record; the runtime and canonical directives are the operational source, and the runtime wins.

## Context (original, 2026-07-17)

The orchestrator directive was ported from `@maestria/opencode`, where it is a **pure dispatcher** with no implementation tools because the coding agent implements. On Hermes the orchestrator has **full tool access** (read, write, bash, LLM, delegation), so that mandate forces unnecessary delegation for simple tasks that are faster and more reliable in a single turn.

## Decision

The Hermes orchestrator defaults to **single-thread execution**, delegating only for complex tasks:

- 4+ files requiring coordinated changes
- Multi-domain work (e.g., frontend + backend + docs)
- Risky changes needing a maker/checker split
- Explicit "Maestria mode" requested by the user

### What changed

| Layer | Before | After |
| --- | --- | --- |
| Orchestrator directive | "Only tools are `delegate_task()` and `question()`. Never implement yourself." | "Default to direct implementation. Only delegate for complex tasks." |
| Fein context | "All stages execute. Maker/checker split applies." | "Default: single-thread execution. Maker/checker split applies when delegation is used." |
| Sync configuration | No replace rules for the orchestrator mandate | Replace rules adapting canonical "pure dispatcher" language |
| Permission handling | Unchanged - the orchestrator role already allowed full access with no role mapping | No change needed |

### What did NOT change

- **Specialist roles** (adventurer, builder, reviewer, etc.) - unchanged for when delegation is used.
- **Mode system** (fein/sonar/blitz) - unchanged; semantics are enforced by the runtime (see Revision).
- **Permission enforcement** - originally a no-op for the main session (no role mapping); the Revision adds sonar/blitz allowlists and role-gated child access.

## Consequences (original, 2026-07-17)

### Positive

- Simple tasks complete in fewer turns; no subagent overhead
- No context fragmentation for straightforward changes
- Delegation infrastructure remains available for complex tasks

### Negative

- The orchestrator skill diverges from canonical `@maestria/opencode`; sync replaces must be maintained
- Developers may over-rely on single-thread and not delegate when beneficial

These consequences still apply to direct fein work; the Revision narrows them.

---

## Revision (2026-08-10): Bounded Direct Execution and Role-Gated Delegation

> **Supersession notice.** This Revision records the policy implemented as of 2026-08-10. Items 1-3 and 7-8 (top-level direct access, direct blitz, sonar, review advisory, user-text markers) and their table rows remain current. Items 4-6 (role-gated child delegation), the "Child roles" and "Role source" rows, and the role-based Consequences, Security Boundaries, and Platform Limitations entries are superseded by the role-neutral child trust policy in [Amendment (2026-08-10)](#amendment-2026-08-10-approved-role-neutral-child-trust-policy), retained here as historical record. The Amendment is the active child policy.

### Context

The original policy assumed the main session's tools were unconstrained and that direct execution was uniformly the default. The implemented runtime and canonical directive distinguish top-level sessions, trusted native child roles, and invalid child state, and apply per-mode allowlists.

### Decision

1. **Trusted top-level sessions retain direct behavior; unknown contexts fail closed.** Trust requires recognized native lifecycle state (session start on a non-child platform, or a host turn-to-session binding); unknown or ambiguous contexts are denied tools. Fein keeps normal direct permissions.

2. **Direct blitz is limited to a literal positive allowlist and fails closed.** In blitz only the reviewed read/research/LLM tools are permitted; write, bash, delegation, and OpenCode routing are blocked. The immutable allowlist is not derived from the general tool categories, so new or renamed tools are denied by default.

3. **Sonar is read/research-only with a literal allowlist and fails closed.** Only the sonar allowlist (read categories plus web fetch/search/extract) is permitted; write, bash, delegation, code execution, and browser interaction are blocked, and unknown tools and aliases are denied by default.

4. **Directive routing of code changes to a permitted builder is policy-level, not mechanical.** _[Superseded in its child-capability part - see [Amendment](#amendment-2026-08-10-approved-role-neutral-child-trust-policy): delegated children can no longer use OpenCode routing; code changes run on a trusted top-level fein session.]_ The directive and Hermes notes route code changes through delegation to a permitted `builder`, which may use the OpenCode CLI; only the sonar, direct-blitz, and child boundaries are mechanically enforced.

5. **Trusted native child roles are validated; invalid/ambiguous child state fails closed.** _[Superseded - see [Amendment](#amendment-2026-08-10-approved-role-neutral-child-trust-policy): the role-based `PermissionRole` model is replaced by the fixed role-neutral policy.]_ Roles came only from the native subagent-start child-role value, matched against the fixed seven canonical names; invalid or ambiguous values blocked all tools.

6. **Child session roles are cleaned up on exit.** _[Superseded - see [Amendment](#amendment-2026-08-10-approved-role-neutral-child-trust-policy): session-to-role mapping is replaced by session-to-trust-state tracking.]_ A stopped subagent's mapping was cleared so it could not retain permissions; cleanup depended on the subagent-stop hook firing.

7. **Review/landing enforcement is advisory.** Hermes has no native review-state or landing gate; reviewer dispatch for non-trivial builder work is directive guidance.

8. **User text role markers are not trusted.** Role context comes only from the trusted native lifecycle mapping; `[MAESTRIA_ROLE: ...]` and similar markers are ignored.

#### What changed (relative to the 2026-07-17 decision)

| Layer | Original (2026-07-17) | Implemented (2026-08-10) |
| --- | --- | --- |
| Direct default | Single-thread direct; all main tools pass through | Trusted top-level only; unknown contexts fail closed; fein direct, blitz allowlisted, sonar read-only |
| Direct blitz | Not gated | Literal allowlist; fails closed; no code changes |
| Code changes | Orchestrator may implement directly | Policy-level routing through a permitted `builder` |
| Sonar | "No changes made" (advisory) | Literal allowlist blocks write/bash/delegation; fails closed |
| Child roles | Not tracked for permissions | _[Superseded - see Amendment]_ trusted subagent-start mapping, fixed seven-role set, fail-closed |
| Review/landing | Not addressed | Advisory (no native Hermes gate) |
| Role source | Not addressed | _[Superseded - see Amendment]_ native lifecycle only; user text ignored |

#### Consequences

##### Positive

- **Defense in depth** - sonar and direct-blitz allowlists fail closed; unknown tools are denied by default
- **Scoped, mechanical enforcement** - the pre-tool-call hook enforces the sonar, direct-blitz, and child boundaries; builder routing remains directive-level
- **Child-role spoofing is prevented** - _[superseded - see Amendment]_ roles came from trusted lifecycle state and were cleared on exit
- **Consistent with canonical directives**

##### Negative

- **Direct blitz is narrower than expected** - even simple edits go through a builder or fein
- **Review is advisory** - a non-compliant agent can skip reviewer dispatch
- **Allowlists need maintenance** as Hermes adds or renames read/research tools
- **Builder routing is not mechanically enforced** - direct fein keeps normal permissions

##### Security Boundaries

- Role permission was scoped to trusted native subagent-start values; user text was never a role source _[superseded - see Amendment]_
- Invalid child state mapped to a blocked state, never direct or valid _[superseded - see Amendment]_
- Only positively identified trusted top-level sessions keep direct access; an unknown session with no role mapping fails closed
- Allowlists are positive and literal: unlisted tools, aliases, and post-review renames are denied

##### Platform Limitations

- No native review-state or landing gate; review enforcement is advisory
- The pre-tool-call hook receives no child role; the subagent-start mapping is the workaround, so enforcement depends on the hook firing _[superseded - see Amendment]_
- Cleanup depends on the subagent-stop hook; a missed hook can leave a stale role mapping _[superseded - see Amendment]_
- User-config role overrides could widen a role's categories _[superseded - see Amendment]_
- Tool names are matched literally, so Hermes renames require updating the map or tools become unavailable

##### Rollback / Reversion

- To restore the original single-thread unrestricted behavior, revert the direct-session allowlist logic and the code-route-to-builder instruction (the original decision text above documents that state).
- Reverting the child-role mapping restores the pre-Revision behavior where child and direct sessions were not distinguished.
- Canonical changes propagate through `scripts/sync-all`; run `scripts/check-sync` after reverting or changing the notes.

##### References

- ADR-HM-001: `/goal` integration decision
- PR #89: Original single-thread orchestration policy (2026-07-17)
- Revision (2026-08-10): implemented in the `@maestria/hermes` runtime (`packages/hermes/`); runtime pointers and canonical sources are listed in the Amendment References below

---

## Amendment (2026-08-10): Approved Role-Neutral Child Trust Policy

### Context

The Revision's child model matched the native subagent-start child-role value to the seven Maestria specialist names and gave each match that specialist's tool set, so a `builder` child got full write/bash/coding/OpenCode access. Hermes' native delegated-child roles are `leaf` and `orchestrator` topology roles only, not specialist identities, and no authenticated channel binds a child to a specialist with write capability; the grant was unsupported. This Amendment records the approved role-neutral policy superseding the Revision's role-based child-permission elements.

### Decision (Approved Policy)

1. **Native Hermes child roles are topology roles, not Maestria specialists.** A delegated child's native role is `leaf` (default) or `orchestrator` only; the Maestria specialist names are orchestrator routing identities, not tool-granting child identities.

2. **User/delegation text cannot grant capabilities.** Capabilities come only from trusted native lifecycle state; `[MAESTRIA_ROLE: ...]`-style markers neither create a role mapping nor relax any allowlist.

3. **Delegated children receive a fixed read/research/LLM-only policy.** A child may use read/research tools and LLM reasoning only: no write, execution, shell, further delegation, or OpenCode, regardless of the routed specialist name.

4. **Top-level direct sessions retain normal direct behavior only with trusted native binding.** Trust comes only from recognized native lifecycle state (session start on a non-child platform, or a validated turn-to-session binding); ambiguous, invalid, or ended child state fails closed and never inherits direct or write access.

5. **Sonar and direct blitz have literal positive allowlists that fail closed:** immutable sets where unknown, renamed, and new tools are denied by default.

6. **Review/landing enforcement is advisory.** No native review-state or landing gate exists; reviewer dispatch for non-trivial work is directive guidance.

7. **Lifecycle: session end is per-turn and resumable; finalize, reset, and subagent stop are terminal trust boundaries.** A stopped or ended child has role and trust cleared; a reused id starts clean and needs a fresh trusted event.

8. **Role-specific delegated builder writes are deferred until Hermes provides an authenticated capability channel.** Until then children have no write/execute/shell/delegate/OpenCode capability; code changes run on a trusted top-level fein session, not a delegated `builder`.

#### What this supersedes

| Aspect | Revision (2026-08-10) | Amendment (2026-08-10) |
| --- | --- | --- |
| Child role identity | Native child role matched to specialist names; matches got that specialist's tools | Native roles are `leaf`/`orchestrator` topology only; specialist names are routing identities, not tool grants |
| Builder child write | `builder` children could write, run bash, delegate, and route to OpenCode | Deferred until an authenticated capability channel exists; children are read/research/LLM-only |
| Child tool policy | Role-specific tool sets | Fixed read/research/LLM-only for all children |
| Capability source | Native child-role string | Trusted native lifecycle only; text never grants capability |

#### Enforcement status (runtime as authority)

- **Mechanical in the current runtime:** trusted-top-level fail-closed classification; the sonar, direct-blitz, and fixed child-safe allowlists; ignored user-text markers; per-turn session end with resumable trust; and terminal cleanup on finalize, reset, and subagent stop.
- **The role-neutral child boundary is mechanically enforced:** the legacy role-based path is removed; the subagent-start hook records the native role (`leaf`/`orchestrator`) as topology trust only, and the pre-tool-call hook grants every child the fixed read/research/LLM-only policy. Role overrides are no longer loaded; the sync configuration states the delegation boundary instead of granting write or OpenCode routing.

#### Consequences

##### Positive

- **Child escalation is eliminated** - a native child-role value matching a specialist name no longer grants write/execute/shell/delegate/OpenCode capability
- **Single, uniform child surface** - all children share one limited policy; no per-role child attack surface
- **Spoofing is further constrained** - only trusted native lifecycle state establishes context

##### Negative

- **Delegated builders cannot write on Hermes** - the pipeline's delegated `builder` step cannot make code changes, so implementation falls to a trusted top-level fein session, weakening builder-reviewer separation for code work
- **Allowlists still require maintenance** as Hermes adds or renames read/research tools

##### Security Boundaries

- A child's native role never grants write/execute/shell/delegate/OpenCode capability; only a future authenticated channel may do so
- User/delegation text never grants capability; only trusted native lifecycle state does
- Ambiguous, invalid, or ended child state fails closed and never inherits direct or write access
- Sonar and direct-blitz allowlists are literal: unknown, renamed, and new tools are denied

##### Platform Limitations

- Native delegated-child roles are `leaf`/`orchestrator` topology roles; no authenticated channel binds a child to a specialist write capability
- No native review-state or landing gate; review/landing enforcement is advisory
- The pre-tool-call hook receives no child role; the subagent-start session-to-trust mapping is the workaround, so enforcement depends on the hook firing. A missed start leaves the child UNKNOWN, which fails closed
- The former `maestria-roles.json` overrides are no longer loaded: children are always held to the fixed allowlist, so a stale override cannot re-introduce write capability

##### Future Capability-Channel Requirement

Role-specific delegated builder writes are deferred until Hermes provides an authenticated capability channel: a mechanism provably binding a child to an authorized capability (for example write), rather than a child-role string or user text. Until then, children remain read/research/LLM-only, and this policy stands.

#### References

- [Revision (2026-08-10)](#revision-2026-08-10-bounded-direct-execution-and-role-gated-delegation) - the implemented role-based model this Amendment supersedes
- Runtime: the `@maestria/hermes` package (`packages/hermes/`)
- Hermes sync config: `packages/hermes/sync.config.ts` (builder and orchestrator append blocks state the delegation boundary)
- Canonical orchestrator source: `packages/core/agent-directives/specialists/orchestrator.md` (specialist names are routing identities)
- Hermes Agent docs: https://hermes-agent.nousresearch.com/docs
