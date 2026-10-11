# Hermes Portable Plugin Integration

## Purpose

Explain Hermes consumption of the consolidated Maestria plugin and the retired native adapter boundary.

## Audience

Contributors and users migrating from the Python adapter.

## Architecture

Hermes loads root `plugin.json` and the shared `skills/` corpus from `packages/agent-plugins/`. Discover actual qualified names with `skills_list`, then load a skill with `skill_view`. Maestria's role names are methodology identities; they do not grant or deny tools.

The former Python adapter's mode commands, permission gates, lifecycle hooks, state tracking, and OpenCode subprocess bridge have been removed. Hermes owns native delegation, trust, memory, goals, and session lifecycle. [CORE-034](adr/core/ADR-CORE-034-consolidated-declarative-plugin.md) records the owner's choice and the consequential adapter trade-offs; portable skills do not grant runtime capabilities.

## Dated evidence

- 2026-10-10: [verified] Hermes documents a portable Agent Plugins subset with shared skills and host-owned trust. See the [developer guide](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins#portable-agent-plugins-v1-packages).
- 2026-10-10: [verified] The compatible clients catalog lists Hermes skill support. See [Agent Plugins clients](https://agent-plugins.org/compatible-clients).
- Live discovery of the consolidated archive requires a separate host smoke test; package checks do not establish runtime enforcement.

## Next step

Use the [installation guide](../apps/docs/src/content/docs/agent-plugins/hermes/getting-started/installation.mdx) to migrate and verify discovery.
