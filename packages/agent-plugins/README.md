# @maestria/agent-plugins

maestria packages shared engineering methodology and native integration metadata in one plugin. The canonical methodology remains in `packages/core/agent-directives/`; this package contains generated projections, hand-authored manifests and integration configuration, and host adapters.

The root `plugin.json` is an Agent Plugins v1 manifest with one portable `skills/` corpus. Hosts that support it select shared methodology through their manifests or overlays. Host-specific profiles and entry points adapt that same corpus; generated files are projections, not independent sources. Kimi Code also uses the shared skills and adds only host-specific command aliases, manifest instructions, and short native bootstrap text.

| Host | Manifest | Native resources |
| --- | --- | --- |
| Portable clients | `plugin.json` | Shared skills; client owns activation |
| Claude Code | `.claude-plugin/plugin.json` | Explicit thin agent wrappers; shared `skills/`; no duplicate workflow commands |
| Cursor | `.cursor-plugin/plugin.json` | Root `agents/`, shared `skills/`, and selected integration commands and rules |
| Codex | `.codex-plugin/plugin.json` | Shared skills; companion CLI installs `agents/codex/` and the instruction template |
| Devin | `.devin-plugin/plugin.json` | Root advisory agent profiles; local CLI/Desktop only |
| ZCode | `.zcode-plugin/plugin.json` | Explicit root advisory agent files and shared skills |
| Hermes | `plugin.json` | Portable shared skills; host-generated qualified namespace |
| OMP | `plugin.json` | Portable shared skills and root advisory profiles; activation and delegation belong to OMP |
| Kimi Code | `kimi.plugin.json` | Shared `skills/`, Kimi command aliases, and shared global rules as system-prompt input; custom-agent discovery disabled |

Start with [installation](https://github.com/agustinusnathaniel/maestria/blob/main/packages/agent-plugins/INSTALL.md) and [support boundaries](https://github.com/agustinusnathaniel/maestria/blob/main/packages/agent-plugins/docs/support.md). The shared orchestrator skill links to each host integration guide before native delegation.

## Development

Run `scripts/sync-all`, then `scripts/check-sync` from the repository root. Sync configs project canonical methodology from core into host-specific skills, profiles, rules, and workflow entry points. `scripts/sync-consolidated-plugin.ts` assembles selected package resources and integration guides after projections are generated. It never installs into host directories.

Run `pnpm --filter @maestria/agent-plugins test` for assembly, native Kimi behavior, and packed payload checks. The packed test writes `artifacts/plugin-pack-evidence.json` with the shipped entries, manifest checks, preserved read-only metadata, and reproduction command. Live host loading remains unverified.
