# ADR-CORE-007: maestria CLI

## Status

Accepted (2026-06-28), Confidence: High. Absorbed the dependency-bundling record CORE-008 and the Effect resource record CORE-033 on 2026-11-27.

## Context

maestria ships to hosts with different installation and update mechanisms. Without one entry point, users learn a separate command per host, and each integration would need to know about the others.

## Decision

Provide a standalone `maestria` CLI that coordinates install, update, status, and related operations across hosts. Each host operation is a data-driven handler: adding a host adds a handler, not a class hierarchy, a global registry, or a dependency between platform packages. The host stays authoritative for installation state, configuration, and operation semantics; the CLI reports what its handler can observe and calls supported host interfaces. The shared command surface is a convenience, not a common package manager or transaction model.

### Dependencies and versions

The CLI runs through npm package runners, so its artifact carries its runtime dependencies: bundle them with the workspace build instead of making each user install the development graph (externalizing them once pulled a native addon and its install warnings into every run). Compare versions with npm's `semver` through focused subpath imports. Keep the CLI syntax strict (no `v` prefix, surrounding whitespace, ranges, or coercion) and keep `latest`, `unknown`, and empty-string behavior at the boundary. Publish no sourcemaps while nothing consumes them.

### Effect at the I/O boundary only

Use Effect where the CLI stages packages and runs host commands. Recover expected failures through the typed error channel and let defects and interruption propagate. Pass the abort signal from `Effect.tryPromise` to Node's child-process API so cancellation reaches the subprocess. Stage each npm archive in a fresh temporary directory under `Effect.acquireUseRelease`, fetch before replacing the destination, and release the directory on success, failure, or interruption. Synchronous helpers and plugin hooks stay ordinary TypeScript.

## Security Boundaries

The CLI runs host operations under the user's environment; it does not sandbox them or define a shared permission policy. Host confirmation and authorization rules stay authoritative, and orchestration across hosts does not promise uniform permissions, rollback, or enforcement.

## Consequences

- One entry point replaces per-host commands, and data-driven handlers keep host additions local.
- The CLI is another package to version and release. Host differences limit what detection, pinning, and recovery can guarantee.
- Bundling grows the artifact, and a dependency fix needs a CLI release.
- Probe defects surface as failures instead of being swallowed. Extraction failure after the destination is replaced still needs a retry; this is not a transactional swap.

## Alternatives Considered

- **One shell script per host:** rejected because scripts vary across shells and operating systems and keep installation knowledge scattered.
- **A shared plugin registry or self-managing platform packages:** rejected because integrations would depend on one another and users still lack one surface.
- **A Rust or Go CLI:** rejected because host commands and network I/O dominate; a second toolchain adds cost without a performance need.
- **Handwritten SemVer rules:** rejected after locale collation misordered prerelease identifiers and validation accepted leading zeroes.
- **Suppress the native-addon warnings, or build with raw esbuild:** rejected; the first hides unneeded downloads, the second duplicates workspace build setup.
- **Scan a shared temporary directory for archives:** rejected because it couples unrelated installs and needs its own discovery and cleanup.
- **An Effect service layer, or Effect in every plugin:** rejected because Node already supplies abort and process APIs, and the synchronous hooks and bounded polling do not need it.

## Date

2026-06-28; absorbed CORE-008 (2026-06-30) and CORE-033 (2026-10-01) on 2026-11-27.
