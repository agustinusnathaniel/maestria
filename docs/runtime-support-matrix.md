# Runtime Support Matrix

Maintainer evidence ledger supporting [ADR-CORE-014](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md): runtime capabilities, enforcement, and promotion gates. It records dated research evidence, not a public support promise.

Every row is a dated snapshot as of its review date, not a maintenance obligation; reverification timing is governed by [ADR-CORE-014](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md). Start with the [snapshot](#snapshot) for support decisions, then follow each Evidence ID to its runtime section for sources and verification limits.

## Consolidated distribution (2026-10-12)

`@maestria/agent-plugins` owns the declarative distributions for Codex, Claude Code, Cursor, Kimi Code, Devin, ZCode, Hermes, OMP, and portable clients. The root portable skill surface is limited to handoff and iteration-limit utilities. Native roles, modes and policy use the selected host mechanisms recorded in the [component capability contract](agent-plugin-capabilities.md).

Markdown hosts (Claude Code, Cursor, Kimi Code, ZCode, OMP) share seven `agents/<role>.md` profiles and one `commands/` set; Devin auto-discovers the same root `agents/` and `AGENTS.md`; there is no orchestrator profile. Kimi adds a primary bootstrap. Codex marketplace installation is utility-only; the companion CLI installs complete native TOMLs and marked primary instructions. Hermes portable installation is utility-only, with optional manual host context setup. OpenCode and Pi retain native runtime adapters; OMP, Prime Agent and Hermes's former executable adapters remain retired.

Current validation (2026-10-12): Claude 2.1.295 strict validation and the offline reviewer fixture passed against the shared profile. OMP 18.4.8 loader discovery passed on archive and git root with seven agents, three commands, one rule and two skills. A Cursor CLI 2026.10.01 probe showed `readonly` is not enforced for plugin-supplied agents but is for project `.cursor/agents/` profiles. Kimi read-only now uses the tool names `Write` and `Edit`. None of this proves model obedience; no actual OMP task spawn was performed. Devin and ZCode live loading, and Kimi live runs, remain unverified. Earlier fourteen-skill and eight-profile results are historical and do not establish current activation. See [host verification](plugin-host-verification.md) for reproduction, artifacts and limits.

## How to read this document

- **Reviewed:** the date the cited source was last verified; older claims are stale against the runtime's current documented state.
- **Verified:** a fact read directly from an official source on the review date. `[inferred]` marks a reasonable but unconfirmed assumption, tagged with its evidence.
- **Support level** uses the controlled vocabulary from ADR-CORE-014 (`Native`, `Native candidate`, `Provisional`, `Deferred`, `Withdrawn`) and contains no delivery terms.
- **Capability** (`Supported`, `Available`, `Unverified`, `Unavailable`) records what a runtime can do.
- **Control** (`Enforced`, `Trust-gated`, `Ignored`, `Advisory`, `Not a sandbox`, `Unsupported`) records what a runtime actually enforces. Skills, MCP, plugin loading, subagents, and JSON/RPC are never labeled `Enforced` as security controls.
- **Test status** is `tested` or `not tested`, qualified by the verification boundary; none implies a live runtime end-to-end test. `tested: source inspection` = pinned upstream source read, no runtime execution; `tested: package/unit tests` = tests against a fake host API; `tested: built-artifact smoke` = compiled artifact built and its behavior exercised.
- **Pinned state:** the exact release/version/immutable commit/docs revision per record, or the exact text `unpinned - reverify before implementation`.
- **Evidence ID:** links each row to a complete per-runtime Evidence record through one or more IDs (for example `E-CLAUDE-01`); the record carries runtime/surface, claim, pinned state, source URL/path, review date, and test status. Records are self-contained: do not infer runtime, date, or source from the section heading.

## maestria CLI adapter evidence (reviewed 2026-08-13)

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
| Prime Agent | Withdrawn | None | withdrawn 2026-10-09: package and CLI platform removed; evidence pruned 2026-10-12 | See Prime Agent section | 2026-10-12 |
| Codex CLI | Native | Plugin + CLI-managed native agents/instructions | shipped native CLI adapter | Verified plugin skills, native custom agents, automatic primary-session orchestration guidance, model configuration, and idempotent install/update/uninstall against Codex CLI 0.145.0 and current upstream source | E-CODEX-CLI-12, E-CODEX-CLI-13, E-CODEX-CLI-14, E-CODEX-CLI-15 | 2026-08-26 |
| Codex desktop | Deferred | Common-subset projection | no CLI parity | Common-subset projection only; no CLI parity claim | E-CODEX-DESKTOP-01 | 2026-08-11 |
| JCode | Deferred | Projection | Deferred - projection/experiment only | No confirmed first-class package/extension API | E-JCODE-01 | 2026-08-11 |
| Crush | Deferred | Projection | Deferred - projection/experiment only | No confirmed first-class package/extension API | E-CRUSH-01 | 2026-08-11 |

The per-runtime sections below are dated evidence snapshots as of their review dates, not maintenance obligations; each runtime's disposition is set by this table.

---

## Claude Code

### Evidence (baseline reviewed 2026-08-11; package evidence through 2026-10-12)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CLAUDE-01 | Claude Code | Plugin layout | Plugins are self-contained directories with skills, agents, hooks, or a `.claude-plugin/plugin.json` manifest; skills in `skills/<name>/SKILL.md`, agents in `agents/`, hooks in `hooks/hooks.json` | unpinned - reverify before implementation | https://code.claude.com/docs/en/plugins | 2026-08-11 | not tested |
| E-CLAUDE-02 | Claude Code | Plugin skills | Plugin skills are namespaced as `/plugin-name:skill-name` | unpinned - reverify before implementation | https://code.claude.com/docs/en/plugins | 2026-08-11 | not tested |
| E-CLAUDE-03 | Claude Code | Plugin distribution | Plugin distribution uses plugin marketplaces | unpinned - reverify before implementation | https://code.claude.com/docs/en/plugin-marketplaces | 2026-08-11 | not tested |
| E-CLAUDE-04 | Claude Code | Hooks | A matching `PreToolUse` hook handler that returns `hookSpecificOutput.permissionDecision: "deny"` can block the matched call conditionally on event, matcher, handler, decision format, and active installation scope; best-effort `if` filters can fail open. Hooks run at lifecycle points including `PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd`, `SubagentStart`, `SubagentStop`, `Stop`, and `PreCompact`/`PostCompact`; handlers support command, HTTP, MCP tool, prompt, and agent types | unpinned - reverify before implementation | https://code.claude.com/docs/en/hooks | 2026-08-11 | not tested |
| E-CLAUDE-05 | Claude Code | Plugin hooks | Plugin `hooks/hooks.json` is a supported shareable resource and runs with the same event schema as settings hooks when enabled; presence alone is not enforcement, a matching blocking handler is required | unpinned - reverify before implementation | https://code.claude.com/docs/en/hooks | 2026-08-11 | not tested |
| E-CLAUDE-06 | Claude Code | Plugin subagents | Plugin subagents are loaded from a plugin's `agents/` directory with a scoped identifier | unpinned - reverify before implementation | https://code.claude.com/docs/en/sub-agents | 2026-08-11 | not tested |
| E-CLAUDE-07 | Claude Code | Plugin-subagent frontmatter | For security reasons, plugin subagents do not support the `hooks`, `mcpServers`, or `permissionMode` frontmatter fields; these fields are ignored when loading agents from a plugin. To use them, copy the agent file into `.claude/agents/` or `~/.claude/agents/` | unpinned - reverify before implementation | https://code.claude.com/docs/en/sub-agents | 2026-08-11 | not tested |
| E-CLAUDE-08 | Claude Code | First separate `@maestria/claude-code` package (historical) | The first package shipped no `hooks/` directory or package-level hook resources; that historical fact does not establish the consolidated package's current contents or downgrade Claude Code capability | Historical working-tree package snapshot | Prior package snapshot, 2026-08-12; current package support is documented in [plugin-host-verification.md](plugin-host-verification.md) | 2026-08-12 | tested |
| E-CLAUDE-09 | Claude Code | Native child skill preload and tool schema | A deterministic CLI fixture loaded the thin reviewer profile, reached both reviewer and global-rules skills in the child request, and observed a child tool schema without Write/Edit. This verifies that role's native preload and declared tool boundary, not model judgment, shell-mediated editing, every specialist, or other CLI versions | Claude Code `2.1.217` | `docs/plugin-host-verification.md`; `scripts/e2e/claude-skill-preload.ts`; `packages/agent-plugins/tests/claude-loading.test.ts` | 2026-10-10 | tested: native CLI fixture; no paid inference |
| E-CLAUDE-10 | Claude Code | Full native child context | The real offline CLI fixture reached complete reviewer and global-policy instructions without role-skill preloads, excluded Write/Edit from the child tool schema, and returned its result to the parent. Superseded by E-CLAUDE-11 for the current layout. | Claude Code 2.1.217 | `docs/plugin-host-verification.md`; `scripts/e2e/claude-skill-preload.ts` | 2026-10-11 | tested: native CLI fixture; no paid inference |
| E-CLAUDE-11 | Claude Code | Shared-profile child context and strict validation | `claude plugin validate --strict` passed. The offline fixture loaded the reviewer from the shared `agents/reviewer.md` (no per-host copy), Write and Edit were unavailable, and the full role and global policy reached the child context. | Claude Code 2.1.295 | `docs/plugin-host-verification.md`; `scripts/e2e/claude-skill-preload.ts` | 2026-10-12 | tested: native CLI fixture; no paid inference |

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-CLAUDE-06 | Plugin subagent loading | Supported | Advisory | Loading is not itself a security control |
| E-CLAUDE-07 | `permissionMode`, `hooks`, `mcpServers` on plugin subagents | Unavailable | Ignored | Must move to project/user agent files if needed |
| E-CLAUDE-04 | Matching `PreToolUse` handler returning `hookSpecificOutput.permissionDecision: "deny"` | Supported | Enforced | Blocking is conditional; best-effort `if` filters can fail open |
| E-CLAUDE-05 | Plugin `hooks/hooks.json` resource | Supported | Advisory | Presence alone is not enforcement; a matching blocking handler is required |
| E-CLAUDE-08 | First separate `@maestria/claude-code` package hook resources (historical) | Unavailable | Advisory | Historical package snapshot only; use current package evidence for present contents |
| E-CLAUDE-11 | Complete reviewer/policy context and Write/Edit tool-schema exclusion | Supported | Enforced | Verified for the reviewer child from the shared profile in Claude Code 2.1.295 (E-CLAUDE-10 on 2.1.217 is superseded); does not establish shell isolation, model obedience or all-agent coverage |

### Statuses and gates

- **Promotion:** the repaired docs pass blind review; a plugin package ships via the core sync pipeline (ADR-CORE-005) with `scripts/check-sync` passing; the ADR-CORE-014 gates are verified. The native-candidate implementation may already exist; gates precede promotion or landing.
- **Withdrawal:** if the plugin-subagent field limitation cannot be worked around without dropping the plugin distribution shape, downgrade or remove the plugin delivery, capability, and control claims. The project/user agent file workaround is a promotion-gate item, not an open question; rollback and re-promotion follow ADR-CORE-014.

---

## Prime Agent

> Withdrawn 2026-10-09; evidence ledger (E-PRIME-01 through E-PRIME-11) removed 2026-10-12. The `@maestria/prime-agent` package and CLI `prime-agent` platform no longer exist, and no host-support claim remains. Prior evidence is retained in Git history; any re-promotion restarts qualification under [ADR-CORE-014](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md).

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
| E-CODEX-CLI-11 | Codex CLI | maestria projection | At the 2026-08-13 review point, the package generated 14 skills and the separate maestria CLI provided npm-backed marketplace staging; native agents and automatic instructions were added in the subsequent re-verification | `packages/codex` on the 2026-08-13 snapshot | `packages/codex/sync.config.ts`; `packages/codex/skills/`; `apps/maestria-cli/src/lib/platforms.ts` | 2026-08-13 | tested after sync |

### Current re-verification (2026-08-26)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CODEX-CLI-12 | Codex CLI | Native custom agents | Codex discovers standalone custom-agent TOMLs from `~/.codex/agents/` and project agent directories, including `name`, `description`, `developer_instructions`, model, reasoning, sandbox, MCP, and skill configuration fields | Codex CLI `0.145.0`; current upstream source | https://learn.chatgpt.com/docs/agent-configuration/subagents?surface=app; `/home/nathan/.opensrc/repos/github.com/openai/codex/main/codex-rs/core/src/config/agent_roles.rs` | 2026-08-26 | tested: source inspection + package/unit tests |
| E-CODEX-CLI-13 | Codex CLI | Delegation | Native subagent selection uses the `agent_type` role name, so maestria's `maestria-*` TOMLs are directly addressable by Codex's delegation runtime | Codex CLI `0.145.0`; current upstream source | https://learn.chatgpt.com/docs/agent-configuration/subagents?surface=app; `/home/nathan/.opensrc/repos/github.com/openai/codex/main/codex-rs/core/src/tools/handlers/multi_agents_spec.rs` | 2026-08-26 | tested: source inspection + package/unit tests |
| E-CODEX-CLI-14 | Codex CLI | Global instructions | Codex loads global `AGENTS.override.md` or `AGENTS.md` from `$CODEX_HOME`; the maestria CLI manages a marked block in the active file and preserves unrelated instructions | Codex CLI `0.145.0`; current upstream source | https://learn.chatgpt.com/docs/config-file/config-reference; `/home/nathan/.opensrc/repos/github.com/openai/codex/main/codex-rs/codex-home/src/instructions/mod.rs` | 2026-08-26 | tested: source inspection + package/unit tests |
| E-CODEX-CLI-15 | Codex CLI | maestria integration | `maestria install codex` installs the skills plugin, seven native roles, model-preserving updates, and automatic orchestration guidance; uninstall removes only maestria-managed content | Working-tree implementation; Codex CLI `0.145.0` | `apps/maestria-cli/src/lib/platforms.ts`; `packages/codex/instructions/AGENTS.md`; `packages/codex/tests/plugin.test.ts` | 2026-08-26 | tested: package/unit tests + built package |
| E-CODEX-CLI-16 | Codex CLI | Native marketplace | The repository marketplace entry maps `maestria@maestria` to the published `@maestria/codex` npm package; native `codex plugin marketplace add` followed by `codex plugin add maestria@maestria` installs the published plugin and skills | Codex CLI `0.145.0`; published `@maestria/codex@0.3.2` | `.agents/plugins/marketplace.json`; `/home/nathan/.opensrc/repos/github.com/openai/codex/main/codex-rs/core-plugins/src/marketplace.rs`; isolated Codex smoke test | 2026-08-26 | tested: live host smoke |

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-CODEX-CLI-10 | Non-managed plugin command hooks | Supported | Trust-gated | Require managed status, a matching trusted hash, or an explicit bypass |
| E-CODEX-CLI-10 | Managed hook policy and trust bypass | Available | Advisory | Host controls and explicit exceptions, not maestria enforcement paths |
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

## Pi-family extension dependency evidence (reviewed 2026-10-02)

Evidence for the `@gotgenes/pi-subagents` peer and for Pi host builtin tool names, neither of which had a prior row. Pinned state is the version this branch actually resolves; the host copies read for corroboration are labelled as such and are not this branch's resolved host. This section records dependency evidence only; support levels in the [snapshot](#snapshot) are unchanged.

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-PI-SUB-01 | Pi | `@gotgenes/pi-subagents` peer contract | The dispatch contract maestria consumes is unchanged from the 18.x line: `getSubagentsService(): SubagentsService \| undefined`, `spawn(type, prompt, options?)`, `getRecord(id)`, and `abort(id)` keep their signatures, `SpawnOptions` keeps its seven keys (`description`, `model`, `maxTurns`, `thinkingLevel`, `inheritContext`, `foreground`, `bypassQueue`), and `SUBAGENT_EVENTS` retains `STARTED`/`COMPLETED`/`FAILED`/`STEERED` as a subset of the 21.x constant, which adds only `RESUMING` (`RESUMED`, `COMPACTED`, and `CREATED` are present in both lines) | `@gotgenes/pi-subagents` `21.9.0` | `packages/pi/node_modules/@gotgenes/pi-subagents/dist/public.d.ts` (`SpawnOptions`, `SubagentsService`, `SUBAGENT_EVENTS`) | 2026-10-02 | tested: source inspection of the resolved package + `packages/pi` typecheck and unit tests (no live runtime E2E) |
| E-PI-SUB-02 | Pi | `@gotgenes/pi-subagents` peer admissibility | `21.9.0` declares peers `@earendil-works/pi-coding-agent >=0.81.0` with no ceiling and `@earendil-works/pi-ai >=0.75.0`, `@earendil-works/pi-tui >=0.75.0`, so it admits the Pi 1.0 line. Its new `typebox: *` peer is satisfied by the `typebox` peer `@maestria/pi` already declares, so the upgrade adds no second dependency | `@gotgenes/pi-subagents` `21.9.0` | `packages/pi/node_modules/@gotgenes/pi-subagents/package.json` (`peerDependencies`); `packages/pi/package.json` (`peerDependencies`); `pnpm-lock.yaml` (single `typebox` resolution satisfies the peer) | 2026-10-02 | tested: source inspection of the resolved package + `pnpm install` peer resolution (no live runtime E2E) |
| E-PI-SUB-03 | Pi | Host npm package spec | A `pi install npm:<pkg>@<spec>` spec accepts a semver range, not only a concrete version or a tag: `parseNpmSpec` splits name from the trailing version text, `getNpmVersionRange` passes it through semver `validRange`, `isExactNpmVersion` marks a range unpinned, `installedNpmMatchesConfiguredVersion` compares with `satisfies`, `getLatestNpmVersion` reconciles with `maxSatisfying`, and the raw spec reaches `npm install` verbatim. This is why the maestria CLI prerequisite can pin a range instead of bare `latest` | Host `0.84.2` (this branch's resolved host); identical logic read in a host `1.0.0` copy present in the local pnpm store | `node_modules/.pnpm/@earendil-works+pi-coding-agent@0.84.2_*/node_modules/@earendil-works/pi-coding-agent/dist/core/package-manager.js` (`parseNpmSpec`, `getNpmVersionRange`, `isExactNpmVersion`, `installedNpmMatchesConfiguredVersion`, `getLatestNpmVersion`, `getNpmInstallArgs`); `docs/packages.md` in the same package | 2026-10-02 | tested: source inspection of the installed host (the installer was not executed against a live host) |
| E-PI-SUB-04 | Pi | Spawn option precedence over agent frontmatter | From 21.0.0 a spawn option the caller names wins over the agent `.md` frontmatter for `model`, `thinking`, `max_turns`, `inherit_context`, and `run_in_background`; the frontmatter regains control through `locked: true` for every field the file sets, or `locked: [field, ...]` for a subset. Omitting `foreground` is not the same as passing `false`: the SDK door hands the decision to the agent frontmatter and defaults to background, which is why every maestria spawn site passes `foreground: true` explicitly. The signatures in E-PI-SUB-01 do not carry this rule, so adding `model` to a spawn call would silently invert precedence; `SubagentSpawnService` in `packages/pi/src/subagent.ts` narrows the options to `description`, `foreground`, and `inheritContext`, so such a change has to widen that type first | `@gotgenes/pi-subagents` `21.9.0` | `packages/pi/node_modules/@gotgenes/pi-subagents/src/config/invocation-config.ts` (`resolveAgentInvocationConfig`, `resolveField`, `isLocked`); `.../src/service/service-adapter.ts` (the `background` default when `foreground` is omitted); `.../CHANGELOG.md` (the 21.0.0 breaking change); `packages/pi/src/subagent.ts` (`SubagentSpawnService` and its three `spawn` call sites) | 2026-10-03 | tested: source inspection of the resolved package + `packages/pi` typecheck and unit tests (no live runtime E2E) |
| E-PI-TOOLS-01 | Pi | Host builtin tool names | Pi registers its builtin tools from the `allToolNames` constant, and `glob` is not in it. `find` matches glob patterns and `grep` takes an optional `glob` path filter, so glob-shaped search is reachable through names Pi actually registers. An agent frontmatter `tools:` entry naming an unregistered tool passes the host parser unvalidated and becomes an inert filter entry, so a stale name costs capability silently rather than failing loudly | Host `0.84.2` (this branch's resolved host, seven names); a host `1.0.0` copy present in the local pnpm store lists the same seven plus `powershell` | `node_modules/.pnpm/@earendil-works+pi-coding-agent@0.84.2_*/node_modules/@earendil-works/pi-coding-agent/dist/core/tools/index.js` (`allToolNames`, `createToolDefinition`); `.../dist/core/tools/find.d.ts`; `.../dist/core/tools/grep.js` | 2026-10-02 | tested: source inspection of the installed host + `packages/core` sync guard test (no live runtime E2E) |

---

## Pi

Dated evidence for the Pi tool-enforcement boundary. Enforcement here is host-observed, not package-owned: the Pi adapter can only block a call inside the interceptor it registers on `tool_call`, the only maestria layer in this Pi extension that observes a call, and review mode only narrows the host tool list. Both halves depend on the host surfacing every invocation. Support levels in the [snapshot](#snapshot) are unchanged.

### Evidence (reviewed 2026-10-04)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-PI-TOOLS-02 | Pi | Tool-level enforcement | Tool-level enforcement is conditional on the host emitting `tool_call` for every tool invocation: that handler is the only maestria layer in this Pi extension that observes a call, and review-mode `setActiveTools` narrowing can only withhold tools the host already exposes. Whether a non-default host execution mode emits `tool_call` for in-script invocations is unverified (codemode is one example). In review mode the interceptor blocks any tool name outside the read-only set, which bounds the exposure but cannot cover a call the host never surfaces. No live host probe has been performed | unpinned - reverify before implementation | `packages/pi/src/tools.ts`; `packages/shared/pi/src/commands-core.ts`; `packages/shared/pi/src/tools-core.ts` | 2026-10-04 | not tested |

---

## OMP

Dated evidence for OMP's native declarative resources alongside portable utilities. The empty `package.json#omp` marker registers the data-only package; no executable extensions array is required. The retired executable adapter's hooks, interception, mode persistence, and goal mirroring remain historical. OMP has no tool denylist, so the shared profiles' read-only text is prompt-level.

### Evidence (reviewed 2026-10-12)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-OMP-PLUGIN-01 | OMP | Current native resource discovery | Source (git root) and archive discovery expose seven task profiles, two utility skills, three commands, and one always-apply global rule; `.toml` files are not loaded. The previous fourteen-skill/zero-command fixture and the 2026-10-11 eight-profile result describe retired layouts. | Host 18.4.8 | `scripts/e2e/omp-plugin-discovery.ts`; `docs/plugin-host-verification.md` | 2026-10-12 | tested: actual capability providers, source/archive payload |
| E-OMP-PLUGIN-02 | OMP | Real installed lifecycle and prepared context | An isolated local-archive CLI installation, disable, reinstall, upgrade refusal for a local source, and uninstall passed. Default installed discovery, command expansion, global system-prompt injection, and all eight task-template compositions passed against the previous eight-profile layout (superseded; not re-run for seven). No inference or actual task spawn was performed. | Host 18.4.8 | `artifacts/omp-actual-host-proof/`; `docs/plugin-host-verification.md` | 2026-10-11 | tested: real bundled CLI and native prompt/discovery APIs |

---

## Cursor and Kimi Code

Dated evidence for the shared-profile layout. Plugin read-only metadata is host-dependent and recorded per host rather than assumed.

### Evidence (reviewed 2026-10-12)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CURSOR-PLUGIN-01 | Cursor | Plugin agent `readonly` | Plugin-supplied agents did not enforce `readonly: true` (a write succeeded, with or without other hosts' frontmatter keys present). A project `.cursor/agents/` profile with `readonly: true` was blocked ("cannot run non read-only tools"). Other hosts' keys do not affect Cursor loading. Cursor desktop was not tested. | Cursor CLI 2026.10.01 | `docs/plugin-host-verification.md` | 2026-10-12 | tested: live Cursor CLI; no desktop |
| E-KIMI-PLUGIN-01 | Kimi Code | Tool names for `disallowedTools` | Kimi registers tools as `Write` and `Edit`; the previously shipped `WriteFile` and `StrReplaceFile` names matched nothing, so read-only was not effective before. Unknown keys (`readonly`, `model`) are ignored and `$ARGUMENTS` is substituted in plugin commands. Not live-run. | Kimi v0.38.0 | `docs/plugin-host-verification.md` | 2026-10-12 | tested: source inspection |

---

## Project customization loading (reviewed 2026-09-18)

Dated evidence for root `.maestria/workflow.md` then `.maestria/rules.md` loading. Order is workflow first, then rules, on every engine. Scope is project root only with no ancestor or nested lookup. Absent or empty files leave defaults unchanged. Diagnostics name only the relative file and the failure kind. This section records loading evidence only; support levels in the [snapshot](#snapshot) are unchanged.

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-PROJ-OC-01 | OpenCode | `experimental.chat.system.transform` | Project files are injected as full fresh content on every model call through the transform hook, not through `config.instructions`; a transform error propagates as a failed model call | Host `1.18.31` | `/tmp/opencode/src/packages/opencode/src/session/llm/request.ts:70`; `/tmp/opencode/src/packages/opencode/src/plugin/index.ts` (trigger); `packages/opencode/src/index.ts` (`injectProjectSystem`) | 2026-09-18 | tested: source inspection + package/unit tests (no live model run) |
| E-PROJ-OC-02 | OpenCode | Instruction/config loading | The host instruction file reader swallows read failures to empty, and plugin init/config errors are swallowed, so `config.instructions` paths are not the project-loading path | Host `1.18.31` | `/tmp/opencode/src/packages/opencode/src/session/instruction.ts` (`read` catches to `""`); `packages/opencode/src/index.ts` (`configureAgents` only appends the bundled rules path) | 2026-09-18 | tested: source inspection (no live model run) |
| E-PROJ-OC-03 | OpenCode | Project root | Root resolves from SDK project worktree, then worktree path, then session directory; `/` is skipped as a sentinel for non-git opens | Host `1.18.31` | `/tmp/opencode/src/packages/opencode/src/project/project.ts` (non-VCS worktree `"/"`); `/tmp/opencode/src/packages/opencode/src/project/instance-context.ts` (skip `"/"`); `packages/opencode/src/project-config.ts` (`resolveProjectRoot`) | 2026-09-18 | tested: source inspection + package/unit tests |
| E-PROJ-PI-01 | Pi | `before_agent_start` | Both files are re-read in full every turn from host-selected session cwd; a present-but-unusable file surfaces via notify plus STOP banner and the handler never throws because the host swallows handler errors | Package peer `^1.0.0`, resolved `1.0.1` on 2026-10-05; handler-error swallowing and whole-string `systemPrompt` return re-verified in the installed 1.0.1 runner source (`emitBeforeAgentStart` into `emitError`) | `packages/pi/src/rules.ts`; `packages/shared/pi/src/project-config.ts` | 2026-10-05 | tested: installed 1.0.1 source inspection + package/unit tests against real 1.0 types (no live runtime E2E) |
| E-PROJ-OMP-01 | OMP (retired native executable) | `before_agent_start` | Retired 2026-10-12 with `@maestria/omp`; the replacement native global rule supplies routing guidance without a per-turn interceptor. Prior evidence is in Git history | n/a | n/a | 2026-10-12 | retired |
| E-PROJ-PRIME-01 | Prime Agent | `before_agent_start` | Withdrawn 2026-10-09 with the package; evidence pruned 2026-10-12 (Git history) | n/a | n/a | 2026-10-12 | withdrawn |
| E-PROJ-HERMES-01 | Hermes | `pre_llm_call` | Retired 2026-10-10 with the Python adapter ([CORE-034](adr/core/ADR-CORE-034-consolidated-declarative-plugin.md)); Hermes now receives utility skills only and no project-file injection. Prior evidence is in Git history | n/a | n/a | 2026-10-12 | retired |
| E-PROJ-SHARED-01 | All engines | Loader contract | Deterministic workflow-first order; root-only scope; sanitized relative-path diagnostics; symlink root canonicalized with resolved-target regular-file check; call-time checks are not an atomic snapshot; content stays subordinate and never waives safety, authorization, or host permissions; subagent auto-injection is unverified so briefs still carry constraints | Working-tree loaders | `packages/opencode/src/project-config.ts`; `packages/shared/pi/src/project-config.ts` | 2026-09-18 | tested: package/unit tests |

Capability notes: OpenCode transform injection is `Supported` and `Advisory`; Pi `before_agent_start` injection is `Supported` and `Advisory`. OMP, Prime Agent, and Hermes executable injection was retired with their adapters. STOP banners and notifications advise stopping and waiting; none of them programmatically cancels the model call, so none is labeled `Enforced`.

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
| E-CLAUDE-08 | Claude Code | historical first-package snapshot; see this record's original source notes | 2026-08-12 | tested |
| E-CLAUDE-09 | Claude Code | `docs/plugin-host-verification.md`; `scripts/e2e/claude-skill-preload.ts` | 2026-10-10 | tested: native CLI fixture (superseded) |
| E-CLAUDE-11 | Claude Code | `docs/plugin-host-verification.md`; `scripts/e2e/claude-skill-preload.ts` | 2026-10-12 | tested: native CLI fixture |
| E-CURSOR-PLUGIN-01 | Cursor | `docs/plugin-host-verification.md` (live CLI probe) | 2026-10-12 | tested: live Cursor CLI |
| E-KIMI-PLUGIN-01 | Kimi Code | Kimi `v0.38.0` source tool registry | 2026-10-12 | tested: source inspection |
| E-PRIME-01 through E-PRIME-11 | Prime Agent | Withdrawn 2026-10-09; upstream and package sources removed 2026-10-12 (Git history) | 2026-10-12 | withdrawn |
| E-CODEX-CLI-01 | Codex CLI | https://github.com/openai/codex | 2026-08-11 | not tested |
| E-CODEX-CLI-02 | Codex CLI | https://developers.openai.com/codex (docs index) | 2026-08-11 | not tested |
| E-CODEX-CLI-03, E-CODEX-CLI-04, E-CODEX-CLI-05, E-CODEX-CLI-06 | Codex CLI | https://developers.openai.com/codex/hooks | 2026-08-11 | not tested |
| E-CODEX-DESKTOP-01, E-CODEX-DESKTOP-02 | Codex desktop | https://developers.openai.com/codex (docs index) | 2026-08-11 | not tested |
| E-JCODE-01, E-JCODE-03 | JCode | https://github.com/1jehuang/jcode | 2026-08-11 | not tested |
| E-JCODE-02 | JCode | https://jcode.sh/sdk | 2026-08-11 | not tested |
| E-CRUSH-01, E-CRUSH-02, E-CRUSH-03, E-CRUSH-04, E-CRUSH-05 | Crush | https://github.com/charmbracelet/crush | 2026-08-11 | not tested |
| E-PI-TOOLS-02 | Pi | `packages/pi/src/tools.ts`; `packages/shared/pi/src/commands-core.ts`; `packages/shared/pi/src/tools-core.ts` (working-tree snapshot; no pinned host source read for execution-mode behavior) | 2026-10-04 | not tested |
| E-PROJ-OC-01, E-PROJ-OC-02, E-PROJ-OC-03 | OpenCode | Pinned host `1.18.31` (`/tmp/opencode/src`) plus `packages/opencode/src/` | 2026-09-18 | tested: source inspection + package/unit tests (no live model run) |
| E-PI-SUB-01, E-PI-SUB-02, E-PI-SUB-03, E-PI-SUB-04, E-PI-TOOLS-01 | Pi | `packages/pi/node_modules/@gotgenes/pi-subagents/dist/public.d.ts` and `package.json` (resolved `21.9.0`); `node_modules/.pnpm/@earendil-works+pi-coding-agent@0.84.2_*/node_modules/@earendil-works/pi-coding-agent/dist/` (host `0.84.2` where those claims were read; `allToolNames` re-verified unchanged in the installed `1.0.1` host on 2026-10-05) | 2026-10-02 (claims); 2026-10-05 (`allToolNames` re-verification) | tested: source inspection + package/unit tests (no live runtime E2E) |
| E-PROJ-PI-01 | Pi | `packages/pi/src/rules.ts`; `packages/shared/pi/src/project-config.ts`; `node_modules/.pnpm/@earendil-works+pi-coding-agent@1.0.1_*/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js` (`emitBeforeAgentStart`, `emitError`) (working-tree snapshot; package peer `^1.0.0`, resolved `1.0.1` 2026-10-05; swallowing path and whole-string `systemPrompt` return re-verified in installed 1.0.1 runner source) | 2026-10-05 | tested: installed 1.0.1 source inspection + package/unit tests against real 1.0 types (no live runtime E2E) |
| E-OMP-PLUGIN-01 | OMP | `docs/plugin-host-verification.md`; `scripts/e2e/omp-plugin-discovery.ts`; installed `18.4.8` loader and capability-provider source | 2026-10-10 | tested: packed discovery fixture; no `PluginManager.install`, `omp plugin install`, or task-execution E2E |
| E-PROJ-OMP-01 | OMP (retired native executable) | Retired 2026-10-12 with `@maestria/omp`; sources removed (Git history) | 2026-10-12 | retired |
| E-PROJ-PRIME-01 | Prime Agent | Withdrawn 2026-10-09; sources removed 2026-10-12 (Git history) | 2026-10-12 | withdrawn |
| E-PROJ-HERMES-01 | Hermes | Retired 2026-10-10 with the Python adapter; sources removed (Git history) | 2026-10-12 | retired |
| E-PROJ-SHARED-01 | All engines | Working-tree loaders (see Evidence section) | 2026-09-18 | tested: package/unit tests |

Upstream sources above are research-only (`unpinned - reverify before implementation`); E-CLAUDE-08 is a local working-tree package snapshot (`Working-tree package snapshot; verify at landing`), not an upstream research source. Reverify material claims before implementation, promotion, or re-promotion.
