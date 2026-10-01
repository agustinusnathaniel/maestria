# ADR-CORE-033: CLI Effect Resource Boundaries

## Status

Accepted (2026-10-01), Confidence: High

## Context

The CLI stages npm packages and runs host commands through Effect. Scanning a shared temporary directory to discover archives requires cleanup and ambiguity handling unrelated to the requested installation. Recovering complete Effect causes as ordinary probe failures also hides programming defects. Cancelling a fiber cannot stop a child process unless the process observes its abort signal.

## Decision

Keep Effect at the CLI I/O boundary. Recover expected failures through the typed error channel; defects and interruption propagate. Pass the signal supplied by `Effect.tryPromise` to Node's child-process API.

Bracket npm archive staging with `Effect.acquireUseRelease` in a fresh temporary directory. Fetch before replacing the destination, and release the temporary directory on success, failure, or interruption. Retain the existing host-specific installation commands and deadlines.

Keep synchronous helpers and plugin hooks in ordinary TypeScript. Pi's current polling contract uses Promise-based polling and best-effort sibling cleanup; this decision does not require a plugin migration or services and layers for dependency-free CLI operations.

## Consequences

- Positive: archive discovery and cleanup are local to one operation; download failures preserve the existing destination; cancellation reaches the subprocess.
- Negative: previously hidden probe defects become visible failures. Extraction failure after destination replacement still requires a retry; this is not a transactional directory swap.
- Neutral: CLI arguments, serialized results, and platform inventories retain their existing contracts.

## Alternatives Considered

- Keep shared temporary-directory scanning: rejected because it couples unrelated installations and needs additional discovery and cleanup code.
- Introduce an Effect service and platform command executor: rejected because Node already supplies the required abort and process APIs, and a service layer adds no needed capability here.
- Convert every plugin to Effect: rejected because their tested synchronous hooks and bounded polling do not justify that migration.

## Supersession

- Extends [ADR-CORE-007](ADR-CORE-007-cli-package-plugin-management.md)'s CLI decision with scoped archive resources and subprocess cancellation.
- Supersedes [ADR-CORE-017](ADR-CORE-017-selective-effect-v4-adoption.md)'s requirement to use Effect for Pi polling. Plugin adoption remains driven by a demonstrated need.

## Date

2026-10-01
