# ADR-PI-003: Pi 1 Host Capability Verdicts

## Status

Accepted (2026-10-02), Confidence: High. Amended 2026-10-04: restored the rejected alternatives, restored the tool-surface condition on the codemode reversal trigger, and returned the untested codemode interaction to hypothetical. The original decision date is unchanged.

## Context

Pi 1.0 added codemode, tool search, and MCP as built-ins. The adapter exposes one always-visible dispatch tool, so the question is which built-ins we adopt, not which host line we support. The supported version lives in [docs/runtime-support-matrix.md](../../runtime-support-matrix.md) and the Pi peer range.

## Decision

1. **No codemode.** It compresses a large tool surface we do not have, `codemode.mode: "only"` would conflict with review-mode narrowing via `setActiveTools(READ_ONLY_TOOLS)`, and whether the read-only `tool_call` interceptor still enforces inside QuickJS scripts is unverified, which is a potential bypass of our safety boundary.
2. **No deferred tool loading or `exposure` on `maestria_subagent`.** No MCP servers, no large tool surface to compress, and deferring the only delegation path would add a discovery round trip to every delegating turn.
3. **Defer mid-conversation system-message section patching.** Our whole-string `before_agent_start` return still works (`emitBeforeAgentStart` maps a returned `systemPrompt` onto `forceSystemPrompt`, `[verified]` in installed source), and Prime's vendored fork cannot do section patching `[inferred]`. Adopting now means a two-path injection design with no measured gain.

## Alternatives Considered

- **Stay on the pre-1.0 floor.** Rejected because the published stable host line is `1.0.0`, the adapter surface verifies intact against it, and the supported version is tracked in [docs/runtime-support-matrix.md](../../runtime-support-matrix.md).
- **Adopt codemode now.** Rejected for the reasons in Decision 1: no large-surface problem to compress, an unproven interaction with review-mode narrowing, and an unverified enforcement boundary inside QuickJS scripts.
- **Adopt section patching now.** Rejected because the whole-string return path we rely on is intact, so a second injection mechanism would double the surface to verify for no measured behavior gain.
- **Widen the peer ceiling beyond the caret.** Rejected because an unbounded range would silently admit an unverified next major before it is checked against the adapter.

## Consequences

Tool enforcement stays on the one verified mechanism, review-mode narrowing plus the read-only interceptor. The cost is that interceptor enforcement inside QuickJS scripts stays open and unmeasured, and codemode is unavailable as a compression lever.

## Security Boundaries

The read-only `tool_call` interceptor plus review-mode `setActiveTools` narrowing is our tool-level enforcement. Codemode's QuickJS execution sits outside that verified path, so codemode stays off until interceptor behavior inside scripts is confirmed, and no alternate execution route may bypass review-mode narrowing.

## What Would Change Each Verdict

- **Codemode:** our tool surface grows large enough that deferred loading matters, the host documents interceptor enforcement inside scripts, and review-mode narrowing is proven compatible with a codemode setting; all three, then re-decide.
- **Deferred loading / `exposure`:** per-specialist tools replace the single dispatch tool, or always-loaded tools become measurably costly.
- **Section patching:** a need to update the prompt mid-conversation without a full replace, or deprecation of the whole-string return.

## Date

2026-10-02
