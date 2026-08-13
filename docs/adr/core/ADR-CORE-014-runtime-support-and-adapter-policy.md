# ADR-CORE-014: Runtime Support and Adapter Policy for Claude Code, Prime Agent, Codex, JCode, and Crush

## Status

Proposed (2026-08-11). This ADR records a decision boundary and support policy, not a shipped implementation. It accompanies the evidence ledger in [runtime-support-matrix.md](../../runtime-support-matrix.md).

No runtime in this ADR is claimed as promoted to `Native`. Package projections and separate CLI marketplace adapters may exist without changing the support level declared here. Promotion requires the gates below and a blind review of these repaired docs; review/promotion gates precede promotion or landing, and the native-candidate implementation may already exist before promotion review.

The package projections and Maestria CLI marketplace adapters described by this policy have since been implemented. Their support levels remain governed by this ADR; implementation does not by itself promote Claude Code or Codex CLI to `Native`.

## Context

Maestria is a behavior layer for AI coding agents. The canonical methodology lives in `packages/core/agent-directives/` and is projected to platform-specific plugins by the core sync pipeline (ADR-CORE-005). The project already ships adapters for OpenCode, Kimi Code, Cursor, Oh My Pi, Pi, and Hermes.

A feasibility review identified five additional runtimes that the community commonly asks about: Claude Code, Prime Agent, Codex (CLI and desktop), JCode, and Crush. Before committing engineering effort, we needed to establish which runtimes have a first-class package or extension API we can target, which only support projections or experiments, and what the security and trust boundaries are for each.

This ADR records the verified findings from sources reviewed on 2026-08-11 (see the evidence ledger for the exact citations and dates) and sets the implementation boundary for the first batch. It deliberately does not assume that any runtime package has been built, released, or verified end to end.

The current upstream evidence is mostly unpinned moving documentation on `main`/`latest`. That documentation is research-only, not production support proof. Every material claim must be reverified before implementation, promotion, or re-promotion, after upstream API or security changes, or within 30 days of the review date.

## Goals

- Record a per-runtime support level using the controlled vocabulary (`Native`, `Native candidate`, `Provisional`, `Deferred`, `Withdrawn`); support levels contain no delivery terms.
- Record the delivery shape (plugin, skills-first, projection) for each runtime, separately from its support level.
- Separate capability status from control/enforcement status for each runtime.
- Establish security and trust boundaries for each runtime, especially which fields or mechanisms are enforced versus advisory.
- Define per-runtime promotion, rollback, withdrawal, and re-promotion rules.
- Define deprecation and reverification triggers so version-sensitive claims are not treated as stable.
- Establish package and sync boundaries consistent with the canonical source invariant (ADR-CORE-005): canonical content stays in core, outputs are per-platform generated.

## Non-Goals

- At the time of the original decision, this ADR did not implement any runtime package. It remains the decision and scope record for the subsequent bounded package projections and CLI adapters.
- It does not modify canonical agent directives or any generated platform output.
- It does not define model-config handlers for these runtimes. CLI installation/version handlers remain a separate concern under ADR-CORE-007; the current adapters only stage packages and invoke host-native marketplace commands.
- It does not make a public-facing support promise. All runtime claims are internal, dated, and version-sensitive.
- It does not reuse `@maestria/pi` for Prime Agent. Prime Agent is built on the Pi ecosystem (it is a Pi-based harness), so reusing the Maestria Pi extension would create a false or conflicting dependency claim.
- It does not claim desktop/local parity for any runtime where parity is unverified.

## Decision

### Controlled vocabulary

Support levels describe how far a runtime has progressed. They contain no delivery terms; delivery shape is recorded separately.

| Term               | Meaning                                                       |
| ------------------ | ------------------------------------------------------------- |
| `Native`           | Shipped first-class adapter whose promotion gates passed      |
| `Native candidate` | Targetable first-class API; not shipped/promoted              |
| `Provisional`      | Bounded experiment with incomplete/version-sensitive evidence |
| `Deferred`         | No implementation in the current batch                        |
| `Withdrawn`        | Removed pending requalification                               |

