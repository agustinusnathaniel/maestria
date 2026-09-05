# Runtime Support Matrix

Internal evidence ledger for runtime support and adapter policy. This is the supporting evidence for [ADR-CORE-014](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md). It records verified facts, `[inferred]` assumptions, capability vs control status, statuses and gates, evidence records, and sources. It is a living document for maintainers, not a public support promise.

## How to read this document

- **Reviewed:** the date on which the cited source was last verified. Reverify before implementation.
- **Verified:** a fact read directly from an official source on the review date.
- **`[inferred]`:** a reasonable assumption not directly confirmed by a cited source. Each is tagged with its evidence.
- **Support level** uses the controlled vocabulary from ADR-CORE-014 (`Native`, `Native candidate`, `Provisional`, `Deferred`, `Withdrawn`) and contains no delivery terms.
- **Capability** (`Supported`, `Available`, `Unverified`, `Unavailable`) records what a runtime can do.
- **Control** (`Enforced`, `Trust-gated`, `Ignored`, `Advisory`, `Not a sandbox`, `Unsupported`) records what a runtime actually enforces. Skills, MCP, plugin loading, subagents, and JSON/RPC are never labeled security `Enforced`.
- **Test status** is `tested` or `not tested`. Local working-tree package evidence uses qualified labels that distinguish verification levels: `tested: source inspection` (pinned upstream source read, no runtime execution), `tested: package/unit tests` (skills/manifest/dependency-boundary/behavior tests against a fake host API), and `tested: built-artifact smoke` (the compiled artifact is built and its behavior exercised); these labels never imply a live runtime E2E. Almost all upstream evidence here is `not tested` and unpinned; treat it as research-only, not production support proof.
- **Pinned state:** each evidence record states the exact release/version/immutable commit/docs revision, or the exact text `unpinned - reverify before implementation`.
- **Evidence ID:** every snapshot, evidence, capability/control, and source row carries one or more `Evidence ID`s (for example `E-CLAUDE-01`) that are the traceability link to a complete evidence record. A complete evidence record is a row in the per-runtime Evidence tables below; it contains the runtime/surface, the claim, the pinned state, the source URL/path, the review date, and the test status. Section headings do not provide implicit metadata (runtime, review date, or source); each row is self-contained and must be read together with its evidence record, never inferred from its heading.

## Maestria CLI adapter evidence (reviewed 2026-08-13)

The CLI adapters are management wrappers around host-native capabilities. They stage the published npm package under `~/.cache/maestria/`, register a local marketplace with the host CLI, and use the host's native install/remove/list commands. The Codex adapter additionally installs native custom-agent TOMLs and a marked global `AGENTS.md` orchestration block because those surfaces are outside the plugin manifest.

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

---

## Claude Code

**Support level:** Native candidate. **Delivery:** Plugin. **Disposition:** candidate native plugin. **Rationale:** promotion gated on approved docs and a blind review.

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
| E-CLAUDE-06 | Plugin subagent loading | Supported | Advisory | Agents load from plugin `agents/`; scoped identifier. Loading is not itself a security control |
| E-CLAUDE-07 | `permissionMode`, `hooks`, `mcpServers` on plugin subagents | Unavailable | Ignored | Fields ignored; must move to project/user agent files |
| E-CLAUDE-04 | Matching `PreToolUse` handler returning `hookSpecificOutput.permissionDecision: "deny"` | Supported | Enforced | Can block the matched call conditionally on event, matcher, handler, decision format, and active installation scope; best-effort `if` filters can fail open |
| E-CLAUDE-05 | Plugin `hooks/hooks.json` resource | Supported | Advisory | Supported shareable resource, but presence alone is not enforcement; matching blocking handler required |
| E-CLAUDE-08 | `@maestria/claude-code` first package hook resources and handlers | Unavailable | Advisory | Package ships no `hooks/` directory and no package-level hook enforcement; this does not downgrade runtime/plugin capability |

### Statuses and gates

- **Promotion to `Native`:** gated on these repaired docs passing blind review, a Claude Code plugin package via the core sync pipeline (ADR-CORE-005) with `scripts/check-sync` passing, and the promotion gates in ADR-CORE-014. Review/promotion gates precede promotion or landing; the native-candidate implementation may already exist before promotion review.
- **Rollback:** revert the generated projection/package; canonical content stays in `packages/core/agent-directives/`.
- **Withdrawal:** if the plugin-subagent field limitation cannot be worked around without dropping the plugin distribution shape, downgrade or remove the plugin delivery, capability, and control claims.
- **Re-promotion:** no automatic re-promotion; only after the promotion gates are re-verified.

