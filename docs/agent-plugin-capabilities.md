# Agent Plugin Capability Contract

## Purpose

Record the complete component audit for the consolidated package, reviewed 2026-10-12. Component support, selected resources, loader verification, and model behavior are separate claims. A runtime supporting a component does not require maestria to ship an unused hook, MCP service, or scheduled task.

## Semantic ownership

The directly installable `packages/agent-plugins/` root keeps all five host manifest directories. Core owns the methodology; the consolidated compiler composes an explicit output plan before writing it.

| Component | Package contract |
| --- | --- |
| Agents | Seven complete specialists, one shared `agents/<role>.md` per role for every Markdown host (no per-host copies, no orchestrator profile); generated Codex TOMLs beside them as `agents/maestria-<role>.toml` |
| Commands | Three complete modes in one shared `commands/` set, including parent routing, policy, and argument preservation |
| Rules | Per host because formats differ: `rules/global.md` (OMP), `rules/cursor/`, `rules/kimi-code/`, `rules/codex/`, `rules/hermes/`, and root `AGENTS.md` (Devin) |
| Skills | Only reusable handoff and iteration-limit utilities |
| Integrations | Host usage and capability guides, not build configs or disguised commands |
| Generation | Development-only manifests, profile metadata, and native template metadata |
| CLI | Standalone companion in `apps/maestria-cli`, not an executable plugin component |
| Hooks, automations, MCP | Intentionally absent; no concrete executable or service capability requires them |

