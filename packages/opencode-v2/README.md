# @maestria/opencode-v2

> Experimental POC: Maestria methodology on the OpenCode V2 beta plugin API. V2 is beta - APIs change. Verified against `@opencode-ai/plugin@0.0.0-next-16531` and the opencode `dev` branch (2026-07-31).

## Install

V2 runs as `opencode2`. Add the plugin to your `opencode.json`:

```json
{
  "plugins": ["@maestria/opencode-v2"]
}
```

## What it does

- Registers the 8 Maestria agents (orchestrator + 7 specialists) via `ctx.agent.transform()` - `AgentDraft.update()` is an upsert, so missing agents are created (verified in `packages/core/src/agent.ts`).
- Injects global rules + mode prompts via `ctx.session.hook("context")` - the only session hook event in the installed package.
- Detects mode keywords (`fein` / `sonar` / `blitz`) in user messages and strips them.

## Verified API surface (vs docs)

| Domain | Docs say | Package (next-16531) says | Verdict |
| --- | --- | --- | --- |
| `ctx.agent.transform` | `update(id, cb)` | `update(id, cb)` - upsert | ✅ match |
| `ctx.session.hook` | `"request"` event | `"context"` event only | ❌ docs stale |
| `ctx.tool.transform` | `tools.add("name", def)` two-arg | `tools.add({ name, ... })` one-arg | ❌ docs stale |
| `ctx.catalog.model.default` | `set(providerID, modelID)` | `set(providerID, modelID)` | ✅ match |
| `ctx.command.transform` | `update(name, cb)` | `update(name, cb)` | ✅ match |
| Agent fields | `prompt` / `permission` / `maxSteps` | `system` / `permissions[]` / `steps` | ❌ docs use V1 names |
| Skill sources | `SkillV2Source` | `Skill.Source` (directory/url/embedded) | ❌ docs stale |

Verified by compiling against the installed package types (zero `any` casts) and tracing the runtime consumer in the opencode `dev` branch source.

## Development

```bash
pnpm sync    # regenerate agents/ + rules/ from canonical core directives
vp check     # format, lint, type-check
vp pack      # build to dist/
```

Agents are synced from `packages/core/agent-directives/` - edit canonical sources there, never the generated files.
