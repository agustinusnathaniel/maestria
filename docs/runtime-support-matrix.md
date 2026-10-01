# Runtime Support Matrix

Maintainer evidence ledger supporting [ADR-CORE-014](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md): runtime capabilities, enforcement, and promotion gates. It records dated research evidence, not a public support promise.

Every row is a dated snapshot as of its review date, not a maintenance obligation; reverification timing is governed by [ADR-CORE-014](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md). Start with the [snapshot](#snapshot) for support decisions, then follow each Evidence ID to its runtime section for sources and verification limits.

## How to read this document

- **Reviewed:** the date the cited source was last verified; older claims are stale against the runtime's current documented state.
- **Verified:** a fact read directly from an official source on the review date. `[inferred]` marks a reasonable but unconfirmed assumption, tagged with its evidence.
- **Support level** uses the controlled vocabulary from ADR-CORE-014 (`Native`, `Native candidate`, `Provisional`, `Deferred`, `Withdrawn`) and contains no delivery terms.
- **Capability** (`Supported`, `Available`, `Unverified`, `Unavailable`) records what a runtime can do.
- **Control** (`Enforced`, `Trust-gated`, `Ignored`, `Advisory`, `Not a sandbox`, `Unsupported`) records what a runtime actually enforces. Skills, MCP, plugin loading, subagents, and JSON/RPC are never labeled `Enforced` as security controls.
- **Test status** is `tested` or `not tested`, qualified by the verification boundary; none implies a live runtime end-to-end test. `tested: source inspection` = pinned upstream source read, no runtime execution; `tested: package/unit tests` = tests against a fake host API; `tested: built-artifact smoke` = compiled artifact built and its behavior exercised.
- **Pinned state:** the exact release/version/immutable commit/docs revision per record, or the exact text `unpinned - reverify before implementation`.
- **Evidence ID:** links each row to a complete per-runtime Evidence record through one or more IDs (for example `E-CLAUDE-01`); the record carries runtime/surface, claim, pinned state, source URL/path, review date, and test status. Records are self-contained: do not infer runtime, date, or source from the section heading.

## Maestria CLI adapter evidence (reviewed 2026-08-13)

CLI adapters wrap host-native capabilities: they stage the published npm package under `~/.cache/maestria/`, register a local marketplace with the host CLI, and use the host's native install/remove/list commands. The Codex adapter also installs native custom-agent TOMLs and a marked global `AGENTS.md` orchestration block, because those surfaces are outside the plugin manifest.

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CLI-01 | Claude Code | Host CLI | `claude plugin marketplace add`, `install`, `uninstall`, and `list --json` are available for the user-scope adapter | Claude Code `2.1.217` | `claude plugin --help`; `apps/maestria-cli/src/lib/platforms.ts` | 2026-08-13 | tested |
| E-CLI-02 | Codex CLI | Host CLI | `codex plugin marketplace add`, `add`, `remove`, and `list --json` are available for the marketplace adapter | Codex CLI `0.145.0` | `codex plugin --help`; `apps/maestria-cli/src/lib/platforms.ts` | 2026-08-13 | tested |
| E-CLI-03 | Both | Distribution bridge | The adapter stages the published package and creates a local marketplace manifest; it does not edit host configuration files directly | Working-tree CLI implementation | `apps/maestria-cli/src/lib/platforms.ts` | 2026-08-13 | tested by code inspection |

## Snapshot

| Runtime | Support level | Delivery | Disposition | Rationale | Evidence ID | Reviewed |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Code | Native candidate | Plugin | candidate native plugin | Promotion gated on approved docs and a blind review | E-CLAUDE-01 | 2026-08-11 |
| Prime Agent | Native candidate | Skills-first + verified extension subset | skills + mode-command extension; native rlm dispatch deferred | Skills-first package plus a small verified extension subset (mode commands, mode prompt injection); native `rlm` dispatch/JSON-RPC deferred until a public JS bridge is verified | E-PRIME-01 | 2026-08-13 |
| Codex CLI | Native | Plugin + CLI-managed native agents/instructions | shipped native CLI adapter | Verified plugin skills, native custom agents, automatic primary-session orchestration guidance, model configuration, and idempotent install/update/uninstall against Codex CLI 0.145.0 and current upstream source | E-CODEX-CLI-12, E-CODEX-CLI-13, E-CODEX-CLI-14, E-CODEX-CLI-15 | 2026-08-26 |
| Codex desktop | Deferred | Common-subset projection | no CLI parity | Common-subset projection only; no CLI parity claim | E-CODEX-DESKTOP-01 | 2026-08-11 |
| JCode | Deferred | Projection | Deferred - projection/experiment only | No confirmed first-class package/extension API | E-JCODE-01 | 2026-08-11 |
| Crush | Deferred | Projection | Deferred - projection/experiment only | No confirmed first-class package/extension API | E-CRUSH-01 | 2026-08-11 |
| DeepSeek Harness | Provisional | Projection + native plugin + agent preset | shipped provisional package, unverified against a live runtime | 14-skill projection plus a Cordis plugin (prompt sections, persona variables, skills provider) and a self-contained Maestria agent preset with per-specialist subagent delegation; typechecked and unit-tested against the published `@deepseek-ai/*` RC types, not verified against a live `dsh` deployment | E-DSH-01 | 2026-09-06 |

The per-runtime sections below are dated evidence snapshots as of their review dates, not maintenance obligations; each runtime's disposition is set by this table.

---

## Claude Code

### Evidence (historical baseline reviewed 2026-08-11)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CLAUDE-01 | Claude Code | Plugin layout | Plugins are self-contained directories with skills, agents, hooks, or a `.claude-plugin/plugin.json` manifest; skills in `skills/<name>/SKILL.md`, agents in `agents/`, hooks in `hooks/hooks.json` | unpinned - reverify before implementation | https://code.claude.com/docs/en/plugins | 2026-08-11 | not tested |
| E-CLAUDE-02 | Claude Code | Plugin skills | Plugin skills are namespaced as `/plugin-name:skill-name` | unpinned - reverify before implementation | https://code.claude.com/docs/en/plugins | 2026-08-11 | not tested |
| E-CLAUDE-03 | Claude Code | Plugin distribution | Plugin distribution uses plugin marketplaces | unpinned - reverify before implementation | https://code.claude.com/docs/en/plugin-marketplaces | 2026-08-11 | not tested |
| E-CLAUDE-04 | Claude Code | Hooks | A matching `PreToolUse` hook handler that returns `hookSpecificOutput.permissionDecision: "deny"` can block the matched call conditionally on event, matcher, handler, decision format, and active installation scope; best-effort `if` filters can fail open. Hooks run at lifecycle points including `PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd`, `SubagentStart`, `SubagentStop`, `Stop`, and `PreCompact`/`PostCompact`; handlers support command, HTTP, MCP tool, prompt, and agent types | unpinned - reverify before implementation | https://code.claude.com/docs/en/hooks | 2026-08-11 | not tested |
| E-CLAUDE-05 | Claude Code | Plugin hooks | Plugin `hooks/hooks.json` is a supported shareable resource and runs with the same event schema as settings hooks when enabled; presence alone is not enforcement, a matching blocking handler is required | unpinned - reverify before implementation | https://code.claude.com/docs/en/hooks | 2026-08-11 | not tested |
| E-CLAUDE-06 | Claude Code | Plugin subagents | Plugin subagents are loaded from a plugin's `agents/` directory with a scoped identifier | unpinned - reverify before implementation | https://code.claude.com/docs/en/sub-agents | 2026-08-11 | not tested |
| E-CLAUDE-07 | Claude Code | Plugin-subagent frontmatter | For security reasons, plugin subagents do not support the `hooks`, `mcpServers`, or `permissionMode` frontmatter fields; these fields are ignored when loading agents from a plugin. To use them, copy the agent file into `.claude/agents/` or `~/.claude/agents/` | unpinned - reverify before implementation | https://code.claude.com/docs/en/sub-agents | 2026-08-11 | not tested |
| E-CLAUDE-08 | Claude Code | `@maestria/claude-code` first package | The package ships no `hooks/` directory and no package-level hook resources or handlers, so there is no package-level hook enforcement; this does not downgrade runtime/plugin capability | Working-tree package snapshot; verify at landing | `packages/claude-code/tests/plugin.test.ts`, `packages/claude-code/package.json` | 2026-08-12 | tested |

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-CLAUDE-06 | Plugin subagent loading | Supported | Advisory | Loading is not itself a security control |
| E-CLAUDE-07 | `permissionMode`, `hooks`, `mcpServers` on plugin subagents | Unavailable | Ignored | Must move to project/user agent files if needed |
| E-CLAUDE-04 | Matching `PreToolUse` handler returning `hookSpecificOutput.permissionDecision: "deny"` | Supported | Enforced | Blocking is conditional; best-effort `if` filters can fail open |
| E-CLAUDE-05 | Plugin `hooks/hooks.json` resource | Supported | Advisory | Presence alone is not enforcement; a matching blocking handler is required |
| E-CLAUDE-08 | `@maestria/claude-code` first package hook resources and handlers | Unavailable | Advisory | No package-level hooks; does not downgrade runtime/plugin capability |

### Statuses and gates

- **Promotion:** the repaired docs pass blind review; a plugin package ships via the core sync pipeline (ADR-CORE-005) with `scripts/check-sync` passing; the ADR-CORE-014 gates are verified. The native-candidate implementation may already exist; gates precede promotion or landing.
- **Withdrawal:** if the plugin-subagent field limitation cannot be worked around without dropping the plugin distribution shape, downgrade or remove the plugin delivery, capability, and control claims. The project/user agent file workaround is a promotion-gate item, not an open question; rollback and re-promotion follow ADR-CORE-014.

---

## Prime Agent

> Evidence was re-verified on 2026-08-13 against the immutable upstream commit `7787f07415d843b9a800f6a4720e0c739bd608e5` (PrimeIntellect-ai/prime-agent, `main`): E-PRIME-01..07 were confirmed and pinned to that commit, and the executable-extension subset (E-PRIME-09..11) was verified against it. The decision stays `Native candidate`; native `rlm` dispatch remains deferred.

### Evidence (reverified 2026-08-13)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-PRIME-01 | Prime Agent | Identity | Prime Agent is an open-source RLM coding and research agent built on the Pi ecosystem: "Our agent and TUI is built on top of `pi`" (earendil-works/pi) | 7787f07415d843b9a800f6a4720e0c739bd608e5 (immutable commit) | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/README.md | 2026-08-13 | not tested |
| E-PRIME-02 | Prime Agent | Subagents | `rlm(...)` spawns real child agents (subagents) for parallel or background work and returns results programmatically | 7787f07415d843b9a800f6a4720e0c739bd608e5 (immutable commit) | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/README.md | 2026-08-13 | not tested |
| E-PRIME-03 | Prime Agent | Skills | Skills implement the Agent Skills standard (`SKILL.md` + frontmatter); `name` and `description` are required, unknown frontmatter fields are ignored, and skills with a missing description are not loaded; validation is otherwise lenient (warnings, including name/directory mismatch); Python-backed skills install packages into the persistent IPython kernel | 7787f07415d843b9a800f6a4720e0c739bd608e5 (immutable commit) | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/docs/skills.md | 2026-08-13 | not tested |
| E-PRIME-04 | Prime Agent | Skill discovery | Skill discovery paths include `~/.prime/agent/skills/`, `.prime/agent/skills/`, `~/.agents/skills/`, `.agents/skills/`, package `skills/` directories or `pi.skills` entries in `package.json`, settings `skills` arrays, `--skill <path>`, and built-in skills. Root `.md` files are discovered as individual skills only in the prime-specific paths (`~/.prime/agent/skills/`, `.prime/agent/skills/`); directories containing `SKILL.md` are discovered recursively in all skill locations; root `.md` files under `~/.agents/skills/` and `.agents/skills/` are ignored | 7787f07415d843b9a800f6a4720e0c739bd608e5 (immutable commit) | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/docs/skills.md | 2026-08-13 | not tested |
| E-PRIME-05 | Prime Agent | Skill consumption | Prime Agent can consume skills from other harnesses by adding their directories to settings, including `~/.claude/skills` and `~/.codex/skills` (global) and `.prime/agent/settings.json` with `"skills": ["../.claude/skills"]` (project) | 7787f07415d843b9a800f6a4720e0c739bd608e5 (immutable commit) | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/docs/skills.md | 2026-08-13 | not tested |
| E-PRIME-06 | Prime Agent | Headless modes | JSON mode and RPC mode exist for headless automation and integrations (documented as `docs/json.md` and `docs/rpc.md`) | 7787f07415d843b9a800f6a4720e0c739bd608e5 (immutable commit) | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/README.md | 2026-08-13 | not tested |
| E-PRIME-07 | Prime Agent | Execution boundary | "Prime Agent executes model-generated Python and project commands with your user permissions. Its worker and kernel processes improve lifecycle isolation and recovery; they are **not** a security sandbox." | 7787f07415d843b9a800f6a4720e0c739bd608e5 (immutable commit) | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/README.md | 2026-08-13 | not tested |
| E-PRIME-08 | Prime Agent | `@maestria/prime-agent` first package | The package ships 14 Agent Skills (`skills/<name>/SKILL.md`), each with the required `name` (matching its directory) and `description` frontmatter, generated from canonical directives via the core sync pipeline, plus a compiled extension (`dist/extension.mjs`, declared under `pi.extensions`) covering the verified mode subset; it claims no native `rlm` dispatch or JSON/RPC headless mode and makes no sandbox claim | Working-tree package snapshot; verify at landing | `packages/prime-agent/` (sync.config.ts, skills/, src/, tests/, README.md, package.json) | 2026-08-13 | tested: package/unit tests + built-artifact smoke (live Prime E2E not tested) |
| E-PRIME-09 | Prime Agent | Extension API subset | The pinned fork's public extension API (exported by `@earendil-works/pi-coding-agent`, `src/core/extensions/types.ts` re-exported from `src/index.ts`) supports: default-export factory `(pi: ExtensionAPI) => void \| Promise<void>`; `pi.registerCommand(name, { description, handler(args, ctx) })`; `pi.on("before_agent_start", ...)` returning `{ systemPrompt }` (chained per turn); `pi.on("session_start" / "session_tree" / "session_shutdown")`; `pi.appendEntry(customType, data)` with `CustomEntry { type: "custom", customType, data }` persisted in the session; `ctx.sessionManager.getBranch()/getEntries()` (ReadonlySessionManager); `pi.sendUserMessage(content, { deliverAs })`; `ctx.ui.notify/setEditorText`; extension paths declared under `pi.extensions` in package.json are resolved relative to the package root and must exist | 7787f07415d843b9a800f6a4720e0c739bd608e5 (immutable commit) | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/src/core/extensions/types.ts; .../docs/extensions.md; .../src/core/extensions/loader.ts | 2026-08-13 | tested: source inspection |
| E-PRIME-10 | Prime Agent | `rlm` dispatch bridge | `rlm(...)` subagent dispatch is an IPython-side (Python) tool of the RLM runtime; the public extension API of the pinned fork exposes no JS subagent-spawn bridge (no such method on `ExtensionAPI`/`ExtensionCommandContext`; `ExtensionCommandContext` session methods are `newSession`/`fork`/`navigateTree`/`switchSession`/`reload`, not subagents). A Prime extension therefore cannot dispatch native `rlm` subagents | 7787f07415d843b9a800f6a4720e0c739bd608e5 (immutable commit) | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/src/core/extensions/types.ts; .../docs/rlm.md | 2026-08-13 | tested: source inspection |
| E-PRIME-11 | Prime Agent | Runtime dependency boundary | The Prime-compatible `@earendil-works/pi-coding-agent` fork (`0.7.2` in the pinned workspace) is NOT published to npm (registry carries only the original Pi line, latest `0.84.1`). Prime bundles pi packages into its runtime (jiti virtual modules in the compiled binary, workspace aliases in dev), and its `docs/packages.md` requires core pi packages imported at runtime and not bundled to be listed in `peerDependencies` as `"*"`. `@maestria/prime-agent` imports only types (erased at build), so `dist/extension.mjs` has zero pi imports and the package declares no runtime/peer dependency on pi packages | 7787f07415d843b9a800f6a4720e0c739bd608e5 (immutable commit); npm registry | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/docs/packages.md; https://registry.npmjs.org/@earendil-works/pi-coding-agent (dist-tags latest 0.84.1) | 2026-08-13 | tested: source inspection |

**Test coverage (local package evidence):** `tested` labels are level-specific, never a live runtime E2E. E-PRIME-09/10/11 are **source inspection** of the pinned commit; E-PRIME-08 is verified by **package/unit tests** (skills layout and frontmatter, manifest/dependency boundary, and extension behavior against a fake `pi` API in `tests/skills.test.ts`, `tests/package.test.ts`, `tests/extension.test.ts`) and by **built-artifact smoke** (the package `test` script builds `dist/extension.mjs` first, then `tests/package.test.ts` exercises command registration, command behavior, and mode prompt injection against a fake `pi` API). Live Prime Agent E2E is not tested; the immutable source pin and `Native candidate` status are unaffected.

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-PRIME-03 | Skills (Agent Skills standard, Python-backed) | Supported | Advisory | Loading is not a security control |
| E-PRIME-02 | Subagent dispatch (`rlm`) | Supported | Advisory | Dispatch is not a security control; not in the package (deferred; no JS extension bridge, E-PRIME-10) |
| E-PRIME-06 | JSON/RPC headless modes | Available | Advisory | Not a security control; not in the package (deferred) |
| E-PRIME-07 | Execution sandbox | Unavailable | Not a sandbox | Model-generated Python/commands run with user permissions |
| E-PRIME-08, E-PRIME-09 | `@maestria/prime-agent` extension subset (mode commands, mode prompt injection, session-scoped mode state) | Supported | Advisory | Registered via `pi.registerCommand` / `pi.on("before_agent_start")` / session custom entries; advisory prompt/state behavior, no tool interception or security control |
| E-PRIME-08 | `@maestria/prime-agent` skills package | Supported | Advisory | 14 generated Agent Skills with required frontmatter; advisory only, no native `rlm`/JSON-RPC or sandbox claim |

### Statuses and gates

- **Promotion to `Native`:** a stable supported API for an executable extension beyond the verified subset (native `rlm` dispatch / JSON-RPC needs a public JS bridge the pinned fork does not expose); a verified security model (not a sandbox, so trusted repositories and skills only); package plus subset ships via the sync pipeline with `scripts/check-sync` passing. The package exists; these gates are not yet met.
- **Withdrawal:** if no stable executable-extension API exists beyond the verified subset, keep native dispatch deferred and downgrade or remove package-level claims; rollback and re-promotion follow ADR-CORE-014.

---

## Codex CLI

### Evidence (reviewed 2026-08-11)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CODEX-CLI-01 | Codex CLI | Identity | Codex CLI is a local coding agent, distinct from the desktop app (`codex app`), the IDE extension, and the cloud-based Codex Web (`chatgpt.com/codex`) | unpinned - reverify before implementation | https://github.com/openai/codex | 2026-08-11 | not tested |
| E-CODEX-CLI-02 | Codex CLI | Surface scope | Codex supports AGENTS.md, subagents, config files, skills, plugins, and hooks | unpinned - reverify before implementation | https://developers.openai.com/codex | 2026-08-11 | not tested |
| E-CODEX-CLI-03 | Codex CLI | Hook trust | Non-managed command hooks must be reviewed and trusted before they run; Codex records trust against the hook's current hash; new or changed hooks are skipped until trusted | unpinned - reverify before implementation | https://developers.openai.com/codex/hooks | 2026-08-11 | not tested |
| E-CODEX-CLI-04 | Codex CLI | Hook types | Only `type: "command"` hook handlers run today; `prompt` and `agent` handlers are parsed but skipped | unpinned - reverify before implementation | https://developers.openai.com/codex/hooks | 2026-08-11 | not tested |
| E-CODEX-CLI-05 | Codex CLI | Managed hook policy | Managed hooks are trusted by managed policy: they run under it rather than the per-hash trust review non-managed command hooks require, so they are not `Trust-gated` like non-managed hooks | unpinned - reverify before implementation | https://developers.openai.com/codex/hooks | 2026-08-11 | not tested |
| E-CODEX-CLI-06 | Codex CLI | Trust-bypass | A documented trust-bypass configuration lets hooks run without the normal trust review; it is an explicit security exception, not an enforcement path | unpinned - reverify before implementation | https://developers.openai.com/codex/hooks | 2026-08-11 | not tested |

### Pinned re-verification (2026-08-13)

The projection baseline is local `codex 0.145.0` (`rust-v0.145.0`, commit `25af12f`).

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CODEX-CLI-07 | Codex CLI | Version identity | The local CLI reports `codex 0.145.0`; the matching upstream release is `rust-v0.145.0` | `0.145.0`; commit `25af12f` | `codex --version`; https://github.com/openai/codex/releases/tag/rust-v0.145.0 | 2026-08-13 | tested |
| E-CODEX-CLI-08 | Codex CLI | Plugin bundle | A plugin requires `.codex-plugin/plugin.json` and can expose skills from a `skills/` directory; the plugin name provides the component namespace | `rust-v0.145.0` plugin specification | https://github.com/openai/codex/blob/rust-v0.145.0/codex-rs/skills/src/assets/samples/plugin-creator/references/plugin-json-spec.md; https://developers.openai.com/plugins/build/plugins | 2026-08-13 | tested |
| E-CODEX-CLI-09 | Codex CLI | Hook handlers | The pinned source executes configured command handlers; prompt and agent handlers are parsed but skipped | `rust-v0.145.0` | https://github.com/openai/codex/blob/rust-v0.145.0/codex-rs/hooks/src/engine/discovery.rs | 2026-08-13 | tested: source inspection |
| E-CODEX-CLI-10 | Codex CLI | Plugin hook trust | Non-managed plugin hooks require managed status, a matching trusted hash, or an explicit bypass before command execution | `rust-v0.145.0` | https://github.com/openai/codex/blob/rust-v0.145.0/codex-rs/hooks/src/engine/discovery.rs; https://github.com/openai/codex/blob/rust-v0.145.0/codex-rs/hooks/src/registry.rs | 2026-08-13 | tested: source inspection |
| E-CODEX-CLI-11 | Codex CLI | Maestria projection | At the 2026-08-13 review point, the package generated 14 skills and the separate Maestria CLI provided npm-backed marketplace staging; native agents and automatic instructions were added in the subsequent re-verification | `packages/codex` on the 2026-08-13 snapshot | `packages/codex/sync.config.ts`; `packages/codex/skills/`; `apps/maestria-cli/src/lib/platforms.ts` | 2026-08-13 | tested after sync |

### Current re-verification (2026-08-26)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CODEX-CLI-12 | Codex CLI | Native custom agents | Codex discovers standalone custom-agent TOMLs from `~/.codex/agents/` and project agent directories, including `name`, `description`, `developer_instructions`, model, reasoning, sandbox, MCP, and skill configuration fields | Codex CLI `0.145.0`; current upstream source | https://learn.chatgpt.com/docs/agent-configuration/subagents?surface=app; `/home/nathan/.opensrc/repos/github.com/openai/codex/main/codex-rs/core/src/config/agent_roles.rs` | 2026-08-26 | tested: source inspection + package/unit tests |
| E-CODEX-CLI-13 | Codex CLI | Delegation | Native subagent selection uses the `agent_type` role name, so Maestria's `maestria-*` TOMLs are directly addressable by Codex's delegation runtime | Codex CLI `0.145.0`; current upstream source | https://learn.chatgpt.com/docs/agent-configuration/subagents?surface=app; `/home/nathan/.opensrc/repos/github.com/openai/codex/main/codex-rs/core/src/tools/handlers/multi_agents_spec.rs` | 2026-08-26 | tested: source inspection + package/unit tests |
| E-CODEX-CLI-14 | Codex CLI | Global instructions | Codex loads global `AGENTS.override.md` or `AGENTS.md` from `$CODEX_HOME`; the Maestria CLI manages a marked block in the active file and preserves unrelated instructions | Codex CLI `0.145.0`; current upstream source | https://learn.chatgpt.com/docs/config-file/config-reference; `/home/nathan/.opensrc/repos/github.com/openai/codex/main/codex-rs/codex-home/src/instructions/mod.rs` | 2026-08-26 | tested: source inspection + package/unit tests |
| E-CODEX-CLI-15 | Codex CLI | Maestria integration | `maestria install codex` installs the skills plugin, seven native roles, model-preserving updates, and automatic orchestration guidance; uninstall removes only Maestria-managed content | Working-tree implementation; Codex CLI `0.145.0` | `apps/maestria-cli/src/lib/platforms.ts`; `packages/codex/instructions/AGENTS.md`; `packages/codex/tests/plugin.test.ts` | 2026-08-26 | tested: package/unit tests + built package |
| E-CODEX-CLI-16 | Codex CLI | Native marketplace | The repository marketplace entry maps `maestria@maestria` to the published `@maestria/codex` npm package; native `codex plugin marketplace add` followed by `codex plugin add maestria@maestria` installs the published plugin and skills | Codex CLI `0.145.0`; published `@maestria/codex@0.3.2` | `.agents/plugins/marketplace.json`; `/home/nathan/.opensrc/repos/github.com/openai/codex/main/codex-rs/core-plugins/src/marketplace.rs`; isolated Codex smoke test | 2026-08-26 | tested: live host smoke |

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-CODEX-CLI-10 | Non-managed plugin command hooks | Supported | Trust-gated | Require managed status, a matching trusted hash, or an explicit bypass |
| E-CODEX-CLI-10 | Managed hook policy and trust bypass | Available | Advisory | Host controls and explicit exceptions, not Maestria enforcement paths |
| E-CODEX-CLI-09 | Hooks (prompt/agent types) | Unavailable | Unsupported | Parsed but skipped by the pinned source |
| E-CODEX-CLI-08 | Plugin manifest and skills | Supported | Advisory | Skills are the bounded projection surface; they do not enforce delegation, role permissions, or review |
| E-CODEX-CLI-12 | Native custom-agent TOMLs | Supported | Host-enforced where configured | Codex owns discovery, role selection, sandbox settings, and per-agent runtime configuration |
| E-CODEX-CLI-14 | Global `AGENTS.md` instructions | Supported | Advisory | The managed block activates the workflow in the host-owned primary session; user and repository instructions still take precedence |

### Statuses and gates

- **Version sensitivity gate:** baseline pinned to `codex 0.145.0` / `rust-v0.145.0` (`25af12f`). Reverify after CLI upgrades or material plugin/hook changes.
- **Integration boundary:** keep the plugin manifest skills-focused. Native custom agents, model configuration, and the marked global `AGENTS.md` block belong to the companion CLI; do not add hooks or MCP without a separate decision and security review.
- **Promotion to `Native`:** resolved 2026-08-26 after docs/source re-verification, package tests, and full workspace checks. Reverify after material host changes; rollback and re-promotion follow ADR-CORE-014.

---

## Codex desktop

### Evidence (reviewed 2026-08-11)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CODEX-DESKTOP-01 | Codex desktop | Surface identity | `[inferred]` Codex desktop means the hosted ChatGPT/Codex desktop surface, not an IDE integration. Evidence: the Codex docs list "ChatGPT desktop app" as a distinct surface alongside Codex CLI, Codex IDE extension, and Codex Web | unpinned - reverify before implementation | https://developers.openai.com/codex | 2026-08-11 | not tested |
| E-CODEX-DESKTOP-02 | Codex desktop | Extension surface | `[inferred]` The CLI extension surface is unverified for the hosted desktop surface; no parity claim is made. Evidence: the CLI-only surfaces (hooks, config files, build plugins) are documented under Codex CLI / developers, while the desktop app is documented separately | unpinned - reverify before implementation | https://developers.openai.com/codex | 2026-08-11 | not tested |

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-CODEX-DESKTOP-01, E-CODEX-DESKTOP-02 | Desktop/local parity with CLI | Unverified | Unsupported | The CLI extension surface is unverified for the hosted desktop surface; no parity claim is made |

### Statuses and gates

- **Deferred:** no implementation in the current batch.
- **Promotion to `Native`:** separate from Codex CLI; first verify that a desktop extension surface exists. Only a common-subset projection is in scope, with no CLI parity claim; rollback and re-promotion follow ADR-CORE-014.

---

## JCode

### Evidence (reviewed 2026-08-11)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-JCODE-01 | JCode | Identity | JCode is a Rust-based coding harness ("the most RAM efficient harness"); it supports skills (loaded on demand, with a `Skill` tool and semantic-embedding-based injection), swarm (multi-agent), and memory | unpinned - reverify before implementation | https://github.com/1jehuang/jcode | 2026-08-11 | not tested |
| E-JCODE-02 | JCode | SDK | JCode has a TypeScript SDK to drive sessions from your own program (`jcode.sh/sdk`) | unpinned - reverify before implementation | https://github.com/1jehuang/jcode, https://jcode.sh/sdk | 2026-08-11 | not tested |
| E-JCODE-03 | JCode | Paths | Skill and config paths are project-local and personal (for example `~/.jcode/config.toml`, MCP config in `~/.jcode/mcp.json` and `.jcode/mcp.json`) | unpinned - reverify before implementation | https://github.com/1jehuang/jcode | 2026-08-11 | not tested |

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-JCODE-02 | TypeScript SDK (drive sessions) | Available | Advisory | Basis for a projection adapter; not a security control |
| E-JCODE-01 | Skills, swarm, memory | Supported | Advisory | Native capabilities; not a security control |
| E-JCODE-01, E-JCODE-02 | First-class package/extension distribution API | Unverified | Unsupported | No confirmed plugin/package API; projection/experiment only |

### Statuses and gates

- **Deferred:** projection/experiment only; no native plugin claim.
- **Promotion to `Native`:** requires a confirmed first-class package/extension distribution API.
- **Rollback / withdrawal:** remove the projection and its claims; keep `Deferred`; re-promotion follows ADR-CORE-014.

---

## Crush

### Evidence (reviewed 2026-08-11)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CRUSH-01 | Crush | Identity | Crush is a Go-based terminal coding agent from Charm; it supports MCP (stdio, http, sse) and skills via the Agent Skills open standard | unpinned - reverify before implementation | https://github.com/charmbracelet/crush | 2026-08-11 | not tested |
| E-CRUSH-02 | Crush | Skill discovery | Skill discovery includes `~/.agents/skills/`, `~/.claude/skills/`, `.agents/skills`, `.crush/skills`, and `.cursor/skills`, plus configured paths | unpinned - reverify before implementation | https://github.com/charmbracelet/crush | 2026-08-11 | not tested |
| E-CRUSH-03 | Crush | Config | Configuration uses `crushrc` (Bash with Crush-specific builtins) or `crush.json` | unpinned - reverify before implementation | https://github.com/charmbracelet/crush | 2026-08-11 | not tested |
| E-CRUSH-04 | Crush | Config trust | `crushrc` and `crush.json` are trusted code; `crushrc` runs in a full shell and `$(...)` in `crush.json` runs at load time. Do not launch Crush in a directory whose config you have not reviewed | unpinned - reverify before implementation | https://github.com/charmbracelet/crush | 2026-08-11 | not tested |
| E-CRUSH-05 | Crush | Hooks | Hooks are "preliminary" support | unpinned - reverify before implementation | https://github.com/charmbracelet/crush | 2026-08-11 | not tested |

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-CRUSH-01, E-CRUSH-02 | Skills discovery | Supported | Advisory | Agent Skills standard; discovery is not a security control |
| E-CRUSH-01 | MCP | Supported | Advisory | stdio, http, sse; not a security control |
| E-CRUSH-04 | `crushrc`/`crush.json` | Supported | Not a sandbox | Runs in a full shell; review before launching |
| E-CRUSH-05 | Top-level `PreToolUse` hooks | Unavailable | Advisory | Preliminary; does not provide full subagent enforcement |

### Statuses and gates

- **Deferred:** projection/experiment only; no native plugin claim.
- **Promotion to `Native`:** requires a confirmed first-class distribution API and verified hooks.
- **Rollback / withdrawal:** remove the projection and its claims; keep `Deferred`; re-promotion follows ADR-CORE-014.

---

## DeepSeek Harness

**Support level:** Provisional. **Delivery:** Projection + native plugin + agent preset. **Disposition:** shipped provisional package, unverified against a live runtime. **Rationale:** DSH is a developer-preview runtime; the package is verified against published RC types and unit tests only, so no native claim is made yet.

### Evidence (reviewed 2026-09-06)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-DSH-01 | DeepSeek Harness | Product | Open-source agent harness in developer preview; every agent capability (models, tools, skills, sessions, sandboxes, storage) is a Cordis plugin composed via `cordis.yml`/profiles | unpinned - reverify before promotion | https://www.deepseek.com/harness/en/ ; https://github.com/deepseek-ai/deepseek-harness | 2026-09-06 | not tested |
| E-DSH-02 | DeepSeek Harness | Skills | Agent-Skills `SKILL.md` (`name`/`description`, optional `whenToUse`, invocation controls); discovery roots include `<projectRoot>/.dsh/skills`, `<projectRoot>/.agents/skills`, `<agentsHome>/skills`; `ctx.skills.registerProvider` merges provider catalogs; skill-name grammar is kebab-case | unpinned - reverify before promotion | docs/subsystems/skills.md; `@deepseek-ai/dsh-skill@0.0.1-rc.1` types | 2026-09-06 | tested: typecheck + unit tests + real `SkillService` integration (list/get over the generated tree) |
| E-DSH-03 | DeepSeek Harness | Subagents | Named-provider registry (`ctx.subagents.registerProvider`); in-process backends advertise `persona`, `toolFilter`, `depthLimit`, `agentOptions` capabilities; one-shot runs resolve `SubagentResult` with typed stop reasons | unpinned - reverify before promotion | docs/subsystems/subagent.md; `packages/subagent/tool-subagent/README.md` | 2026-09-06 | not tested |
| E-DSH-04 | DeepSeek Harness | Delegation tool | `dsh-tool-subagent` config: `provider`, `toolName`, `persona`, `toolFilter {allow,deny}`, `maxDepth`, `backgroundMode`; unknown `toolFilter` names fail startup; one instance per tool | unpinned - reverify before promotion | docs/config-catalog.md (`@deepseek-ai/dsh-tool-subagent`) | 2026-09-06 | not tested |
| E-DSH-05 | DeepSeek Harness | System prompt | Ordered `PromptSection`/`PromptContext` registrations; strict `{{variable}}` interpolation (unknown or valueless references throw); external contributions may use any finite order | unpinned - reverify before promotion | docs/subsystems/system-prompt.md; `@deepseek-ai/dsh-system-prompt@0.0.1-rc.1` README | 2026-09-06 | tested: real `SystemPrompt` integration (assemble + renderPrompt of the persona/rules sections; missing-variable loud failure) |
| E-DSH-06 | DeepSeek Harness | Agent presets | Preset = directory with `agent.cordis.yml` + `preset.yml` under `<dshHome>/.agent-presets`; standing mount per preset; services need `isolate` realms; tool/skill rows register into the preset layer; the `subagents` registry and spawn/fork backends stay in the host composition | unpinned - reverify before promotion | packages/preset/agent-presets/README.md; shipped `standard` preset | 2026-09-06 | not tested |
| E-DSH-07 | DeepSeek Harness | Plugin model | Function plugin: named-export `apply(ctx)` plus `inject: [...]`; entries are module specifiers (relative path or npm package) in `cordis.yml`; registration disposers unwind on unload | unpinned - reverify before promotion | docs/cordis-primer.md; docs/cordis-tutorial/01-first-plugin.md; docs/cordis-tutorial/07-into-the-harness.md | 2026-09-06 | tested: unit tests against explicit fakes + integration mounting the plugin under a real Cordis root with the published services |
| E-DSH-08 | DeepSeek Harness | Distribution | npm packages published under the `@deepseek-ai` scope: `@deepseek-ai/cordis` 4.0.2, `@deepseek-ai/dsh-skill` 0.0.1-rc.1, `@deepseek-ai/dsh-system-prompt` 0.0.1-rc.1, `@deepseek-ai/dsh` 0.1.2-rc.1 (CLI: profile boot, plugin management) | unpinned - reverify before promotion | https://registry.npmjs.org (npm view, 2026-09-06) | 2026-09-06 | tested: devDependency typecheck + runtime integration against the published `cordis`/`dsh-system-prompt`/`dsh-skill` packages |

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-DSH-02, E-DSH-07 | Skills (filesystem roots + provider) | Supported | Advisory | Discovery and invocation are not security controls |
| E-DSH-05 | Prompt sections and variables | Supported | Advisory | Owner plugins contribute facts; assembly is not a permission boundary |
| E-DSH-03, E-DSH-04 | Subagent delegation with personas | Supported | Advisory | Personas guide child behavior; they do not restrict tools |
| E-DSH-04 | `toolFilter` on delegation tools | Supported | Control (host-enforced) | Filtered tools vanish from the child's prompt and refuse execution; not shipped by default because denied names are host-composition-dependent and unknown names fail startup |
| E-DSH-01 | Sandbox, approvals, permission presets | Host-owned | Control | The host owns confinement and trust; the projection makes no claims |

### Statuses and gates

- **Provisional:** the package ships (`@maestria/deepseek`) with verified type-level, unit-test, and integration surfaces (the plugin mounts under the real published `dsh-system-prompt`/`dsh-skill` services in a real Cordis root), but no live-`dsh` deployment verification; no native claim.
- **Promotion to `Native`:** requires verification against a live `dsh` deployment (preset mounts, delegation tools appear, personas resolve, skills discoverable) plus reconfirmation of the pinned `@deepseek-ai/*` versions after RC churn.
- **Rollback:** remove `packages/deepseek`, the CLI handler entry, and the staged `<dshHome>/.agent-presets/maestria` directory.
- **Withdrawal:** remove claims and package; keep the evidence ledger entry.
- **Re-promotion:** only after the runtime surfaces are reconfirmed.

---

## Project customization loading (reviewed 2026-09-18)

Dated evidence for root `.maestria/workflow.md` then `.maestria/rules.md` loading. Order is workflow first, then rules, on every engine. Scope is project root only with no ancestor or nested lookup. Absent or empty files leave defaults unchanged. Diagnostics name only the relative file and the failure kind. This section records loading evidence only; support levels in the [snapshot](#snapshot) are unchanged.

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-PROJ-OC-01 | OpenCode | `experimental.chat.system.transform` | Project files are injected as full fresh content on every model call through the transform hook, not through `config.instructions`; a transform error propagates as a failed model call | Host `1.18.31` | `/tmp/opencode/src/packages/opencode/src/session/llm/request.ts:70`; `/tmp/opencode/src/packages/opencode/src/plugin/index.ts` (trigger); `packages/opencode/src/index.ts` (`injectProjectSystem`) | 2026-09-18 | tested: source inspection + package/unit tests (no live model run) |
| E-PROJ-OC-02 | OpenCode | Instruction/config loading | The host instruction file reader swallows read failures to empty, and plugin init/config errors are swallowed, so `config.instructions` paths are not the project-loading path | Host `1.18.31` | `/tmp/opencode/src/packages/opencode/src/session/instruction.ts` (`read` catches to `""`); `packages/opencode/src/index.ts` (`configureAgents` only appends the bundled rules path) | 2026-09-18 | tested: source inspection (no live model run) |
| E-PROJ-OC-03 | OpenCode | Project root | Root resolves from SDK project worktree, then worktree path, then session directory; `/` is skipped as a sentinel for non-git opens | Host `1.18.31` | `/tmp/opencode/src/packages/opencode/src/project/project.ts` (non-VCS worktree `"/"`); `/tmp/opencode/src/packages/opencode/src/project/instance-context.ts` (skip `"/"`); `packages/opencode/src/project-config.ts` (`resolveProjectRoot`) | 2026-09-18 | tested: source inspection + package/unit tests |
| E-PROJ-PI-01 | Pi | `before_agent_start` | Both files are re-read in full every turn from host-selected session cwd; a present-but-unusable file surfaces via notify plus STOP banner and the handler never throws because the host swallows handler errors | Package cites pinned host `0.84.2` (`emitBeforeAgentStart` into `emitError`); no independent pinned-source read in this change | `packages/pi/src/rules.ts`; `packages/shared/pi/src/project-config.ts` | 2026-09-18 | tested: package/unit tests (no live runtime E2E) |
| E-PROJ-OMP-01 | OMP | `before_agent_start` | Both files are re-read in full every turn from host-selected session cwd; a present-but-unusable file surfaces via notify plus STOP banner and the handler never throws because the host swallows handler errors | Package cites pinned host `17.4.0` (`#runHandlerWithTimeout` into `emitError`); no independent pinned-source read in this change | `packages/omp/src/rules.ts`; `packages/shared/pi/src/project-config.ts` | 2026-09-18 | tested: package/unit tests (no live runtime E2E) |
| E-PROJ-PRIME-01 | Prime Agent | `before_agent_start` | Prime-local loader re-reads both files in full every turn from `ctx.cwd`; error surfaces via notify plus STOP banner; handler-error swallowing is `[inferred]` from Pi-lineage behavior with no pinned Prime source verified | Unpinned Prime host; Prime-local module | `packages/prime-agent/src/project-config.ts`; `packages/prime-agent/src/modes.ts` | 2026-09-18 | tested: package/unit tests (no live runtime E2E) |
| E-PROJ-HERMES-01 | Hermes | `pre_llm_call` | Both files are re-read in full every turn from the process working directory at call time after the mode context; the hook runs fail-open and inject-only, so a broken file yields a visible error banner plus a host log warning without cancelling the turn | Local pinned source `d4625b5` | `~/.hermes/hermes-agent` (payload carries no working-directory field); `packages/hermes/src/maestria_hermes/project_config.py`; `packages/hermes/src/maestria_hermes/hooks/pre_llm.py` | 2026-09-18 | tested: source inspection + package tests (no live runtime E2E) |
| E-PROJ-SHARED-01 | All engines | Loader contract | Deterministic workflow-first order; root-only scope; sanitized relative-path diagnostics; symlink root canonicalized with resolved-target regular-file check; call-time checks are not an atomic snapshot; content stays subordinate and never waives safety, authorization, or host permissions; subagent auto-injection is unverified so briefs still carry constraints | Working-tree loaders | `packages/opencode/src/project-config.ts`; `packages/shared/pi/src/project-config.ts`; `packages/prime-agent/src/project-config.ts`; `packages/hermes/src/maestria_hermes/project_config.py` | 2026-09-18 | tested: package/unit tests |

Capability notes: OpenCode transform injection is `Supported` and `Advisory`; Pi/OMP/Prime `before_agent_start` injection is `Supported` and `Advisory`; Hermes `pre_llm_call` injection is `Supported` and `Advisory`. STOP banners and notifications advise stopping and waiting; none of them programmatically cancels the model call, so none is labeled `Enforced`.

## Cross-cutting boundaries

This file is the dated evidence ledger. The controlled support vocabulary, capability-versus-control rules, package boundaries, promotion and withdrawal gates, and reverification triggers are defined in [ADR-CORE-014](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md) and [ADR-CORE-005](adr/core/ADR-CORE-005-shared-agent-directives-core-sync.md).

---

## Sources

| Evidence ID | Runtime | Source | Review date | Test status |
| --- | --- | --- | --- | --- |
| E-CLAUDE-01, E-CLAUDE-02 | Claude Code | https://code.claude.com/docs/en/plugins | 2026-08-11 | not tested |
| E-CLAUDE-04, E-CLAUDE-05 | Claude Code | https://code.claude.com/docs/en/hooks | 2026-08-11 | not tested |
| E-CLAUDE-06, E-CLAUDE-07 | Claude Code | https://code.claude.com/docs/en/sub-agents | 2026-08-11 | not tested |
| E-CLAUDE-03 | Claude Code | https://code.claude.com/docs/en/plugin-marketplaces | 2026-08-11 | not tested |
| E-CLAUDE-08 | Claude Code | `packages/claude-code/tests/plugin.test.ts`, `packages/claude-code/package.json` (working-tree snapshot) | 2026-08-12 | tested |
| E-PRIME-01, E-PRIME-02, E-PRIME-06, E-PRIME-07 | Prime Agent | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/README.md | 2026-08-13 | not tested |
| E-PRIME-03, E-PRIME-04, E-PRIME-05 | Prime Agent | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/docs/skills.md | 2026-08-13 | not tested |
| E-PRIME-08 | Prime Agent | `packages/prime-agent/` (sync.config.ts, skills/, src/, tests/, README.md, INSTALL.md, package.json; working-tree snapshot) | 2026-08-13 | tested: package/unit tests + built-artifact smoke (no live Prime E2E) |
| E-PRIME-09, E-PRIME-10 | Prime Agent | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/src/core/extensions/types.ts; .../docs/extensions.md; .../src/core/extensions/loader.ts; .../docs/rlm.md | 2026-08-13 | tested: source inspection |
| E-PRIME-11 | Prime Agent | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/docs/packages.md; https://registry.npmjs.org/@earendil-works/pi-coding-agent (dist-tags) | 2026-08-13 | tested: source inspection |
| E-CODEX-CLI-01 | Codex CLI | https://github.com/openai/codex | 2026-08-11 | not tested |
| E-CODEX-CLI-02 | Codex CLI | https://developers.openai.com/codex (docs index) | 2026-08-11 | not tested |
| E-CODEX-CLI-03, E-CODEX-CLI-04, E-CODEX-CLI-05, E-CODEX-CLI-06 | Codex CLI | https://developers.openai.com/codex/hooks | 2026-08-11 | not tested |
| E-CODEX-DESKTOP-01, E-CODEX-DESKTOP-02 | Codex desktop | https://developers.openai.com/codex (docs index) | 2026-08-11 | not tested |
| E-JCODE-01, E-JCODE-03 | JCode | https://github.com/1jehuang/jcode | 2026-08-11 | not tested |
| E-JCODE-02 | JCode | https://jcode.sh/sdk | 2026-08-11 | not tested |
| E-CRUSH-01, E-CRUSH-02, E-CRUSH-03, E-CRUSH-04, E-CRUSH-05 | Crush | https://github.com/charmbracelet/crush | 2026-08-11 | not tested |
| E-DSH-01 | DeepSeek Harness | https://www.deepseek.com/harness/en/ ; https://github.com/deepseek-ai/deepseek-harness | 2026-09-06 | not tested |
| E-DSH-02, E-DSH-07 | DeepSeek Harness | https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/skills.md ; https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md ; https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/01-first-plugin.md | 2026-09-06 | tested: typecheck + unit tests |
| E-DSH-03, E-DSH-04, E-DSH-06 | DeepSeek Harness | https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/subagent.md ; https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/config-catalog.md ; https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/preset/agent-presets/README.md | 2026-09-06 | not tested |
| E-DSH-05 | DeepSeek Harness | https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/system-prompt.md | 2026-09-06 | tested |
| E-DSH-08 | DeepSeek Harness | https://registry.npmjs.org (npm view, 2026-09-06) | 2026-09-06 | tested: typecheck |
| E-PROJ-OC-01, E-PROJ-OC-02, E-PROJ-OC-03 | OpenCode | Pinned host `1.18.31` (`/tmp/opencode/src`) plus `packages/opencode/src/` | 2026-09-18 | tested: source inspection + package/unit tests (no live model run) |
| E-PROJ-PI-01 | Pi | `packages/pi/src/rules.ts`; `packages/shared/pi/src/project-config.ts` (working-tree snapshot; pinned host `0.84.2` cited in package comment, not independently re-read) | 2026-09-18 | tested: package/unit tests (no live runtime E2E) |
| E-PROJ-OMP-01 | OMP | `packages/omp/src/rules.ts`; `packages/shared/pi/src/project-config.ts` (working-tree snapshot; pinned host `17.4.0` cited in package comment, not independently re-read) | 2026-09-18 | tested: package/unit tests (no live runtime E2E) |
| E-PROJ-PRIME-01 | Prime Agent | `packages/prime-agent/src/project-config.ts`; `packages/prime-agent/src/modes.ts` (working-tree snapshot; host swallowing `[inferred]`) | 2026-09-18 | tested: package/unit tests (no live runtime E2E) |
| E-PROJ-HERMES-01 | Hermes | Local pinned `~/.hermes/hermes-agent` at `d4625b5`; `packages/hermes/src/maestria_hermes/project_config.py`; `packages/hermes/src/maestria_hermes/hooks/pre_llm.py` | 2026-09-18 | tested: source inspection + package tests (no live runtime E2E) |
| E-PROJ-SHARED-01 | All engines | Working-tree loaders (see Evidence section) | 2026-09-18 | tested: package/unit tests |

Upstream sources above are research-only (`unpinned - reverify before implementation`); E-CLAUDE-08 and E-PRIME-08 are local working-tree package snapshots (`Working-tree package snapshot; verify at landing`), not upstream research sources. Reverify material claims before implementation, promotion, or re-promotion.
