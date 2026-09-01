# @maestria/agent-plugin

Maestria's portable [Agent Plugins v1](https://agent-plugins.org/) package. It delivers the methodology as standard [Agent Skills](https://agentskills.io/specification) for compatible agent clients.

## Status and boundary

This is the portable surface, not a replacement for Maestria's native runtime integrations. It contains one standard `plugin.json` manifest and 14 generated skills. It intentionally contains no executable agents, commands, hooks, MCP servers, or client-specific extensions.

Skills describe workflow behavior. The consuming client remains responsible for discovery, invocation, delegation, permissions, session state, installation, and trust decisions. Read-only roles are advisory in this package and do not enforce tool restrictions.

## What it provides

- **Specialist skills** - `adventurer`, `architect`, `builder`, `diagnose`, `planner`, `reviewer`, and `writer`.
- **Workflow skills** - `orchestrator`, `global-rules`, `handoff`, and `iteration-limits`.
- **Mode skills** - `fein`, `sonar`, and `blitz`.

The skills are generated from the canonical directives in `packages/core/agent-directives/`. The portable projection removes host-specific role syntax while preserving the methodology. Native packages remain responsible for runtime-specific agents, commands, hooks, permissions, and extensions.

## Installation

Use the consuming client's Agent Plugins installation flow with the published package or an extracted package directory. The plugin root must be the directory containing `plugin.json`; the standard skill root is `skills/`.

For a local checkout, install the package directory at `packages/agent-plugin/` after running `scripts/sync-all`. See [INSTALL.md](./INSTALL.md) for source and package-manager guidance.

## Development

```bash
scripts/sync-all
scripts/check-sync
pnpm --filter @maestria/agent-plugin test
```

Do not edit `skills/` directly. Edit the canonical directive or this package's sync configuration, then regenerate the projection.

## License

MIT
