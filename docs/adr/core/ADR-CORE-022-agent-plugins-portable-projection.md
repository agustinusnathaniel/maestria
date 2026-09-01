# ADR-CORE-022: Agent Plugins v1 Portable Projection

## Status

Accepted (2026-09-01)

## Context

Maestria already has a private canonical directive source and explicit native projections for each supported runtime. The Agent Plugins specification provides a vendor-neutral directory format with a root `plugin.json`, fixed `skills/` and `mcp.json` locations, and client-owned installation, permissions, lifecycle, and extension behavior.

Agent Plugins v1 standardizes skills and MCP configuration, but it does not standardize executable agents, commands, hooks, delegation, permissions, sandboxing, trust, provenance, or session state. It is therefore a useful distribution boundary, but not a sufficiently expressive runtime model or internal representation for Maestria.

## Decision

Add `@maestria/agent-plugin` as a first-class public package with these properties:

- The package root contains a strict Agent Plugins v1 `plugin.json` whose `$schema` is `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`.
- The package contains 14 generated Agent Skills under the fixed `skills/<name>/SKILL.md` layout: the seven specialists, `orchestrator`, `global-rules`, `handoff`, `iteration-limits`, and the `fein`, `sonar`, and `blitz` workflow modes.
- The projection replaces Maestria's internal `@role` references with plain sibling skill names and states that role boundaries are advisory.
- The package contains no `mcp.json`, executable agent registration, commands, hooks, or client-specific extension data.
- `packages/core/agent-directives/` remains the content source. `packages/agent-plugin/sync.config.ts` is the projection adapter, and `scripts/sync-all` remains the generation entrypoint.
- The package version and portable manifest version are synchronized by `scripts/sync-plugin-versions.ts` and released through Changesets.
- The Maestria CLI exposes `plugin validate` and `plugin install` as artifact operations. It validates local or npm sources and stages a package in the Maestria cache or an explicit directory without registering the artifact as a runtime platform.

Native packages remain independently published and continue to provide runtime-specific capabilities. The Agent Plugins package is additive and does not replace `@maestria/opencode`, `@maestria/codex`, `@maestria/cursor`, `@maestria/claude-code`, `@maestria/kimi-code`, `@maestria/pi`, `@maestria/omp`, `@maestria/prime-agent`, or the Hermes distribution.

## Mapping

| Maestria source | Portable projection | Notes |
| --- | --- | --- |
| `specialists/*.md` | `skills/<role>/SKILL.md` | Role methodology, with plain skill references |
| `commands/{fein,sonar,blitz}.md` | `skills/{fein,sonar,blitz}/SKILL.md` | Workflow modes become skills because v1 has no command component |
| `rules.md` | `skills/global-rules/SKILL.md` | Universal rules plus portable host boundary note |
| `skills/{handoff,iteration-limits}.md` | `skills/{handoff,iteration-limits}/SKILL.md` | Shared supporting skills |

## Non-goals

- Do not use Agent Plugins v1 as Maestria's canonical internal representation. Native runtime adapters need richer fields and behavior.
- Do not build a universal runtime or merge Node, Python, and host SDK dependencies into one package.
- Do not make the Maestria CLI activate portable packages in every client or own client permissions, trust, sandboxing, or lifecycle. The CLI may validate and stage an artifact, but client activation remains client-owned.
- Do not add portable MCP configuration without a concrete, host-neutral capability and credential story.

## Consequences

### Positive

- Compatible clients can consume Maestria's core methodology directly from one standard package.
- The portable artifact is generated from the existing canonical source, so methodology changes do not require hand-editing a second content tree.
- Native runtime behavior remains isolated, preserving permissions, hooks, subagent registration, and host-specific UX.
- Users have a first-party way to validate and stage a portable artifact before handing it to a compatible client's installer or directory loader.
- Package tests verify the closed manifest surface, fixed skill layout, portable references, and package boundary.

### Negative

- A new public package and manifest-version target must be maintained.
- Portable skills cannot promise runtime enforcement or native delegation semantics.
- CLI staging does not activate a package in a client, so users still need the target client's installation or directory-loading step.
- Some native wording and capabilities intentionally do not fit the portable surface and must continue to be expressed in host adapters.

## Verification

```bash
scripts/sync-all
scripts/check-sync
pnpm --filter @maestria/agent-plugin test
npx maestria plugin validate packages/agent-plugin
npx maestria plugin install packages/agent-plugin --destination /tmp/maestria-agent-plugin-staged
```

The package must also pass the repository formatting, lint, type, manifest-version, and packaging checks.

## References

- [Agent Plugins v1 specification](https://agent-plugins.org/specification)
- [Agent Skills specification](https://agentskills.io/specification)
- [ADR-CORE-005: Shared Agent Directives and Core Sync](ADR-CORE-005-shared-agent-directives-core-sync.md)
- [ADR-CORE-014: Runtime Support and Adapter Policy](ADR-CORE-014-runtime-support-and-adapter-policy.md)
- [ADR-CORE-020: Hybrid Package Topology](ADR-CORE-020-hybrid-package-topology.md)
