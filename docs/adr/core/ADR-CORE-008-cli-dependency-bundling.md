# ADR-CORE-008: Self-Contained CLI Dependencies and Version Semantics

## Status

Accepted (2026-06-30), Confidence: High. Amended 2026-09-08 to omit unconsumed sourcemaps; consolidated 2026-10-03 with the version-comparison decision of 2026-10-01. Package-manager commands and version pins belong in repository configuration and contributor guidance.

## Context

The maestria CLI is invoked through npm package runners. Externalizing its runtime libraries originally made installation fetch unnecessary transitive dependencies, including a native addon that produced build-script warnings. A CLI artifact should carry its implementation instead of making each user reconstruct the development graph.

The original custom version comparison later proved incorrect: locale collation reverses case-sensitive prerelease identifiers such as `alpha.A` and `alpha.a`, and the validation expression accepted leading zeroes in numeric identifiers. Patching those cases would leave the CLI responsible for more of SemVer's grammar.

## Decision

Bundle runtime functions into the CLI artifact with the existing Vite+/tsdown build. Keep library-package externalization separate from this CLI choice. The [CLI manifest](../../../apps/maestria-cli/package.json) and [build configuration](../../../apps/maestria-cli/vite.config.ts) own the dependency declarations and bundle list; this record does not require an empty `dependencies` field or a particular package count.

Use npm's maintained `semver` comparison and validation through focused subpath imports, bundled with the runtime. Preserve strict CLI syntax: no `v` prefix, whitespace aliases, ranges, or coercion. Preserve `latest`, `unknown`, and empty-string behavior at the CLI boundary. Reject malformed numeric identifiers and ignore build metadata for precedence. This replaces the earlier suffix-strip and locale-comparison experiment rather than extending it.

Omit published JavaScript sourcemaps while no error-reporting pipeline consumes them: their size exceeded the bundled runtime without serving a maintained consumer.

## Consequences

- Package-runner installation gets a self-contained artifact without the original transitive native-addon install path.
- Maintained SemVer parsing owns grammar and precedence, while the CLI keeps its public sentinel behavior and helper shapes.
- Bundling grows the artifact and prevents sharing those libraries across separately installed CLIs. Dependency fixes require a CLI rebuild and republication.
- New runtime dependencies need compatible declarations and bundler configuration. Focused imports limit emitted code but still add a direct dependency and development types.
- Omitting sourcemaps reduces published size at the cost of less source-level debugging information for consumers.

## Alternatives Considered

- **Suppress native-addon install warnings:** rejected because it hides the symptom and retains unnecessary downloads.
- **Replace the build with raw esbuild:** rejected because it duplicates workspace path-resolution and build infrastructure without a needed capability.
- **Keep handwritten SemVer rules:** rejected because locale ordering and numeric validation failures show the maintenance cost of owning the parser.
- **Import the full SemVer API or coerce user versions:** rejected because ranges and aliases are outside the CLI contract.

## Related Decisions

- [CORE-007](ADR-CORE-007-cli-package-plugin-management.md): CLI responsibilities and host management.
- [CORE-033](ADR-CORE-033-cli-effect-resource-boundaries.md): scoped installation resources and cancellation.

## Date

2026-06-30; version semantics adopted 2026-10-01; consolidated 2026-10-03.
