# Installing @maestria/codex-cli

> This package is a provisional projection spike, not a production support promise. It was verified against `codex-cli 0.145.0` on 2026-08-13.

## Prerequisites

- Codex CLI 0.145.0 or a later version whose plugin and skills behavior has been independently reverified.
- A Codex marketplace source that can install a local or repository plugin.

## Package validation

Validate the package before installing it:

```bash
python3 /path/to/plugin-creator/scripts/validate_plugin.py packages/codex-cli
```

Replace the placeholder with the `validate_plugin.py` path from the plugin-creator skill in your Codex installation.

The validator checks the `.codex-plugin/plugin.json` manifest and the packaged layout. This does not prove that a live Codex session activates every skill.

## Loading and testing

Codex loads plugins through a configured marketplace. Install the package from that marketplace, enable it, and start a new session. Check that the `$maestria:*` skills appear in the available skill set, then exercise:

1. `$maestria:orchestrator` on a multi-file task.
2. `$maestria:adventurer` on an unfamiliar-code reconnaissance task.
3. `$maestria:reviewer` after an implementation, verifying that it reports findings instead of silently approving the maker's work.
4. `$maestria:fein`, `$maestria:sonar`, and `$maestria:blitz` on representative requests.

These skills are advisory. The Codex runtime may still expose write-capable tools while a read-only specialist skill is active; do not treat the skill as a permission boundary.

## Scope deliberately excluded

This spike does not add a `maestria install codex-cli` handler, write Codex configuration, register a model, add MCP, or ship lifecycle hooks. It also does not claim Codex desktop parity.

## Updating generated content

Edit canonical directives under `packages/core/agent-directives/`, then run:

```bash
scripts/sync-all
scripts/check-sync
```

Never edit generated files under `packages/codex-cli/skills/` directly.
