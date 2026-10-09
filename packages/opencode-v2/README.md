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

## V1 parity and V2 API choices

Project `.maestria/workflow.md` and `.maestria/rules.md` are read fresh for agent-loop and compaction requests using the shared V1 loader. Missing files are optional; directories, unreadable files, and escaping symlinks fail the request. Compaction receives the same canonical continuity rules and current project constraints. Existing agent step limits are retained when the bundle omits them. Bundled permission data is validated by the SDK schema, and skill upserts preserve configured names and autoinvoke settings.

V1 detects mode keywords only for the orchestrator. V2 keeps its existing detection across selected agents; this avoids retiring a V2 capability. Select the orchestrator for specialist routing, or disable ambiguous keywords through the existing denylist. V2 additionally provides native slash commands and bundled core skills.

| V2 surface | Use or next concrete opportunity |
| --- | --- |
| Agent, command, skill transforms | Register the current inventory; SDK editors own replay and upsert semantics. |
| Session prompt/context/compaction hooks | Expand visible input, load project guidance, and preserve continuity. |
| Effect scope and schemas | Own registration cleanup and validate host data without parallel validators. |
| CLI/TUI data, commands, slots, toasts | A future mode/review status badge can read native session data through `./tui`; a second mode picker would duplicate existing commands. |
| RPC and Effect RPC | Useful for shared diagnostics consumed by TUI or external clients; defer until a consumer needs a plugin-owned service. |
| Events and storage | Native session history already carries modes; avoid duplicating it in plugin storage. Scoped subscriptions can support a future status UI. |
| Permission, tool, shell hooks | Future audit telemetry or explicitly designed enforcement; current agent rules and host policies remain authoritative. |
| Model/provider/integration, AI SDK, generation | Keep user model selection and provider connections intact; add transforms only for a defined routing requirement. |
| Retry, model/HTTP/WebSocket, title/generate hooks | Available for provider-specific reliability work; no current Maestria requirement justifies wire interception. |
| VCS/worktree, websearch, experimental terminal | Let host tools provide these capabilities rather than rebuilding them inside this methodology plugin. |
| Console | Workspace access, connections, budgets, and policies are host-managed, not another plugin entrypoint. |

These choices follow the official [plugin](https://opencode.ai/v2/docs/build/plugins/), [Effect](https://opencode.ai/v2/docs/build/plugins/effect/), [CLI/TUI](https://opencode.ai/v2/docs/build/plugins/cli/), [RPC](https://opencode.ai/v2/docs/build/plugins/rpc/), [Effect RPC](https://opencode.ai/v2/docs/build/plugins/effect/rpc/), and [Console](https://opencode.ai/v2/docs/console/) documentation. Optional surfaces remain available; this package adds them when they solve a specific user problem.
