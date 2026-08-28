# Installing @maestria/kimi-code

## Prerequisites

- **Kimi Code v0.38.0+** - required for the native plugin `systemPromptPath` contract used by this package. Older versions may still load the skills-only subset, but are outside the verified support boundary.

## Via maestria CLI (recommended)

```bash
pnpx maestria@latest install kimi-code
pnpx maestria@latest status
```

The CLI pulls `@maestria/kimi-code` from npm (`npm pack @maestria/kimi-code@latest`), extracts it into Kimi Code's managed plugin directory, and registers it in Kimi's native `plugins/installed.json` registry:

```text
${KIMI_CODE_HOME:-~/.kimi-code}/plugins/managed/maestria
```

The installer preserves existing plugin records and does not overwrite global instructions. After install, start a new session so the plugin's `sessionStart.skill` loads the orchestrator and Kimi contributes `SYSTEM.md` through its native `systemPromptPath`. Add any desired `[[hooks]]` and `[[permission.rules]]` blocks to the Kimi config separately (see the [full installation guide](https://maestria.dev/kimi-code/getting-started/installation/)).

### Updating

```bash
pnpx maestria@latest update kimi-code
pnpx maestria@latest status
```

To pin to a specific version:

```bash
pnpx maestria@latest update kimi-code --version 0.5.2
```

## Verify

1. Start a new Kimi Code session (`/new`)
2. Ask: "List your available specialists"
3. The orchestrator should respond listing builder, adventurer, architect, planner, reviewer, writer, and diagnose.
4. Confirm the plugin is enabled in `/plugins` and that Maestria's system-prompt rules appear in the active context.
5. Optional workflow commands are namespaced as `/maestria:fein`, `/maestria:sonar`, and `/maestria:blitz`.

## Uninstall

```bash
pnpx maestria@latest uninstall kimi-code
```

Optionally remove the `[[hooks]]` and `[[permission.rules]]` blocks from `~/.kimi-code/config.toml`.
