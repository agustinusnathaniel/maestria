# Agent Plugin Capability Contract

## Purpose

Record the complete component audit for the consolidated package, reviewed 2026-10-12. Component support, selected resources, loader verification, and model behavior are separate claims. A runtime supporting a component does not require maestria to ship an unused hook, MCP service, or scheduled task.

## Semantic ownership

The directly installable `packages/agent-plugins/` root keeps all five host manifest directories. Core owns the methodology; the consolidated compiler composes an explicit output plan before writing it.

| Component | Package contract |
| --- | --- |
| Agents | Seven complete specialists, one shared `agents/<role>.md` per role for every Markdown host (no per-host copies, no orchestrator profile); generated Codex TOMLs beside them as `agents/maestria-<role>.toml` |
| Commands | Three complete modes in one shared `commands/` set, including parent routing, policy, and argument preservation |
| Rules | `rules/global.md` (OMP) and `rules/cursor/` (Cursor) keep their own formats; one root `AGENTS.md` serves Devin (always on), Kimi Code (`systemPromptPath`), Codex (installed by the CLI), and Hermes (manual), with a Host Notes section per host |
| Skills | The `handoff` and `iteration-limits` utilities and the bundled `create-pull-request` and `docs-update` methodology skills; no role, command, or policy facades |
| Integrations | Core host notes (`packages/core/agent-directives/integrations/`) composed into the generated rules and profiles; not shipped as separate guides |
| Generation | Development-only profile metadata (`generation/profiles.json`); root host manifests are hand-edited and validated against the generated outputs |
| CLI | Standalone companion in `apps/maestria-cli`, not an executable plugin component |
| Hooks, automations, MCP | Intentionally absent; no concrete executable or service capability requires them |

The portable v1 manifest exposes the four skills. It does not establish native agents, commands, policy injection, scheduling, permissions, or session lifecycle. See the [published specification](https://agent-plugins.org/specification). The existing OpenCode and Pi packages retain their native runtime adapters; Prime Agent and the former OMP/Hermes adapters remain retired.

## Native mappings

| Host/surface | Roles | Workflows and parent policy | Selection / limitation |
| --- | --- | --- | --- |
| Claude Code / Desktop Code | Seven shared profiles, listed explicitly | Three shared commands carry complete context | Agent-directory selectors are rejected by the validator; `disallowedTools` Write/Edit exclusion is enforced but is not a shell sandbox; no `model` key |
| Claude Cowork / Chat | Availability differs; Chat ignores plugin agents | Commands and utilities are supported | Do not promise Code's agents/settings/hooks on every Claude surface |
| Cursor | Seven shared profiles (`agents/`) | Shared commands (`commands/`) and always-applied `rules/cursor/` rule | `readonly` is declared but not enforced for plugin-supplied agents; enforced for project `.cursor/agents/` copies written by `maestria configure cursor` at project level |
| Codex CLI / local desktop | Companion-installed complete TOMLs from `agents/maestria-<role>.toml` (plugins cannot ship agents); `sandbox_mode = "read-only"` on adventurer, architect, planner, reviewer | Companion-managed marked AGENTS block includes router, policy, and per-turn mode keywords | Portable marketplace installation alone exposes utilities |
| ChatGPT / generic portable clients | No portable role component | No portable mode or policy component | Skill-only discovery; no implied companion installation |
| Kimi Code | Seven shared profiles | Shared commands and complete systemPromptPath bootstrap | `disallowedTools: [Write, Edit]` (tool names are in the [register](plugin-host-verification.md#kimi-code)); unknown keys ignored; no built-in-profile remapping; no agent model field |
| Devin local / cloud | Custom profiles load locally; cloud does not load them | Root AGENTS policy; no plugin commands component, so modes use keywords such as `fein: <task>` | Manifest selects only `skills`; no denylist, so read-only is prompt-level; no invented commands/agents selector |
| ZCode | Seven shared profiles (discovered from `agents/`) | Three shared commands, with policy in their context | `disallowedTools` removes `Write`/`Edit` from subagent tools per ZCode source, not live-run; ZCode has no plugin rules component |
| OMP | Seven shared task profiles | Three shared commands and one always-apply `rules/global.md` | No denylist; read-only is prompt-level; `.toml` files not loaded |
| Hermes | No portable native profiles | Optional manual project context, separate from skill installation | No Python route; project-context precedence and subagent context skipping matter |

## Verification levels

Evidence detail, versions, and dates live in the [host verification register](plugin-host-verification.md); this contract records only what ships and how far verification reaches. Plugin read-only metadata is host-dependent and recorded per host rather than assumed.

- **Claude Code:** offline real-CLI fixture plus strict validation; no paid inference. See [Claude Code](plugin-host-verification.md#claude-code).
- **Codex CLI:** source inspection plus package and installer tests; live smoke for the marketplace path. Companion supplies native agents and instructions. See [Codex CLI](plugin-host-verification.md#codex-cli).
- **Codex desktop:** docs-only, no CLI parity claim. See [Codex desktop](plugin-host-verification.md#codex-desktop).
- **Cursor:** live probe; plugin `readonly` not enforced, project copies enforced; desktop untested. See [Cursor](plugin-host-verification.md#cursor).
- **Kimi Code:** source inspection; not live-run. See [Kimi Code](plugin-host-verification.md#kimi-code).
- **Devin:** live discovery; task execution not run. See [Devin](plugin-host-verification.md#devin).
- **ZCode:** source inspection; not live-run. See [ZCode](plugin-host-verification.md#zcode).
- **OMP:** live loader probe plus a superseded-layout install lifecycle probe; no task spawn. See [OMP](plugin-host-verification.md#omp).
- **Hermes:** docs-only portable contract; skill-only installation. See [Hermes](plugin-host-verification.md#hermes).

A doctor command, dry-run installation, accepted unknown frontmatter, or resolved selector is insufficient proof of activation or enforcement. Historical fourteen-skill/zero-command and eight-profile probes describe retired layouts and are not current acceptance evidence.

## Whole-package acceptance

Verify semantic components and parent/child context, every manifest resource, archive reachability, local/npm staging, native settings preservation, lifecycle ownership, no-write preflight failures, and unrelated-file preservation. Published archives exclude generation tooling and tests. Generic config preflight and the consolidated compiler validate before writes; processing errors must return failure in all CLI modes.

Hooks and MCP remain available host capabilities but are unused by this package. Automations belong to host scheduling APIs and are not installed by these manifests. Permission, trust, sandbox, model, and session-state controls remain host-owned. Plugin-host evidence lives in the [host verification register](plugin-host-verification.md); non-plugin runtime evidence stays in the [runtime support matrix](runtime-support-matrix.md). This contract defines the consolidated component selection.
