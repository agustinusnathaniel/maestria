# @maestria/agent-plugin

Maestria's portable [Agent Plugins v1](https://agent-plugins.org/) package. It delivers the methodology as standard [Agent Skills](https://agentskills.io/specification) for compatible agent clients.

## Status / Support Boundary

This package contains a standard `plugin.json` manifest and 14 generated skills. Use a native Maestria integration if you need executable agents, commands, hooks, MCP servers, or client-specific extensions.

Skills describe workflow behavior. The consuming client remains responsible for discovery, invocation, delegation, permissions, session state, installation, and trust decisions. Read-only roles are advisory in this package and do not enforce tool restrictions.

## What It Provides

- **Specialist skills** - `adventurer`, `architect`, `builder`, `diagnose`, `planner`, `reviewer`, and `writer`.
- **Workflow skills** - `orchestrator`, `global-rules`, `handoff`, and `iteration-limits`.
- **Mode skills** - `fein`, `sonar`, and `blitz`.

The skills are generated from the canonical directives in `packages/core/agent-directives/`. The portable projection removes host-specific role syntax while preserving the methodology. Native packages remain responsible for runtime-specific agents, commands, hooks, permissions, and extensions.

## Installation

Use the consuming client's Agent Plugins installation flow with a released package or an extracted package directory. The plugin root must be the directory containing `plugin.json`; the standard skill root is `skills/`.

To fetch, validate, and stage a published npm release:

```bash
npx maestria plugin install
```

The install command prints the staged directory. Give that directory to your compatible client to activate the plugin.

For a local package, validate it without changing it:

```bash
npx maestria plugin validate /path/to/plugin
```

To stage a repository checkout, first run `scripts/sync-all`, then:

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
