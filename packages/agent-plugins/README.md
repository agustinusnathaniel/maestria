# @maestria/agent-plugins

Maestria ships one directly installable plugin with native host components and two reusable utility skills. Canonical methodology lives in `packages/core/agent-directives/`; generated resources and all five host manifest directories live at this package root. Git/local installations and npm archives expose the same resource paths.

## Component ownership

| Package folder | Contents | Canonical input |
| --- | --- | --- |
| `agents/` | Dispatcher and seven specialist definitions, plus schema-specific native profiles | Core `specialists/` |
| `commands/` | Complete FEIN, SONAR, and BLITZ workflow entry points and native host projections | Core `commands/`, dispatcher, policy, and integration notes |
| `rules/` | Global policy and supported host bootstrap/instruction resources | Core `rules.md` and integration notes |
| `skills/` | Only `handoff` and `iteration-limits` reusable utilities | Core `skills/` |
| `integrations/` | Generated host usage and capability guides | Core integration notes |
| `compatibility/devin/skills/` | Generated workflow transport for Devin's skill-based command loader | The same canonical workflow compositions |
| `generation/` | Development-only manifests, profile metadata, and native TOML metadata | Hand-authored mechanical inputs |
| `assets/`, `docs/` | Presentation and package usage documentation | Hand-authored package files |

Roles, modes, dispatch, and policy are not published as root skills. Full native profiles include the role and policy required in an isolated child. Workflow commands carry their mode, router, policy, and argument contract without loading removed skills. Schema-specific profiles share canonical bodies; native formats, model settings, and tool restrictions stay host-specific.

The dispatcher profile does not automatically replace a host's primary agent. Host command, policy, or companion installation determines how primary-session routing is activated.

## Host mappings

| Host/surface | Installation resources | Boundary |
| --- | --- | --- |
| Claude Code and Desktop Code | Explicit native agent files, three native commands, two utilities | Research/review profiles exclude Write/Edit; shell-mediated editing is not a sandbox guarantee |
| Claude Cowork / Chat | Shared command/utility resources | Native component availability differs by surface; Chat does not load plugin agents |
| Cursor | Selected native agents, commands, always-applied policy, two utilities | Cursor owns native readonly enforcement and reload behavior |
| Codex CLI / local desktop | Utilities through the plugin; full TOMLs and marked global instructions through `maestria install codex` | Marketplace-only installation does not activate routing, roles, or modes; companion instructions support per-turn FEIN/SONAR/BLITZ keywords |
| ChatGPT plugin surfaces / portable v1 clients | Two root utilities | No portable native-agent, command, policy, or runtime-enforcement contract |
| Kimi Code | Seven native profiles, three commands, complete primary-session bootstrap, two utilities | No built-in persona remapping or removed role-skill preloads; the host chooses models |
| Devin | Root agents, root `AGENTS.md` policy, utilities and three selected workflow compatibility exports | Custom plugin agents load locally in CLI/Desktop, not cloud sessions |
| ZCode | Selected full native profiles, three commands, utilities | Policy is embedded in agent/command context; a plugin rules selector is unverified |
| OMP | Eight task profiles, three commands, one always-apply rule, two utilities | Dispatcher is a task profile; generic roles provide advisory boundaries rather than per-role tool enforcement |
| Hermes | Two portable utilities; optional manual host context from `rules/hermes/context.md` | No Python adapter; installation alone does not activate orchestration, modes, or named agents |

See [installation](INSTALL.md), [support boundaries](docs/support.md), and the [public guides](https://maestria.sznm.dev/agent-plugins/). OpenCode and Pi retain their native runtime packages. The standalone CLI lives in `apps/maestria-cli`; separately installable methodology skills remain under the repository's root `skills/`.

## Development and verification

Edit core methodology or `generation/` metadata, then run `scripts/sync-all` and `scripts/check-sync`. The consolidated compiler composes an explicitly owned output plan from canonical inputs and validates it before mutation. It is the single writer for this package's generated resources. Generic package sync validates every discovered configuration before any write. Cleanup retires only named generated outputs and preserves unrelated files.

Run `pnpm --filter @maestria/agent-plugins test` for archive, assembly, native context, and Kimi resource contracts. Packed evidence is written under ignored `artifacts/`. The [capability audit](https://github.com/agustinusnathaniel/maestria/blob/main/docs/agent-plugin-capabilities.md) records supported, selected, and unverified surfaces; [host verification](https://github.com/agustinusnathaniel/maestria/blob/main/docs/plugin-host-verification.md) records reproducible loader probes and their limits.

This package has no executable runtime adapter, hooks, scheduled automations, CLI executable, or MCP server. Some hosts support these components; they are intentionally omitted because this package supplies methodology and has no concrete executable integration requiring them.
