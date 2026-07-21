# Installing @maestria/cursor

## Prerequisites

- **Cursor IDE** and/or **Cursor CLI** (`agent` on `$PATH`)
- No Node toolchain required for end-user install (declarative plugin files)

## Via maestria CLI (recommended)

```bash
pnpx maestria@latest install cursor
pnpx maestria@latest status
```

This downloads `packages/cursor` from GitHub `main` into:

```text
~/.cursor/plugins/local/maestria
```

Restart Cursor IDE so Customize → Plugins picks up the local plugin. For CLI:

```bash
agent --plugin-dir ~/.cursor/plugins/local/maestria
```

## Manual install from a monorepo checkout

```bash
mkdir -p ~/.cursor/plugins/local/maestria
cp -a packages/cursor/. ~/.cursor/plugins/local/maestria/
```

Or run without installing:

```bash
agent --plugin-dir ./packages/cursor
```

## Verify

1. Open **Customize → Plugins** (IDE) and confirm `maestria` is listed, **or**
2. In Agent chat, confirm `/fein`, `/sonar`, `/blitz`, `/orchestrate` appear
3. Confirm specialists are available as agents (adventurer, builder, reviewer, …)
4. Confirm global rules include Maestria content (`alwaysApply`)

## Uninstall

```bash
pnpx maestria@latest uninstall cursor
# or
rm -rf ~/.cursor/plugins/local/maestria
```

## Notes

- v1 maker/checker uses **two-layer enforcement**: runtime `readonly: true` flag on adventurer/planner/reviewer agents blocks write tools at the Cursor runtime level, with prompt-level instructions as a backup layer.
- Marketplace publish is out of scope for v1; local plugin install is the supported path.