---

## Prime Agent

**Support level:** Native candidate. **Delivery:** Skills-first + verified extension subset. **Disposition:** skills + mode-command extension; native rlm dispatch deferred. **Rationale:** skills-first package plus a small verified executable extension subset (mode commands, mode prompt injection); native `rlm` dispatch and JSON/RPC headless mode stay deferred until a public JS bridge is verified.

> Prime Agent evidence was re-verified on 2026-08-13 against the immutable upstream commit `7787f07415d843b9a800f6a4720e0c739bd608e5` (PrimeIntellect-ai/prime-agent, `main`). All prior `unpinned` claims (E-PRIME-01..07) were confirmed and are now pinned to that commit. On the same date the executable-extension subset (E-PRIME-09..11) was verified against the same pinned commit; the decision stays `Native candidate` - the extension covers only the verified subset and native `rlm` dispatch remains deferred.

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
| E-PRIME-11 | Prime Agent | Runtime dependency boundary | The Prime-compatible `@earendil-works/pi-coding-agent` fork (`0.7.2` in the pinned workspace) is NOT published to npm (registry carries only the original Pi line, latest `0.84.1`); Prime bundles the pi packages into its runtime (jiti virtual modules in the compiled binary, workspace aliases in dev) and its `docs/packages.md` says core pi packages must be listed in `peerDependencies` with `"*"` if imported at runtime and not bundled. `@maestria/prime-agent` imports only types (erased at build), so `dist/extension.mjs` has zero pi imports and the package declares no runtime/peer dependency on pi packages | 7787f07415d843b9a800f6a4720e0c739bd608e5 (immutable commit); npm registry | https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/docs/packages.md; https://registry.npmjs.org/@earendil-works/pi-coding-agent (dist-tags latest 0.84.1) | 2026-08-13 | tested: source inspection |

**Test coverage (local package evidence):** the `tested` labels above are level-specific, never a live runtime E2E. E-PRIME-09/10/11 are **source inspection** of the pinned commit (no runtime execution). E-PRIME-08 is verified by **package/unit tests** (skills layout and frontmatter, manifest/dependency-boundary, extension behavior against a fake `pi` API - `tests/skills.test.ts`, `tests/package.test.ts`, `tests/extension.test.ts`) and by **built-artifact smoke tests** that build `dist/extension.mjs` and exercise command registration, command behavior, and mode prompt injection against a fake `pi` API (`tests/package.test.ts`; the package `test` script builds the artifact first). **Live Prime Agent E2E is not tested** - the automated suite never requires a Prime binary; the immutable source pin and `Native candidate` status are unaffected.

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-PRIME-03 | Skills (Agent Skills standard, Python-backed) | Supported | Advisory | Loaded on demand; `name`/`description` required (missing description means not loaded); validation otherwise lenient; Python-backed skills install into kernel; loading is not a security control |
| E-PRIME-02 | Subagent dispatch (`rlm`) | Supported | Advisory | Programmatic subagents; dispatch is not a security control. Not part of the package (deferred; no JS extension bridge - E-PRIME-10) |
| E-PRIME-06 | JSON/RPC headless modes | Available | Advisory | For automation and integrations; not a security control. Not part of the package (deferred) |
| E-PRIME-07 | Execution sandbox | Unavailable | Not a sandbox | Model-generated Python/commands run with user permissions |
| E-PRIME-08, E-PRIME-09 | `@maestria/prime-agent` extension subset (mode commands, mode prompt injection, session-scoped mode state) | Supported | Advisory | Registered via `pi.registerCommand` / `pi.on("before_agent_start")` / session custom entries; advisory prompt/state behavior, no tool interception, no security control. Verified by source inspection of the pinned fork and built-artifact smoke tests; live Prime E2E not tested |
| E-PRIME-08 | `@maestria/prime-agent` skills package | Supported | Advisory | 14 generated Agent Skills with required frontmatter; methodology is advisory, no native `rlm`/JSON-RPC claim, no sandbox claim. Verified by package/unit tests; live Prime E2E not tested |

### Statuses and gates

