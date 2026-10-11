# Support boundaries

The package root is directly installable and uses the same resource paths in npm archives. Root skills are the two reusable utilities. Native hosts consume agent, command, and policy resources through their supported loading mechanisms; the portable manifest does not standardize those components.

| Host | Selected contract | Official reference |
| --- | --- | --- |
| Portable v1 | Root utility skills only; no native orchestration or policy activation | [Specification](https://agent-plugins.org/specification) |
| Claude Code | Explicit full native profiles and commands, root utilities; Code/Cowork/Chat have distinct component support | [Components](https://code.claude.com/docs/en/plugins/components), [platform support](https://claude.com/docs/plugins/platform-support) |
| Cursor | Selected agents, commands, always-applied policy, and utilities | [Plugins](https://cursor.com/docs/reference/plugins), [subagents](https://cursor.com/docs/subagents) |
| Codex | Portable utilities; full profiles and primary instructions through the companion CLI | [Version-matched loader](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/core-plugins/src/agent_plugin_manifest.rs#L166), [custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents) |
| Kimi Code | Explicit native profiles, commands, and complete system-prompt bootstrap | [Plugin agents](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html#plugin-agents) |
| Devin | Native policy and local profiles; selected workflow skill transport plus utilities | [Plugin format](https://docs.devin.ai/cli/extensibility/plugins/overview) |
| ZCode | Selected native profiles, commands, and utilities; policy in their instructions | [Plugin reference](https://zcode.z.ai/en/docs/plugin) |
| OMP | Native root profiles, commands and global rule alongside portable utilities | [Plugins](https://omp.sh/docs/plugins), [subagents](https://omp.sh/docs/subagent-authoring) |
| Hermes | Portable utilities; optional manual project context; no Python adapter | [Portable plugins](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins#portable-agent-plugins-v1-packages), [prompt assembly](https://hermes-agent.nousresearch.com/docs/developer-guide/prompt-assembly) |

Claude's tested native reviewer excludes Write/Edit from the tool schema, which does not establish a shell sandbox or model compliance. Cursor declares its supported readonly field. Codex research/review profiles retain read-only sandbox metadata. Kimi filters its named write tools but does not establish a shell sandbox or per-profile model override. Generic profiles are advisory; their names do not grant authenticated permission boundaries.

Documented component support is separate from tested loading. Claude offline native-child and OMP installed-loader probes have reproducible evidence in the [host verification record](https://github.com/agustinusnathaniel/maestria/blob/main/docs/plugin-host-verification.md). Cursor, Kimi, Devin and ZCode end-to-end native task execution remains unverified. Directory reachability or a validator accepting a key is not proof of activation, enforcement, reload, or model behavior.

The package intentionally declares no hooks, automations, runtime adapter or MCP server. Hosts may support them; none has a concrete Maestria purpose in this distribution. Hosted ChatGPT and generic portable clients receive utilities without an implicit local companion installation. OpenCode and Pi continue to use their separate native adapters.
