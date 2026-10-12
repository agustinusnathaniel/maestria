# Plugin Host Verification

## Purpose

Single evidence register for declarative plugin hosts (Claude Code, Codex CLI and desktop, Cursor, Kimi Code, Devin, ZCode, OMP, Hermes). Each host section holds its dated probes and results plus its evidence rows with pinned versions, dates, sources, and test status. The [capability contract](agent-plugin-capabilities.md) defines what ships per host; the [runtime support matrix](runtime-support-matrix.md) keeps non-plugin runtimes.

Verify discovery, actual installation ownership, and complete prepared context independently of package shape. These offline probes do not require provider credentials or prove model obedience. The current component contract is seven shared task profiles (`agents/<role>.md`, no orchestrator), three shared workflows, per-host global policy, and four root skills (two generated utilities and two methodology skills bundled from the repository root since 2026-10-13). Results dated before 2026-10-12 that cite eight profiles describe a superseded layout.

## Claude Code

With Claude Code installed, run from the repository root:

```sh
node --experimental-strip-types scripts/e2e/claude-skill-preload.ts --out artifacts/claude-skill-preload-evidence.json
```

The legacy script filename is retained for reproduction, but the probe now checks complete native context rather than role-skill preloading. It launches the real CLI with temporary configuration/workspace, disabled persistence and nonessential traffic, and a local Anthropic-compatible fixture using a dummy credential. Digests and request diagnostics are recorded instead of credentials or full request prompts.

Superseded run: Claude Code 2.1.217 passed ten checks against the former per-host layout: native dispatch was exposed, the complete reviewer profile and canonical global policy reached the child, Write/Edit were absent from its tool schema, and the result returned to the parent. This proved the tested role's native context and tool-schema filtering.

**2026-10-12 (current):** on Claude Code 2.1.295 the same offline fixture loaded the reviewer from the shared `agents/reviewer.md`; Write and Edit were unavailable and the full role plus global policy reached the child context. `claude plugin validate --strict` also passes on 2.1.295. It does not prove model judgment, every specialist, shell-mediated read-only enforcement, or hosted Claude surfaces. The probe loads the checkout; separate archive checks verify the packaged resource paths.

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
| E-CLAUDE-08 | Claude Code | First separate `@maestria/claude-code` package (historical) | The first package shipped no `hooks/` directory or package-level hook resources; that historical fact does not establish the consolidated package's current contents or downgrade Claude Code capability | Historical working-tree package snapshot | Prior package snapshot, 2026-08-12; current package support is documented in this register | 2026-08-12 | tested |
| E-CLAUDE-09 | Claude Code | Native child skill preload and tool schema | A deterministic CLI fixture loaded the thin reviewer profile, reached both reviewer and global-rules skills in the child request, and observed a child tool schema without Write/Edit. This verifies that role's native preload and declared tool boundary, not model judgment, shell-mediated editing, every specialist, or other CLI versions | Claude Code `2.1.217` | This register; `scripts/e2e/claude-skill-preload.ts`; `packages/agent-plugins/tests/claude-loading.test.ts` | 2026-10-10 | tested: native CLI fixture; no paid inference |
| E-CLAUDE-10 | Claude Code | Full native child context | The real offline CLI fixture reached complete reviewer and global-policy instructions without role-skill preloads, excluded Write/Edit from the child tool schema, and returned its result to the parent. Superseded by E-CLAUDE-11 for the current layout. | Claude Code 2.1.217 | This register; `scripts/e2e/claude-skill-preload.ts` | 2026-10-11 | tested: native CLI fixture; no paid inference |
| E-CLAUDE-11 | Claude Code | Shared-profile child context and strict validation | `claude plugin validate --strict` passed. The offline fixture loaded the reviewer from the shared `agents/reviewer.md` (no per-host copy), Write and Edit were unavailable, and the full role and global policy reached the child context. | Claude Code 2.1.295 | This register; `scripts/e2e/claude-skill-preload.ts` | 2026-10-12 | tested: native CLI fixture; no paid inference |
| E-CLAUDE-12 | Claude Code | Bundled skill discovery | With `create-pull-request` and `docs-update` bundled in `skills/`, `claude plugin validate --strict` passed and the offline fixture's parent request listed `maestria:create-pull-request`, `maestria:docs-update`, `maestria:handoff`, and `maestria:iteration-limits` beside the seven agents and three commands. Skill invocation by a model was not exercised. | Claude Code 2.1.295 | This register; `scripts/e2e/claude-skill-preload.ts` with a local request-capture patch | 2026-10-13 | tested: native CLI fixture; no paid inference |

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

