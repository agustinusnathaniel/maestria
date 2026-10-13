# @maestria/opencode-v2

An [OpenCode V2](https://opencode.ai/v2/docs/) plugin that provides maestria's specialist agents, shared engineering rules, workflow modes, and methodology skills. Verified against OpenCode and `@opencode/plugin` 2.0.28. The V1 package is [`@maestria/opencode`](https://github.com/agustinusnathaniel/maestria/tree/main/packages/opencode).

> This package is part of the maestria project. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Installation

```bash
opencode plugin add @maestria/opencode-v2
```

This installs the package and adds it to the global `plugins` list. Update with `opencode plugin update @maestria/opencode-v2`. For a single project, add it to `plugins` in that project's `opencode.json(c)` instead. Select the `orchestrator` agent for specialist routing; the plugin keeps your configured default agent.

## What It Provides

- **Agents**: `orchestrator` (delegates to the 7 specialists) plus `adventurer`, `architect`, `builder`, `diagnose`, `planner`, `reviewer`, and `writer`, with the same prompts and permission policy as the V1 package.
- **Global rules**: added to every agent-loop and compaction request.
- **Workflow modes**: `fein`, `sonar`, and `blitz` as slash commands or bare keywords.
- **Skills**: `create-pull-request` and `docs-update`, which the global rules name. A project skill with the same ID takes precedence.
- **Project customization**: `.maestria/workflow.md` and `.maestria/rules.md` at the project root are read on every model request, so edits apply without a reload. A missing file is skipped; a directory, unreadable file, or link resolving outside the project fails the request instead of running without it.

## Workflow Modes

```text
fein: implement and review the change
sonar investigate the module
/blitz fix the typo
```

Keywords match case-insensitively outside code spans; when several appear, `fein` wins over `sonar`, which wins over `blitz`. The mode's instructions replace the keyword in the stored prompt, so they persist across tool continuations and reloads, show in desktop and web history, and apply only to that turn. Attachments are kept. Turn off bare keywords with plugin options; slash commands stay available:

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

Unlike V1, which detects keywords only for the orchestrator, keywords apply to whichever agent is selected.

## Support / Platform Notes

- An [Effect plugin](https://opencode.ai/v2/docs/build/plugins/effect/): `effect` and `@opencode/plugin` are peer dependencies supplied by the host. Registrations close with the plugin scope.
- Uses agent, command, and skill transforms plus the `prompt`, `context`, and `compaction` session hooks. It adds no tools, [CLI extension](https://opencode.ai/v2/docs/build/plugins/cli/), or [RPC](https://opencode.ai/v2/docs/build/plugins/rpc/) methods, and stores nothing.
- Rules are prompt guidance, not a sandbox. Agent permissions are configuration, subject to [Console](https://opencode.ai/v2/docs/console/) workspace policies; the plugin does not evaluate permissions itself.
- Makes no network calls of its own.

## Development

Edit shared directives in `packages/core/agent-directives/` and the OpenCode permission policy in `packages/opencode/sync.config.ts`; this package's `sync.config.ts` translates that policy to V2 permission rules. Generated agents, commands, rules, and skills are not hand-authored. From the repository root:

```bash
scripts/sync-all
scripts/check-sync
pnpm --filter @maestria/opencode-v2 test
pnpm --filter @maestria/opencode-v2 build
pnpm exec tsx scripts/e2e/opencode-v2-evidence.ts --out artifacts/opencode-v2-evidence.json
```

The E2E probe needs an OpenCode V2 CLI on `PATH` (or `OPENCODE_BIN`). It starts the host with an isolated home, config, and workspace plus a local fake provider, drives real prompts, commands, and compaction without paid inference, and writes its checks and wire evidence to the output file. Set `MAESTRIA_V2_PLUGIN=@maestria/opencode-v2@<version>` to run it against a published version.

## License

MIT
