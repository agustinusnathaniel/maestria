# ADR-CORE-034: CLI SemVer Library

## Status

Accepted (2026-10-01), Confidence: High

## Context

The CLI needs SemVer precedence for update decisions. Locale collation reverses valid case-sensitive prerelease ordering, such as `alpha.A` and `alpha.a`. The custom validation expression also accepts leading zeroes in numeric identifiers that [SemVer](https://semver.org/) forbids. Correcting these rules individually would increase the custom parser's responsibility.

## Decision

Use npm's `semver` comparison and validation functions through focused subpath imports. Declare the dependency and its development types, and bundle the runtime functions into the CLI artifact.

Keep the CLI's strict version syntax: no `v` prefix, whitespace aliases, ranges, or coercion. Preserve `latest`, `unknown`, and empty-string behavior at the CLI boundary. Reject malformed numeric identifiers and ignore build metadata for precedence.

## Consequences

- Positive: npm's maintained parser owns SemVer rules, and CLI updates use correct prerelease ordering with less custom code.
- Negative: the bundle grows and contributors maintain a direct dependency and its development types.
- Neutral: the published CLI remains self-contained; its version helpers retain their names and return shapes.

## Alternatives Considered

- Patch locale comparison with an identifier parser: rejected because it retains responsibility for numeric, text, case, and metadata rules that the existing ecosystem implementation already owns.
- Import the entire SemVer API: rejected because version ranges and coercion are outside the CLI contract.

## Supersession

Supersedes [ADR-CORE-010](ADR-CORE-010-cli-version-comparison.md). The confirmed ordering defect invalidates that record's assumption that locale comparison needs only a prerelease-versus-release correction.

## Date

2026-10-01