## Codex CLI

Full generated TOML prompts contain bracketed examples that a line-only editor can mistake for table headers. The repaired helper is tested against all seven actual profiles with user settings before and after their multiline instructions. Independent Python `tomllib` validation confirms 14 cases preserve top-level model, effort, service tier, and the prompt value unchanged.

```sh
node --experimental-strip-types artifacts/codex-toml-repair/reproduce.mjs
```

Evidence and baseline failing tests are under ignored `artifacts/codex-toml-repair/`. The reproduction reads the committed baseline through a temporary module rather than replacing production code. Existing installer tests cover managed instructions, model refresh, and unrelated user-file preservation. This does not test model inference or hosted Codex tasks.

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

### Consolidated package re-verification (2026-10-12)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CODEX-CLI-17 | Codex CLI | Portable skill discovery | The version-matched loader fixes portable skill discovery to root `skills/`; the overlay does not redirect it. Full native methodology is supplied by the companion installer. Model preservation is tested independently against actual generated TOML prompts (see the multiline settings probe above). | Codex CLI `0.153.4` (`rust-v0.153.4`) | See Sources table (loader source and custom-agents doc) | 2026-10-12 | tested: source inspection + package/unit tests |
| E-CODEX-CLI-18 | Codex CLI | Companion installer from the packed archive | With an isolated `CODEX_HOME`, `installCodexManagedAgents` wrote seven `maestria-<role>.toml` profiles (all parse as TOML) with `sandbox_mode = "read-only"` on adventurer, architect, planner, and reviewer only, and one marked instruction block in `AGENTS.md` after existing user text. A second run changed nothing; removal deleted only managed files and the marked block, preserving a pre-seeded user agent and user instructions. No Codex session was started. | Codex CLI `0.153.4` | This register | 2026-10-13 | tested: real installer code against the packed archive |

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

## Cursor

The 2026-10-12 live probe asked read-only roles to write a file; the result is in the evidence row. `maestria configure cursor` at project level writes copies into `.cursor/agents/`, where the metadata is enforced. No claim that plugin `readonly` blocks write tools at runtime is supported.

### Evidence (reviewed 2026-10-12)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CURSOR-PLUGIN-01 | Cursor | Plugin agent `readonly` | Plugin-supplied agents did not enforce `readonly: true` (a write succeeded, with or without other hosts' frontmatter keys present). A project `.cursor/agents/` profile with `readonly: true` was blocked ("cannot run non read-only tools"). Other hosts' keys do not affect Cursor loading. Cursor desktop was not tested. | Cursor CLI 2026.10.01 | This register (live CLI probe) | 2026-10-12 | tested: live Cursor CLI; no desktop |

## Kimi Code

Profiles now use `disallowedTools: [Write, Edit]`. In the Kimi 2.1.1 source (2026-10-12), plugin agent and command discovery reads only `.md` files (`app/plugin/manifest.ts`) and `$ARGUMENTS` is substituted in `app/plugin/commands.ts`. This is source inspection only. A live run on Kimi CLI 2.1.1 was not possible: the account has no Kimi Code subscription (403), and the configured OpenCode Go route is rejected by the CLI.

### Evidence (reviewed 2026-10-12)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-KIMI-PLUGIN-01 | Kimi Code | Tool names for `disallowedTools` | Kimi registers tools as `Write` and `Edit`; the previously shipped `WriteFile` and `StrReplaceFile` names matched nothing, so read-only was not effective before. Unknown keys (`readonly`, `model`) are ignored and `$ARGUMENTS` is substituted in plugin commands. Not live-run. | Kimi v0.38.0 and v2.1.1 | This register (Kimi source tool registry) | 2026-10-12 | tested: source inspection |

## Devin

The probe ran `devin plugins install --local -y ./packages/agent-plugins`, then `devin plugins info maestria` (agents are listed as `maestria:adventurer` through `maestria:writer`). Before `trigger: manual` was added, `rules/global.md` was listed as agent-decided, which could add a second policy copy with OMP-only dispatch text; afterwards it is listed as manual. The probe install was removed afterwards.

### Evidence (reviewed 2026-10-12)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-DEVIN-PLUGIN-01 | Devin | Plugin discovery | `devin plugins info` lists seven agents, four skills (two utilities on 2026-10-12; four after bundling, rechecked 2026-10-13), `AGENTS.md` always on and `rules/global.md` manual; `.toml` profiles and per-host rules are not loaded. No agent task run. | Devin CLI 3000.11.3 | This register (`devin plugins info`) | 2026-10-12 | tested: live Devin CLI discovery |

