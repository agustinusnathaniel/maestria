# @maestria/opencode-v2

> Experimental POC: Maestria methodology on the OpenCode V2 beta plugin API. V2 is beta - APIs change. Re-verified against `@opencode-ai/plugin@0.0.0-next-17444` and the current `/v2` docs on 2026-08-24.

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

Checked against the installed package types (zero `any` casts) and https://opencode.ai/v2/docs/build/plugins/ plus https://opencode.ai/v2/docs/agents/ on 2026-08-24.

| Domain | Docs say | Package (next-17444) says | Verdict |
| --- | --- | --- | --- |
| `ctx.agent.transform` | `list`,`get`,`default`,`update`,`remove` | same draft ops; `update(id, cb)` is an upsert | ✅ match |
| `ctx.reference.transform` | `add`, `remove`, `list` | `add(name, source)` with `{ type: "local", path, description?, hidden? }` local sources | ✅ match |
| `ctx.session.hook("context")` | mutable `system`, `messages`, `tools` before model dispatch | `SessionContext` with mutable `system: SystemPart[]`, `messages: Message[]`, `tools` record | ✅ match |
| `ctx.session.hook` HTTP hooks | `http.request` / `http.response` with mutable `request` / `response` | `SessionHttpRequest` / `SessionHttpResponse` wrapping standard `Request` / `Response` | ✅ match (renamed from a single `"request"` hook since next-16694) |
| `ctx.tool.transform` | `tools.add(name, tool, options?)` two-arg | `ToolDraft.add({ name, ... })` one-arg; `name` is required inside the tool object | ❌ docs stale |
| `ctx.catalog.model.default` | `set(providerID, modelID)` | `set(providerID, modelID)` | ✅ match |
| `ctx.command.transform` | `update(name, cb)` | `update(name, cb)` | ✅ match |
| Agent fields | `system` / `permissions[]` / `steps`; warns against legacy `prompt` / `maxSteps` | same V2 field names on `Agent.Info` | ✅ match (docs no longer use V1 names) |
| `ctx.skill.transform` | draft ops `source`, `list` | CRUD shape: `add(skill)`, `update(id, cb)`, `remove(id)`, `list()` over `Skill.Info` | ❌ docs stale |

Notes:

- The tool registration mismatch persists: this plugin compiles against the installed one-arg `tools.add(tool)` shape.
- In next-16694 the second session hook was `"request"` typed as `SessionRequest extends HttpRequest`; by next-17444 it split into `"http.request"` and `"http.response"`. This plugin only uses the `"context"` hook, so the rename does not affect it.

## Known limitations

- **No compaction injection.** V1 plugins could intercept `experimental.session.compacting` to customize the compaction prompt. The V2 beta promise API exposes no equivalent hook; compaction is observable only through `ctx.event.subscribe()`. This is an intentional non-port until upstream ships a hook.
- **Beta channel tracking.** The plugin targets the V2 beta promise API and pins an exact version from the npm `next` dist-tag. Bumps require re-diffing the installed `.d.ts` files; expect breaking renames between next builds.
- **No permissions mapping.** Canonical specialist directives define no permissions, so none are mapped into agent drafts. If needed later, V2 supports ordered permissions rule arrays per agent (last matching rule wins).

## Development

```bash
pnpm sync    # regenerate agents/ + rules/ from canonical core directives
vp check     # format, lint, type-check
vp pack      # build to dist/
```

Agents are synced from `packages/core/agent-directives/` - edit canonical sources there, never the generated files.
