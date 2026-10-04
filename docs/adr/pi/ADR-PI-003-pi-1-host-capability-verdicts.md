# ADR-PI-003: Pi 1 Host Capability Verdicts

## Status

Accepted (2026-10-02), Confidence: High. Amended 2026-10-04: reduced the record to the codemode verdict, dropped the deferred-loading and section-patching verdicts as restatements of current state rather than decisions, restated the enforcement assumption host-wide, restored the security-boundary statement, and added the tagged assumptions that unverified premise rests on. The original decision date is unchanged.

## Context

Codemode is a host setting, not a maestria code path, so it earns a record only for why it stays off: no host source available here establishes whether a host execution mode that runs invocations in-script still emits `tool_call`. That boundary is stated at `installToolInterceptors` and recorded as `E-PI-TOOLS-01` in [docs/runtime-support-matrix.md](../../runtime-support-matrix.md).

## Decision

No codemode. Tool-level enforcement is only as strong as the host event surface, so enabling a mode whose event emission is unverified trades a bounded boundary for an unbounded one. Reverse only when all three hold: the tool surface grows large enough that deferred loading matters, AND the host documents that the `tool_call` interceptor still runs inside scripts under a codemode setting, AND review-mode narrowing is proven compatible with a codemode setting.

## Security Boundaries

Codemode stays outside the verified enforcement path until the host documents in-script `tool_call` emission. No alternate host execution route may be assumed to preserve tool-level enforcement. That enforcement is the `tool_call` interceptor installed by `installToolInterceptors` in `packages/pi/src/tools.ts`, which carries this same invariant as a comment at its installation site. The premise that a host execution mode still emits `tool_call` for in-script invocations is unverified, recorded and dated in `E-PI-TOOLS-01`.

## Consequences

No compression lever. Review-mode narrowing plus the interceptor stay the only tool-level controls, their reach bounded by host event emission rather than by anything in this repository, and no alternate execution route may bypass that narrowing.

## Assumptions

- `[inferred]` In-script invocation emission is unverified for any non-default host execution mode; `E-PI-TOOLS-01` records the gap and its date.
- `[verified]` No live host probe is part of this decision.

## Alternatives Considered

- **Adopt codemode now.** Rejected: it trades a verified event surface for an unverified one, the wrong direction for a safety boundary.
- **Leave the question open pending host documentation.** Rejected: an unverified bypass of a safety control needs a recorded default, not silence.

## Date

2026-10-02
