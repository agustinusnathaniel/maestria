# ADR-CORE-022: Agent Plugins v1 Portable Projection

## Status

Accepted (2026-09-01)

## Context

Maestria already has a private canonical directive source and explicit native projections per runtime. Agent Plugins v1 offers a vendor-neutral directory format with a root `plugin.json`, fixed `skills/` and `mcp.json` locations, and client-owned installation, permissions, lifecycle, and extension behavior.

The standard covers skills and MCP configuration only: it does not standardize executable agents, commands, hooks, delegation, permissions, sandboxing, trust, provenance, or session state. It is a useful distribution boundary, not a sufficiently expressive runtime model or internal representation for Maestria.

## Decision

Add `@maestria/agent-plugin` as a first-class public package:

- The package root contains a strict Agent Plugins v1 `plugin.json` (schema `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`).
- It contains generated Agent Skills under the fixed `skills/<name>/SKILL.md` layout: the specialists, `orchestrator`, `global-rules`, `handoff`, `iteration-limits`, and the `fein`, `sonar`, and `blitz` workflow modes.
- Internal `@role` references become plain sibling skill names, and role boundaries are stated as advisory.
- It contains no `mcp.json`, executable agent registration, commands, hooks, or client-specific extension data.
- `packages/core/agent-directives/` stays the content source; the package's `sync.config.ts` is the projection adapter and `scripts/sync-all` the generation entrypoint.
- Package and portable manifest versions are synchronized by `scripts/sync-plugin-versions.ts` and released through Changesets.
- The Maestria CLI exposes `plugin validate` and `plugin install`: it validates local or npm sources and stages a package in the Maestria cache or an explicit directory without registering it as a runtime platform.

Native packages remain independently published; the portable package is additive and does not replace them or the Hermes distribution.

## Goals

- Give compatible clients one portable package for Maestria's shared methodology.
- Generate that projection from canonical directives, not a second hand-authored skill tree.
- State the portable-versus-runtime boundary clearly enough to choose the right package.

## Mapping

| Maestria source | Portable projection | Notes |
| --- | --- | --- |
| `specialists/*.md` | `skills/<role>/SKILL.md` | Role methodology with plain skill references |
| `commands/{fein,sonar,blitz}.md` | `skills/{fein,sonar,blitz}/SKILL.md` | No command component in v1, so modes become skills |
| `rules.md` | `skills/global-rules/SKILL.md` | Universal rules plus portable host boundary note |
| `skills/{handoff,iteration-limits}.md` | `skills/{handoff,iteration-limits}/SKILL.md` | Shared supporting skills |

## Non-Goals

- Do not use Agent Plugins v1 as Maestria's canonical internal representation; native adapters need richer fields.
- Do not build a universal runtime or merge Node, Python, and host SDK dependencies.
- Do not make the CLI activate packages or own client permissions, trust, sandboxing, or lifecycle; it validates and stages only.
- Do not add portable MCP configuration without a concrete, host-neutral capability and credential story.

## Assumptions

- `[verified]` Agent Plugins v1 clients own skill discovery, activation, permissions, trust, and session behavior; the package exposes only `plugin.json` and `skills/`.
- `[verified]` The projection is generated from `packages/core/agent-directives/` and verified by `scripts/check-sync`.
- `[inferred]` A client supporting the v1 manifest and Agent Skills layout can consume the methodology, but native feature parity depends on its supported components.

## Consequences

### Positive

- Compatible clients can consume Maestria's core methodology from one standard package.
- Methodology changes flow from the canonical source with no second maintained tree.
- Native runtime behavior stays isolated, preserving permissions, hooks, subagent registration, and host UX.
- Users can validate and stage an artifact before handing it to a client's installer or directory loader.
- Package tests verify the closed manifest surface, fixed layout, portable references, and package boundary.

### Negative

- A new public package and manifest-version target must be maintained.
- Portable skills cannot promise runtime enforcement or native delegation semantics.
- CLI staging does not activate the package; users still need the client's installation or directory-loading step.
- Some native wording and capabilities intentionally remain in host adapters.

## Verification

```bash
scripts/sync-all
scripts/check-sync
pnpm --filter @maestria/agent-plugin test
npx maestria plugin validate packages/agent-plugin
npx maestria plugin install packages/agent-plugin --destination /tmp/maestria-agent-plugin-staged
```

The package must also pass the repository formatting, lint, type, manifest-version, and packaging checks.

## Alternatives Considered

### Keep native packages as the only distribution surface

Rejected: clients supporting the v1 format would have no vendor-neutral way to consume the methodology without a platform-specific adapter.

### Use Agent Plugins v1 as the canonical representation

Rejected: the standard cannot express native agents, commands, hooks, delegation, permissions, or session behavior.

### Add runtime code to the portable package

Rejected: runtime code would make the package client-specific and blur the boundary letting clients own activation and permissions.

## References

- [Agent Plugins v1 specification](https://agent-plugins.org/specification)
- [Agent Skills specification](https://agentskills.io/specification)
- [ADR-CORE-005: Shared Agent Directives and Core Sync](ADR-CORE-005-shared-agent-directives-core-sync.md)
- [ADR-CORE-014: Runtime Support and Adapter Policy](ADR-CORE-014-runtime-support-and-adapter-policy.md)
- [ADR-CORE-020: Hybrid Package Topology](ADR-CORE-020-hybrid-package-topology.md)

## Date

2026-09-01
