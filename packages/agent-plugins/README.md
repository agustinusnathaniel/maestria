# @maestria/agent-plugins

Maestria ships one directly installable plugin with native host components and two reusable utility skills. Canonical methodology lives in `packages/core/agent-directives/`; generated resources and all five host manifest directories live at this package root. Git/local installations and npm archives expose the same resource paths.

## Component ownership

| Package folder | Contents | Canonical input |
| --- | --- | --- |
| `agents/` | One profile per specialist for every Markdown host, plus a generated Codex TOML beside each | Core `specialists/` and `generation/profiles.json` |
| `commands/` | Complete FEIN, SONAR, and BLITZ workflow entry points shared by every command-capable host | Core `commands/`, dispatcher, and policy |
| `rules/` | Global policy, plus one folder per host whose rule format differs | Core `rules.md` and integration notes |
| `skills/` | Only `handoff` and `iteration-limits` reusable utilities | Core `skills/` |
| `integrations/` | Generated host usage and capability guides | Core integration notes |
| `generation/` | Development-only manifests and profile metadata | Hand-authored mechanical inputs |
| `assets/`, `docs/` | Presentation and package usage documentation | Hand-authored package files |

Roles, modes, dispatch, and policy are not published as root skills. Full native profiles include the role and policy required in an isolated child. Workflow commands carry their mode, router, policy, and argument contract without loading removed skills.

Each profile's frontmatter carries every Markdown host's keys at once, and each host reads only its own: `readonly` (Cursor), `disallowedTools: [Write, Edit]` (Claude Code, Kimi Code, ZCode), and `subagents: []` (Kimi). Profiles omit `model`, so hosts use the main conversation's model. Primary-session routing comes from each host's always-on rule, context, or companion installation, not from a dispatcher profile.

## Host mappings

| Host/surface | Installation resources | Boundary |
| --- | --- | --- |
| Claude Code and Desktop Code | Explicit native agent files, three native commands, two utilities | Research/review profiles exclude Write/Edit; shell-mediated editing is not a sandbox guarantee |
| Claude Cowork / Chat | Shared command/utility resources | Native component availability differs by surface; Chat does not load plugin agents |
| Cursor | Shared native agents and commands, always-applied policy, two utilities | Cursor CLI 2026.10.01 does not enforce `readonly` on plugin profiles (it does for project `.cursor/agents/`); read-only rests on prompt guidance |
| Codex CLI / local desktop | Utilities through the plugin; full TOMLs and marked global instructions through `maestria install codex` | Marketplace-only installation does not activate routing, roles, or modes; companion instructions support per-turn FEIN/SONAR/BLITZ keywords |
| ChatGPT plugin surfaces / portable v1 clients | Two root utilities | No portable native-agent, command, policy, or runtime-enforcement contract |
| Kimi Code | Shared native profiles and commands, complete primary-session bootstrap, two utilities | Research/review profiles deny `Write`/`Edit`; the host chooses models |
| Devin | Root agents, root `AGENTS.md` policy, two utilities | No plugin commands: mode keywords route through the always-on policy. Custom plugin agents load locally in CLI/Desktop, not cloud sessions; no denylist field |
| ZCode | Shared full native profiles and commands, utilities | Policy is embedded in agent/command context; research/review profiles deny `Write`/`Edit` |
| OMP | Root task profiles, commands, one always-apply rule, two utilities | Roles provide advisory boundaries rather than per-role tool enforcement |
| Hermes | Two portable utilities; optional manual host context from `rules/hermes/context.md` | No Python adapter; installation alone does not activate orchestration, modes, or named agents |

See [installation](INSTALL.md), [support boundaries](docs/support.md), and the [public guides](https://maestria.sznm.dev/agent-plugins/). OpenCode and Pi retain their native runtime packages. The standalone CLI lives in `apps/maestria-cli`; separately installable methodology skills remain under the repository's root `skills/`.

## Development and verification

Edit core methodology or `generation/` metadata, then run `scripts/sync-all` and `scripts/check-sync`. The consolidated compiler composes an explicitly owned output plan from canonical inputs and validates it before mutation. It is the single writer for this package's generated resources. Generic package sync validates every discovered configuration before any write. Cleanup retires only named generated outputs and preserves unrelated files.

Run `pnpm --filter @maestria/agent-plugins test` for archive, assembly, native context, and Kimi resource contracts. Packed evidence is written under ignored `artifacts/`. The [capability audit](https://github.com/agustinusnathaniel/maestria/blob/main/docs/agent-plugin-capabilities.md) records supported, selected, and unverified surfaces; [host verification](https://github.com/agustinusnathaniel/maestria/blob/main/docs/plugin-host-verification.md) records reproducible loader probes and their limits.

This package has no executable runtime adapter, hooks, scheduled automations, CLI executable, or MCP server. Some hosts support these components; they are intentionally omitted because this package supplies methodology and has no concrete executable integration requiring them.