Capability statuses describe what a runtime can do: `Supported`, `Available`, `Unverified`, `Unavailable`.

Control statuses describe what a runtime actually enforces: `Enforced`, `Trust-gated`, `Ignored`, `Advisory`, `Not a sandbox`, `Unsupported`.

Capability and control are separate. A capability being present does not make it a security control. Skills, MCP, plugin loading, subagents, and JSON/RPC are never labeled security `Enforced`; `Enforced` is reserved for actual control mechanisms.

### Decision baseline per runtime

The following table states the support level, the delivery shape, and the disposition for each runtime. Full evidence is in [runtime-support-matrix.md](../../runtime-support-matrix.md).

The `Evidence ID` values in these tables (and in the capability/control tables below) are the traceability link to complete evidence records in the matrix - each record states the runtime/surface, claim, pinned state, source URL/path, review date, and test status. Section headings in the matrix do not provide implicit metadata; every claim is verified against its evidence record, never inferred from a heading.

| Runtime | Support level | Delivery | Disposition | Rationale | Evidence ID |
| --- | --- | --- | --- | --- | --- |
| Claude Code | Native candidate | Plugin | candidate native plugin | Promotion gated on approved docs and a blind review | E-CLAUDE-01 |
| Prime Agent | Native candidate | Skills-first | executable extension deferred | Skills-first delivery; executable extension deferred until API/security verification | E-PRIME-01 |
| Codex CLI | Provisional | Projection | projection-plugin spike | Bounded projection/plugin spike; pin the exact CLI version before relying on it | E-CODEX-CLI-01 |
| Codex desktop | Deferred | Common-subset projection | no CLI parity | Common-subset projection only; no CLI parity claim | E-CODEX-DESKTOP-01 |
| JCode | Deferred | Projection | Deferred - projection/experiment only | No confirmed first-class package/extension API | E-JCODE-01 |
| Crush | Deferred | Projection | Deferred - projection/experiment only | No confirmed first-class package/extension API | E-CRUSH-01 |

### Principle: canonical source, per-platform output

All canonical methodology remains in `packages/core/agent-directives/`. Any adapter is a generated projection produced by the core sync pipeline (ADR-CORE-005). Runtime-specific derivation (frontmatter, file layout, skill names) is owned by each package's `sync.config.ts`, never by hand-edited copies. CLI installation/version handlers and model-config handlers remain separate concerns; the current Claude Code and Codex CLI handlers do not write host configuration.

### Security and trust boundaries (capability vs control)

The feasibility review surfaced mandatory gaps that must be stated explicitly so implementers do not rely on mechanisms the runtime ignores or does not enforce.

| Runtime | Mechanism | Capability status | Control status | Implication for Maestria | Evidence ID |
| --- | --- | --- | --- | --- | --- |
| Claude Code | Plugin-subagent `hooks`, `mcpServers`, `permissionMode` frontmatter | `Unavailable` | `Ignored` | Do not rely on plugin-subagent frontmatter for enforcement; use project/user agent files or permission rules if that behavior is required | E-CLAUDE-07 |
| Claude Code | Matching `PreToolUse` hook handler returning `hookSpecificOutput.permissionDecision: "deny"` | `Supported` | `Enforced` | Can block the matched call conditionally on event, matcher, handler, decision format, and active installation scope; best-effort `if` filters can fail open | E-CLAUDE-04 |
| Claude Code | Plugin `hooks/hooks.json` resource | `Supported` | `Advisory` | Supported shareable resource, but presence alone is not enforcement; matching blocking handler required | E-CLAUDE-05 |
| Claude Code | `@maestria/claude-code` first package hook resources and handlers | `Unavailable` | `Advisory` | Package ships no `hooks/` directory and no package-level hook enforcement; this does not downgrade runtime/plugin capability | E-CLAUDE-08 |
| Codex CLI | Non-managed command hooks | `Supported` | `Trust-gated` | Use command-only hooks as the reliable path; expect a trust review flow for non-managed hooks | E-CODEX-CLI-03 |
| Codex CLI | Managed hook policy and trust-bypass exception | `Supported` | `Advisory` | Managed hooks are trusted by managed policy; the documented trust-bypass configuration is an explicit security exception, not an enforcement path. The policy/exception is not itself a universal enforcement claim | E-CODEX-CLI-05, E-CODEX-CLI-06 |
| Codex CLI | `prompt` and `agent` hook handlers | `Unavailable` | `Unsupported` | Parsed, not executed | E-CODEX-CLI-04 |
| Codex CLI | Plugins, skills, subagents, AGENTS.md | `Supported` | `Advisory` | Documented surfaces; presence is not enforcement | E-CODEX-CLI-02 |
| Prime Agent | Execution (skills, subagent dispatch, JSON/RPC headless) | `Supported` | `Not a sandbox` | Do not claim Prime provides sandboxing; restrict to trusted repositories and skills | E-PRIME-01, E-PRIME-02, E-PRIME-06, E-PRIME-07 |
| Crush | Config (`crushrc`/`crush.json`) | `Supported` | `Not a sandbox` | Config is trusted code; review before launching | E-CRUSH-04 |
| Crush | Top-level `PreToolUse` hooks | `Unavailable` | `Advisory` | Preliminary; incomplete subagent enforcement; do not claim hook-based subagent enforcement | E-CRUSH-05 |
| Crush | Skills discovery and MCP | `Supported` | `Advisory` | Agent Skills standard and MCP (stdio, http, sse); presence is not enforcement | E-CRUSH-01 |

