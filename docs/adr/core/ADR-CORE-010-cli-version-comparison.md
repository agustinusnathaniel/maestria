# ADR-CORE-010: CLI Version Comparison - localeCompare over semver Library

## Status

Accepted (2026-07-03)

## Context

The maestria CLI needs correct semver version comparison in three scenarios:

1. **Validating user-provided version strings** - the `--version` flag accepts a target version to install or update to
2. **Checking if an installed plugin version differs from the latest available version** - to decide whether an update is needed
3. **Checking if a plugin is already at the target version** - to skip redundant update operations

Initially the CLI used basic string equality (`===`) and a simple regex for validation. As version-aware update logic landed, correct ordering became necessary: `0.10.0 > 0.9.0` must hold, which naive string comparison breaks.

We evaluated three approaches: the `semver` npm package (full spec coverage, well-maintained by npm, heavyweight), `compare-versions` (~4 kB, unmaintained for about two years, comparison and validation only), and `localeCompare` with `{ numeric: true }` (built-in, correct except a prerelease edge case). The CLI targets **self-contained distribution** (ADR-CORE-008): it bundles all runtime code into a single artifact with zero runtime dependencies. A large dependency conflicts with that goal, especially when only comparison and validation are needed.

## Decision

Use `String.prototype.localeCompare` with the `{ numeric: true }` option for version comparison, plus a small correction for the semver prerelease edge case, implemented as a dedicated version module.

### Comparison Logic

`localeCompare` with `{ numeric: true }` naturally orders numeric segments, so `0.10.0` compares greater than `0.9.0`.

### Prerelease Edge Case

`localeCompare` reverses prerelease vs release ordering because the hyphen character sorts after the end of the string, so `1.0.0-alpha` compares greater than `1.0.0`, contradicting the semver specification (`1.0.0-alpha < 1.0.0`). The fix: when two versions share the same `MAJOR.MINOR.PATCH` base and exactly one has a prerelease tag, reverse the comparison result.

### Special Values

The CLI also works with two non-semver values:

| Value | Meaning | Comparison behavior |
| --- | --- | --- |
| `'latest'` | Install/update to the latest available version | Always greater than any semver version |
| `'unknown'` | Version cannot be determined (e.g., plugin not installed) | Comparison returns `null` (insufficient information) |

### Validation Regex

Validation uses a regex covering the npm semver subset the CLI encounters: `MAJOR.MINOR.PATCH` with optional prerelease and build metadata identifiers. The special values `'latest'` and `''` (empty string) bypass regex validation.

## Consequences

### Positive

- **Zero runtime dependencies** - version comparison adds no weight to the bundled CLI artifact, consistent with the self-contained distribution goal (ADR-CORE-008).
- **No supply-chain risk** - no third-party package to audit, update, or track for version comparison logic.
- **Small surface area** - one dedicated module, readable, testable, and auditable in one sitting.
- **Correct ordering for standard semver** - `{ numeric: true }` handles MAJOR.MINOR.PATCH ordering out of the box; the prerelease fix is isolated and tested.
- **Node.js built-in** - stable across Node.js versions; no breaking changes expected from a standard language feature.

### Negative

- **Prerelease handling requires custom code** - the edge case is subtle and could be overlooked during maintenance; the fix is documented inline and covered by tests.
- **Not a general-purpose semver library** - comparison and validation only. Version ranges (`^1.0.0`), list sorting, or coercion would require significant extension or replacement.
- **Validation regex is npm-opinionated** - non-standard formats (leading `v`, date-based versions) would require regex changes; acceptable because the CLI handles npm registry packages only.

### Before/After Comparison

| Metric                              | Before                 | After                           |
| ----------------------------------- | ---------------------- | ------------------------------- |
| Runtime dependencies for versioning | None (broken ordering) | None                            |
| Correct ordering (`0.10.0 > 0.9.0`) | No (string comparison) | Yes                             |
| Prerelease ordering                 | N/A                    | Correct (`1.0.0-alpha < 1.0.0`) |
| Bundle size impact                  | 0 kB                   | 0 kB (built-in API)             |

## Alternatives Considered

### Option A: `semver` npm package

The official npm semver implementation, supporting ranges, coercion, prerelease comparisons, and sorting out of the box.

Rejected because:

- **~60 kB** added to the bundled artifact conflicts with the self-contained distribution goal (ADR-CORE-008)
- The CLI would use roughly 10% of the library's feature surface (comparison and validation only)
- Trading 60 kB for a small built-in implementation is disproportionate for a CLI that targets zero runtime dependencies

### Option B: `compare-versions`

A lightweight (~4 kB) alternative focused on comparison and validation.

Rejected because:

- **Unmaintained** - no recent updates or response to issues and PRs; adopting an unmaintained library for a core validation path is a maintenance risk.
- Even at 4 kB, it adds unnecessary weight when a built-in API handles the primary use case correctly.

## Related Decisions

- ADR-CORE-008 (CLI Dependency Bundling) - established the self-contained distribution principle that motivated avoiding runtime dependencies
- ADR-CORE-007 (CLI Package for Plugin Management) - defined the CLI architecture and version-aware update scenarios that require correct semver comparison
