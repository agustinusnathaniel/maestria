# Installing @maestria/claude-code

> Status: `Native candidate`. This package validates cleanly with the official Claude Code CLI, but runtime behavior is not yet tested end to end. Persistent installation is available through `maestria install claude-code`; the package remains a candidate rather than a production support promise.

## Prerequisites

- **Claude Code** with the `claude` CLI on `PATH` (required for validation and local loading).
- Node.js and npm (required by the Maestria CLI's npm-backed marketplace staging).
- Node.js and pnpm (to regenerate files from the canonical core directives).

## Local validation (no install)

The plugin is a self-contained directory, so you can validate and load it without any install step:

```bash
# From the repository root
claude plugin validate ./packages/claude-code --strict

# Load the plugin for a session (development/testing)
claude --plugin-dir ./packages/claude-code
```

`--strict` treats warnings as errors and is the recommended CI check. A clean run prints:

```text
✔ Validation passed
```

`--plugin-dir` loads the plugin for that session only. You can pass it multiple times to load several plugins.

## Persistent installation through Maestria

From any project, install the published package at Claude Code's user scope:

```bash
npx maestria install claude-code
```

The CLI downloads `@maestria/claude-code` from npm, writes a small local marketplace under `~/.cache/maestria/`, and invokes Claude Code's native `plugin marketplace add` and `plugin install` commands. The host, not Maestria, owns the installed plugin state.

Update or remove it with:

```bash
npx maestria update claude-code
npx maestria uninstall claude-code
```

The Maestria CLI uses the marketplace's latest package for Claude Code; exact version pinning is not available through `maestria update claude-code --version`.

## Using the plugin

Once loaded, components are namespaced under the plugin name `maestria`:

- **Agents:** `@maestria:adventurer`, `@maestria:architect`, `@maestria:builder`, `@maestria:diagnose`, `@maestria:planner`, `@maestria:reviewer`, `@maestria:writer`
- **Commands:** `/maestria:fein`, `/maestria:sonar`, `/maestria:blitz`
- **Skills:** `/maestria:orchestrator` (user-invocable). `maestria:global-rules` is auto-preloaded into every agent and is preload-only - it is not user-invocable.

Check the `/plugin` manager and the `/context` Custom Agents tab to confirm the plugin and its components loaded.

## Verification checklist

1. `claude plugin validate ./packages/claude-code --strict` prints `✔ Validation passed`.
2. Start `claude --plugin-dir ./packages/claude-code` and confirm the plugin appears in `/plugin`.
3. `@maestria:adventurer`, `@maestria:planner`, and `@maestria:reviewer` cannot call the `Write` or `Edit` tools (denied via `disallowedTools`).
4. `/maestria:fein`, `/maestria:sonar`, and `/maestria:blitz` run their documented pipelines.

Steps 2-4 are runtime checks that are **not yet verified** in this batch; the CLI validation in step 1 is the current automated gate.

## Updating generated content

Do not edit `agents/`, `skills/`, or `commands/` by hand - they are generated from `packages/core/agent-directives/`. After changing canonical content:

```bash
scripts/sync-all          # regenerate all platform packages
scripts/check-sync        # verify everything is in sync
```

## Uninstall / removal

For a persistent installation managed by Maestria:

```bash
npx maestria uninstall claude-code
```

For a session-only `--plugin-dir` load, stop passing that flag. Removing the local marketplace cache is optional and does not affect Claude Code's installed plugin record:

```bash
rm -rf ~/.cache/maestria/claude-code-marketplace
```

To use Claude Code directly, add the repository marketplace and install the plugin with the host CLI:

```bash
claude plugin marketplace add agustinusnathaniel/maestria
claude plugin install maestria@maestria --scope user
```