Codex hook trust is not uniform: only non-managed command hooks are `Trust-gated` (E-CODEX-CLI-03 covers the non-managed trust review flow), while managed hooks are trusted by managed policy (E-CODEX-CLI-05) and a documented trust-bypass configuration exists that is an explicit security exception (E-CODEX-CLI-06). The managed-hook and trust-bypass distinction is drawn from the same reviewed hooks source that E-CODEX-CLI-03 and E-CODEX-CLI-04 cite (see [runtime-support-matrix.md](../../runtime-support-matrix.md)).

### Scope of the first batch

The first implementation batch covers Claude Code (`Native candidate`, plugin) as the primary candidate, pending promotion/landing gates (approved docs and a blind review), with Prime Agent (`Native candidate`, skills-first) as a secondary candidate pending API/security verification. Codex CLI remains `Provisional`; Codex desktop, JCode, and Crush remain `Deferred` targets. The separate CLI adapters do not promote any runtime or claim desktop parity.

## Consequences

### Positive

- Clear, evidence-backed decision boundary that prevents scope creep across five runtimes at once.
- Support levels use a controlled vocabulary with no delivery terms, so "supported" and "shipped" cannot be confused.
- Capability status is separated from control status, so a documented surface is not mistaken for an enforced security control.
- Version-sensitive and trust-sensitive claims are labeled with review dates and test status, so implementers and reviewers do not treat unverified behavior as stable.
- The canonical-source invariant is preserved: no runtime adapter duplicates canonical content by hand.
- Security gaps (ignored plugin-subagent fields, non-sandbox execution, trust-gated hooks) are explicit rather than discovered mid-implementation.

### Negative

- JCode and Crush have no confirmed first-class package/extension distribution API; only projection/experiment scope is offered (`Deferred`).
- Codex support is version-sensitive and split between CLI and desktop; the desktop surface gets a common-subset projection only, with no CLI parity claim (`Deferred`).
- Prime Agent's executable extension is deferred until API/security verification, so its near-term delivery is skills-first only.
- Documentation alone cannot enforce the boundary; reviewers must check that implementation stays within the stated scope.

## Alternatives Considered

### Option A: Treat all five runtimes as `Native`

Rejected because the verified evidence does not support it. JCode and Crush have no confirmed first-class package/extension distribution API, and Prime Agent's security model is not a sandbox. Claiming `Native` support for all five would overpromise and violate the non-goal of avoiding unsupported public promises.

### Option B: Reuse `@maestria/pi` for Prime Agent

Rejected because Prime Agent is a Pi-based harness. Shipping Maestria's Pi extension under a Prime Agent package would create a false or conflicting dependency claim and blur the package boundary.

