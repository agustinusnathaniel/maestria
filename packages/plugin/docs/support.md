# Support boundaries

The package ships declarative methodology and host resources. Sync and npm archive checks verify resource containment, complete paths, distinct skill roots, and preserved native metadata. Live loading and host enforcement are unverified unless a separate host test supplies evidence.

| Host | Contract | Official reference |
| --- | --- | --- |
| Portable | Root manifest and standard Agent Skills; no portable runtime agent declaration | [Agent Plugins specification](https://agent-plugins.org/specification) |
| Claude Code | Shared default skills scan; explicit agent and command file lists; preserved native tool-denial fields | [Plugin reference](https://code.claude.com/docs/en/plugins-reference) |
| Cursor | Selected host agents, commands, rules, and shared skills | [Plugin schema](https://github.com/cursor/plugins/blob/main/schemas/plugin.schema.json) |
| Codex | Skill manifest plus companion CLI-managed native TOMLs and instructions | [Codex plugin documentation](https://developers.openai.com/codex/plugins) |
| Devin | Conventional root advisory agents; CLI/Desktop availability differs from cloud | [Plugin overview](https://docs.devin.ai/cli/extensibility/plugins/overview) |
| ZCode | Explicit root advisory agents and shared skills; no host-specific command prompts | [Plugin documentation](https://zcode.z.ai/en/docs/plugin) |
| Hermes | Portable root manifest and shared skills; discover the host-generated qualified namespace; no Python plugin or runtime parity | [Portable Agent Plugins support](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins#portable-agent-plugins-v1-packages) |
| Kimi Code | Dedicated native skills and commands, session-start text injection, system instructions within 32 KB | [Plugin documentation](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html) |

Kimi's explicit empty agent list suppresses default root agent discovery, preserving its existing persona-to-built-in-profile mapping. This is verified against the [official loader source](https://github.com/MoonshotAI/kimi-code/blob/419aced0e97fa04b75f8f71b089e1667f6de6d0a/packages/agent-core-v2/src/app/plugin/manifest.ts#L110).

The root agent profiles used by Devin and ZCode carry only name and description metadata plus advisory role guidance. They do not claim native tool restrictions. Claude, Cursor, and Codex retain their native read-only metadata in isolated resource trees; actual enforcement remains the host's responsibility. Portable clients decide whether to discover the conventional root agents at all.

The `cli/`, `automations/`, and `hooks/` directories contain boundary documentation only. They activate no runtime features.
