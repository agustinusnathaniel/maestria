
<!-- Generated from packages/core/agent-directives by scripts/sync-consolidated-plugin.ts. Do not edit directly. -->

## Hermes Integration

Hermes consumes the portable root Agent Plugins v1 manifest and the two root utility skills. Enable the package with the host's plugin flow, then discover the qualified utility names using `skills_list` and load them using `skill_view`. Hermes generates an `agent-plugin-<slug>-<hash>` namespace; do not assume `maestria:<skill>`.

Portable installation supplies utilities only. It does not activate routing, modes, or specialist agents. For optional manual host context configuration, `rules/hermes/context.md` contains complete policy, routing, and mode instructions. Configure it only through an applicable verified Hermes context setting; installing this package alone does not inject that file. The bundle includes no Python adapter, native hooks, or MCP server. Hermes owns tools, permissions, delegation, and lifecycle.

See [Hermes portable packages](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins#portable-agent-plugins-v1-packages).