### Option C: Ship all adapters in a single batch

Rejected in favor of bounded batches. The decision boundary in this ADR is the scope of the documentation batch; implementation is delegated per runtime as a separate bounded batch, starting with Claude Code.

## Promotion Gates

A runtime moves from `Provisional`/`Deferred`/`Native candidate` to a shipped `Native` adapter only when all of the following hold:

1. The runtime exposes a first-class package or extension API that Maestria can target (confirmed against current official docs, not an earlier review).
2. The security and trust model is verified: enforcement boundaries are known, and no ignored fields are relied on.
3. The upstream evidence for every material claim has been reverified against a pinned release/version, an immutable commit, or a fixed docs revision.
4. A generated projection exists via the core sync pipeline, and `scripts/check-sync` passes.
5. Desktop/local parity, where claimed, is verified; otherwise no parity claim is made.
6. The runtime-specific `sync.config.ts` and package boundaries are defined and reviewed.

## Per-runtime lifecycle rules

| Runtime | Promotion | Rollback | Withdrawal | Re-promotion |
| --- | --- | --- | --- | --- |
| Claude Code | Approved docs (blind review), then a plugin package via the core sync pipeline, `scripts/check-sync` passes, promotion gates verified | Revert the generated projection/package; canonical content stays in core | Downgrade or remove support, delivery, capability, and control claims | Only after the promotion gates are re-verified |
| Prime Agent | Verify a stable supported API for the executable extension; skills-first package via the sync pipeline; `check-sync` passes | Revert the generated package | Replace or remove claims; the executable extension stays deferred until verified | Only after re-verification |
| Codex CLI | Pin the exact CLI version, verify the trust flow, projection via the sync pipeline, `check-sync` passes | Remove the projection/plugin spike | Downgrade or remove claims; keep `Provisional`, `Deferred`, or `Withdrawn` | Only after the version and evidence are re-verified |
| Codex desktop | Separate from CLI; verify a desktop extension surface exists first | Remove the common-subset projection | Downgrade or remove parity-adjacent claims | Only after the desktop surface is re-verified |
| JCode | Requires a confirmed first-class package/extension distribution API | Remove the projection | Remove claims; keep `Deferred` | Only after the API is confirmed |
| Crush | Requires a confirmed first-class API and verified hooks | Remove the projection | Remove claims; keep `Deferred` | Only after the API is confirmed |

### Withdrawal

Withdrawal downgrades or removes a runtime's claims (support level, delivery, capability, and control). There is no automatic re-promotion. Re-promotion requires the promotion gates to be re-verified against current, pinned upstream evidence.

## Deprecation and Reverification Triggers

- Any runtime whose official API changes such that the recorded shape or trust model is stale triggers reverification before further work.
- Any finding that a mechanism we marked as enforced is actually advisory (or vice versa) triggers an update to this ADR and the evidence ledger.
- Version-sensitive claims are re-dated on each review; a claim older than the runtime's current documented state is not treated as current.
- Upstream docs on `main`/`latest` are research-only. Reverify any material claim before implementation, promotion, or re-promotion, after upstream API or security changes, or within 30 days of the review date.

## Related Decisions

- ADR-CORE-002 (plugin architecture) - the pure plugin, markdown agents, hooks pattern that Claude Code's plugin shape aligns with.
- ADR-CORE-005 (shared agent directives core sync) - establishes the canonical-source, per-platform generated output invariant this ADR relies on.
- ADR-CORE-007 (CLI package for plugin management) - CLI host adapters are separate from runtime support promotion and use native marketplace commands.
- ADR-CORE-008 (CLI dependency bundling) - dependency policy applies to any future adapter package.
- ADR-PI-000 and ADR-PI-001 - Prime Agent is Pi-based, so `@maestria/pi` is not reused for it (see Non-Goals).

## References

Sources reviewed on 2026-08-11 are cited with URLs, review dates, test status, and pinned/unpinned state in [runtime-support-matrix.md](../../runtime-support-matrix.md). Those sources are research-only and must be reverified before implementation, promotion, or re-promotion.

## Date

2026-08-11
