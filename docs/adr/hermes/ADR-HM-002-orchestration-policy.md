# ADR-HM-002: Hermes Orchestrator Policy - Direct Default, Bounded Modes, Role-Neutral Child Trust

> **Title note (2026-08-10; successor named 2026-09-28).** The original title named the role-based child-permission model in the Revision below; that model is superseded by the role-neutral policy in [ADR-HM-004](ADR-HM-004-role-neutral-child-trust-policy.md), which the title now reflects. "Role-Gated Delegation" survives only as a historical marker in the Revision.

## Status

Accepted (2026-07-17). Revised (2026-08-10) - supersedes the single-thread default and unrestricted main-session tool access described in the original decision below. Amended (2026-08-10) - the approved role-neutral child trust policy supersedes the role-based child-permission elements of the Revision below. The Amendment that carried that policy has moved to [ADR-HM-004](ADR-HM-004-role-neutral-child-trust-policy.md) (2026-09-28); this record keeps its comparison table and security boundaries.

> The original 2026-07-17 policy is superseded by the Revision below, whose role-based child-permission elements are in turn superseded by the role-neutral child trust policy in [ADR-HM-004](ADR-HM-004-role-neutral-child-trust-policy.md). The original Context and Decision remain historical record; the runtime (`packages/hermes/`) and canonical directives are the operational source, and the runtime wins.

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

## What this supersedes

Retained from the 2026-08-10 Amendment, because it states the relation between the Revision above and the policy that replaced it. That policy is decided in [ADR-HM-004](ADR-HM-004-role-neutral-child-trust-policy.md).

| Aspect | Revision (2026-08-10) | Amendment (2026-08-10, now ADR-HM-004) |
| --- | --- | --- |
| Child role identity | Native child role matched to specialist names; matches got that specialist's tools | Native roles are `leaf`/`orchestrator` topology only; specialist names are routing identities, not tool grants |
| Builder child write | `builder` children could write, run bash, delegate, and route to OpenCode | Deferred until an authenticated capability channel exists; children are read/research/LLM-only |
| Child tool policy | Role-specific tool sets | Fixed read/research/LLM-only for all children |
| Capability source | Native child-role string | Trusted native lifecycle only; text never grants capability |

## Security Boundaries

Retained because they constrain the parts of this record that remain in force, not only the policy that moved to [ADR-HM-004](ADR-HM-004-role-neutral-child-trust-policy.md).

A child's native role never grants write/execute/shell/delegate/OpenCode capability; user/delegation text never grants capability; ambiguous, invalid, or ended child state fails closed; sonar and direct-blitz allowlists are literal (unknown, renamed, and new tools denied). The former `maestria-roles.json` overrides are no longer loaded, so a stale override cannot re-introduce write capability. Role-specific delegated builder writes stay deferred until Hermes provides an authenticated capability channel provably binding a child to an authorized capability.

The runtime is the authority on whether each boundary is mechanically enforced or merely configured. Verify it against the `@maestria/hermes` package rather than against this text.

## Supersession

The Approved Role-Neutral Child Trust Policy that this record carried from 2026-08-10 is now [ADR-HM-004](ADR-HM-004-role-neutral-child-trust-policy.md), extracted on 2026-09-28 under [ADR-CORE-030](../core/ADR-CORE-030-adr-immutability-and-supersession.md) because it decides a subject other than this record's. This record keeps its original context, decision, consequences, and date. ADR-HM-004 holds the decision itself, its rationale, and its negative consequences.

Frozen text above that says "the Amendment" means the policy recorded in ADR-HM-004. The Revision's supersession notice, the comparison table, and the security boundaries above are retained in substance for exactly that reason.
