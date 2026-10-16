# @maestria/opencode

An [OpenCode](https://opencode.ai/v2/docs/) plugin that provides maestria's specialist agents, shared engineering rules, workflow modes, and methodology skills.

> This package is part of the maestria project. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Compatibility

| OpenCode             | `@maestria/opencode` |
| -------------------- | -------------------- |
| V2 (2.0.28 or later) | 0.9.0 and later      |
| V1                   | 0.8.0 and earlier    |

From 0.9.0 the package is an OpenCode V2 plugin; OpenCode V1 cannot load it. To stay on OpenCode V1, pin `@maestria/opencode@0.8.0` in the V1 `plugin` array.

## Installation

```bash
opencode plugin add @maestria/opencode
```

This installs the package and adds it to the global `plugins` list. Update with `opencode plugin update @maestria/opencode` and remove with `opencode plugin remove @maestria/opencode`, or let the [maestria CLI](https://maestria.sznm.dev/cli/) manage it (`maestria install opencode`, `maestria update opencode`, `maestria uninstall opencode`). For a single project, add it to `plugins` in that project's `opencode.json(c)` instead. Select the `orchestrator` agent for specialist routing; the plugin keeps your configured default agent.

Coming from OpenCode V1: V2 ignores the V1 `plugin` array, so add the package with the command above. `maestria update opencode` moves a V1 entry for you and also replaces a `@maestria/opencode-v2` preview entry.

## What It Provides

- **Agents**: `orchestrator` (delegates to the 4 specialists) plus `adventurer`, `architect`, `builder`, and `reviewer`, each with its own permission rules.
- **Global rules**: added to every agent-loop and compaction request. Delivery ownership (workflow modes, autonomous commit, push, and PR, and PR slicing) lives in the `orchestrator` agent; the plugin also adds it for OpenCode's own agents such as `build` and `plan`, so only maestria's specialist subagents go without it.
- **Workflow modes**: `fein` (adventurer, architect, builder, reviewer), `sonar` (read-only adventurer or architect, then stop), and `blitz` as slash commands or bare keywords.
- **Skills**: `create-pull-request`, `docs-update`, `diagnose`, and `plan`, which the global rules name. A project skill with the same ID takes precedence.
- **Project customization**: `.maestria/workflow.md` and `.maestria/rules.md` at the project root are read on every model request, so edits apply without a reload. A missing file is skipped; a directory, unreadable file, or link resolving outside the project fails the request instead of running without it.

## Workflow Modes

```text
fein: implement and review the change
sonar investigate the module
/blitz fix the typo
```

Keywords match case-insensitively outside code spans; when several appear, `fein` wins over `sonar`, which wins over `blitz`. The mode's instructions replace the keyword in the stored prompt, so they persist across tool continuations and reloads, show in desktop and web history, and apply only to that turn. Attachments are kept. Keywords apply to whichever agent is selected. Turn off bare keywords with plugin options; slash commands stay available:

```json
{
  "plugins": [
    {
      "package": "@maestria/opencode",
      "options": { "modes": { "disabledKeywords": ["blitz"] } }
    }
  ]
}
```

## Support / Platform Notes

- An [Effect plugin](https://opencode.ai/v2/docs/build/plugins/effect/): `effect` and `@opencode/plugin` are peer dependencies supplied by the host. Registrations close with the plugin scope.
- Uses agent, command, and skill transforms plus the `prompt`, `context`, and `compaction` session hooks. It adds no tools, [CLI extension](https://opencode.ai/v2/docs/build/plugins/cli/), or [RPC](https://opencode.ai/v2/docs/build/plugins/rpc/) methods, and stores nothing.
- Rules are prompt guidance, not a sandbox. Agent permissions are configuration, subject to [Console](https://opencode.ai/v2/docs/console/) workspace policies; the plugin does not evaluate permissions itself.
- Makes no network calls of its own.

## Development

Edit shared directives in `packages/core/agent-directives/` and the agent permission maps in `sync.config.ts`, which translates them to ordered OpenCode permission rules. Generated agents, commands, rules, and skills are not hand-authored. From the repository root:

```bash
scripts/sync-all
scripts/check-sync
pnpm --filter @maestria/opencode test
pnpm --filter @maestria/opencode build
pnpm e2e:opencode
```

The E2E probe needs an OpenCode V2 CLI on `PATH` (or `OPENCODE_BIN`). It starts the host with an isolated home, config, and workspace plus a local fake provider, drives real prompts, commands, and compaction without paid inference, and writes its checks and wire evidence to `artifacts/opencode-evidence.json`. Set `MAESTRIA_OPENCODE_PLUGIN=@maestria/opencode@<version>` to run it against a published version.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/opencode/) on the docs site
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/opencode/CHANGELOG.md)

## License

MIT
