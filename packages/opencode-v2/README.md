# @maestria/opencode-v2

> Experimental POC: Maestria methodology on the OpenCode V2 beta plugin API. V2 is beta - APIs change. Re-verified against `@opencode-ai/plugin@0.0.0-next-17444` (npm `next` dist-tag unchanged since 2026-08-24) and the current `/v2` docs on 2026-09-17. The pin keeps `effect@4.0.0-beta.101` to match the plugin package's own dependency; the workspace catalog has moved on (rc.113).

## Install

V2 runs as `opencode2`. Add the plugin to your `opencode.json`:

```json
{
  "plugins": ["@maestria/opencode-v2"]
}
```

## What it does

- Registers the 8 Maestria agents (orchestrator + 7 specialists) via `ctx.agent.transform()` - `AgentDraft.update()` is an upsert, so missing agents are created (verified against the upstream opencode repository, github.com/anomalyco/opencode).
- Declares the global rules file (`rules/AGENTS.md`, synced from `@maestria/core`) as a native instruction source via `ctx.reference.transform()`.
- Detects mode keywords (`fein` / `sonar` / `blitz`) in user messages via `ctx.session.hook("context")`, injects the mode marker + prompt into `system`, and strips the keyword.

## Verified API surface (vs docs)

Checked against the installed package types (zero `any` casts) and https://opencode.ai/v2/docs/build/plugins/ plus https://opencode.ai/v2/docs/agents/ on 2026-09-17. Live docs describe a newer API than the pin implements; rows below record both sides.

| Domain | Docs say | Package (next-17444) says | Verdict |
| --- | --- | --- | --- |
| `ctx.agent.transform` | `list`,`get`,`default`,`update`,`remove` | same draft ops; `update(id, cb)` is an upsert | ✅ match |
| `ctx.reference.transform` | `add`, `remove`, `list`, `get` | `add(name, source)` with `{ type: "local", path, description?, hidden? }` local sources, plus `remove`, `list`; no `get` | ✅ compatible (this plugin only uses `add`) |
| `ctx.session.hook("context")` | mutable `system`, `messages`, `tools` before model dispatch | `SessionContext` with mutable `system: SystemPart[]`, `messages: Message[]`, `tools` record | ✅ match |
| `ctx.session.hook` other hooks | `prompt`, `compaction`, `generate`, `title`, `model.request`, `http.request` / `http.response`, `retry`, experimental `ws.*` | only `context`, `http.request`, `http.response` | ❌ pin behind docs (see Known limitations) |
| `ctx.tool.transform` | one-arg `add(tool)` plus `list`, `get`, `namespace`, `update`, `remove` | `ToolDraft.add({ name, ... })` one-arg only; `name` is required inside the tool object | ✅ compatible (this plugin only uses `add`) |
| `ctx.catalog.model.default` | `set(providerID, modelID)` | `set(providerID, modelID)` | ✅ match |
| `ctx.command.transform` | add-only `add({ name, description, execute })` | template model `list`, `get`, `update(name, cb)`, `remove`; no `add` | ❌ pin behind docs (code handles both shapes defensively) |
| Agent fields | `system` / `permissions[]` / `steps`; warns against legacy `prompt` / `maxSteps` | same V2 field names on `Agent.Info` | ✅ match (docs no longer use V1 names) |
| `ctx.skill.transform` | `list`, `get`, `add`, `update`, `remove` over `Skill.Info` | CRUD shape: `add(skill)`, `update(id, cb)`, `remove(id)`, `list()`; no `get` | ✅ compatible (code uses `list().find()` instead of `get`) |

Notes:

- The tool registration mismatch from August (docs two-arg `tools.add(name, tool)` vs package one-arg) is resolved on both sides: current docs and the pin both use one-arg `add(tool)`. The remaining gap is the reverse: docs list extra editors (`list`, `get`, `namespace`, `update`, `remove`) the pin lacks.
- The skill `get(id)` helper exists in current docs but not in the pin; the loader uses `list().find()` so no code change is needed.
- The command gap is structural: docs describe code-style commands with an `execute` callback, the pin describes template-style commands discovered from `agents/commands/`. `src/transforms/commands.ts` feature-detects `add()` at runtime and updates in place otherwise.
- Session hook coverage beyond `"context"` (notably `"compaction"`, the documented V2 destination for V1 `experimental.session.compacting` per `/migrate-v1`) is not available in the pin; see Known limitations.

## Known limitations

- **No compaction injection.** V1 plugins could intercept `experimental.session.compacting` to customize the compaction prompt. The documented V2 destination is `ctx.session.hook("compaction", ...)` (see `/migrate-v1`), but the pinned `next-17444` package only exposes `context`, `http.request`, and `http.response` hooks, so compaction stays out of reach on this pin. Compaction is observable only through `ctx.event.subscribe()`. This is an intentional non-port until the pin moves to a track (beta/dev) that ships the hook.
- **Beta channel tracking.** The plugin targets the V2 beta promise API and pins an exact version from the npm `next` dist-tag. Bumps require re-diffing the installed `.d.ts` files; expect breaking renames between next builds. The `next` tag still resolves to `0.0.0-next-17444` as of 2026-09-17; newer API (compaction/generate/title hooks, command `add`, skill/reference `get`) is visible on the `beta` (`0.0.0-beta-19271`) and `dev` tracks and in live docs.
- **Separate package from V1.** This POC ships as its own `@maestria/opencode-v2` package (plugin id `maestria.v2`) coexisting with the stable V1 `maestria` plugin. Live docs (`/migrate-v1`) describe converging both in one default export (`Plugin.define(...)` spread plus a legacy `server()` entrypoint, supported since OpenCode 1.18.29). Convergence is deferred until V2 leaves beta; see the note in `src/index.ts`.
- **No permissions mapping.** Canonical specialist directives define no permissions, so none are mapped into agent drafts. If needed later, V2 supports ordered permissions rule arrays per agent (last matching rule wins).

## Development

```bash
scripts/sync-all   # regenerate agents/ + rules/ from canonical core directives (repo root)
pnpm check         # format, lint, type-check; verifies sync state via scripts/check-sync
vp pack            # build to dist/
```

Agents are synced from `packages/core/agent-directives/` - edit canonical sources there, never the generated files. To regenerate only this package's outputs, run `npx tsx ../core/scripts/sync.ts` from this package directory.
