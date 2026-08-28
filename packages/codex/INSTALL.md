# Installing @maestria/codex

> Codex CLI support was verified against `codex 0.145.0` on 2026-08-26. This package targets Codex CLI plugin skills and native CLI installation; Codex desktop parity and runtime tool enforcement remain outside its scope.

## Prerequisites

- Codex CLI 0.145.0 or a later version whose plugin and skills behavior has been independently reverified.
- npm on `PATH` when using the Maestria CLI installer.

## Package validation

Validate the package before installing it:

```bash
python3 /path/to/plugin-creator/scripts/validate_plugin.py packages/codex
```

Replace the placeholder with the `validate_plugin.py` path from the plugin-creator skill in your Codex installation.

The validator checks the `.codex-plugin/plugin.json` manifest and the packaged layout. This does not prove that a live Codex session activates every skill.

## Persistent installation through Maestria

Install the published projection and register it with Codex's native plugin manager:

```bash
npx maestria install codex
```

The CLI downloads `@maestria/codex` from npm, creates a local marketplace under `~/.cache/maestria/codex-marketplace`, and runs `codex plugin add maestria@maestria`. Codex owns the installed plugin cache and enabled state. The CLI also installs the bundled native custom agents as `maestria-*.toml` under `$CODEX_HOME/agents/` (normally `~/.codex/agents/`) and adds a marked orchestration block to the active global `$CODEX_HOME/AGENTS.md` or `$CODEX_HOME/AGENTS.override.md` file. Existing instructions remain intact.

Update or remove it with:

```bash
npx maestria update codex
npx maestria uninstall codex
```

The update path refreshes the npm package and reinstalls it because Codex CLI does not expose a separate plugin update command. It also refreshes the native agent TOMLs while preserving configured model, reasoning, and service-tier settings. Exact version pinning is not supported for this adapter.

## Direct installation through Codex

The repository also publishes a Codex marketplace entry whose plugin source is the npm package. Install it with Codex's native marketplace and plugin commands:

```bash
codex plugin marketplace add agustinusnathaniel/maestria
codex plugin add maestria@maestria
```

This direct path installs the published plugin and its skills. `codex plugin add` consumes a `PLUGIN@MARKETPLACE` selector; it does not accept `@maestria/codex` as a bare npm argument. The Maestria CLI remains the full setup path because it additionally copies the bundled native agent TOMLs into `$CODEX_HOME/agents/` and manages the global orchestration instruction block. A direct Codex uninstall removes only the plugin:

```bash
codex plugin remove maestria@maestria
```

## Loading and testing

Codex loads plugins through a configured marketplace. Install the package from that marketplace, enable it, and start a new session. Check that the `$maestria:*` skills appear in the available skill set, then exercise:

1. `$maestria:orchestrator` on a multi-file task.
2. `$maestria:adventurer` on an unfamiliar-code reconnaissance task.
3. `$maestria:reviewer` after an implementation, verifying that it reports findings instead of silently approving the maker's work.
4. `$maestria:fein`, `$maestria:sonar`, and `$maestria:blitz` on representative requests.

These skills are advisory. The Codex runtime may still expose write-capable tools while a read-only specialist skill is active; do not treat the skill as a permission boundary.

5. **Use native specialist agents**

The CLI-installed native roles are `maestria-adventurer`, `maestria-architect`, `maestria-builder`, `maestria-diagnose`, `maestria-planner`, `maestria-reviewer`, and `maestria-writer`. Ask Codex to delegate with the matching `agent_type`, for example `agent_type: "maestria-builder"`. Read-only roles use Codex's native `sandbox_mode = "read-only"`.

6. **Automatic primary-session routing**

After `maestria install codex`, start a new Codex session. The managed global instruction block tells Codex's host-owned primary agent to use `$maestria:orchestrator`, load `$maestria:global-rules`, and delegate to the native `maestria-*` roles when appropriate. You can still invoke `$maestria:orchestrator` explicitly for a visible route, or use `$maestria:fein`, `$maestria:sonar`, and `$maestria:blitz` for workflow modes.

## Native model configuration

The plugin manifest declares skills, while the Maestria CLI configures the native custom-agent model files and managed global orchestration instructions it installs:

```bash
npx maestria configure codex --global --set builder=gpt-5.6-terra
npx maestria configure codex --project --set reviewer=gpt-5.6-luna
```

Global files are written under `~/.codex/agents/`; project files are written under `.codex/agents/`. Existing TOML is edited surgically. Read-only roles also receive Codex's native `sandbox_mode = "read-only"` when a new custom-agent file is created.

## Scope deliberately excluded

The plugin manifest does not itself declare agents, write `config.toml`, register a model, add MCP, or ship lifecycle hooks. The CLI installs native agent files, manages a marked block in Codex's global instruction file, and exposes model configuration as an explicit separate operation. The package also does not claim Codex desktop parity.

## Updating generated content

Edit canonical directives under `packages/core/agent-directives/`, then run:

```bash
scripts/sync-all
scripts/check-sync
```

Never edit generated files under `packages/codex/skills/` directly.