The portable v1 manifest exposes utilities. It does not establish native agents, commands, policy injection, scheduling, permissions, or session lifecycle. See the [published specification](https://agent-plugins.org/specification). The existing OpenCode and Pi packages retain their native runtime adapters; Prime Agent and the former OMP/Hermes adapters remain retired.

## Native mappings

| Host/surface | Roles | Workflows and parent policy | Selection / limitation |
| --- | --- | --- | --- |
| Claude Code / Desktop Code | Seven shared profiles, listed explicitly | Three shared commands carry complete context | Agent-directory selectors are rejected by the validator; `disallowedTools` Write/Edit exclusion is enforced but is not a shell sandbox; no `model` key |
| Claude Cowork / Chat | Availability differs; Chat ignores plugin agents | Commands and utilities are supported | Do not promise Code's agents/settings/hooks on every Claude surface |
| Cursor | Seven shared profiles (`agents/`) | Shared commands (`commands/`) and always-applied `rules/cursor/` rule | `readonly` is declared but not enforced for plugin-supplied agents; enforced for project `.cursor/agents/` copies written by `maestria configure cursor` at project level |
| Codex CLI / local desktop | Companion-installed complete TOMLs from `agents/maestria-<role>.toml` (plugins cannot ship agents); `sandbox_mode = "read-only"` on adventurer, architect, planner, reviewer | Companion-managed marked AGENTS block includes router, policy, and per-turn mode keywords | Portable marketplace installation alone exposes utilities |
| ChatGPT / generic portable clients | No portable role component | No portable mode or policy component | Utility-only discovery; no implied companion installation |
| Kimi Code | Seven shared profiles | Shared commands and complete systemPromptPath bootstrap | `disallowedTools: [Write, Edit]` (names registered by Kimi v0.38.0); unknown keys ignored; no built-in-profile remapping; no agent model field |
| Devin local / cloud | Custom profiles load locally; cloud does not load them | Root AGENTS policy; no plugin commands component, so modes use keywords such as `fein: <task>` | Manifest selects only `skills`; no denylist, so read-only is prompt-level; no invented commands/agents selector |
| ZCode | Seven shared profiles, listed explicitly | Three shared commands, with policy in their context | `disallowedTools` supported per docs, not live-run; plugin rule selection is unverified, not declared unsupported |
| OMP | Seven shared task profiles | Three shared commands and one always-apply `rules/global.md` | No denylist; read-only is prompt-level; `.toml` files not loaded |
| Hermes | No portable native profiles | Optional manual project context, separate from utility installation | No Python route; project-context precedence and subagent context skipping matter |

## Evidence and unresolved surfaces

- **Claude 2.1.295 (2026-10-12):** strict plugin validation and an offline real-CLI reviewer child, loaded from the shared `agents/reviewer.md`, prove native context loading, Write/Edit tool-schema exclusion, and parent return. Other specialists, model judgment, shell-mediated writes, and hosted Claude surfaces are outside that probe. [Components](https://code.claude.com/docs/en/plugins/components), [platform support](https://claude.com/docs/plugins/platform-support).
- **Codex 0.153.4:** the version-matched loader fixes portable skills to root `skills/`; the overlay does not redirect that discovery. Native full methodology is supplied by the companion installer. Its model preservation is tested independently against actual generated TOML prompts. [Loader source](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/core-plugins/src/agent_plugin_manifest.rs#L166), [custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
- **Cursor CLI 2026.10.01 (2026-10-12):** a live probe showed plugin-supplied agents did not enforce `readonly` (a write succeeded, with or without other hosts' keys present), while a project `.cursor/agents/` profile with `readonly: true` was blocked. Other hosts' keys do not affect loading. Cursor desktop is untested. [Plugin reference](https://cursor.com/docs/reference/plugins), [subagents](https://cursor.com/docs/subagents).
- **Kimi:** official native-agent and prompt-bootstrap schemas support the emitted resources. Kimi v0.38.0 source registers tools as `Write` and `Edit`, so the earlier `WriteFile`/`StrReplaceFile` denylist matched nothing; `$ARGUMENTS` is substituted in plugin commands. Not live-run. [Plugin agents](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html#plugin-agents).
- **Devin:** documented always-on policy and conventional root discovery are used; there is no denylist or commands component. Local/cloud distinctions are preserved; native task execution and recursive foreign-profile exclusion require live host evidence. [Plugin format](https://docs.devin.ai/cli/extensibility/plugins/overview).
- **ZCode:** documented explicit agent/command selection and `disallowedTools` are used; live native loading and enforcement remain unverified. [Plugin reference](https://zcode.z.ai/en/docs/plugin).
- **OMP 18.4.8 (2026-10-12):** the real loader probe on the archive and git root found 7 agents, 3 commands, 1 rule, and 2 skills, and did not load `.toml` files. An earlier install lifecycle probe (2026-10-11) covered the superseded eight-profile layout. No actual task spawn or model obedience is proved. [Plugins](https://omp.sh/docs/plugins), [subagents](https://omp.sh/docs/subagent-authoring).
- **Hermes:** the portable loader supplies skills and optional MCP resources. Full manual methodology context is separate; the first matching project-context type wins, and delegated children can skip those files. [Portable plugins](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins#portable-agent-plugins-v1-packages), [prompt assembly](https://hermes-agent.nousresearch.com/docs/developer-guide/prompt-assembly).

See [host verification](plugin-host-verification.md) for reproduction and artifacts. A doctor command, dry-run installation, accepted unknown frontmatter, or resolved selector is insufficient proof of activation or enforcement. Historical fourteen-skill/zero-command and eight-profile probes describe retired layouts and are not current acceptance evidence.

## Whole-package acceptance

Verify semantic components and parent/child context, every manifest resource, archive reachability, local/npm staging, native settings preservation, lifecycle ownership, no-write preflight failures, and unrelated-file preservation. Published archives exclude generation tooling and tests. Generic config preflight and the consolidated compiler validate before writes; processing errors must return failure in all CLI modes.

Hooks and MCP remain available host capabilities but are unused by this package. Automations belong to host scheduling APIs and are not installed by these manifests. Permission, trust, sandbox, model, and session-state controls remain host-owned. The [runtime support matrix](runtime-support-matrix.md) retains dated runtime evidence; this contract defines the consolidated component selection.
