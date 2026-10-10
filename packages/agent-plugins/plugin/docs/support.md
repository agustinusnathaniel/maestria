# Support boundaries

The generated `plugin/` installation bundle ships declarative methodology and host resources. Its contents become the npm archive root; Git consumers select that subdirectory. Source components and development-only generation configs are excluded from that archive. Sync and npm archive checks verify resource containment, complete paths, distinct skill roots, and preserved native metadata. Live loading and host enforcement are unverified unless a separate host test supplies evidence.

| Host | Contract | Official reference |
| --- | --- | --- |
| Portable | Root manifest and standard Agent Skills; no portable runtime agent declaration | [Agent Plugins specification](https://agent-plugins.org/specification) |
| Claude Code | Shared default skills scan; explicit thin agent wrappers with role and global-rules skill preloads; preserved native tool-denial fields | [Plugin components](https://code.claude.com/docs/en/plugins/components) ([manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference)) |
| Cursor | Isolated Cursor agent profiles, shared skills, and selected integration commands and rules; full role guidance remains in profiles where skill preloading is not verified | [Plugin schema](https://github.com/cursor/plugins/blob/main/schemas/plugin.schema.json) |
| Codex | Skill manifest plus companion CLI-managed native TOMLs and instructions; OpenAI presentation via the `.codex-plugin/plugin.json` compatibility fallback, no inline `extensions.com.openai` | [Codex plugin documentation](https://developers.openai.com/codex/plugins) ([packaging guide](https://developers.openai.com/plugins/build/plugins)) |
| Devin | Conventional root advisory agents; CLI/Desktop availability differs from cloud; no hooks or MCP servers declared | [Plugin file format](https://docs.devin.ai/cli/extensibility/plugins/overview) ([Customize product guide](https://docs.devin.ai/product-guides/plugins)) |
| ZCode | Explicit root advisory agents and shared skills; no host-specific command prompts | [Plugin documentation](https://zcode.z.ai/en/docs/plugin) |
| Hermes | Portable root manifest and shared skills; discover the host-generated qualified namespace; no Python plugin or runtime parity | [Portable Agent Plugins support](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins#portable-agent-plugins-v1-packages) |
| OMP | Portable root manifest and shared skills; dispatch, permissions, and lifecycle remain host-owned; no Maestria executable extension or session hooks | [Oh My Pi](https://omp.sh/) |
| Kimi Code | Shared skill corpus, Kimi-specific command aliases, session-start orchestrator, and global-rules system prompt; host-version support for these manifest fields requires separate verification | [Plugin documentation](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html) |

Kimi's explicit empty agent list suppresses default root agent discovery, preserving its existing persona-to-built-in-profile mapping. This is verified against the [official loader source](https://github.com/MoonshotAI/kimi-code/blob/419aced0e97fa04b75f8f71b089e1667f6de6d0a/packages/agent-core-v2/src/app/plugin/manifest.ts#L110).

The root agent profiles used by Devin and ZCode carry only name and description metadata plus advisory role guidance. They do not claim native tool restrictions. Claude, Cursor, and Codex retain their native read-only metadata in isolated resource trees; actual enforcement remains the host's responsibility. Portable clients decide whether to discover the conventional root agents at all.

Only populated component directories ship. The standalone CLI lives in `apps/maestria-cli`; this plugin declares no automations, lifecycle hooks, or MCP servers.

## Verified host loading

The repository provides reproducible [host-loading probes](https://github.com/agustinusnathaniel/maestria/blob/main/docs/plugin-host-verification.md). Claude Code 2.1.217 dispatched the thin reviewer wrapper, preloaded both shared skills into the child context, and omitted Write/Edit from its tool schema using an offline API fixture. OMP 18.4.8 loaded a fixture using the expected npm layout and discovered all 14 shared skills and seven root agents from the packed archive; removing `omp` metadata prevented loader registration. The probe constructs this layout directly rather than exercising installation. These checks cover loader and tool exposure behavior, not model judgment, every role, or other host versions. These checks do not establish cross-host runtime parity; Kimi's newer manifest fields and live native loading for Codex, Cursor, Devin, and ZCode still require separate verification.
