# ADR-CORE-010: CLI Version Comparison - localeCompare over semver Library

## Status

Accepted (2026-07-03)

## Context

The maestria CLI (`apps/maestria-cli/`) needs to compare semver version strings in three scenarios:

1. **Validating user-provided version strings** — the `--version` flag accepts a target version to install or update to
2. **Checking if an installed plugin version differs from the latest available version** — to decide whether an update is needed
3. **Checking if a plugin is already at the target version** — to skip redundant update operations

Initially, the CLI used basic string equality (`===`) and a simple regex for validation. As the CLI evolved to support version-aware update logic, correct ordering became necessary — `0.10.0 > 0.9.0` must hold, which naive string comparison breaks.

We evaluated three approaches for adding correct semver comparison:

| Approach | Size | Maintenance | Correctness |
| --- | --- | --- | --- |
| `semver` npm package | ~60 kB | Well-maintained by npm | Full spec coverage |
| `compare-versions` | ~4 kB | Unmaintained (~2 years) | Comparison + validation only |
| `localeCompare` with `{ numeric: true }` | 0 bytes (built-in) | N/A (standard API) | Correct except prerelease edge case |

The CLI targets **self-contained distribution** (see ADR-CORE-008) — it bundles all runtime code into a single artifact with zero runtime dependencies. Adding a 60 kB dependency conflicts with that goal, especially when we would use roughly 10% of its feature surface (comparison + validation only).

## Decision

Use `String.prototype.localeCompare` with the `{ numeric: true }` option for version comparison, with a small correction for the semver prerelease edge case. Implement as a ~50-line module at `src/lib/version.ts`.

### Comparison Logic

`localeCompare` with `{ numeric: true }` naturally handles numeric segment ordering:

```
"0.10.0".localeCompare("0.9.0", undefined, { numeric: true })
// → 1  (correct: 0.10.0 > 0.9.0)
```

### Prerelease Edge Case

`localeCompare` reverses prerelease vs release ordering because the hyphen character (`-`) sorts after the end-of-string:

```
"1.0.0-alpha".localeCompare("1.0.0", undefined, { numeric: true })
// → 1  (incorrect per semver spec — prereleases should be LESS than release)
```

The semver specification defines `1.0.0-alpha < 1.0.0`. The fix: if two versions share the same `MAJOR.MINOR.PATCH` base and exactly one has a prerelease tag, reverse the `localeCompare` result.

```typescript
// Simplified fix logic
const stripSuffix = /(-[\w]+(\.[\w]+)*)?(\+[\w]+(\.[\w]+)*)?$/;
const aBase = a.replace(stripSuffix, '');
const bBase = b.replace(stripSuffix, '');
if (aBase === bBase) {
  const aIsPrerelease = a.length > aBase.length && a[aBase.length] === '-';
  const bIsPrerelease = b.length > bBase.length && b[bBase.length] === '-';
  if (aIsPrerelease !== bIsPrerelease) {
    return result > 0 ? -1 : 1;
  }
}
```

### Special Values

The CLI also works with two non-semver values:

| Value | Meaning | Comparison behavior |
| --- | --- | --- |
| `'latest'` | Install/update to the latest available version | Always greater than any semver version |
| `'unknown'` | Version cannot be determined (e.g., plugin not installed) | Comparison returns `null` (insufficient information) |

### Validation Regex

Version validation uses a regex (`/^\d+\.\d+\.\d+(-[\w]+(\.[\w]+)*)?(\+[\w]+(\.[\w]+)*)?$/`) that covers the npm semver subset we encounter — `MAJOR.MINOR.PATCH` with optional prerelease and build metadata identifiers. The special values `'latest'` and `''` (empty string) bypass regex validation.

## Consequences

### Positive

- **Zero runtime dependencies** — version comparison adds no weight to the bundled CLI artifact. Consistent with the self-contained distribution goal from ADR-CORE-008.
- **No supply-chain risk** — no third-party package to audit, update, or be affected by for version comparison logic.
- **Small surface area** — ~50 lines of code in a single module. Readable, testable, and auditable in one sitting.
- **Correct ordering for standard semver** — `localeCompare` with `{ numeric: true }` handles MAJOR.MINOR.PATCH ordering correctly out of the box. The prerelease fix is well-isolated and tested.
- **Node.js built-in** — stable across Node.js versions. No breaking changes expected from a standard language feature.

### Negative

- **Prerelease handling requires custom code** — the `localeCompare` edge case is subtle and could be overlooked during maintenance. The fix is documented inline and covered by tests.
- **Not a general-purpose semver library** — this implementation handles comparison and validation only. If future needs include version ranges (`^1.0.0`), sorting lists, or coercion, the module would need significant extension or replacement.
- **Validation regex is npm-opinionated** — the regex covers npm-originated version strings. Non-standard version formats (e.g., leading `v`, date-based versions) would require regex changes. This is acceptable because the CLI only handles packages from npm registries.

### Before/After Comparison

| Metric | Before | After |
| --- | --- | --- |
| Runtime dependencies for versioning | None (broken ordering) | None |
| Line count | ~5 (inline `===` + regex) | ~50 (dedicated module) |
| Correct ordering (`0.10.0 > 0.9.0`) | No (string comparison) | Yes |
| Prerelease ordering | N/A | Correct (`1.0.0-alpha < 1.0.0`) |
| Bundle size impact | 0 kB | 0 kB (built-in API) |

## Alternatives Considered

### Option A: `semver` npm package

The official npm semver implementation. Comprehensive — supports ranges, coercion, prerelease comparisons, and sorting out of the box.

Rejected because:

- **~60 kB** added to the bundled artifact, conflicting with the self-contained distribution goal (ADR-CORE-008)
- The CLI would use ~10% of the library's feature surface (comparison + validation only)
- The trade-off of 60 kB for 50 lines of equivalent logic is disproportionate for a CLI that targets zero runtime dependencies

### Option B: `compare-versions`

A lightweight (~4 kB) alternative focused on comparison and validation.

Rejected because:

- **Unmaintained for ~2 years** — no recent updates, no response to issues or PRs. Adopting an unmaintained library for a core validation path is a maintenance risk.
- Even at 4 kB, it adds unnecessary weight when a built-in API handles the primary use case correctly.

## Related Decisions

- ADR-CORE-008 (CLI Dependency Bundling) — established the self-contained distribution principle that motivated avoiding runtime dependencies
- ADR-CORE-007 (CLI Package for Plugin Management) — defined the CLI's architecture and version-aware update scenarios that require correct semver comparison
