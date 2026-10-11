# Agent Plugin Capability Contract

## Purpose

Record the complete component audit for the consolidated package, reviewed 2026-10-11. Component support, selected resources, loader verification, and model behavior are separate claims. A runtime supporting a component does not require Maestria to ship an unused hook, MCP service, or scheduled task.

## Semantic ownership

The directly installable `packages/agent-plugins/` root keeps all five host manifest directories. Core owns the methodology; the consolidated compiler composes an explicit output plan before writing it.

| Component | Package contract |
| --- | --- |
| Agents | Dispatcher plus seven complete specialist definitions; schema-specific profiles where native metadata differs |
| Commands | Three complete modes, including parent routing, policy, and argument preservation |
| Rules | Global policy plus supported host activation and bootstrap resources |
| Skills | Only reusable handoff and iteration-limit utilities |
| Integrations | Host usage and capability guides, not build configs or disguised commands |
| Compatibility | Devin-only generated workflow skill transport selected outside root skills |
| Generation | Development-only manifests, profile metadata, and native template metadata |
| CLI | Standalone companion in `apps/maestria-cli`, not an executable plugin component |
| Hooks, automations, MCP | Intentionally absent; no concrete executable or service capability requires them |

The portable v1 manifest exposes utilities. It does not establish native agents, commands, policy injection, scheduling, permissions, or session lifecycle. See the [published specification](https://agent-plugins.org/specification). The existing OpenCode and Pi packages retain their native runtime adapters; Prime Agent and the former OMP/Hermes adapters remain retired.

## Native mappings

| Host/surface | Roles | Workflows and parent policy | Selection / limitation |
| --- | --- | --- | --- |
| Claude Code / Desktop Code | Seven explicit full profiles | Three explicit native commands carry complete context | Agent-directory selectors are rejected by the tested validator; Write/Edit exclusion is not a shell sandbox |
| Claude Cowork / Chat | Availability differs; Chat ignores plugin agents | Commands and utilities are supported | Do not promise Code's agents/settings/hooks on every Claude surface |
| Cursor | Seven selected native profiles | Selected commands and always-applied rule | Retain native readonly metadata and model-management paths |
| Codex CLI / local desktop | Companion-installed complete TOMLs | Companion-managed marked AGENTS block includes router, policy, and per-turn mode keywords | Portable marketplace installation alone exposes utilities |
| ChatGPT / generic portable clients | No portable role component | No portable mode or policy component | Utility-only discovery; no implied companion installation |
| Kimi Code | Seven selected native profiles | Native commands and complete systemPromptPath bootstrap | No built-in-profile remapping; no unsupported sessionStart.command or agent model field |
| Devin local / cloud | Custom profiles load locally; cloud does not load them | Root AGENTS policy; three mode skills selected from compatibility exports | Skills-directory array replaces default selection; no invented commands/agents selector |
| ZCode | Explicit native profiles | Explicit commands, with policy in their context | Plugin rule selection is unverified, not declared unsupported |
| OMP | Eight root task profiles | Three root commands and one always-apply global rule | Dispatcher profile does not replace main agent; generic role tool permissions remain advisory |
| Hermes | No portable native profiles | Optional manual project context, separate from utility installation | No Python route; project-context precedence and subagent context skipping matter |

## Evidence and unresolved surfaces

- **Claude 2.1.217:** strict plugin validation and an offline real-CLI reviewer child prove native context loading, Write/Edit tool-schema exclusion, and parent return. Other specialists, model judgment, shell-mediated writes, and hosted Claude surfaces are outside that probe. [Components](https://code.claude.com/docs/en/plugins/components), [platform support](https://claude.com/docs/plugins/platform-support).
- **Codex 0.153.4:** the version-matched loader fixes portable skills to root `skills/`; the overlay does not redirect that discovery. Native full methodology is supplied by the companion installer. Its model preservation is tested independently against actual generated TOML prompts. [Loader source](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/core-plugins/src/agent_plugin_manifest.rs#L166), [custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
- **Cursor:** selectors and readonly metadata are documented; live native task/reload behavior is unverified here. [Plugin reference](https://cursor.com/docs/reference/plugins), [subagents](https://cursor.com/docs/subagents).
- **Kimi:** official native-agent and prompt-bootstrap schemas support the emitted resources. Archive/schema checks do not establish live dispatch, tool filtering, or reload. [Plugin agents](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html#plugin-agents).
- **Devin:** documented always-on policy and custom skill-directory selection are used. Local/cloud distinctions are preserved; native task execution and recursive foreign-profile exclusion require live host evidence. [Plugin format](https://docs.devin.ai/cli/extensibility/plugins/overview).
- **ZCode:** documented explicit agent/command selection is used; live native loading and policy enforcement remain unverified. [Plugin reference](https://zcode.z.ai/en/docs/plugin).
- **OMP 18.4.8:** source/archive discovery, a real isolated archive installation lifecycle, command expansion, global prompt injection, and all eight task-template compositions were exercised without inference. The source/packaged native payloads match. No actual task spawn or model obedience is proved. [Plugins](https://omp.sh/docs/plugins), [subagents](https://omp.sh/docs/subagent-authoring).
- **Hermes:** the portable loader supplies skills and optional MCP resources. Full manual methodology context is separate; the first matching project-context type wins, and delegated children can skip those files. [Portable plugins](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins#portable-agent-plugins-v1-packages), [prompt assembly](https://hermes-agent.nousresearch.com/docs/developer-guide/prompt-assembly).

See [host verification](plugin-host-verification.md) for reproduction and artifacts. A doctor command, dry-run installation, accepted unknown frontmatter, or resolved selector is insufficient proof of activation or enforcement. Historical fourteen-skill/zero-command probes describe the retired layout and are not current acceptance evidence.

## Whole-package acceptance

Verify semantic components and parent/child context, every manifest resource, archive reachability, local/npm staging, native settings preservation, lifecycle ownership, no-write preflight failures, and unrelated-file preservation. Published archives exclude generation tooling and tests. Generic config preflight and the consolidated compiler validate before writes; processing errors must return failure in all CLI modes.

Hooks and MCP remain available host capabilities but are unused by this package. Automations belong to host scheduling APIs and are not installed by these manifests. Permission, trust, sandbox, model, and session-state controls remain host-owned. The [runtime support matrix](runtime-support-matrix.md) retains dated runtime evidence; this contract defines the consolidated component selection.
