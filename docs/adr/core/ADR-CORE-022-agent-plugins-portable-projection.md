# ADR-CORE-022: Agent Plugins v1 Portable Projection

## Status

Accepted (2026-09-01), Confidence: High; consolidated 2026-10-03.

## Consolidation amendment (2026-10-10)

[CORE-034](ADR-CORE-034-consolidated-declarative-plugin.md) supersedes the separate `@maestria/agent-plugin` package topology. The portable skill surface now ships in `@maestria/plugin`, alongside explicitly selected native host resources. The portable format still grants no runtime enforcement, delegation, or lifecycle authority. The original decision below records the earlier skills-only distribution.

## Context

maestria maintains canonical agent directives and richer native integrations. Agent Plugins v1 provides a vendor-neutral manifest and Agent Skills layout, but does not standardize runtime agents, commands, hooks, permissions, trust, or session behavior. It is a distribution format, not a runtime model or a suitable canonical representation.

The format defines an artifact shape, not whether each compatible client discovers or invokes it.

## Decision

Publish `@maestria/agent-plugin` as an additive, generated projection of the canonical directives. Keep native packages independently responsible for host-specific behavior.

Limit the portable package to the v1 `plugin.json` manifest and generated Agent Skills. It does not declare MCP configuration, executable agent identities, commands, hooks, or client-specific extensions. Convert internal role references to sibling skill names and describe role or tool boundaries as advisory.

Generate the projection from `packages/core/agent-directives/`; do not maintain a second hand-authored skills tree. The maestria CLI may validate a package and stage it in its cache or a chosen destination. Staging does not install, register, or activate it in a client.

Do not add portable MCP configuration until there is a concrete host-neutral capability and credential story. Keep the Hermes distribution independent of this package.

## Security Boundaries

The consuming client owns discovery, activation, permissions, trust, sandboxing, lifecycle, delegation, and session state. Portable skills provide methodology text; they cannot enforce read-only roles, host permissions, or native delegation behavior. Use a native integration when those runtime capabilities are required.

## Consequences

- Compatible clients can consume the shared methodology through one standard package, while native integrations keep their richer host capabilities.
- Canonical generation avoids a second maintained content tree, but the public package and manifest version need ongoing maintenance.
- Portable skills cannot promise runtime enforcement or feature parity. Compatibility depends on the client's support for the manifest and skill format.
- A conforming package does not guarantee that a given client discovers or invokes every skill.
- Users must pass the staged package to a client-specific installer or directory loader to activate it.
- Native wording and capabilities may still vary where a host exposes behavior the standard cannot represent.

## Alternatives Considered

- **Keep native packages as the only distribution surface:** rejected because compatible clients would lack a vendor-neutral way to consume the shared methodology.
- **Use Agent Plugins v1 as the canonical representation:** rejected because the format cannot express native agents, commands, hooks, delegation, permissions, or session behavior.
- **Include runtime code in the portable package:** rejected because it would make the package client-specific and blur the client-owned activation and permission boundary.

## Related Decisions

- [ADR-CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md) establishes the canonical directive source and generated platform projections.
- The [package README](../../../packages/agent-plugin/README.md) documents the consumer-facing installation and support boundary.
- [Agent Plugins v1 specification](https://agent-plugins.org/specification) and [Agent Skills specification](https://agentskills.io/specification) define the portable formats.
- [Compatible clients](https://agent-plugins.org/compatible-clients) lists the clients implementing the format and their supported component types.

## Date

2026-09-01
