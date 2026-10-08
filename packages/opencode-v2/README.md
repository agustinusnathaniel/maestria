# @maestria/opencode-v2

> Maestria methodology on the OpenCode V2 plugin API. Verified against `@opencode/plugin@2.0.24` and the current `/v2` docs on 2026-10-08. The pin keeps `effect@4.0.0-rc.112` to match the plugin package's own dependency; the workspace catalog has moved on (stable `4.0.0`).

## Install

Add the plugin to your `opencode.json`:

```json
{
  "plugins": ["@maestria/opencode-v2"]
}
```

## What it does

- Registers the 8 Maestria agents (orchestrator + 7 specialists) via `ctx.agent.transform()` - `AgentEditor.update()` is an upsert, so missing agents are created. Each agent carries ordered `permissions` rules ported from the V1 maps.
- Declares the global rules file (`rules/AGENTS.md`, synced from `@maestria/core`) as a native instruction source via `ctx.reference.transform()`.
- Detects mode keywords (`fein` / `sonar` / `blitz`) in user messages via `ctx.session.hook("context")`, injects the mode marker + prompt into `system`, and strips the keyword.
- Registers the 3 workflow mode commands (`fein` / `sonar` / `blitz`) via `ctx.command.transform()` - each `execute` prepends its synced template to the invocation text and submits it as a session prompt, preserving attachments and the delivery mode.
- Registers core skills (synced into `skills/` from `@maestria/core`) via `ctx.skill.transform()` (`Skill.Info` with `path` + frontmatter-free `content`, validated through the SDK schema).

## Verified API surface (vs docs)

Checked against the installed package types (zero `any` casts) and https://opencode.ai/v2/docs/build/plugins/ plus https://opencode.ai/v2/docs/build/plugins/effect/ on 2026-10-08. All rows match the pin.

| Domain | Docs say | Package (2.0.24) says | Verdict |
| --- | --- | --- | --- |
| `ctx.agent.transform` | `list`, `get`, `default`, `update`, `remove` | same editor ops; `update(id, cb)` is an upsert | ✅ match |
| `ctx.reference.transform` | `add`, `remove`, `list`, `get` | same ops; local sources are `{ type: "local", path }` with no `description` | ✅ match (this plugin only uses `add`) |
| `ctx.session.hook("context")` | mutable `system`, `messages`, `tools` before model dispatch | `SessionContext` with mutable `system: SystemPart[]`, `messages: Message[]`, `tools` record | ✅ match |
| `ctx.session.hook` other hooks | `prompt`, `compaction`, `generate`, `title`, `model.request`, `http.request` / `http.response`, `retry`, experimental `ws.*` | same hook set on `SessionHooks` | ✅ match (this plugin uses only `context`; see Known limitations) |
| `ctx.command.transform` | add-only `add({ name, description, execute })` | same add-only `CommandEditor` | ✅ match |
| Agent fields | `system` / `permissions[]` / `steps`; warns against legacy `prompt` / `maxSteps` | same V2 field names on `Agent.Info` | ✅ match (permissions mapped from the V1 maps) |
| `ctx.skill.transform` | `list`, `get`, `add`, `update`, `remove` over `Skill.Info` | same ops; `Skill.Info` is `{ id, name, description?, autoinvoke?, path, content }` | ✅ match |

Notes:

- The command gap from the `next-17444` era (template-style `list`/`get`/`update`/`remove` with no `add`) is gone: stable V2 uses code-style commands on both sides, and `src/transforms/commands.ts` registers via `add()` with an `execute` callback.
- The skill `location` field is now `path`, and `get(id)` exists, so the loader uses `get()` directly instead of `list().find()`.
- The reference `description` field is gone from the client-level contract, so the rules entry is path-only.
- RPC (`/build/plugins/rpc`, `/build/plugins/effect/rpc`) and CLI (`/build/plugins/cli`, `@opencode/plugin/tui`) are separate surfaces this server plugin does not use; see Known limitations.
- Console (`/console`) needs no plugin integration: workspace Policies arrive as policy statements with final authority over local configuration, and this plugin defines no models that could fight them.

## Known limitations

- **Context hook only, by design.** The SDK now ships `prompt`, `compaction`, `generate`, `title`, and other hooks, but mode injection stays on `"context"`: it runs before every model dispatch (including tool-driven continuations), so the mode marker persists for the whole agent loop, and detection plus keyword strip stay in one place (`src/hooks/session.ts`).
- **No RPC or CLI surface.** This is a server plugin only: no custom RPC methods/events and no TUI extension (`./tui`). Adding either would be a separate entrypoint and package surface.
- **Separate package from V1.** This ships as its own `@maestria/opencode-v2` package (plugin id `maestria.v2`) coexisting with the stable V1 `maestria` plugin. Live docs (`/migrate-v1`) describe supporting V1 and V2 from one package export (`Plugin.define(...)` spread plus a legacy `server()` entrypoint, supported since OpenCode 1.18.29). That convergence is a separate follow-up; until then this package tracks the V2 API and V1 stays untouched.
- **No on-the-fly permission overrides.** Agents carry ordered `permissions` rule arrays ported from the V1 maps (`bash` renamed to `shell`, `task` to `subagent`, scalar tool effects expanded to `resource: "*"`; rule order preserved since last match wins). The 2.0.24 effect API exposes the `evaluate` hook but no session-rules replacement, and V1 never used its ask-hook counterpart, so nothing further is ported.
- **Content is read once at load.** Agents, rules, mode templates, and skills load from the package files when the plugin initializes; there is no file watching. After editing directives and re-running `scripts/sync-all`, reload the plugin (or restart the host) to pick the changes up.

## Development

```bash
scripts/sync-all   # regenerate agents/ + rules/ + skills/ from canonical core directives (repo root)
pnpm check         # format, lint, type-check; verifies sync state via scripts/check-sync
vp pack            # build to dist/
```

Agents are synced from `packages/core/agent-directives/` - edit canonical sources there, never the generated files. To regenerate only this package's outputs, run `npx tsx ../core/scripts/sync.ts` from this package directory.
