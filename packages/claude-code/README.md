# @maestria/claude-code

A declarative Claude Code plugin that encodes the Maestria engineering methodology: 7 specialist agents, an orchestrator skill, a preloaded global-rules skill, and 3 workflow commands, all generated from the canonical directives in `packages/core/agent-directives/`.

> This package is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope. Runtime support status and evidence are tracked in [ADR-CORE-014](../../docs/adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md) and the [runtime support matrix](../../docs/runtime-support-matrix.md).

## Status

`Native candidate` - the plugin validates cleanly with the official CLI (`claude plugin validate --strict`) and follows the current documented plugin contract, but runtime behavior is **not yet tested end to end**. Upstream Claude Code docs are moving and unpinned; reverify any material claim before relying on it (see the runtime support matrix). Do not treat this package as a production support promise.

## Install

The package is published to npm and can be installed persistently through the Maestria CLI. The CLI stages the published package into a local Claude Code marketplace cache, then delegates installation and updates to Claude Code's native plugin commands.

### Local validation and development

```bash
claude plugin validate ./packages/claude-code --strict
# or, from inside the package:
cd packages/claude-code && claude plugin validate . --strict
```

Load the plugin for a session without installing it:

```bash
claude --plugin-dir ./packages/claude-code
```

### Persistent installation

Install the published plugin for the current user with the cross-platform CLI:

```bash
npx maestria install claude-code
```

This requires both `claude` and `npm` on `PATH`. Check or update the installation with:

```bash
npx maestria status
npx maestria update claude-code
```

The Claude Code host manages the installed plugin and its scope. `maestria update claude-code --version ...` is not supported because Claude Code updates from the configured marketplace's latest package.

### Regenerating the plugin

All agents, skills, and commands are generated from the canonical core directives. Never hand-edit generated files; edit the canonical sources and run the sync pipeline:

```bash
scripts/sync-all          # regenerate every platform package
scripts/check-sync        # CI check that generated files are in sync
```

## What's inside

All components are namespaced under the plugin name `maestria`.

### Agents (`agents/`)

| Agent | Invocation | Purpose |
| --- | --- | --- |
| `maestria:adventurer` | `@maestria:adventurer` | Codebase reconnaissance - read-only exploration, structured reports |
| `maestria:architect` | `@maestria:architect` | Architecture decisions, trade-off analysis, ADRs |
| `maestria:builder` | `@maestria:builder` | Focused implementation - atomic tasks, run tests |
| `maestria:diagnose` | `@maestria:diagnose` | Root-cause analysis - 6-step regression tracing |
| `maestria:planner` | `@maestria:planner` | Multi-phase implementation plans, success criteria, rollback |
| `maestria:reviewer` | `@maestria:reviewer` | Code review with quality gates - read-only, structured verdicts |
| `maestria:writer` | `@maestria:writer` | Documentation - READMEs, API docs, changelogs, ADRs |

Every agent is configured to preload the `maestria:global-rules` skill via the Claude Code agent `skills` frontmatter field, so the universal rules contract is staged into each specialist's context at startup. Runtime resolution of the plugin-scoped skill preload is not yet verified against a live session (see Platform notes and limitations).

**Tool restrictions:** `maestria:adventurer`, `maestria:planner`, and `maestria:reviewer` deny the `Write` and `Edit` tools via the `disallowedTools` frontmatter field. This is the only runtime enforcement in this package, and it is user-authorized. All methodology (rules, role constraints, handoff contracts) is advisory prompt guidance, not a security boundary.

### Skills (`skills/`)

| Skill | Invocation | Purpose |
| --- | --- | --- |
| `maestria:global-rules` | auto-preloaded into every agent; preload-only (not user-invocable) | Universal rules contract: floors, delegation, handoff, review, budgets, authorization, commit safety |
| `maestria:orchestrator` | `/maestria:orchestrator` | Router methodology: direct/focused/full routes, delegation, maker/checker split, mode precedence |

### Commands (`commands/`)

| Command | Pipeline |
| --- | --- |
| `/maestria:fein` | Full pipeline: recon -> design -> implement -> review |
| `/maestria:sonar` | Research only: owning specialist -> optional distinct specialist -> STOP |
| `/maestria:blitz` | Fast path: direct or `maestria:builder` (skip optional ceremony; required review remains) |

Commands are invoked by their namespaced name (for example `/maestria:fein`). The bare `/fein` may also resolve when no other skill claims the name, but the namespaced form is the documented contract.

## Platform notes and limitations

- **Plugin-agent `permissionMode`, `hooks`, and `mcpServers` frontmatter are ignored by Claude Code** for security reasons (documented upstream). This plugin therefore ships none of them. To enforce those fields you would need to copy an agent file into `.claude/agents/` or `~/.claude/agents/`.
- **Advisory vs enforced:** skills, preloaded rules, and role prompts are advisory. The only runtime-enforced control in this package is `disallowedTools: Write, Edit` on the three read-only roles. Do not describe prompt rules as security enforcement.
- **Preload syntax:** the agent `skills` field references the plugin skill by its namespaced identifier (`maestria:global-rules`). This follows the documented `plugin-name:skill-name` namespace, but the runtime resolution of plugin-scoped skill preloads is unverified against a live session (see Status). If a preloaded skill cannot be resolved, Claude Code skips it and logs a warning; the agent still loads.
- **No hooks, MCP servers, or runtime code.** This is a declarative package: manifest, agents, skills, and commands only. No postinstall, no config-writing installer, no CLI or model registration.
- The plugin does not ship a `rules/` directory and does not write project or user `CLAUDE.md` files.

## Design

The plugin is generated by the core sync pipeline (ADR-CORE-005). Platform-specific derivation - agent frontmatter, namespaced identifiers, tool restrictions, command frontmatter - lives in `sync.config.ts`. The canonical content stays in `packages/core/agent-directives/`; never edit generated output directly.

The global-rules skill is generated once from `rules.md` and preloaded into every agent; the full rules are not duplicated into individual agents. The orchestrator skill references the global-rules skill and the scoped agent names instead of restating them.

## Development

```bash
pnpm test        # manifest and generated-file assertions
pnpm validate    # claude plugin validate . --strict (requires the Claude CLI)
```

See the [contributing guide](../../CONTRIBUTING.md) for repository conventions.

## License

MIT
