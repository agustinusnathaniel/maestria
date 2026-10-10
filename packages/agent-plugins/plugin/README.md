# @maestria/agent-plugins

maestria packages shared engineering methodology and native integration metadata in one plugin. The canonical methodology remains in `packages/core/agent-directives/`; this package contains generated projections, hand-authored manifests and integration configuration, and host adaptation inputs.

The npm artifact exposes `plugin.json` at its root. In this repository, the complete generated installation tree lives under `plugin/`. Portable clients discover the runtime `skills/` corpus there. Hosts that support it select shared methodology through their manifests or overlays. Host-specific profiles and entry points adapt that same corpus; generated files are projections, not independent sources. Kimi Code also uses the shared skills and adds only host-specific command aliases, manifest instructions, and short native bootstrap text.

| Host | Manifest | Native resources |
| --- | --- | --- |
| Portable clients | `plugin.json` | Shared skills; client owns activation |
| Claude Code | `.claude-plugin/plugin.json` | Explicit thin agent wrappers; shared `skills/`; no duplicate workflow commands |
| Cursor | `.cursor-plugin/plugin.json` | Native `agents/cursor/`, shared `skills/`, and selected integration commands and rules |
| Codex | `.codex-plugin/plugin.json` | Shared skills; companion CLI installs `agents/codex/` and the instruction template |
| Devin | `.devin-plugin/plugin.json` | Root advisory agent profiles; local CLI/Desktop only |
| ZCode | `.zcode-plugin/plugin.json` | Explicit root advisory agent files and shared skills |
| Hermes | `plugin.json` | Portable shared skills; host-generated qualified namespace |
| OMP | `plugin.json` | Portable shared skills and root advisory profiles; activation and delegation belong to OMP |
| Kimi Code | `kimi.plugin.json` | Shared `skills/`, Kimi command aliases, and shared global rules as system-prompt input; custom-agent discovery disabled |

See the [public integration guides](https://maestria.sznm.dev/agent-plugins/) for host-specific setup and capability differences. Start with [installation](https://github.com/agustinusnathaniel/maestria/blob/main/packages/agent-plugins/INSTALL.md) and [support boundaries](https://github.com/agustinusnathaniel/maestria/blob/main/packages/agent-plugins/docs/support.md). The shared orchestrator skill links to each host integration guide before native delegation.

## Source components and installation bundle

| Source path | Responsibility |
| --- | --- |
| `agents/` | Specialist and dispatcher role definitions generated from canonical core directives |
| `commands/` | Workflow definitions and host command aliases |
| `rules/` | Shared contract, host activation, and instruction resources |
| `skills/` | Reusable handoff and iteration-limit guidance |
| `generation/` | Development-only projection configs, manifest inputs, and host adaptation metadata |
| `assets/`, `docs/` | Presentation assets and package usage/support documentation |
| `plugin/` | Generated, tracked installation bundle consumed by Git installers and flattened into the npm archive |

Canonical methodology remains in core. These component views and the installation bundle are generated; neither is a second authoring home. The generator derives agent definitions from canonical role inputs rather than treating a role skill as their source.

The installed bundle retains complete role, mode, and global-rule `SKILL.md` exports where host loading requires them. Those are compatibility representations of agents, commands, and rules, alongside the reusable utility skills. Their names and content remain stable; the source `skills/` directory contains no specialist or workflow-mode definitions. Native profile schemas and permissions remain host-specific. This plugin has no executable hooks, automations, CLI, or MCP server.

## Development

Run `scripts/sync-all`, then `scripts/check-sync` from the repository root. Configs under `generation/` project canonical methodology into semantic components and host-compatible installation resources. `scripts/sync-consolidated-plugin.ts` assembles selected package resources and integration guides after projections are generated. It never installs into host directories.

Run `pnpm --filter @maestria/agent-plugins test` for assembly, native Kimi behavior, and packed payload checks. The packed test writes `artifacts/plugin-pack-evidence.json` with the shipped entries, manifest checks, preserved read-only metadata, and reproduction command. See [host-loading verification](https://github.com/agustinusnathaniel/maestria/blob/main/docs/plugin-host-verification.md) for the Claude native-child and OMP packed-discovery probes, their reproduction commands, and their limits.
