# Per-Agent Model Selection: `maestria configure`

**Status:** Done; historical implementation record. The command shipped for OpenCode, Pi, and OMP, and later CLI releases added Codex CLI and Cursor. Current user documentation is in the [CLI command reference](https://maestria.sznm.dev/cli/commands/#configure). [verified] 2026-09-14: `maestria configure` lists opencode, codex, cursor, pi, and omp; no variant/thinking support is present.

## Durable decisions

- **Platform-native writes, not a unified config.** The MVP edits each runtime's own format (`agent.<name>.model` in opencode JSONC, `model:` frontmatter in Pi/OMP agent files) because that is the runtime contract and is immediately verifiable. A unified `~/.maestria/models.jsonc` with per-platform materializers remains the direction once per-agent settings grow beyond one model string (the oh-my-openagent pattern of one config with per-agent fallback chains).
- **Empty model means inherit.** An absent `model` falls back to the session model; `--set builder=` resets an agent to inherit.
- **Validate against live model lists** (`opencode models`, `pi --list-models`, `omp models --json`) before writing; the interactive flow picks from the same list.
- **Surgical writes preserve user content.** JSONC path edits keep comments and sibling keys; frontmatter edits keep the agent body.

A verification bug fixed here: the OpenCode plugin's `config` hook did a shallow per-agent spread, dropping user-set `model`/`variant` keys. It now deep-merges (`packages/opencode/src/index.ts`); a config hook that returns merged config must deep-merge.

## Verification

`apps/maestria-cli/tests/model-config.test.ts` (18 tests), an OpenCode regression test preserving user model/variant through the plugin hook, end-to-end `opencode serve` + `GET /agent` against opencode 1.18.11, and mock-CLI smoke tests with fake HOME for all three original platforms.

## Open follow-ups

- Variant / thinking effort (`--set builder=provider/model:variant` was the proposed syntax) is not implemented.
- Unified canonical config remains deferred.
- Per-agent config for kimi-code is not supported.

## Next step

None - informational. Use the CLI command reference for current usage.