- **Reverified 2026-08-13** against upstream commit `7787f07415d843b9a800f6a4720e0c739bd608e5`; all E-PRIME-01..07 claims confirmed. On the same date the extension subset (E-PRIME-09..11) was verified against the same pinned commit: the public API supports the shipped subset (mode commands, `before_agent_start` systemPrompt chaining, session custom entries), the fork exposes no JS bridge for native `rlm` dispatch, and no runtime dependency on pi packages is needed or declared. Decision updated to `Native candidate` / Skills-first + verified extension subset; native `rlm` dispatch and JSON/RPC headless mode remain deferred. **Testing:** source inspection (E-PRIME-09..11), package/unit tests, and built-artifact smoke tests (mode commands, command behavior, mode prompt injection) pass; live Prime Agent E2E is not tested.
- **Promotion to `Native`:** verify a stable, supported package API for an executable extension beyond the verified subset (native `rlm` dispatch / JSON-RPC would require a public JS bridge that does not exist in the pinned fork); verify the security model (not a sandbox, so restrict to trusted repositories and skills); the skills-first package plus the verified subset ships via the sync pipeline and `scripts/check-sync` passes. The package exists now; promotion still requires the gates above.
- **Rollback:** revert the generated package and/or the extension subset; canonical content stays in core.
- **Withdrawal:** if no stable executable-extension API exists beyond the verified subset, keep native dispatch deferred and downgrade or remove package-level claims.
- **Re-promotion:** no automatic re-promotion; only after re-verification.

---

## Codex CLI

**Support level:** Native. **Delivery:** Plugin + CLI-managed native agents/instructions. **Disposition:** shipped native CLI adapter. **Rationale:** the integration uses Codex's documented plugin, skills, custom-agent, `agent_type`, and global `AGENTS.md` surfaces, with CLI-managed installation and preservation of user-owned settings.

### Evidence (reviewed 2026-08-11)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CODEX-CLI-01 | Codex CLI | Identity | Codex CLI is a local coding agent, distinct from the desktop app (`codex app`), the IDE extension, and the cloud-based Codex Web (`chatgpt.com/codex`) | unpinned - reverify before implementation | https://github.com/openai/codex | 2026-08-11 | not tested |
| E-CODEX-CLI-02 | Codex CLI | Surface scope | Codex supports AGENTS.md, subagents, config files, skills, plugins, and hooks | unpinned - reverify before implementation | https://developers.openai.com/codex | 2026-08-11 | not tested |
| E-CODEX-CLI-03 | Codex CLI | Hook trust | Non-managed command hooks must be reviewed and trusted before they run; Codex records trust against the hook's current hash; new or changed hooks are skipped until trusted | unpinned - reverify before implementation | https://developers.openai.com/codex/hooks | 2026-08-11 | not tested |
| E-CODEX-CLI-04 | Codex CLI | Hook types | Only `type: "command"` hook handlers run today; `prompt` and `agent` handlers are parsed but skipped | unpinned - reverify before implementation | https://developers.openai.com/codex/hooks | 2026-08-11 | not tested |
| E-CODEX-CLI-05 | Codex CLI | Managed hook policy | Managed hooks are trusted by managed policy: they run under the runtime's managed-hook policy rather than the per-hash trust review that non-managed command hooks require. Managed hooks are trusted by managed policy and are not `Trust-gated` like non-managed hooks | unpinned - reverify before implementation | https://developers.openai.com/codex/hooks | 2026-08-11 | not tested |
| E-CODEX-CLI-06 | Codex CLI | Trust-bypass | A documented trust-bypass configuration exists that lets hooks run without the normal trust review. This trust-bypass configuration exists and is an explicit security exception, not an enforcement path | unpinned - reverify before implementation | https://developers.openai.com/codex/hooks | 2026-08-11 | not tested |

### Pinned re-verification (2026-08-13)

The projection spike pins its implementation baseline to local `codex 0.145.0`. The corresponding upstream release tag is `rust-v0.145.0`, which resolves to commit `25af12f`.

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
| E-CODEX-CLI-10 | Non-managed plugin command hooks | Supported | Trust-gated | Plugin command hooks require managed status, a matching trusted hash, or an explicit bypass |
| E-CODEX-CLI-10 | Managed hook policy and trust bypass | Available | Advisory | These are host controls and explicit exceptions, not Maestria enforcement paths |
| E-CODEX-CLI-09 | Hooks (prompt/agent types) | Unavailable | Unsupported | Parsed but skipped by the pinned source |
| E-CODEX-CLI-08 | Plugin manifest and skills | Supported | Advisory | Skills are the bounded projection surface; they do not enforce delegation, role permissions, or review |
| E-CODEX-CLI-12 | Native custom-agent TOMLs | Supported | Host-enforced where configured | Codex owns discovery, role selection, sandbox settings, and per-agent runtime configuration |
| E-CODEX-CLI-14 | Global `AGENTS.md` instructions | Supported | Advisory | The managed block activates the workflow in the host-owned primary session; user and repository instructions still take precedence |

