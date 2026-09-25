# ADR-KC-000: Kimi Code Plugin Distribution - Subtree-Split Release Branch

## Status

**Superseded** by npm-based distribution on 2026-07-21. The original mechanism and its trade-offs are retained here as history; current installation is in the [Kimi Code package README](../../../packages/kimi-code/README.md).

## Context

At the time of this decision, Kimi Code looked for `kimi.plugin.json` at the root of an extracted archive, while Maestria kept the plugin under `packages/kimi-code/` in a multi-package repository. Moving the manifest to the monorepo root would misrepresent the repository and break relative skill paths.

## Decision (historical)

The original decision used a release branch produced from the `packages/kimi-code/` subtree. This kept the monorepo root clean and gave users a stable auto-update URL, at the cost of CI and a force-pushed synthetic branch.

The alternatives were a root manifest (rejected because it would misidentify the monorepo), a separate repository (deferred because it would duplicate or mirror maintenance), and a release tarball (deferred because it required users to update pinned URLs). At the time, the subtree branch was the option that kept one source tree and supported auto-updates.

## Supersession

On 2026-07-21, distribution moved to npm. The Maestria CLI now installs `@maestria/kimi-code` from the registry, so the subtree-split release workflow, branch, tags, and GitHub URL forms described in the original procedure are retired. See the [current package README](../../../packages/kimi-code/README.md) for installation and [ADR-KC-001](ADR-KC-001-kimi-code-architecture.md) for plugin architecture.

## Consequences

The original choice optimized for auto-update while preserving the monorepo boundary. Its synthetic branch and force-push costs are historical; npm distribution replaced that workflow. The root-of-archive constraint remains useful context for why the original mechanism was chosen.

## Related Decisions

- [ADR-KC-001](ADR-KC-001-kimi-code-architecture.md) records the Kimi Code plugin architecture.
- [ADR-CORE-007](../core/ADR-CORE-007-cli-package-plugin-management.md) records CLI plugin management.

## Date

2026-06-18
