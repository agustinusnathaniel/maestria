# ADR-CORE-014: Evidence-Backed Runtime Support and Adapter Policy

## Status

Accepted (2026-08-11), Confidence: High. Consolidated 2026-10-03. The [runtime support matrix](../../runtime-support-matrix.md) owns dated runtime dispositions, pinned source evidence, and verification limits; this record owns the policy behind those claims.

## Context

A feasibility review considered additional hosts with different plugin, skill, subagent, hook, and desktop surfaces. Moving upstream documentation was enough to investigate, but not enough to claim production support or a security control. A working skill or plugin does not establish enforcement, and a CLI adapter does not establish desktop parity.

## Decision

### Support vocabulary

Describe support separately from delivery shape:

| Level | Meaning |
| --- | --- |
| `Native` | Shipped first-class adapter whose promotion gates passed |
| `Native candidate` | Targetable first-class surface; not yet promoted, even if a bounded subset ships |
| `Provisional` | Bounded experiment with incomplete or version-sensitive evidence |
| `Deferred` | No implementation in the scoped decision |
| `Withdrawn` | Removed pending requalification |

Capabilities use `Supported`, `Available`, `Unverified`, or `Unavailable`. Controls use `Enforced`, `Trust-gated`, `Ignored`, `Advisory`, `Not a sandbox`, or `Unsupported`. Skills, MCP, plugin loading, subagents, and JSON/RPC capabilities are not security enforcement merely because they are available. Each material claim points to its dated evidence, not a heading or support label.

### Architecture and trust boundaries

Canonical methodology stays in core and is generated through [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md); each package owns its host projection and runtime integration. CLI installation/version management and model configuration are separate concerns from runtime support qualification.

Prime's Pi-based runtime is not evidence that `@maestria/pi` can be reused as its adapter. Its pinned types and verified extension subset remain independent, with no sandbox claim or unverified native-dispatch promise. Codex CLI and desktop qualify separately. JCode and Crush cannot be promoted without a confirmed first-class distribution surface.

Keep version-sensitive security evidence in the [matrix](../../runtime-support-matrix.md): ignored Claude plugin-subagent frontmatter is not a gate, and a hook resource needs a correctly installed matching blocking handler; the first maestria Claude package's lack of handlers does not negate the host capability. Codex command-hook trust differs between managed policy, non-managed trust review, and an explicit trust-bypass exception; parsed unsupported prompt/agent handlers do not enforce anything. Prime execution and trusted Crush configuration are not sandboxes, and preliminary Crush hooks do not establish child enforcement. These gaps require source evidence before an adapter relies on them.

### Promotion and withdrawal

Promote to `Native` only after confirming a current first-class host API, verifying its security and trust model without relying on ignored fields, pinning every material upstream claim, reviewing package/projection boundaries, and passing canonical sync checks. Verify desktop/local parity wherever claimed; otherwise leave it unclaimed. A bounded working subset does not automatically qualify the remaining host surface.

On invalidation, downgrade or remove support, capability, control, and delivery claims together. Revert the affected projection or adapter while preserving canonical methodology and unrelated host configuration. Re-promotion requires all gates again; it is never automatic. Codex native-agent/instruction management, Prime extension scope, and desktop surfaces each retain their own rollback boundary in the matrix.

Reverify before implementation, promotion, or re-promotion and after material host API or security changes. Moving `main`/`latest` evidence remains research-only. The original review also required reverification within 30 days; record dates and pinned versions so an old claim cannot silently pass as current.

## Consequences

- Support claims become reviewable without confusing available capability, shipped subset, and security enforcement.
- Host-specific adapters and separate desktop qualification limit false compatibility and scope expansion.
- Evidence gathering and reverification cost time; documentation alone cannot enforce these boundaries.
- Some hosts remain deferred or ship only a verified subset. Narrow support is preferable to an unverified public promise.

## Alternatives Considered

- **Treat every evaluated runtime as Native:** rejected because confirmed distribution APIs and enforcement evidence differ.
- **Reuse the Pi adapter for Prime:** rejected because shared ancestry does not establish compatible types, dependencies, or behavior.
- **Ship every adapter in one batch:** rejected in favor of bounded host work with independent qualification.
- **Infer controls from plugin or hook presence:** rejected because ignored fields, event matching, handler format, scope, and trust policy determine actual enforcement.

## Related Decisions

- [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): canonical projections.
- [CORE-007](ADR-CORE-007-cli-package-plugin-management.md): installation ownership.
- [CORE-020](ADR-CORE-020-hybrid-package-topology.md): native hosts and narrow sharing.

## Date

2026-08-11; consolidated 2026-10-03.