## ZCode

ZCode source (`zai-org/ZCode`, 2026-10-12) and the installed desktop bundle agree. The plugin loader reads `.zcode-plugin/plugin.json`; `commands` and `skills` selectors are directories (file-list entries are ignored) and the default directories load automatically, so the Codex TOMLs are skipped. The subagent parser reads `name`, `description`, `model`, `tools`, `disallowedTools`, `skills`, `permissionMode`, and a few display fields. Bash and MCP tools remain after `disallowedTools` is applied. An omitted `model` inherits the parent model. Command files substitute `$ARGUMENTS`, name commands by filename, and run inline shell expansion. Shipped Markdown must therefore never contain an exclamation mark directly before a backtick, because ZCode and Claude Code commands run that as inline shell; the packed-artifact test enforces it. No live ZCode run was performed: it is desktop-only.

### Evidence (reviewed 2026-10-12)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-ZCODE-PLUGIN-01 | ZCode | Agent loading and `disallowedTools` | Directory selectors for commands and skills, conventional `agents/` discovery (the `agents` key is diagnostic-only), `.md`-only agents, no rules component; `disallowedTools` is subtracted from the subagent's tool allowlist (exact `Write`/`Edit` names; shell remains); unknown keys dropped. Not live-run. | ZCode source `main`, installed desktop build | This register (ZCode source and shipped bundle) | 2026-10-12 | tested: shipped code inspection |

## OMP

Dated evidence for OMP's native declarative resources alongside portable utilities. The empty `package.json#omp` marker registers the data-only package; no executable extensions array is required. The retired executable adapter's hooks, interception, mode persistence, and goal mirroring remain historical. OMP has no tool denylist, so the shared profiles' read-only text is prompt-level.

With Bun and OMP 18.4.8 sources installed, run:

```sh
pnpm exec bun scripts/e2e/omp-plugin-discovery.ts --host-root /absolute/path/to/@oh-my-pi/pi-coding-agent --out artifacts/omp-plugin-discovery.json
```

This packs and extracts the plugin, then uses actual capability providers and installed-loader code against both the Git root and archive. On 2026-10-12 (OMP 18.4.8, archive and git root), discovery returned 7 agents, 3 commands, 1 rule, and 2 skills; `.toml` files are not loaded. On 2026-10-13, after the methodology skills were bundled, it returned 7 agents, 3 commands, 1 rule, and 4 skills on both. The metadata registration fixture is distinct from a real installation transaction.

### Real isolated installation and prepared prompts

Re-run 2026-10-13 on the bundled-skills layout (`ebf9e511`): the same harness, adapted to seven profiles and four named skills, passed 39 of 39 checks with no network requests. Install, disable, reinstall, enable, and uninstall succeeded; the local-source upgrade was refused as expected; default installed discovery found 7 agents, 3 commands, 1 always-apply rule, and exactly the 4 skills `create-pull-request`, `docs-update`, `handoff`, and `iteration-limits`, with no extension modules, tools, hooks, or MCP servers; the full global rule and the skill catalog were injected into the system prompt; all seven role-template compositions passed. An earlier 2026-10-13 run on `d47c2c91` (2 skills, before bundling) also passed 39 of 39. The harness lives only under ignored `artifacts/` and must be adapted to the current profile and skill counts. The 2026-10-11 run covered the previous eight-profile layout. It uses the pinned 18.4.8 bundled CLI with a temporary host home/configuration, local archive input, and no provider configuration. In that 2026-10-11 eight-profile run, the native payload was compared between source and archive (52 files matched), and its 41 checks covered real install, disable, reinstall, local-source remote-upgrade refusal, uninstall cleanup, default installed discovery, slash argument expansion, full global-rule system-prompt injection, and all eight task-role template compositions; the 2026-10-13 run above replaces it for the current layout.

The 2026-10-11 inputs and results are preserved under ignored `artifacts/omp-actual-host-proof/` (`run-proof.py`, `probe.ts`, `proof.json`, `source-archive-identity.json`, and the prepared prompt), and the current run under its `2026-10-13-four-skills/` subfolder. `probe.ts` and `run-proof.py` hard-code their fixture root and the pinned 18.4.8 host path; point both at a fresh directory containing empty `home/`, `bun-cache/`, `npm-cache/`, and `project/` folders, then reproduce with:

```sh
python3 -I <fixture-root>/run-proof.py
```

