# Per-Agent Model Selection: `maestria configure`

## Goal

Let users give each maestria specialist agent (`adventurer`, `architect`, `builder`, `diagnose`, `planner`, `reviewer`, `writer`) its own model, per coding-agent platform, from a single CLI command.

**Status:** Implemented for opencode, pi, omp (maestria-cli 0.8.0). See [cli/commands.mdx](/cli/commands/#configure) for user docs.

## Design decisions

### 1. Write platform-native config directly (MVP), defer unified source

Two options were evaluated:

- **(a) Platform-native writes** - `maestria configure` edits each runtime's own config format: `agent.<name>.model` in opencode JSONC, `model:` frontmatter in pi/omp agent files.
- **(b) Unified canonical config** (`~/.maestria/models.jsonc`) + materializers per platform, mirroring how agent directives flow through `scripts/sync-all` (canonical in `core/` -> generated copies per platform).

Chosen: **(a) for the MVP**, with (b) still the direction for a follow-up. Rationale:

- The native formats are the runtime contract; writing them directly is immediately verifiable (`opencode` reads `agent.<name>.model` at request time; pi/omp read frontmatter `model:`).
- (b) adds a sync pipeline with drift risk; it only pays off once the config grows (variant/thinking effort, fallback chains) or platforms multiply.
- The OmO (oh-my-openagent) pattern - one `~/.omo/omo.jsonc` with per-agent model fallback chains, resolved per connected provider, materialized per harness - is the reference for (b).

### 2. Empty model = inherit

An absent `model` means the agent uses the session model (opencode: `input.model ?? agent.model ?? currentModel`; pi/omp: runtime falls back to the parent/default). `--set builder=` resets an agent to inherit. This makes "reset" idempotent and cheap.

### 3. Validation against live model lists

`opencode models` (one `provider/model` per line), `pi --list-models` (table), `omp models --json` (structured). Configure validates `--set` values against the platform's live list before writing; the interactive flow picks from the same list.

### 4. Surgical writes

- opencode: jsonc-parser path-level edits (`agent.<name>.model`) preserve comments, `plugin`, `mcp`, and the `variant` key.
- pi/omp: frontmatter line edits (`model: ...`) preserve the agent body; a missing project agent file is created as a copy of the global one.
- Bundling: the CLI imports `jsonc-parser/lib/esm/main.js` - the UMD entry does runtime `require('./impl/*')` calls the bundler cannot inline. jsonc-parser 3.3.x throws `Can not delete in empty document` when removing a non-existent path, so removal is guarded by a presence check (`hasConfigModel`).

## Bug found and fixed: plugin shallow merge

While verifying the feature end-to-end, `agent.<name>.model` had no effect on opencode: subagents always inherited the primary agent's model.

Root cause: `@maestria/opencode`'s `config` hook did `input.agent = { ...input.agent, ...agents }` - a **shallow per-agent merge**. For each of the 8 maestria agent names, the plugin's bundled entry replaced the user's entry wholesale, dropping user-set keys (`model`, `variant`, `temperature`) from `opencode.jsonc` before opencode assembled its agents. opencode itself applies `agent.<name>.model` to all agents, plugin-registered included (`agent/agent.ts` iterates every `cfg.agent` entry).

Fix: deep merge with es-toolkit `merge(input.agent ?? {}, agents)` - plugin defaults (description/mode/prompt/permission) win on conflict, user overrides survive. Verified end-to-end against opencode 1.18.11 via `opencode serve` + `GET /agent`.

Lesson: a config hook that returns merged config must deep-merge; shallow spreads silently destroy sibling keys.

## Verification

- `apps/maestria-cli/tests/model-config.test.ts` - 18 tests (parsers, frontmatter, JSONC edits, remove-non-existent no-op).
- `packages/opencode/tests/index.test.ts` - regression test for user model/variant preservation through the plugin hook.
- End-to-end: opencode 1.18.11 `GET /agent` shows configured `model`/`variant` on plugin agents; mock-CLI smoke tests with fake HOME for all three platforms, both config levels, and all error paths.

## Follow-ups

1. **Variant / thinking effort** - feasible on all three platforms (verified in source):
   - opencode: `agent.<name>.variant` is an official config key; values come from `opencode models --verbose` (`variants: {high: {reasoningEffort: high}, ...}`).
   - pi: agent frontmatter supports `model:` + `thinking:` (pi-subagents `custom-agents.ts`); vocabulary `off/minimal/low/medium/high/xhigh`.
   - omp: same frontmatter format; per-model levels available from `omp models --json` (`thinking: [...]`).
   - Syntax: `--set builder=provider/model:variant` (matches pi's own CLI shorthand).
2. **Unified canonical config** (option (b) above) once the per-agent settings grow beyond a single model string.
3. **Per-agent config for kimi-code/cursor** - rejected with a clear message today; revisit when those runtimes expose a mechanism.
