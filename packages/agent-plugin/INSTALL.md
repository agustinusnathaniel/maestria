# Installing @maestria/agent-plugin

This package is a standard Agent Plugins v1 directory package. Use a client that supports the Agent Plugins format, then provide the package root containing `plugin.json`.

## Published package

Install or download `@maestria/agent-plugin` through the client-specific package or plugin flow. The client must extract or materialize the package as a directory before discovering its `plugin.json` and `skills/` directory. A normal dependency install alone does not make a client discover the plugin unless that client documents this behavior.

## Local checkout

From the Maestria repository:

```bash
scripts/sync-all
```

Point the compatible client at:

```text
/path/to/maestria/packages/agent-plugin/
```

The directory contains the portable manifest and generated skills. Keep the package root intact; do not point the client only at `skills/` when it expects an Agent Plugin.

## Support boundary

The portable package declares skills only. It does not provide native subagent registration, slash commands, lifecycle hooks, MCP servers, tool permissions, sandboxing, or session-state management. Those capabilities remain in the corresponding native Maestria packages and in the consuming client.

## Updating a checkout

After changing canonical directives, regenerate and verify the projections:

```bash
scripts/sync-all
scripts/check-sync
```

Never edit generated files under `skills/` by hand.
