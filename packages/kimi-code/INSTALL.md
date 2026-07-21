# Installing @maestria/kimi-code

## Prerequisites

- **Kimi Code v0.12.0+** - required for first-class `AgentSwarm` support. On older versions, fallback to single `Agent` calls.

## Via maestria CLI (recommended)

```bash
pnpx maestria@latest install kimi-code
pnpx maestria@latest status
```

The CLI pulls `@maestria/kimi-code` from npm (`npm pack @maestria/kimi-code@latest`) and extracts it into:

```text
~/.kimi-code/plugins/managed/maestria
```

It also copies the global rules to `~/.kimi-code/AGENTS.md`.

After install, add the recommended `[[hooks]]` and `[[permission.rules]]` blocks to `~/.kimi-code/config.toml` (see the [full installation guide](https://maestria.dev/kimi-code/getting-started/installation/)).

### Updating

```bash
pnpx maestria@latest update kimi-code
pnpx maestria@latest status
```

To pin to a specific version:

```bash
pnpx maestria@latest update kimi-code@0.4.6
```

## Verify

1. Start a new Kimi Code session (`/new`)
2. Ask: "List your available specialists"
3. The orchestrator should respond listing builder, adventurer, architect, planner, reviewer, writer, and diagnose.
4. Confirm `ls ~/.kimi-code/AGENTS.md` exists.

## Uninstall

```bash
pnpx maestria@latest uninstall kimi-code
# or
rm -rf ~/.kimi-code/plugins/managed/maestria ~/.kimi-code/AGENTS.md
```

Optionally remove the `[[hooks]]` and `[[permission.rules]]` blocks from `~/.kimi-code/config.toml`.
