# @maestria/opencode-v2

Maestria methodology for OpenCode V2, checked against `@opencode/plugin@2.0.26` and the [current plugin docs](https://opencode.ai/v2/docs/build/plugins/) on 2026-10-09. The V1 package remains separate.

## Install

Add the plugin to `opencode.json`:

```json
{
  "plugins": ["@maestria/opencode-v2"]
}
```

Select the `orchestrator` agent to use Maestria's specialist routing. The plugin preserves your configured default agent.

## Workflow modes

Use bare keywords anywhere outside code spans, or invoke a slash command:

```text
fein: implement and review the change
sonar investigate the module
blitz fix the typo
/fein implement and review the change
```

Keywords are case-insensitive; when several occur, priority is `fein > sonar > blitz`. Disable automatic detection with plugin options:

```json
{
  "plugins": [
    {
      "package": "@maestria/opencode-v2",
      "options": { "modes": { "disabledKeywords": ["blitz"] } }
    }
  ]
}
```

Explicit slash commands remain available. Each mode expands into its marker and bundled instructions during prompt admission, then persists with the user message. Continuations and plugin reloads retain that message; a later plain prompt selects no mode. Expansion also updates existing desktop/web display text so visible history shows the template. It preserves file, agent, and skill attachments while removing invalid inline mention offsets. This follows [prompt admission](https://opencode.ai/v2/docs/build/plugins/#prompt-admission) and keeps no session cache.

## Integration

- Registers eight agents with `agent.transform`: orchestrator plus seven specialists. Ordered permissions preserve the effective V1 policy, using V2 `shell` and `subagent` actions.
- Appends bundled global rules to every agent-loop model request with the `context` hook. References are directory aliases, not instruction injection.
- Registers three code-style commands with `command.transform`, preserving session, delivery, and attachments.
- Registers bundled core skills with `skill.transform`, validating SDK schema fields and stripping frontmatter from model-visible content.

The [Effect runtime](https://opencode.ai/v2/docs/build/plugins/effect/) and plugin SDK are peer dependencies supplied by OpenCode, with matching development dependencies for checks. Registrations belong to the plugin scope and are released by the host on unload. Content loads from the published package; reload after changing it.

This server plugin has no [CLI extension](https://opencode.ai/v2/docs/build/plugins/cli/) or [custom RPC](https://opencode.ai/v2/docs/build/plugins/effect/rpc/). [Console policies](https://opencode.ai/v2/docs/console/) remain host-managed. Permission rules are advisory configuration subject to those policies; this plugin adds no permission-evaluation hook.

## Development

From the repository root:

```bash
scripts/sync-all
scripts/check-sync
pnpm --filter @maestria/opencode-v2 test
pnpm --filter @maestria/opencode-v2 build
pnpm exec tsx scripts/e2e/opencode-v2-evidence.ts --out artifacts/opencode-v2-evidence.json
pnpm check
```

Edit shared directives in `packages/core/agent-directives/` and host projections in `sync.config.ts`; generated agents, commands, rules, and skills are not hand-authored.

The E2E probe requires an OpenCode V2 CLI on `PATH` (or `OPENCODE_BIN`). It starts an isolated home/config/workspace and local fake provider, exercises real admissions and model requests without paid inference, and writes checks plus wire evidence to the selected artifact.

To verify an installed npm version through the same host loader, set `MAESTRIA_V2_PLUGIN=@maestria/opencode-v2@<version>` when running the E2E probe. Its native presentation-metadata checks cover both `should it fein` and `test fein`.