The source SDK's direct PluginManager import hit an upstream module-resolution ambiguity; installation was exercised through the shipped bundled CLI instead. This is not treated as a maestria failure. Prompt preparation uses native formatter/template APIs; formatting may normalize Markdown table padding.

No inference or actual task spawn occurs. Generic profiles have no `tools`, `spawns`, or model override metadata, so read-only role text remains advisory. No executable modules, hooks, custom tools, or MCP servers were discovered. These results do not establish enforcement, other host versions, or provider behavior.

### Evidence (reviewed 2026-10-12)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-OMP-PLUGIN-01 | OMP | Current native resource discovery | Source (git root) and archive discovery expose seven task profiles, four skills, three commands, and one always-apply global rule; `.toml` files are not loaded. The previous fourteen-skill/zero-command fixture and the 2026-10-11 eight-profile result describe retired layouts. | Host 18.4.8 | `scripts/e2e/omp-plugin-discovery.ts`; this register | 2026-10-13 | tested: actual capability providers, source/archive payload |
| E-OMP-PLUGIN-02 | OMP | Real installed lifecycle and prepared context | An isolated local-archive CLI installation, disable, reinstall, enable, upgrade refusal for a local source, and uninstall passed (39 of 39 checks, no network). Default installed discovery (7 agents, 3 commands, 1 always-apply rule, and the 4 skills `create-pull-request`, `docs-update`, `handoff`, `iteration-limits`), global rule and skill-catalog system-prompt injection, and all seven task-template compositions passed on the bundled-skills layout (`ebf9e511`). No inference or actual task spawn was performed. | Host 18.4.8 | `artifacts/omp-actual-host-proof/` (ignored, adapted harness); this register | 2026-10-13 | tested: real bundled CLI and native prompt/discovery APIs |

## Hermes

The Hermes loader supplies skills and optional MCP resources. Portable installation is skills-only. Full manual methodology context is separate: the first matching project-context type wins, and delegated children can skip those files, so they require explicit context handoff. Docs-only; see Sources.

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-HERMES-PLUGIN-01 | Hermes | Portable install and discovery | With an isolated `HERMES_HOME`, the packed archive (served as a local git source, since Hermes does not take plain local paths) installed and enabled; `hermes plugins list` and `doctor` passed. Re-run on the bundled-skills package (`ebf9e511`, Hermes 0.21.7): Hermes discovered exactly four skills as `agent-plugin-maestria-<hash>:create-pull-request`, `:docs-update`, `:handoff`, and `:iteration-limits`; no agents, commands, rules, tools, hooks, or MCP servers loaded. Disable and remove left no plugin files. An earlier 2026-10-13 run on Hermes 0.21.3, before bundling, discovered exactly the two utilities. No inference was run. | Hermes 0.21.7 | This register | 2026-10-13 | tested: live Hermes CLI (isolated home) |

## Remaining evidence boundaries

- Claude's explicit agent-file form passes strict validation; directory form is rejected. Acceptance of extra frontmatter does not establish runtime enforcement.
- Kimi native profiles, command/bootstrap resources, and size limits have package/schema evidence; live dispatch and reload remain unverified.
- Cursor plugin agents do not enforce `readonly` (see above). Devin discovery is verified, but Devin and ZCode native task execution remains unverified; Devin and OMP have no denylist, so their read-only roles are prompt-level. ZCode removes `disallowedTools` from subagent tools per its source, but no live ZCode run was performed.
- Codex marketplace exposes only utility skills; its complete agent/policy/mode context is supplied by the managed CLI path.
- A doctor check or install dry-run is not proof of a plugin loading, and earlier fourteen-skill/zero-command and eight-profile probes describe retired layouts.

Run the completion gates as well as these probes. Regenerate affected evidence when native contexts, selectors, or installation behavior changes; unchanged source bodies and metadata-only descriptions do not require repeating provider-independent lifecycle work without a named concern.

## Sources

