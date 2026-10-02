# ADR-PI-006: Prime Agent Pi 1.0 Alignment Assessment

## Status

Accepted (2026-10-02), Confidence: High.

## Context

Prime Agent is a fork of the Pi line, so a Pi host version alignment has to ask whether Prime moves with it. Pi 1.0 alignment was performed for the Pi and OMP packages. Prime Agent was in the same review scope, was assessed, and was correctly left unchanged, but that reasoning existed only in a source-file header comment in `packages/prime-agent/src/pi-api.ts`. A reader of the merged repository could not tell that Prime had been considered at all, and the Prime rows in [docs/runtime-support-matrix.md](../../runtime-support-matrix.md) still read as an unexamined host.

The question this record answers is narrow: does a Pi 1.0 host release reach `@maestria/prime-agent`?

[ADR-CORE-014](../core/ADR-CORE-014-runtime-support-and-adapter-policy.md) already governs which runtimes are candidates and already fixes Prime's scope. It classifies Prime Agent as `Native candidate`, skills-first plus a verified extension subset, and records that native `rlm` dispatch and JSON/RPC headless mode remain deferred, with promotion gated on verifying a stable supported API for the executable extension beyond that subset. It also rejects reusing `@maestria/pi` for Prime because that would create a false dependency claim. This record does not restate any of that and does not change it. It answers the one question ADR-CORE-014 leaves open, which is host-version compatibility rather than candidate classification.

## Goals

Record that Prime Agent was assessed against Pi 1.0 and deliberately left unchanged, the evidence that supports that verdict, and the conditions that would reverse it.

## Non-Goals

No change to the Prime package, manifest, extension surface, support level, or Node floor. No re-verification of Prime's evidence ledger, which ADR-CORE-014 owns on its own schedule. No claim about Pi 1.0 compatibility of any other package.

## Decision

Prime Agent is deliberately left unchanged by Pi 1.0 host alignment.

Four facts support the verdict. Together they mean no Pi package is resolved at runtime, so there is no coupling for a Pi release to break.

**1. The API surface is a vendored, type-only mirror.** `packages/prime-agent/src/pi-api.ts` mirrors the public extension types of the Prime fork, pinned to upstream commit `7787f07415d843b9a800f6a4720e0c739bd608e5`. The module declares only interfaces and type aliases and exports no runtime value, so nothing it declares survives into the build.

**2. No Pi package is resolved at runtime.** The Prime-compatible `@earendil-works/pi-coding-agent` is an unpublished fork, and the compiled Prime binary serves the pi packages to extensions through bundled jiti virtual modules. A Prime extension receives the live `ExtensionAPI` object as its default-export factory argument rather than resolving it. The compiled extension therefore has zero pi imports.

**3. The absence of a Pi dependency is enforced, not incidental.** `packages/prime-agent/package.json` declares no `dependencies` and no `peerDependencies` block at all. `packages/prime-agent/tests/package.test.ts` asserts that directly, and separately asserts that no source file imports any `@earendil-works/pi-*` package. The no-import assertion matches on the import specifier without distinguishing `import` from `import type`, so even a type-only Pi import fails the suite. The vendored mirror is therefore the only shape the package can take, not merely the preferred one.

**4. ADR-CORE-014 already bounds the surface.** The extension ships only the verified subset: workflow-mode slash commands, mode prompt injection, and session-scoped mode state, all registered through the `pi` object Prime supplies. It installs no tool interception and makes no sandbox or enforcement claim, and the mirrored `ExtensionAPI` subset does not even declare a tool-registration member, so a Pi-side change to tool registration has nothing to reach.

### What would change this verdict

- A Prime upstream change that makes the vendored mirror diverge from the fork's public extension types. The mirror header already instructs reverification against the pinned commit before extending the subset.
- A Prime release that ships a Pi 1.0-lineage host. Prime re-forking is the one path by which Pi's API could reach this package, and it would arrive as upstream fork drift rather than as dependency resolution.
- A decision to expand Prime's extension surface beyond the verified subset, which ADR-CORE-014 gates on a verified public API and which would require re-assessing the mirror.

### Node floor rationale

`engines.node` in `packages/prime-agent/package.json` is `>=22.12.0` on `main`. The Pi 1.0 alignment raises the three Pi-family packages to `>=22.19.0` with the stated rationale that `@earendil-works/pi-coding-agent@0.84.2` declares `engines.node >=22.19.0` and Pi's README requires Node 22.19 or newer.

That rationale is direct for `@maestria/pi` and `@maestria/omp`, whose hosts are the Pi line. It is not verified for Prime. Both citations name the original Pi line on npm, whereas Prime's host is the unpublished fork at `0.7.2`, whose own `engines` declaration was not read at the pinned commit. The fork is also numerically older than the cited release and may declare a lower floor, so the raised value is conservative rather than derived. No Prime-specific justification for the floor has been verified.

Two facts bound how much the floor can matter, and both are recorded rather than asserted as intent. The repository's own development floor is far higher (the root manifest and `.node-version` pin a Node 24 line), so the package-level value is a consumer-facing declaration rather than a toolchain constraint. And because the extension is loaded by Prime's own bundled jiti inside the compiled Prime binary, no Node version this package declares gates its execution by Prime at all.

