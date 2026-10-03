# ADR-CORE-007: CLI Package for Plugin Management

## Status

Accepted (2026-06-28), Confidence: High; consolidated 2026-10-03.

## Context

maestria distributes one methodology through host integrations with different installation and update mechanisms. Users working across hosts otherwise need to learn and run separate commands, and each integration would need cross-platform awareness to provide a unified view.

## Decision

Provide a standalone `maestria` CLI that coordinates install, update, status, and related package-management operations across host integrations. Keep each host adapter responsible for translating those operations to the host's supported mechanism.

The shared command surface is a convenience for callers, not a common package manager or transaction model.

Represent host operations as data-driven handlers. Adding a host should add a handler, not a new class hierarchy, global registration system, or dependency between platform packages. The CLI owns cross-platform orchestration; individual integrations do not manage one another.

For host plugin operations, the host remains authoritative for installation state, configuration, and operation semantics. The CLI reports what its handler can observe and requests operations through supported host interfaces. Detection and version behavior may differ by host.

## Security Boundaries

The CLI orchestrates host operations under the user's environment; it does not sandbox them or define a shared permission policy. Host confirmation and authorization rules remain authoritative. Cross-platform orchestration does not promise uniform permissions, rollback, or enforcement.

## Consequences

- Users get one entry point for operations that would otherwise require host-specific commands.
- Data-driven handlers keep platform additions local and avoid cross-package discovery dependencies.
- The CLI is another package to version, build, and maintain. Host-specific behavior limits detection, pinning, and recovery guarantees.
- Bundle and version-comparison trade-offs are recorded in [ADR-CORE-008](ADR-CORE-008-cli-dependency-bundling.md). Effect resource and subprocess boundaries are recorded in [ADR-CORE-033](ADR-CORE-033-cli-effect-resource-boundaries.md).

## Alternatives Considered

- **One shell script per host:** rejected because scripts vary across shells and operating systems and would preserve the scattered installation knowledge.
- **A shared plugin registry or self-managing platform packages:** rejected because they make integrations depend on one another and still leave users without one cross-platform operation surface.
- **A Rust or Go CLI:** rejected because the work is dominated by host commands and network I/O; a separate toolchain and cross-compilation path add cost without a material performance benefit.

## Related Decisions

- [ADR-CORE-002](ADR-CORE-002-plugin-architecture.md) defines the platform integrations managed by the CLI.
- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) establishes the shared multi-platform distribution model.
- The [CLI README](../../../apps/maestria-cli/README.md) documents the current command surface and support limits.

## Supersession

Extended by [ADR-CORE-033](ADR-CORE-033-cli-effect-resource-boundaries.md), which records scoped archive staging, typed failure recovery, and subprocess cancellation.

## Date

2026-06-28