### Statuses and gates

- **Version sensitivity gate:** the spike baseline is pinned to `codex 0.145.0` / `rust-v0.145.0` (`25af12f`). Reverify after CLI upgrades or material plugin/hook changes.
- **Integration boundary:** keep the plugin manifest focused on skills. Native custom agents, model configuration, and the marked global `AGENTS.md` block belong to the companion CLI; do not add hooks or MCP without a separate decision and security review.
- **Promotion to `Native`:** resolved for Codex CLI on 2026-08-26 after current docs/source re-verification, package tests, and full workspace checks. Reverify after material host changes.
- **Rollback:** remove the companion native-agent and instruction management while leaving unrelated Codex configuration untouched.
- **Withdrawal:** downgrade or remove claims; keep `Provisional`, `Deferred`, or `Withdrawn`.
- **Re-promotion:** no automatic re-promotion; only after the version and evidence are re-verified.

---

## Codex desktop

**Support level:** Deferred. **Delivery:** Common-subset projection. **Disposition:** no CLI parity. **Rationale:** common-subset projection only; no CLI parity claim.

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
- **Promotion to `Native`:** separate from Codex CLI; first verify that a desktop extension surface exists. Only a common-subset projection is in scope, with no CLI parity claim.
- **Rollback:** remove the common-subset projection.
- **Withdrawal:** downgrade or remove parity-adjacent claims.
- **Re-promotion:** no automatic re-promotion; only after the desktop surface is re-verified.

---

## JCode

**Support level:** Deferred. **Delivery:** Projection. **Disposition:** Deferred - projection/experiment only.

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
- **Rollback:** remove the projection.
- **Withdrawal:** remove claims; keep `Deferred`.
- **Re-promotion:** no automatic re-promotion; only after the API is confirmed.

---

## Crush

**Support level:** Deferred. **Delivery:** Projection. **Disposition:** Deferred - projection/experiment only.

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
- **Rollback:** remove the projection.
- **Withdrawal:** remove claims; keep `Deferred`.
- **Re-promotion:** no automatic re-promotion; only after the API is confirmed.

---

## DeepSeek Harness

**Support level:** Provisional. **Delivery:** Projection + native plugin + agent preset. **Disposition:** shipped provisional package, unverified against a live runtime. **Rationale:** DSH is a developer-preview runtime; the package is verified against published RC types and unit tests only, so no native claim is made yet.

