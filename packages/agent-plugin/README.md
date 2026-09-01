# @maestria/agent-plugin

Maestria's portable [Agent Plugins v1](https://agent-plugins.org/) package. It delivers the methodology as standard [Agent Skills](https://agentskills.io/specification) for compatible agent clients.

## Status / Support Boundary

This is the portable surface, not a replacement for Maestria's native runtime integrations. The current checkout is pre-release (`package.json` and `plugin.json` are `0.0.0`); use the local checkout option below until the first npm release. It contains one standard `plugin.json` manifest and 14 generated skills, with no executable agents, commands, hooks, MCP servers, or client-specific extensions.

Skills describe workflow behavior. The consuming client remains responsible for discovery, invocation, delegation, permissions, session state, installation, and trust decisions. Read-only roles are advisory in this package and do not enforce tool restrictions.

## What It Provides

- **Specialist skills** - `adventurer`, `architect`, `builder`, `diagnose`, `planner`, `reviewer`, and `writer`.
- **Workflow skills** - `orchestrator`, `global-rules`, `handoff`, and `iteration-limits`.
- **Mode skills** - `fein`, `sonar`, and `blitz`.

The skills are generated from the canonical directives in `packages/core/agent-directives/`. The portable projection removes host-specific role syntax while preserving the methodology. Native packages remain responsible for runtime-specific agents, commands, hooks, permissions, and extensions.

## Installation

Use the consuming client's Agent Plugins installation flow with a released package or an extracted package directory. The plugin root must be the directory containing `plugin.json`; the standard skill root is `skills/`.

After the first npm release, the Maestria CLI can fetch, validate, and stage the package before you hand it to a compatible client:

```bash
npx maestria plugin install
```

For a local package, validate it without changing it:

```bash
npx maestria plugin validate /path/to/plugin
```

The CLI prints the staged directory, but the consuming client still owns activation, permissions, trust, and session behavior.

For the current checkout, stage the local package explicitly after running `scripts/sync-all`:

```bash
npx maestria plugin install ./packages/agent-plugin
```

See the [installation guide](https://github.com/agustinusnathaniel/maestria/blob/main/packages/agent-plugin/INSTALL.md) for source and package-manager guidance.

## Documentation

- [User-facing documentation](https://maestria.sznm.dev/agent-plugin/)
- [Compatibility matrix](https://maestria.sznm.dev/agent-plugin/compatibility/)

## Contributing

See the [contributing guide](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md) for repository conventions.

## Development

```bash
scripts/sync-all
scripts/check-sync
pnpm --filter @maestria/agent-plugin test
```

Do not edit `skills/` directly. Edit the canonical directive or this package's sync configuration, then regenerate the projection.

## License

MIT
