# Per-Agent Model Selection: `maestria configure`

**Status:** Done; historical implementation record. The command shipped for OpenCode, Pi, OMP, Codex CLI, and Cursor. Current user guidance is in the [CLI command reference](https://maestria.sznm.dev/cli/commands/#configure).

## Durable decisions

- **Platform-native writes, not a unified config.** The MVP edits each runtime's own format (`agent.<name>.model` in opencode JSONC, `model:` frontmatter in Pi/OMP agent files) because that is the runtime contract and is immediately verifiable. A unified `~/.maestria/models.jsonc` with per-platform materializers remains the direction once per-agent settings grow beyond one model string (the oh-my-openagent pattern of one config with per-agent fallback chains).
- **Empty model means inherit.** An absent `model` falls back to the session model; `--set builder=` resets an agent to inherit.
- **Validate against live model lists** (`opencode models`, `pi --list-models`, `omp models --json`) before writing; the interactive flow picks from the same list.
- **Surgical writes preserve user content.** JSONC path edits keep comments and sibling keys; frontmatter edits keep the agent body.

The OpenCode plugin's shallow per-agent merge once dropped user-set `model` and `variant` keys. The hook now deep-merges configuration; a hook returning merged config must preserve user values.

## Deferred capabilities

Status recorded in the 2026-09-14 snapshot; use the CLI reference for current support.

- Variant or thinking-effort selection is not implemented.
- A unified canonical config remains deferred; settings are written to each runtime's native format.
- Per-agent config for Kimi Code is not supported.

## Next step

None. Use the CLI command reference for current usage and the package source for implementation details.