### Evidence (reviewed 2026-09-06)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-DSH-01 | DeepSeek Harness | Product | Open-source agent harness in developer preview; every agent capability (models, tools, skills, sessions, sandboxes, storage) is a Cordis plugin composed via `cordis.yml`/profiles | unpinned - reverify before promotion | https://www.deepseek.com/harness/en/ ; https://github.com/deepseek-ai/deepseek-harness | 2026-09-06 | not tested |
| E-DSH-02 | DeepSeek Harness | Skills | Agent-Skills `SKILL.md` (`name`/`description`, optional `whenToUse`, invocation controls); discovery roots include `<projectRoot>/.dsh/skills`, `<projectRoot>/.agents/skills`, `<agentsHome>/skills`; `ctx.skills.registerProvider` merges provider catalogs; skill-name grammar is kebab-case | unpinned - reverify before promotion | docs/subsystems/skills.md; `@deepseek-ai/dsh-skill@0.0.1-rc.1` types | 2026-09-06 | tested: typecheck + package unit tests |
| E-DSH-03 | DeepSeek Harness | Subagents | Named-provider registry (`ctx.subagents.registerProvider`); in-process backends advertise `persona`, `toolFilter`, `depthLimit`, `agentOptions` capabilities; one-shot runs resolve `SubagentResult` with typed stop reasons | unpinned - reverify before promotion | docs/subsystems/subagent.md; `packages/subagent/tool-subagent/README.md` | 2026-09-06 | not tested |
| E-DSH-04 | DeepSeek Harness | Delegation tool | `dsh-tool-subagent` config: `provider`, `toolName`, `persona`, `toolFilter {allow,deny}`, `maxDepth`, `backgroundMode`; unknown `toolFilter` names fail startup; one instance per tool | unpinned - reverify before promotion | docs/config-catalog.md (`@deepseek-ai/dsh-tool-subagent`) | 2026-09-06 | not tested |
| E-DSH-05 | DeepSeek Harness | System prompt | Ordered `PromptSection`/`PromptContext` registrations; strict `{{variable}}` interpolation (unknown or valueless references throw); external contributions may use any finite order | unpinned - reverify before promotion | docs/subsystems/system-prompt.md; `@deepseek-ai/dsh-system-prompt@0.0.1-rc.1` README | 2026-09-06 | tested: `{{`-free body gate in package unit tests |
| E-DSH-06 | DeepSeek Harness | Agent presets | Preset = directory with `agent.cordis.yml` + `preset.yml` under `<dshHome>/.agent-presets`; standing mount per preset; services need `isolate` realms; tool/skill rows register into the preset layer; the `subagents` registry and spawn/fork backends stay in the host composition | unpinned - reverify before promotion | packages/preset/agent-presets/README.md; shipped `standard` preset | 2026-09-06 | not tested |
| E-DSH-07 | DeepSeek Harness | Plugin model | Function plugin: named-export `apply(ctx)` plus `inject: [...]`; entries are module specifiers (relative path or npm package) in `cordis.yml`; registration disposers unwind on unload | unpinned - reverify before promotion | docs/cordis-primer.md; docs/cordis-tutorial/01-first-plugin.md; docs/cordis-tutorial/07-into-the-harness.md | 2026-09-06 | tested: plugin contract unit tests against explicit fake contexts |
| E-DSH-08 | DeepSeek Harness | Distribution | npm packages published under the `@deepseek-ai` scope: `@deepseek-ai/cordis` 4.0.2, `@deepseek-ai/dsh-skill` 0.0.1-rc.1, `@deepseek-ai/dsh-system-prompt` 0.0.1-rc.1, `@deepseek-ai/dsh` 0.1.2-rc.1 (CLI: profile boot, plugin management) | unpinned - reverify before promotion | https://registry.npmjs.org (npm view, 2026-09-06) | 2026-09-06 | tested: devDependency typecheck in `packages/deepseek` |

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-DSH-02, E-DSH-07 | Skills (filesystem roots + provider) | Supported | Advisory | Discovery and invocation are not security controls |
| E-DSH-05 | Prompt sections and variables | Supported | Advisory | Owner plugins contribute facts; assembly is not a permission boundary |
| E-DSH-03, E-DSH-04 | Subagent delegation with personas | Supported | Advisory | Personas guide child behavior; they do not restrict tools |
| E-DSH-04 | `toolFilter` on delegation tools | Supported | Control (host-enforced) | Filtered tools vanish from the child's prompt and refuse execution; not shipped by default because denied names are host-composition-dependent and unknown names fail startup |
| E-DSH-01 | Sandbox, approvals, permission presets | Host-owned | Control | The host owns confinement and trust; the projection makes no claims |

### Statuses and gates

- **Provisional:** the package ships (`@maestria/deepseek`) with a verified type-level and unit-test surface, but no live-`dsh` verification; no native claim.
- **Promotion to `Native`:** requires verification against a live `dsh` deployment (preset mounts, delegation tools appear, personas resolve, skills discoverable) plus reconfirmation of the pinned `@deepseek-ai/*` versions after RC churn.
- **Rollback:** remove `packages/deepseek`, the CLI handler entry, and the staged `<dshHome>/.agent-presets/maestria` directory.
- **Withdrawal:** remove claims and package; keep the evidence ledger entry.
- **Re-promotion:** only after the runtime surfaces are reconfirmed.

---

## Cross-cutting boundaries

### Capability vs control summary

- Control is runtime-specific and frequently narrower than the marketing language. The two most important caveats:
  - Claude Code ignores `permissionMode`, `hooks`, and `mcpServers` on plugin subagents (`Ignored`).
  - Codex runs only `type: "command"` hooks, and non-managed hooks are `Trust-gated`; `prompt`/`agent` handlers are `Unsupported`.
- Prime Agent execution is `Not a sandbox`; Crush treats its config as `Not a sandbox` trusted code. Both restrict to trusted inputs.
- Skills, MCP, plugin loading, subagents, and JSON/RPC are never labeled security `Enforced`; `Enforced` is reserved for actual controls.

