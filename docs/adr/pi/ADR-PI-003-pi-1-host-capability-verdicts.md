# ADR-PI-003: Pi 1 Host Capability Verdicts

## Status

Accepted (2026-10-02), Confidence: Medium. Amended 2026-10-04: reduced the record to the codemode verdict, dropped the deferred-loading and section-patching verdicts as restatements of current state rather than decisions, and restated the enforcement assumption host-wide. The original decision date is unchanged.

## Context

Codemode is a Pi setting rather than a maestria code path, so it earns a record only for why it stays off: no host source available here establishes whether a mode that runs tool invocations in-script still emits `tool_call`. That boundary is documented at `installToolInterceptors` and as `E-PI-TOOLS-01` in [docs/runtime-support-matrix.md](../../runtime-support-matrix.md).

## Decision

No codemode. Tool-level enforcement is only as strong as the host event surface, so enabling a mode whose event surface is unverified trades a bounded boundary for an unbounded one. Reverse only when all three hold: the tool surface grows large enough that deferred loading matters, AND the host documents in-script enforcement, AND review-mode narrowing is proven compatible with such a setting.

## Consequences

No compression lever. Review-mode narrowing plus the interceptor stay the only tool-level controls, their reach is bounded by host event emission rather than by anything in this repository, and no alternate execution route may bypass that narrowing.

## Alternatives Considered

- **Adopt codemode now.** Rejected: it trades a verified event surface for an unverified one, the wrong direction for a safety boundary.
- **Leave the question open pending host documentation.** Rejected: an unverified bypass of a safety control needs a recorded default, not silence.

## Date

2026-10-02
