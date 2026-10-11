# @maestria/agent-plugins

maestria packages shared engineering methodology and native integration metadata in one plugin. The canonical methodology remains in `packages/core/agent-directives/`; this package contains generated projections, hand-authored manifests and integration configuration, and host adaptation inputs.

The package directory is directly installable from a repository checkout, like the PostHog and Pstack plugins. `plugin.json`, the host manifest directories, `agents/`, and `skills/` live at this root. Published npm archives expose the same resource layout. Hosts select their native profiles and entry points through manifests; generated exports are projections, not independent methodology sources. Kimi Code uses the shared skills and adds only host-specific command aliases, manifest instructions, and short native bootstrap text.

| Host | Manifest | Native resources |
| --- | --- | --- |
| Portable clients | `plugin.json` | Shared skills; client owns activation |
| Claude Code | `.claude-plugin/plugin.json` | Explicit thin agent wrappers; shared `skills/`; no duplicate workflow commands |
| Cursor | `.cursor-plugin/plugin.json` | Native `agents/cursor/`, shared `skills/`, and selected `commands/cursor/` and `rules/cursor/` |
| Codex | `.codex-plugin/plugin.json` | Shared skills; companion CLI installs `agents/codex/` and the instruction template |
| Devin | `.devin-plugin/plugin.json` | Root advisory agent profiles; local CLI/Desktop only |
| ZCode | `.zcode-plugin/plugin.json` | Explicit root advisory agent files and shared skills |
| Hermes | `plugin.json` | Portable shared skills; host-generated qualified namespace |
| OMP | `plugin.json` | Portable shared skills and root advisory profiles; activation and delegation belong to OMP |
| Kimi Code | `kimi.plugin.json` | Shared `skills/`, Kimi command aliases, and shared global rules as system-prompt input; custom-agent discovery disabled |

See the [public integration guides](https://maestria.sznm.dev/agent-plugins/) for host-specific setup and capability differences. Start with [installation](https://github.com/agustinusnathaniel/maestria/blob/main/packages/agent-plugins/INSTALL.md) and [support boundaries](https://github.com/agustinusnathaniel/maestria/blob/main/packages/agent-plugins/docs/support.md). The shared orchestrator skill links to each host integration guide before native delegation.

## Component ownership and generated exports

| Path | Responsibility |
| --- | --- |
| Core `specialists/` | Canonical specialist and dispatcher role definitions |
| Core `commands/` | Canonical workflow-mode definitions |
| Core `rules.md` and `integrations/` | Shared contract and host-specific guidance |
| Core `skills/` | Canonical reusable handoff and iteration-limit guidance |
| Package `agents/` | Generated shared advisory profiles and selected native host profiles |
| Package `skills/` | Generated host-compatible skill exports, including role, mode, global-rule, and utility representations |
| Package `commands/`, `rules/` | Generated host aliases, activation rules, and instruction resources |
| Package `integrations/` | Generated host guides only |
| Package `generation/` | Development-only projection configs, manifest inputs, and native adaptation templates |
| Package `assets/`, `docs/` | Presentation assets and package usage/support documentation |

Canonical methodology remains in `packages/core/agent-directives/`. Roles belong to specialists, modes to commands, policy to rules, and reusable guidance to skills there. No duplicate semantic component tree is maintained inside this installable package. The generator derives advisory agent definitions directly from canonical roles rather than from exported role skills.

The fourteen complete `SKILL.md` exports preserve portable and native host loading contracts. Role and mode exports are compatibility representations, not additional semantic sources. Host-specific native schemas and permissions remain distinct. Cursor/Kimi aliases and host rules use selected subdirectories under `commands/` and `rules/` to avoid discovery by unrelated hosts. Build configuration stays in `generation/`, outside runtime integrations. This plugin has no executable hooks, automations, CLI, or MCP server.

## Development

Run `scripts/sync-all`, then `scripts/check-sync` from the repository root. Configs under `generation/` project canonical methodology directly into host-compatible installation resources. `scripts/sync-consolidated-plugin.ts` assembles selected package resources and integration guides after projections are generated. It never installs into host directories.

Run `pnpm --filter @maestria/agent-plugins test` for assembly, native Kimi behavior, and packed payload checks. The packed test writes `artifacts/plugin-pack-evidence.json` with the shipped entries, manifest checks, preserved read-only metadata, and reproduction command. See [host-loading verification](https://github.com/agustinusnathaniel/maestria/blob/main/docs/plugin-host-verification.md) for the Claude native-child and OMP packed-discovery probes, their reproduction commands, and their limits.