### Package and sync boundaries

- Canonical methodology lives in `packages/core/agent-directives/`. Per-platform output is generated by the core sync pipeline (ADR-CORE-005).
- CLI installation/version handlers (ADR-CORE-007) and model-config handlers are separate and are not part of this first batch.
- Prime Agent must not reuse `@maestria/pi`, because Prime Agent is a Pi-based harness.

### Promotion gates

A runtime moves from `Provisional`/`Deferred`/`Native candidate` to a shipped `Native` adapter only when all of the following hold:

1. A first-class package or extension API is confirmed against current official docs.
2. The security and trust model is verified; no ignored fields are relied on.
3. Upstream evidence for every material claim is reverified against a pinned release/version, an immutable commit, or a fixed docs revision.
4. A generated projection exists via the core sync pipeline and `scripts/check-sync` passes.
5. Desktop/local parity, where claimed, is verified; otherwise no parity claim is made.
6. The runtime-specific `sync.config.ts` and package boundaries are defined and reviewed.

### Per-runtime lifecycle rules

See the per-runtime sections above. In all cases, withdrawal downgrades or removes a runtime's claims (support level, delivery, capability, and control), and there is no automatic re-promotion.

### Deprecation and reverification triggers

- Any runtime whose official API changes such that the recorded shape or trust model is stale triggers reverification before further work.
- Any finding that a mechanism marked enforced is actually advisory (or vice versa) triggers an update to this ledger and ADR-CORE-014.
- Version-sensitive claims are re-dated on each review; a claim older than the runtime's current documented state is not treated as current.
- Upstream docs on `main`/`latest` are research-only. Reverify any material claim before implementation, promotion, or re-promotion, after upstream API or security changes, or within 30 days of the review date.

---

## Assumptions documented

- `[inferred]` These docs define an internal decision boundary, not a production support guarantee.
- `[inferred]` The user means Claude Code, Prime Agent, and Codex CLI as first implementation candidates; JCode and Crush remain bounded experiments.
- `[inferred]` Codex desktop means the hosted ChatGPT/Codex desktop surface, not an IDE integration.
- `[inferred]` Claude Code's promotion/landing is gated on the repaired docs passing blind review; the native-candidate implementation may already exist before promotion review.
- `[verified]` Canonical content remains in `packages/core/agent-directives/` and projections follow ADR-CORE-005.
- `[inferred]` Runtime behavior reflects source/docs reviewed on 2026-08-11 and must be reverified before implementation.
- `[verified]` Prime Agent evidence (E-PRIME-01..07) was re-verified on 2026-08-13 against immutable upstream commit `7787f07415d843b9a800f6a4720e0c739bd608e5`; the extension subset (E-PRIME-09..11) was verified against the same commit. Decision: `Native candidate` / Skills-first + verified extension subset; native `rlm` dispatch and JSON/RPC headless mode remain deferred.

## Statuses and gates (resolved open questions)

Each previously unresolved question now has an explicit status or gate:

- Claude Code: can the plugin-subagent field limitation be worked around while keeping the plugin distribution shape? **Gate:** keep plugin-subagent fields `Ignored` and do not rely on them; the workaround (project/user agent files) is a promotion-gate item, not an open question.
- Prime Agent: is there a stable supported API for an executable extension beyond skills-first delivery? **Status:** a verified subset ships (mode commands, mode prompt injection, session-scoped mode state - E-PRIME-09). **Gate:** native `rlm` dispatch stays deferred - the pinned fork exposes no public JS extension bridge (E-PRIME-10); promotion to `Native` requires it.
- Codex CLI: which exact CLI version introduced the trust-gated hook flow and plugin support? **Resolved:** Codex CLI `0.145.0` and current upstream source were reverified on 2026-08-26; reverify after material host upgrades.
- JCode and Crush: is there a first-class package/extension distribution API, or is projection the only supported path? **Status:** `Deferred` - projection/experiment only, until a first-class API is confirmed.

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

Upstream sources above are research-only (`unpinned - reverify before implementation`) and must be reverified before implementation, promotion, or re-promotion. E-CLAUDE-08 and E-PRIME-08 are local working-tree package snapshots (`Working-tree package snapshot; verify at landing`), not upstream research sources.

## Related

- [ADR-CORE-014: Runtime Support and Adapter Policy](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md)