The floor is therefore recorded here as an open justification gap, not as a settled decision.

## Consequences

### Positive

- The Pi 1.0 assessment is durable and auditable rather than trapped in a source comment, so a later reader can see Prime was considered and why the verdict was no change.
- The verdict rests on an enforced boundary. A future change that imports any `@earendil-works/pi-*` package, or that declares a `@earendil-works/pi-coding-agent` runtime or peer dependency, fails the package test rather than passing review unnoticed. The guard is narrower than a general dependency ban, so it does not by itself stop an unrelated peer from being added.
- The Node floor gap is named instead of being inherited silently through a rationale written for a different host.

### Negative

- The verdict is only as durable as the pinned commit. The mirror encodes an assumption about a fork that does not publish to a registry, and drift is detectable only by re-reading that commit.
- The Node floor for Prime remains justified by Pi-lineage inference while citing a host that is not Prime's. This record names the gap but does not close it; closing it requires reading the fork's manifest at the pinned commit.
- Compliance with ADR-CORE-030 for `docs/**` is a review responsibility, not a gate, because CI path-ignores the directory.

### Neutral

- No runtime or published behavior changes, so this record is documentation-only and carries no release effect.
- The Prime support level and extension surface are unchanged; only their host-version reasoning is now written down.

## Security Boundaries

This decision relies on the boundary ADR-CORE-014 records for Prime: Prime execution is `Supported` capability and `Not a sandbox` control. Skills, mode commands, and mode prompt injection are advisory guidance and are never a security control. The extension registers no tool interception and writes no files, so it neither grants nor denies a tool.

The dependency boundary reinforces this rather than adding to it. Because the extension consumes only the `pi` object Prime supplies, it inherits Prime's trust model exactly and adds no independent capability surface of its own.

## Assumptions

- `[verified]` `packages/prime-agent/package.json` declares no `dependencies` and no `peerDependencies` block.
- `[verified]` `packages/prime-agent/src/pi-api.ts` is a vendored type-only mirror pinned to `7787f07415d843b9a800f6a4720e0c739bd608e5`, exports no runtime value, and every import of it elsewhere in the package is a type-only import.
- `[verified]` No file under `packages/prime-agent/src/` imports any `@earendil-works/pi-*` package, and the package's remaining runtime imports are Node builtins plus two private workspace packages that declare no dependencies of their own, so the transitive runtime graph contains no Pi package.
- `[verified]` `packages/prime-agent/tests/package.test.ts` guards the boundary: the manifest has no `dependencies` block, no `@earendil-works/pi-coding-agent` peer, and no `@maestria/pi` entry in any dependency section; no source file imports any `@earendil-works/pi-*` package or reaches into the fork's `src/core/*`; and no source file performs a filesystem write.
- `[verified]` The manifest registers only `pi.extensions` and `pi.skills`, and the extension registers five slash commands and three event handlers, with no tool interception.
- `[verified]` ADR-CORE-014 classifies Prime Agent as `Native candidate`, skills-first plus a verified extension subset, rejects reusing `@maestria/pi` for it, and pins its evidence to the same commit the mirror pins.
- `[verified]` The Node floor was set to a uniform value across the Pi, OMP, and Prime packages when the Prime package was created, not derived from the Prime host.
- `[inferred]` The Prime fork's own `engines.node` declaration at the pinned commit is consistent with, or lower than, the Pi line's floor. Not read at the pinned commit, so the raised Prime floor is treated as conservative rather than derived. This is the open gap named above.
- `[inferred]` Pi 1.0 host alignment does not alter the extension API the Prime fork exposes. Unverified because Pi 1.0 alignment is assessed against the Pi line and the fork is a separate snapshot; this is the second trigger listed above.

## Alternatives Considered

- **Widen a Prime host peer or dependency to the Pi 1.0 line to match the Pi package.** Rejected: there is no resolution to widen. Prime supplies the API object at runtime and never resolves a Pi package, so a peer would assert a dependency that does not exist. ADR-CORE-014 rejected reusing `@maestria/pi` for the same false-dependency-claim reason, and adding a Pi peer directly would contradict it.
- **Leave Prime out of the assessment and rely on the source comment.** Rejected as insufficient: the reasoning was real but undiscoverable from the merged repository, which is the gap this record closes.
- **Record the assessment as a matrix row only, with no record.** Rejected: the matrix holds dated evidence snapshots, not decisions and rationale, and it carries no place to record what would reverse a verdict.
- **Re-verify the whole Prime evidence ledger while assessing.** Rejected as scope creep. ADR-CORE-014 owns that schedule and its own reverification triggers; this record touches neither.

## Related Decisions

- [ADR-CORE-014](../core/ADR-CORE-014-runtime-support-and-adapter-policy.md) governs Prime Agent's support level, its verified extension subset, and the prohibition on reusing `@maestria/pi`.
- [ADR-PI-000](ADR-PI-000-pi-ecosystem-reuse.md) defines the Pi extension versus Pi package distinction this decision's resolution argument depends on.
- [ADR-PI-001](ADR-PI-001-rules-injection.md) is the Pi-side decision on the `before_agent_start` mode-prompt mechanism, whose Prime counterpart this decision finds separately pinned rather than shared.

## Date

2026-10-02
