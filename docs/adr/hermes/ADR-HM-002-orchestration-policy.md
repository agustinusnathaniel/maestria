# ADR-HM-002: Hermes Orchestrator Policy - Direct Default, Bounded Modes, Role-Neutral Child Trust

> **Title note (2026-08-10).** The original title named the role-based child-permission model in the Revision below; that model is superseded by the role-neutral policy in the Amendment, which the title now reflects. "Role-Gated Delegation" survives only as a historical marker in the Revision.

## Status

Accepted (2026-07-17). Revised (2026-08-10) - supersedes the single-thread default and unrestricted main-session tool access described in the original decision below. Amended (2026-08-10) - the approved role-neutral child trust policy supersedes the role-based child-permission elements of the Revision below.

> The original 2026-07-17 policy is superseded by the Revision below, whose role-based child-permission elements are in turn superseded by the Amendment's role-neutral child trust policy. The original Context and Decision remain historical record; the runtime (`packages/hermes/`) and canonical directives are the operational source, and the runtime wins.

## Context (original, 2026-07-17)

The orchestrator directive was ported from `@maestria/opencode`, where it is a **pure dispatcher** with no implementation tools because the coding agent implements. On Hermes the orchestrator has **full tool access** (read, write, bash, LLM, delegation), so that mandate forces unnecessary delegation for simple tasks that are faster and more reliable in a single turn.

## Decision (original, 2026-07-17 - historical record)

The Hermes orchestrator defaulted to **single-thread execution**, delegating only for complex tasks: 4+ files with coordinated changes, multi-domain work, risky changes needing a maker/checker split, or an explicit "Maestria mode" request. The orchestrator mandate changed from "Only tools are `delegate_task()` and `question()`. Never implement yourself." to "Default to direct implementation. Only delegate for complex tasks.", via sync replace rules adapting the canonical "pure dispatcher" language. Specialist roles and the mode system were unchanged. (Consequences: fewer turns and no context fragmentation for simple tasks, against sync-replace maintenance and the risk of under-delegation. Both narrowed by the Revision.)

---

## Revision (2026-08-10): Bounded Direct Execution and Role-Gated Delegation

> **Supersession notice.** Items 1-3 and 7-8 (top-level direct access, direct blitz, sonar, review advisory, user-text markers) and their table rows remain current. Items 4-6 (role-gated child delegation), the "Child roles" and "Role source" rows, and the role-based Consequences, Security Boundaries, and Platform Limitations entries are superseded by the Amendment's role-neutral child trust policy, retained here as historical record. The Amendment is the active child policy.

### Context

The original policy assumed the main session's tools were unconstrained and that direct execution was uniformly the default. The implemented runtime and canonical directive distinguish top-level sessions, trusted native child roles, and invalid child state, and apply per-mode allowlists.

### Decision

1. **Trusted top-level sessions retain direct behavior; unknown contexts fail closed.** Trust requires recognized native lifecycle state (session start on a non-child platform, or a host turn-to-session binding); unknown or ambiguous contexts are denied tools. Fein keeps normal direct permissions.
2. **Direct blitz is limited to a literal positive allowlist and fails closed.** In blitz only the reviewed read/research/LLM tools are permitted; write, bash, delegation, and OpenCode routing are blocked. The immutable allowlist is not derived from the general tool categories, so new or renamed tools are denied by default.
3. **Sonar is read/research-only with a literal allowlist and fails closed.** Only the sonar allowlist (read categories plus web fetch/search/extract) is permitted; write, bash, delegation, code execution, and browser interaction are blocked, and unknown tools and aliases are denied by default.
4. **Directive routing of code changes to a permitted builder is policy-level, not mechanical.** _[Superseded in its child-capability part - see Amendment: delegated children can no longer use OpenCode routing; code changes run on a trusted top-level fein session.]_
5. **Trusted native child roles are validated; invalid/ambiguous child state fails closed.** _[Superseded - see Amendment: the role-based `PermissionRole` model is replaced by the fixed role-neutral policy.]_
6. **Child session roles are cleaned up on exit.** _[Superseded - see Amendment: session-to-role mapping is replaced by session-to-trust-state tracking.]_
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

Defense in depth (sonar and direct-blitz allowlists fail closed; unknown tools denied), with scoped mechanical enforcement in the pre-tool-call hook while builder routing stays directive-level. Costs: direct blitz is narrower than expected (even simple edits go through a builder or fein), review stays advisory, allowlists need maintenance as Hermes adds or renames tools, and builder routing is not mechanically enforced. The role-based child entries (spoofing prevention, session-to-role mapping, stop-hook cleanup, role overrides) are superseded by the Amendment and retained above only as marked history. Rollback: revert the direct-session allowlist logic and the code-route-to-builder instruction (the original decision text above documents that state); canonical changes propagate through the sync pipeline (see [ADR-CORE-005](../core/ADR-CORE-005-shared-agent-directives-core-sync.md)) after.

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

Child escalation is eliminated (a native child-role value matching a specialist name no longer grants write/execute/shell/delegate/OpenCode), with a single uniform child surface and spoofing constrained to trusted native lifecycle state. Costs: delegated builders cannot write on Hermes, so implementation falls to a trusted top-level fein session (weakening builder-reviewer separation for code work), and allowlists still require maintenance as Hermes adds or renames tools.

#### Security Boundaries

A child's native role never grants write/execute/shell/delegate/OpenCode capability; user/delegation text never grants capability; ambiguous, invalid, or ended child state fails closed; sonar and direct-blitz allowlists are literal (unknown, renamed, and new tools denied). The former `maestria-roles.json` overrides are no longer loaded, so a stale override cannot re-introduce write capability. Role-specific delegated builder writes stay deferred until Hermes provides an authenticated capability channel provably binding a child to an authorized capability.

#### Platform Limitations

Native delegated-child roles are `leaf`/`orchestrator` topology roles; no native review-state or landing gate exists; enforcement depends on the subagent-start session-to-trust mapping firing (a missed start leaves the child UNKNOWN, which fails closed); tool names are matched literally, so Hermes renames require updating the map.

#### References

- Runtime: the `@maestria/hermes` package (`packages/hermes/`)
- Hermes sync config: `packages/hermes/sync.config.ts` (builder and orchestrator append blocks state the delegation boundary)
- Canonical orchestrator source: `packages/core/agent-directives/specialists/orchestrator.md` (specialist names are routing identities)
- Hermes Agent docs: https://hermes-agent.nousresearch.com/docs
