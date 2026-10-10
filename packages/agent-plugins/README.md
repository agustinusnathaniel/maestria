# @maestria/agent-plugins

maestria packages shared engineering methodology and native integration metadata in one plugin. The canonical methodology remains in `packages/core/agent-directives/`; this package contains generated projections and host adapters.

The root `plugin.json` is an Agent Plugins v1 manifest with one portable `skills/` corpus. Claude Code, Cursor, Codex, Devin, and ZCode select that corpus through their overlays. Kimi Code selects a dedicated native corpus to preserve its built-in subagent profiles, session-start skill, and bounded system instructions.

| Host | Manifest | Native resources |
| --- | --- | --- |
| Portable clients | `plugin.json` | Shared skills; client owns activation |
| Claude Code | `.claude-plugin/plugin.json` | Explicit agents and commands in their `claude-code/` subdirectories |
| Cursor | `.cursor-plugin/plugin.json` | Selected `cursor/` agents, commands, and rules |
| Codex | `.codex-plugin/plugin.json` | Shared skills; companion CLI installs `agents/codex/` and the instruction template |
| Devin | `.devin-plugin/plugin.json` | Root advisory agent profiles; local CLI/Desktop only |
| ZCode | `.zcode-plugin/plugin.json` | Explicit root advisory agent files and shared skills |
| Hermes | `plugin.json` | Portable shared skills; host-generated qualified namespace |
| OMP | `plugin.json` | Portable shared skills; native `task(agent, task)` dispatch, no host manifest shim |
| Kimi Code | `kimi.plugin.json` | Isolated native skills, commands, and `SYSTEM.md`; custom-agent discovery disabled |

Start with [installation](INSTALL.md) and [support boundaries](docs/support.md). The shared orchestrator skill links to each host integration guide before native delegation.

## Development

Run `scripts/sync-all`, then `scripts/check-sync` from the repository root. The root and nested sync configs derive skills, agents, rules, and commands from core. `scripts/sync-consolidated-plugin.ts` then assembles the advisory root agent profiles and integration guides after the native projections are generated. It never installs into host directories.

Run `pnpm --filter @maestria/agent-plugins test` for assembly, native Kimi behavior, and packed payload checks. The packed test writes `artifacts/plugin-pack-evidence.json` with the shipped entries, manifest checks, preserved read-only metadata, and reproduction command. Live host loading remains unverified.