| Evidence ID | Source | Review date | Test status |
| --- | --- | --- | --- |
| E-CLAUDE-01, E-CLAUDE-02 | https://code.claude.com/docs/en/plugins | 2026-08-11 | not tested |
| E-CLAUDE-04, E-CLAUDE-05 | https://code.claude.com/docs/en/hooks | 2026-08-11 | not tested |
| E-CLAUDE-06, E-CLAUDE-07 | https://code.claude.com/docs/en/sub-agents | 2026-08-11 | not tested |
| E-CLAUDE-03 | https://code.claude.com/docs/en/plugin-marketplaces | 2026-08-11 | not tested |
| E-CLAUDE-08 | Working-tree package snapshot; verify at landing (historical first-package snapshot) | 2026-08-12 | tested |
| E-CLAUDE-09 | This register; `scripts/e2e/claude-skill-preload.ts` | 2026-10-10 | tested: native CLI fixture (superseded) |
| E-CLAUDE-10, E-CLAUDE-11, E-CLAUDE-12 | This register; `scripts/e2e/claude-skill-preload.ts`; https://code.claude.com/docs/en/plugins/components; https://claude.com/docs/plugins/platform-support | 2026-10-12 (E-CLAUDE-10 reviewed 2026-10-11) | tested: native CLI fixture |
| E-CURSOR-PLUGIN-01 | This register (live CLI probe); https://cursor.com/docs/reference/plugins; https://cursor.com/docs/subagents | 2026-10-12 | tested: live Cursor CLI |
| E-KIMI-PLUGIN-01 | Kimi `v0.38.0` and `v2.1.1` source tool registry; https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html#plugin-agents | 2026-10-12 | tested: source inspection |
| E-DEVIN-PLUGIN-01 | This register (`devin plugins info`); https://docs.devin.ai/cli/extensibility/plugins/overview | 2026-10-12 | tested: live Devin CLI discovery |
| E-ZCODE-PLUGIN-01 | This register (ZCode source and shipped bundle); https://zcode.z.ai/en/docs/plugin | 2026-10-12 | tested: source inspection |
| E-CODEX-CLI-01 | https://github.com/openai/codex | 2026-08-11 | not tested |
| E-CODEX-CLI-02 | https://developers.openai.com/codex (docs index) | 2026-08-11 | not tested |
| E-CODEX-CLI-03, E-CODEX-CLI-04, E-CODEX-CLI-05, E-CODEX-CLI-06 | https://developers.openai.com/codex/hooks | 2026-08-11 | not tested |
| E-CODEX-DESKTOP-01, E-CODEX-DESKTOP-02 | https://developers.openai.com/codex (docs index) | 2026-08-11 | not tested |
| E-CODEX-CLI-07, E-CODEX-CLI-08, E-CODEX-CLI-09, E-CODEX-CLI-10, E-CODEX-CLI-11 | Pinned `rust-v0.145.0` sources and working-tree snapshot; see Evidence rows | 2026-08-13 | tested (see Evidence rows) |
| E-CODEX-CLI-12, E-CODEX-CLI-13, E-CODEX-CLI-14, E-CODEX-CLI-15, E-CODEX-CLI-16 | Upstream docs, pinned host source, and working-tree implementation; see Evidence rows | 2026-08-26 | tested (see Evidence rows) |
| E-OMP-PLUGIN-01 | This register; `scripts/e2e/omp-plugin-discovery.ts`; installed `18.4.8` loader and capability-provider source; https://omp.sh/docs/plugins; https://omp.sh/docs/subagent-authoring | 2026-10-12 | tested: packed discovery fixture; no `PluginManager.install`, `omp plugin install`, or task-execution E2E |
| E-OMP-PLUGIN-02 | `artifacts/omp-actual-host-proof/` (ignored, adapted harness); this register | 2026-10-13 | tested: real bundled CLI and native prompt/discovery APIs |
| E-CODEX-CLI-17 | https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/core-plugins/src/agent_plugin_manifest.rs#L166; https://learn.chatgpt.com/docs/agent-configuration/subagents | 2026-10-12 | tested: source inspection + package/unit tests |
| E-CODEX-CLI-18 | This register; `apps/maestria-cli/src/lib/codex-managed-agents.ts` (`installCodexManagedAgents`, removal) run against the packed archive with an isolated `CODEX_HOME` | 2026-10-13 | tested: real installer code against the packed archive |
| E-HERMES-PLUGIN-01 | This register; Hermes 0.21.7 CLI (`hermes plugins install/list/doctor/disable/remove`) with an isolated `HERMES_HOME` | 2026-10-13 | tested: live Hermes CLI (isolated home) |
| Hermes section (no evidence ID) | https://hermes-agent.nousresearch.com/docs/developer-guide/plugins#portable-agent-plugins-v1-packages; https://hermes-agent.nousresearch.com/docs/developer-guide/prompt-assembly | 2026-10-12 | docs-only |

Upstream sources above are research-only (`unpinned - reverify before implementation`); E-CLAUDE-08 is a local working-tree package snapshot (`Working-tree package snapshot; verify at landing`), not an upstream research source. Reverify material claims before implementation, promotion, or re-promotion.
