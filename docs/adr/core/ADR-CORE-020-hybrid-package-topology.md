# ADR-CORE-020: Hybrid Package Topology

## Status

Accepted (2026-08-27), Confidence: High. Consolidated 2026-10-03 with consumer-driven sharing decisions from 2026-09-11. Distribution-status decision partially superseded by [CORE-034](ADR-CORE-034-consolidated-declarative-plugin.md) on 2026-10-10.

## Context

Canonical methodology already had one projection pipeline, but host-neutral mode mechanics, Pi/OMP validators, and adapter helpers were duplicated. The CLI also maintained a platform-ID list separately from its authoritative handler registry. These copies could drift even when every host still built.

A universal runtime would remove some duplication by coupling incompatible host SDKs, manifests, install paths, peer dependencies, and Node/Python distributions. Sharing must follow demonstrated common behavior rather than a presumed cross-host abstraction.

## Decision

Keep private canonical directives and development tooling in core, explicit generated projections in separately published host packages, and public host-native runtime adapters. Core library modules remain platform-independent and browser-safe; development scripts may use Node APIs. Each host owns its SDK integration and distribution contract.

Share pure host-neutral mechanics through narrow private workspace modules under `packages/shared/`. Their public consumers bundle these build-time dependencies rather than publishing a universal runtime. Keep Pi-family state, compaction, review, commands, and tools in family-specific sharing; host types, model guards, lifecycle payloads, prompt loading, session state, and distinct tool contracts stay at the host seam.

The mode-sharing decision preserves case-insensitive word boundaries, priority, disabled keywords, code-span exclusion, stripping, section extraction, and the accepted unclosed-fence false-positive behavior recorded in [OC-003](../opencode/ADR-OC-003-keyword-triggered-workflow-modes.md). Share tested mechanics without imposing one adapter's strictness or mode lifetime on another.

Share Pi/OMP filesystem/frontmatter validation as development tooling while retaining its output, exit status, and strictness. Prime's stricter validator, pinned fork types, and fail-closed verified extension subset remain independent under [CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md). At the time of this decision Hermes used a native Python adapter; CORE-034 later retired it in favor of the consolidated declarative package.

The management CLI remains a separate distribution. Derive platform validation from its handler registry while preserving ordering, messages, and public types, without importing effectful handlers into validation or creating cycles. Shared batch mechanics keep sequencing and result handling consistent while individual commands retain choices and messages.

Share demonstrated adapter surfaces directly: narrow installers accept what they use rather than re-wrapping the entire extension API. Private exports and config features without consumers need no compatibility aliases; public plugin contracts still require consumer evidence. Anchor and provenance checks remain load-bearing even when wrappers and test-only APIs are removed.

## Consequences

- Common behavior has one implementation and test suite while each installed adapter carries only its host footprint.
- Canonical source and explicit projections preserve readable methodology without equating runtime enforcement across hosts.
- Registry-derived platform validation removes a drift point, but derivation must remain acyclic and free of handler side effects.
- Private workspace modules add dependency edges and must retain their declared host, filesystem, and browser boundaries.
- Family sharing does not eliminate host wrappers. Removing a real type or lifecycle seam would trade visible duplication for hidden coupling.
- Removing unused private APIs breaks hypothetical out-of-repository consumers; this is acceptable only because those names are not published plugin contracts.

## Alternatives Considered

- **Keep byte-identical copies:** rejected because long-tail drift is a maintenance failure even before an immediate regression appears.
- **One shared core runtime for every host mechanic:** rejected because pure mode functions do not establish common state, compaction, dispatch, or Python behavior.
- **One universal bundle:** rejected because it conflates host SDKs, marketplace manifests, runtime languages, peer dependencies, and install paths.
- **Compatibility shims for unused private APIs:** rejected because no consumer requires them and they prolong dead surface.
- **Merge Prime or all Pi/OMP wrappers wholesale:** rejected because pinned Prime semantics and host-specific types and lifecycle payloads have not been shown equivalent.

## Related Decisions

- [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): canonical content and generated projections.
- [CORE-006](ADR-CORE-006-project-workflow-protocol.md): Node project-loader sharing outside browser-safe core.
- [CORE-014](ADR-CORE-014-runtime-support-and-adapter-policy.md): supported host surfaces and enforcement evidence.
- [CORE-007](ADR-CORE-007-cli-package-plugin-management.md): CLI ownership and native install handlers.

## Supersession

[CORE-034](ADR-CORE-034-consolidated-declarative-plugin.md) supersedes this record's distribution-status claims for Hermes, OMP, and Prime Agent, and records the consolidated declarative package topology. The decisions here about narrow private code sharing and runtime boundaries remain in force.

## Date

2026-08-27; consolidated 2026-10-03.
