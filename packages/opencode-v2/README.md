# @maestria/opencode-v2

> Experimental POC: Maestria methodology on the OpenCode V2 beta plugin API. V2 is beta - APIs change. Verified against `@opencode-ai/plugin@0.0.0-next-16573` (current next tag) and the opencode `dev` branch (2026-07-31).

## Install

V2 runs as `opencode2`. Add the plugin to your `opencode.json`:

```json
{
  "plugins": ["@maestria/opencode-v2"]
}
```

## What it does

- Registers the 8 Maestria agents (orchestrator + 7 specialists) via `ctx.agent.transform()` - `AgentDraft.update()` is an upsert, so missing agents are created (verified in `packages/core/src/agent.ts`).
- Injects global rules + mode prompts via `ctx.session.hook("context")` - the only session hook event exposing mutable prompt state.
- Detects mode keywords (`fein` / `sonar` / `blitz`) in user messages and strips them.

## Verified API surface (vs docs)

| Domain | Docs say | Package (next-16573) says | Verdict |
| --- | --- | --- | --- |
| `ctx.agent.transform` | `update(id, cb)` | `update(id, cb)` - upsert | ✅ match |
| `ctx.session.hook` | `"request"` event with mutable `system`/`messages`/`tools` | `"context"` (mutable SessionContext) and `"request"` (SessionRequest = HTTP wire format: url/method/headers/body, not prompt state) | ❌ docs stale - docs' request claims don't match SessionRequest |
| `ctx.tool.transform` | `tools.add("name", def)` two-arg | `tools.add({ name, ... })` one-arg | ❌ docs stale |
| `ctx.catalog.model.default` | `set(providerID, modelID)` | `set(providerID, modelID)` | ✅ match |
| `ctx.command.transform` | `update(name, cb)` | `update(name, cb)` | ✅ match |
| Agent fields | `prompt` / `permission` / `maxSteps` | `system` / `permissions[]` / `steps` | ❌ docs use V1 names |
| Skill sources | `SkillV2Source` | `Skill.Source` (directory/url/embedded) | ❌ docs stale |

Verified by compiling against the installed package types (zero `any` casts) and tracing the runtime consumer in the opencode `dev` branch source.

Note: 16573 added a second session hook event, `request` (SessionRequest = HttpRequest wire format with sessionID/agent/model). It is for HTTP middleware, not prompt editing - the docs' claim that `request` exposes mutable system/messages/tools does not match the package. Verified in dist/promise/session.d.ts.

## Development

```bash
pnpm sync    # regenerate agents/ + rules/ from canonical core directives
vp check     # format, lint, type-check
vp pack      # build to dist/
```

Agents are synced from `packages/core/agent-directives/` - edit canonical sources there, never the generated files.
