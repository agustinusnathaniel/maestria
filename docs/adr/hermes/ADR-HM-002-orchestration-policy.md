# ADR-HM-002: Hermes Orchestrator Policy - Direct Default, Bounded Modes, Role-Neutral Child Trust

> **Title note (2026-08-10).** This ADR was originally titled "...Role-Gated Delegation" after the role-based child-permission model it first recorded. That model is superseded by the approved role-neutral child trust policy in [Amendment (2026-08-10)](#amendment-2026-08-10-approved-role-neutral-child-trust-policy); the title now reflects the active role-neutral policy. The "Role-Gated Delegation" phrasing survives only as a historical marker in the [Revision (2026-08-10)](#revision-2026-08-10-bounded-direct-execution-and-role-gated-delegation) section below.

## Status

Accepted (2026-07-17). Revised (2026-08-10) - supersedes the single-thread default and unrestricted main-session tool access described in the original decision below. Amended (2026-08-10) - the approved role-neutral child trust policy supersedes the role-based child-permission elements of the Revision below.

> The original 2026-07-17 policy ("orchestrator defaults to single-thread, all main-session tools pass through `pre_tool_call`") is superseded by the implemented policy documented in [Revision (2026-08-10)](#revision-2026-08-10-bounded-direct-execution-and-role-gated-delegation). The Revision's role-based child-permission elements are in turn superseded by the approved role-neutral child trust policy in [Amendment (2026-08-10)](#amendment-2026-08-10-approved-role-neutral-child-trust-policy). The original Context and Decision remain as historical record. The runtime and canonical directives are the operational source; where this ADR disagrees with them, the approved policy governs and the runtime wins for what is actually enforced.

## Context (original, 2026-07-17)

The Maestria orchestrator SKILL.md was ported from `@maestria/opencode`, where the orchestrator is a **pure dispatcher** with no implementation tools — its only actions are `task()` (delegate) and `question()` (ask the user). This design works for OpenCode because the coding agent handles implementation.

On Hermes Agent, the orchestrator has **full tool access** (read, write, bash, LLM, delegation). The "pure dispatcher" mandate is actively harmful because it forces unnecessary `delegate_task()` calls for simple tasks that could be done faster and more reliably in a single turn.

## Decision

The Hermes orchestrator defaults to **single-thread execution**. It uses `delegate_task()` to spawn specialists only for complex tasks that benefit from parallelization or focused expertise:

- 4+ files requiring coordinated changes
- Multi-domain work (e.g., frontend + backend + docs)
- Risky changes needing maker/checker split
- Explicit "Maestria mode" requested by the user

### What changed

| Layer | Before | After |
| --- | --- | --- |
| Orchestrator SKILL.md | "Only tools are delegate_task() and question(). Never implement yourself." | "Default to direct implementation. Only delegate for complex tasks." |
| `pre_llm.py` fein context | "All stages execute. Maker/checker split applies." | "Default: single-thread execution. Maker/checker split applies when delegation is used." |
| `sync.config.ts` | No replace rules for orchestrator mandate | 5 replace rules adapting canonical "pure dispatcher" language for Hermes |
| `permissions.py` | Unchanged — orchestrator role already allows full access when no role mapping | No change needed |

### What did NOT change

- **Specialist roles** (adventurer, builder, reviewer, etc.) — unchanged. They still describe their roles correctly for when delegation IS used.
- **Mode system** (fein/sonar/blitz) - unchanged. Semantics are now enforced by the runtime (see Revision below).
- **Permission enforcement** - as originally written this was a no-op for the main session: the main session has no role mapping, so all tools passed through `pre_tool_call`. This is now superseded - see [Revision (2026-08-10)](#revision-2026-08-10-bounded-direct-execution-and-role-gated-delegation), which adds direct-session allowlists in sonar/blitz and role-gated access for delegated child sessions.

## Consequences (original, 2026-07-17)

### Positive

- Simple tasks complete in fewer turns (no subagent overhead)
- No context fragmentation for straightforward changes
- Existing delegation infrastructure still available for complex tasks

### Negative

- Orchestrator skill diverges from canonical `@maestria/opencode` source — sync replaces must be maintained
- Developers may over-rely on single-thread and not delegate when beneficial

These consequences still apply to direct fein work. The Revision below narrows them.

---

## Revision (2026-08-10): Bounded Direct Execution and Role-Gated Delegation

> **Supersession notice.** This Revision records the policy implemented as of 2026-08-10. Its top-level-direct, direct-blitz, sonar, review-advisory, and user-text-marker elements (items 1-3, 7-8 and the matching table rows below) remain current. Its **role-based child-permission elements are superseded** by the approved role-neutral child trust policy in [Amendment (2026-08-10)](#amendment-2026-08-10-approved-role-neutral-child-trust-policy): items 4-6 (role-gated child delegation), the "Child roles" and "Role source" table rows, and the role-based Consequences, Security Boundaries, and Platform Limitations entries. They are retained here as historical record of the implemented role-based model; the Amendment is the active child policy.

### Context

The original policy assumed the main session's tools pass through `pre_tool_call` unconstrained and that direct execution is uniformly the default. The implemented runtime and the canonical orchestrator directive now distinguish top-level sessions, trusted native child roles, and invalid child state, and apply per-mode allowlists. This Revision records that implemented policy so the ADR matches runtime and canonical behavior.

### Decision

The implemented policy (see `packages/hermes/src/maestria_hermes/` and `packages/core/agent-directives/specialists/orchestrator.md`):

1. **Trusted top-level sessions retain direct behavior; unknown contexts fail closed.** A session is trusted as direct/top-level only from native lifecycle state: `on_session_start` recorded it on a non-child platform, or the host bound the turn's `task_id` to the `session_id` (the CLI/gateway top-level turn binding). Only such sessions keep normal direct access. A session with no trusted child-role mapping is not automatically direct - an unmapped or ambiguous context is denied tools rather than inheriting direct permissions. In fein, a trusted top-level session retains its normal direct permissions; its tools are not restricted by the role hook. This preserves the original single-thread direct default for ordinary top-level work.

2. **Direct blitz is limited to a literal positive allowlist and fails closed.** A trusted top-level session in blitz may only use the reviewed read/research/llm tools (`BLITZ_DIRECT_ALLOWED_TOOLS`: read categories, llm, webfetch/web_search/web_extract). Everything else - including write, bash, delegation, and `opencode_route` - is blocked. The allowlist is a literal immutable frozenset, deliberately not derived from `TOOL_CATEGORIES`, so new or renamed tools are denied by default. Code changes cannot be made directly in blitz. This boundary is enforced mechanically by `pre_tool_call`.

3. **Sonar is read/research-only with a literal allowlist and fails closed.** `SONAR_ALLOWED_TOOLS` (read categories plus webfetch/web_search/web_extract) is the only set permitted; write, bash, delegation, code execution, and browser interaction tools are blocked. Like the blitz list, it is a literal immutable frozenset written and re-reviewed by hand; unknown tools and aliases are denied by default. This boundary is enforced mechanically by `pre_tool_call`.

4. **Directive routing of code changes to a permitted builder is policy-level, not mechanical.** _[Superseded in its child-capability part - see [Amendment](#amendment-2026-08-10-approved-role-neutral-child-trust-policy): a delegated child can no longer use `opencode_route`; code changes run on a trusted top-level fein session.]_ The orchestrator directive and Hermes-specific skill notes instruct code changes to flow through `delegate_task()` to a permitted `builder`, and the builder may use the registered `opencode_route` tool to delegate complex coding to OpenCode CLI. These routing instructions are directive guidance. Hermes does not mechanically block direct fein code changes; direct fein retains normal direct permissions. What Hermes enforces mechanically is the sonar and direct-blitz tool boundaries and the child-role restrictions described above.

5. **Trusted native child roles are validated; invalid/ambiguous child state fails closed.** _[Superseded - see [Amendment](#amendment-2026-08-10-approved-role-neutral-child-trust-policy): the role-based `PermissionRole` model below is replaced by the fixed role-neutral child policy.]_ Specialist roles are sourced only from the native `subagent_start` lifecycle `child_role` value, matched against the fixed `SUPPORTED_SPECIALIST_ROLES` set (the seven canonical names). Roles are not derived from user or task text. A child with a valid role gets that role's `PermissionRole` tool set. An invalid or ambiguous child lifecycle value (unknown role, missing/empty/non-string session id or role) maps to `INVALID_ROLE`, which blocks all tools - it can never fall through to direct permissions.

6. **Child session roles are cleaned up on exit.** _[Superseded - see [Amendment](#amendment-2026-08-10-approved-role-neutral-child-trust-policy): the session-to-role mapping is replaced by session-to-trust-state tracking.]_ When a subagent stops, its session-to-role mapping is cleared (`clear_role_for_session` in `_on_subagent_stop`), so a finished child cannot retain permissions. A `forget_trusted_top_level_session` helper exists to drop a trusted-top-level marker, but it is not currently wired to a lifecycle hook - `on_session_end` only logs. Cleanup therefore depends on the `subagent_stop` lifecycle hook firing correctly.

7. **Review/landing enforcement is advisory.** Hermes has no native review-state or landing gate. `pre_tool_call` enforces direct-blitz tool safety, sonar read-only behavior, and role-based child access, but there is no hard gate that forces a reviewer pass or blocks landing. The orchestrator directive and Hermes-specific notes instruct that reviewer dispatch for non-trivial builder work is expected; enforcement of that expectation is procedural (directive guidance), not mechanical.

8. **User text role markers are not trusted.** Role context comes exclusively from the trusted native lifecycle mapping. `[MAESTRIA_ROLE: ...]` or similar markers in user messages are ignored; they neither create a role mapping nor relax the direct-session allowlists.

#### What changed (relative to the 2026-07-17 decision)

| Layer | Original (2026-07-17) | Implemented (2026-08-10) |
| --- | --- | --- |
| Direct default | Single-thread direct; all main tools pass through | Direct only for trusted top-level sessions; unknown/ambiguous contexts fail closed. Fein retains normal direct access; blitz restricted to allowlist; sonar read-only |
| Direct blitz | Not gated | Literal positive allowlist, fails closed; no code changes |
| Code changes | Orchestrator may implement directly | Policy-level: directive routes code changes through a permitted `builder` via `delegate_task()` (not mechanically enforced) |
| Sonar | "No changes made" (advisory) | Literal allowlist blocks write/bash/delegate; fails closed |
| Child roles | Not tracked for permissions | _[Superseded - see Amendment]_ Trusted `subagent_start` mapping, fixed seven-role set, fail-closed on invalid, role cleared on exit |
| Review/landing | Not addressed | Advisory (no native Hermes gate) |
| Role source | Not addressed | _[Superseded - see Amendment]_ Native lifecycle only; user text markers ignored |

#### Consequences

##### Positive

- **Defense in depth** - sonar and direct-blitz allowlists fail closed; unknown tools are denied by default rather than silently allowed
- **Tool-boundary enforcement is scoped and mechanical** - `pre_tool_call` enforces the sonar and direct-blitz tool boundaries and child-role restrictions; the builder routing of code changes is directive-level policy
- **Child-role spoofing is prevented** - _[superseded - see Amendment]_ roles come from trusted lifecycle state, invalid child state cannot fall through to direct permissions, and roles are cleared on child exit
- **Consistent with canonical directives** - the Hermes-specific notes and the canonical orchestrator both describe the same policy-level routing and role-gated behavior

##### Negative

- **Direct blitz is narrower than some users expect** - it cannot make even simple edits; that work must go through a builder or fein
- **Review is advisory** - without a native gate, a non-compliant agent can skip reviewer dispatch; enforcement depends on the directive and operator discipline
- **Allowlists require maintenance** - `SONAR_ALLOWED_TOOLS` and `BLITZ_DIRECT_ALLOWED_TOOLS` must be updated as Hermes adds or renames read/research tools, or the behavior narrows further
- **Builder routing is not mechanically enforced** - direct fein retains normal direct permissions, so code-change routing relies on directive guidance rather than a hard gate

##### Security Boundaries

- Role permission is scoped to trusted native `subagent_start` lifecycle values only; user message text and direct-session markers are never a role source _[superseded - see Amendment]_
- Invalid child lifecycle state (unknown role, missing/non-string session id or role) always maps to `INVALID_ROLE` and blocks all tools - it can never be treated as a direct or valid session _[superseded - see Amendment]_
- Only positively-identified trusted top-level sessions keep direct access; a session with no role mapping that is also not trusted as top-level fails closed rather than inheriting direct or specialist permissions
- The allowlists are positive and literal: tools not explicitly listed are denied in sonar and direct-blitz, including aliases and tools added or renamed after review

##### Platform Limitations

- Hermes provides no native review-state or landing gate; review/landing enforcement is advisory (directive-level) rather than mechanically enforced
- `pre_tool_call` receives no `child_role`; the session-to-role mapping populated by `subagent_start` is the workaround, so enforcement depends on the lifecycle hook firing correctly _[superseded - see Amendment]_
- Session cleanup depends on the `subagent_stop` hook: `clear_role_for_session` runs in `_on_subagent_stop`; a missed hook can leave a stale role mapping. `forget_trusted_top_level_session` exists but is not wired to any lifecycle hook _[superseded - see Amendment]_
- Role overrides in `~/.hermes/maestria-roles.json` can widen a role's categories; users own this file _[superseded - see Amendment]_
- Tool names in `TOOL_CATEGORIES`, `SONAR_ALLOWED_TOOLS`, and `BLITZ_DIRECT_ALLOWED_TOOLS` are matched literally - Hermes tool renames require updating the relevant map or the tools silently become unavailable/blocked

##### Rollback / Reversion

- To restore the original single-thread unrestricted behavior, revert the direct-session allowlist logic in `pre_tool.py` (`BLITZ_DIRECT_ALLOWED_TOOLS`, `SONAR_ALLOWED_TOOLS`) and remove the code-route-to-builder instruction from the orchestrator skill notes (`packages/hermes/sync.config.ts` `orchestrator.md` append block). The original decision text above documents that state.
- Reverting the child-role mapping (`session.py`, `_on_subagent_start` in `__init__.py`) removes role-gated child permissions and restores the pre-Revision behavior where child sessions were not distinguished from direct sessions.
- Canonical changes to `orchestrator.md` propagate through `scripts/sync-all`; always run `scripts/check-sync` after reverting or changing the skill notes.

##### References

- ADR-HM-001: `/goal` integration decision
- PR #89: Original single-thread orchestration policy (2026-07-17)
- Revision (2026-08-10): implemented with `packages/hermes/src/maestria_hermes/permissions.py`, `session.py`, `hooks/pre_tool.py`, `hooks/pre_llm.py`, `__init__.py`, `tools/opencode.py`
- Canonical orchestrator source: `packages/core/agent-directives/specialists/orchestrator.md`
- Hermes sync config: `packages/hermes/sync.config.ts` (orchestrator and builder `append` blocks)
- Hermes Agent docs: https://hermes-agent.nousresearch.com/docs

---

## Amendment (2026-08-10): Approved Role-Neutral Child Trust Policy

### Context

The [Revision (2026-08-10)](#revision-2026-08-10-bounded-direct-execution-and-role-gated-delegation) above documented a role-based child model in which the native `subagent_start` `child_role` value is matched against the seven Maestria specialist names and each matched child is granted that specialist's `PermissionRole` tool set - so a `builder` child received full write/bash/coding/`opencode_route` access. That model treated Hermes' native `child_role` as if it carried a Maestria specialist identity.

That assumption does not hold. Hermes' native delegated-child roles are `leaf` and `orchestrator` topology roles only; they are not Maestria specialist identities, and Hermes provides no authenticated channel that binds a delegated child to a Maestria specialist with write capability. Granting a write-capable `builder` child based on a native `child_role` string is therefore an unsupported capability grant. This Amendment records the approved role-neutral child trust policy that supersedes the role-based child-permission elements of the Revision.

### Decision (Approved Policy)

1. **Native Hermes child roles are topology roles, not Maestria specialists.** A delegated child's native role is `leaf` (default) or `orchestrator` only. The seven Maestria specialist names (adventurer, architect, builder, diagnose, planner, reviewer, writer) are methodology routing identities for the orchestrator directive. They are not tool-granting child identities on Hermes.

2. **User/delegation text cannot grant capabilities.** Capabilities come only from trusted native lifecycle state. `[MAESTRIA_ROLE: ...]`-style markers in user or delegation text neither create a role mapping nor relax any allowlist.

3. **Delegated children receive a fixed read/research/LLM-only policy.** A delegated child may use read/research tools and LLM reasoning only. It cannot write, execute code, run a shell, delegate further, or invoke OpenCode (`opencode` or `opencode_route`). This is the role-neutral child boundary: the same limited policy applies regardless of which specialist name the orchestrator routes to.

4. **Top-level direct sessions retain normal direct behavior only with trusted native binding.** A session is trusted as direct/top-level only from recognized native lifecycle state: `on_session_start` on a recognized non-child platform, or a validated `task_id == session_id` binding. Ambiguous, invalid, or ended child state fails closed - it never inherits direct or write access.

5. **Sonar and direct blitz have literal positive allowlists that fail closed.** `SONAR_ALLOWED_TOOLS` and `BLITZ_DIRECT_ALLOWED_TOOLS` are literal immutable sets; unknown, renamed, and new tools are denied by default.

6. **Review/landing enforcement is advisory.** Hermes provides no native review-state or landing gate. Reviewer dispatch for non-trivial work is directive guidance, not mechanical enforcement.

7. **Lifecycle: session end is per-turn and resumable; finalize/reset/subagent stop are terminal trust boundaries.** A stopped or ended child has its role and trust cleared; a reused id starts clean and must be re-established by a fresh trusted lifecycle event.

8. **Role-specific delegated builder writes are deferred until Hermes provides an authenticated capability channel.** Until such a channel exists, delegated children do not receive write/execute/shell/delegate/OpenCode capability. Code changes on Hermes are performed by a trusted top-level fein session under its direct-access boundary, not by a delegated `builder` child.

#### What this supersedes

| Aspect | Revision (2026-08-10) | Amendment (2026-08-10) |
| --- | --- | --- |
| Child role identity | Native `child_role` matched to Maestria specialist names; matched child gets that specialist's `PermissionRole` | Native child roles are `leaf`/`orchestrator` topology only; specialist names are routing identities, not tool grants |
| Builder child write | A `builder` child may write/bash/delegate/`opencode_route` in fein | Deferred until an authenticated capability channel exists; children are read/research/LLM-only |
| Child tool policy | Role-specific `PermissionRole` sets | Fixed role-neutral read/research/LLM-only policy for all children |
| Capability source | Native `child_role` string | Trusted native lifecycle only; user/delegation text never grants capability |

#### Enforcement status (runtime as authority)

- **Mechanical in the current runtime:** trusted-top-level fail-closed classification (`pre_tool.py`, `session.py`), the sonar and direct-blitz literal allowlists and the role-neutral `CHILD_SAFE_ALLOWED_TOOLS` set (`permissions.py`), user-text markers being ignored, per-turn `on_session_end` preserving resumable trust, and terminal trust cleanup on `on_session_finalize`, session reset, and `subagent_stop`.
- **The role-neutral child boundary is mechanically enforced:** the legacy role-based child path is removed. `_on_subagent_start` validates the native `child_role` against `NATIVE_CHILD_ROLES` (`leaf`/`orchestrator`) and records it as topology trust state only; `pre_tool_call` grants every delegated child the fixed read/research/LLM-only `CHILD_SAFE_ALLOWED_TOOLS` policy (never write/execute/shell/delegate/OpenCode). `permissions.py` no longer loads `maestria-roles.json`, and `sync.config.ts` (builder `append`) states the delegation boundary instead of granting write/`opencode_route`.

#### Consequences

##### Positive

- **Child escalation is eliminated** - a delegated child cannot gain write/execute/shell/delegate/OpenCode capability by a native `child_role` value that happens to match a specialist name
- **Single, uniform child surface** - all delegated children share one limited read/research/LLM-only policy, so there is no per-role child attack surface to maintain
- **Spoofing is further constrained** - user/delegation text can never grant capability, and only trusted native lifecycle state establishes top-level or child context

##### Negative

- **Delegated builders cannot write on Hermes** - until an authenticated capability channel exists, the maker/checker pipeline's delegated `builder` step cannot perform code changes; implementation must be done by a trusted top-level fein session, which weakens the builder-reviewer separation for code work on Hermes
- **Allowlists still require maintenance** - `SONAR_ALLOWED_TOOLS`, `BLITZ_DIRECT_ALLOWED_TOOLS`, and `CHILD_SAFE_ALLOWED_TOOLS` must be re-reviewed as Hermes adds or renames read/research tools

##### Security Boundaries

- A delegated child's native role never grants write/execute/shell/delegate/OpenCode capability; only an authenticated capability channel (future) may do so
- User/delegation text never grants capability; capability source is trusted native lifecycle state only
- Ambiguous, invalid, or ended child state fails closed and never inherits direct or write access
- Sonar and direct-blitz allowlists are literal and positive; unknown/renamed/new tools are denied by default

##### Platform Limitations

- Hermes' native delegated-child roles are `leaf`/`orchestrator` topology roles; there is no native authenticated channel binding a child to a Maestria specialist write capability
- Hermes provides no native review-state or landing gate; review/landing enforcement is advisory
- `pre_tool_call` receives no `child_role`; the session-to-trust-state mapping populated by `subagent_start` is the workaround, so enforcement depends on the lifecycle hook firing correctly. A missed `subagent_start` leaves the child UNKNOWN and it fails closed
- `maestria-roles.json` role overrides are no longer loaded: delegated children are always held to `CHILD_SAFE_ALLOWED_TOOLS`, so a stale override file cannot re-introduce write capability for children

##### Future Capability-Channel Requirement

Role-specific delegated builder writes are deferred until Hermes provides an authenticated capability channel - a mechanism by which a delegated child is provably bound to an authorized capability (for example write) rather than relying on a native `child_role` string or user text. Until that channel exists, delegated children remain read/research/LLM-only, and this policy stands.

#### References

- [Revision (2026-08-10)](#revision-2026-08-10-bounded-direct-execution-and-role-gated-delegation) - the implemented role-based model this Amendment supersedes
- Runtime: `packages/hermes/src/maestria_hermes/permissions.py`, `session.py`, `__init__.py`, `hooks/pre_tool.py`
- Hermes sync config: `packages/hermes/sync.config.ts` (builder and orchestrator `append` blocks state the delegation boundary)
- Canonical orchestrator source: `packages/core/agent-directives/specialists/orchestrator.md` (specialist names are routing identities)
- Hermes Agent docs: https://hermes-agent.nousresearch.com/docs
