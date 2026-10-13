# Runtime Support Matrix

Maintainer evidence ledger supporting [ADR-CORE-014](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md): runtime capabilities, enforcement, and promotion gates. It records dated research evidence, not a public support promise.

Every row is a dated snapshot as of its review date, not a maintenance obligation; reverification timing is governed by [ADR-CORE-014](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md). Start with the [snapshot](#snapshot) for support decisions, then follow each Evidence ID to its section here for non-plugin runtimes or to the [host verification register](plugin-host-verification.md) for plugin hosts.

## Consolidated distribution (2026-10-12)

`@maestria/agent-plugins` owns the declarative distributions for Codex, Claude Code, Cursor, Kimi Code, Devin, ZCode, Hermes, OMP, and portable clients. What ships per host is defined by the [component capability contract](agent-plugin-capabilities.md); dated plugin-host evidence lives in the [host verification register](plugin-host-verification.md). OpenCode and Pi retain native runtime adapters; OMP, Prime Agent and Hermes's former executable adapters remain retired.

## How to read this document

- **Reviewed:** the date the cited source was last verified; older claims are stale against the runtime's current documented state.
- **Verified:** a fact read directly from an official source on the review date. `[inferred]` marks a reasonable but unconfirmed assumption, tagged with its evidence.
- **Support level** uses the controlled vocabulary from ADR-CORE-014 (`Native`, `Native candidate`, `Provisional`, `Deferred`, `Withdrawn`) and contains no delivery terms.
- **Capability** (`Supported`, `Available`, `Unverified`, `Unavailable`) records what a runtime can do.
- **Control** (`Enforced`, `Trust-gated`, `Ignored`, `Advisory`, `Not a sandbox`, `Unsupported`) records what a runtime actually enforces. Skills, MCP, plugin loading, subagents, and JSON/RPC are never labeled `Enforced` as security controls.
- **Test status** is `tested` or `not tested`, qualified by the verification boundary; none implies a live runtime end-to-end test. `tested: source inspection` = pinned upstream source read, no runtime execution; `tested: package/unit tests` = tests against a fake host API; `tested: built-artifact smoke` = compiled artifact built and its behavior exercised.
- **Pinned state:** the exact release/version/immutable commit/docs revision per record, or the exact text `unpinned - reverify before implementation`.
- **Evidence ID:** links each row to a complete per-runtime Evidence record through one or more IDs (for example `E-CLAUDE-01`); the record carries runtime/surface, claim, pinned state, source URL/path, review date, and test status. Records are self-contained: do not infer runtime, date, or source from the section heading. Plugin-host records live in the [host verification register](plugin-host-verification.md).

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
| Claude Code | Native candidate | Plugin | candidate native plugin | Promotion gated on approved docs and a blind review; detail in [register](plugin-host-verification.md#claude-code) | [E-CLAUDE-01](plugin-host-verification.md#claude-code) | 2026-08-11 |
| Prime Agent | Withdrawn | None | withdrawn 2026-10-09: package and CLI platform removed; evidence pruned 2026-10-12 | See Prime Agent section | 2026-10-12 |
| Codex CLI | Native | Plugin + CLI-managed native agents/instructions | shipped native CLI adapter | Verified plugin skills, native custom agents, automatic primary-session orchestration guidance, model configuration, and idempotent install/update/uninstall; evidence, versions, and sources in the [register](plugin-host-verification.md#codex-cli) | [E-CODEX-CLI-12, E-CODEX-CLI-13, E-CODEX-CLI-14, E-CODEX-CLI-15](plugin-host-verification.md#codex-cli) | 2026-08-26 |
| Codex desktop | Deferred | Common-subset projection | no CLI parity | Common-subset projection only; no CLI parity claim; detail in [register](plugin-host-verification.md#codex-desktop) | [E-CODEX-DESKTOP-01](plugin-host-verification.md#codex-desktop) | 2026-08-11 |
| JCode | Deferred | Projection | Deferred - projection/experiment only | No confirmed first-class package/extension API | E-JCODE-01 | 2026-08-11 |
| Crush | Deferred | Projection | Deferred - projection/experiment only | No confirmed first-class package/extension API | E-CRUSH-01 | 2026-08-11 |
| DeepSeek Harness | Provisional | Projection + native plugin + agent preset | shipped provisional package, unverified against a live runtime | 14-skill projection plus a Cordis plugin (prompt sections, persona variables, skills provider) and a self-contained Maestria agent preset with per-specialist subagent delegation; typechecked and unit-tested against the published `@deepseek-ai/*` RC types, not verified against a live `dsh` deployment | E-DSH-01 | 2026-09-06 |

The per-runtime sections below are dated evidence snapshots as of their review dates, not maintenance obligations; each listed runtime's disposition is set by this table. Plugin-host detail for Cursor, Kimi Code, Devin, ZCode, OMP, and Hermes lives in the [host verification register](plugin-host-verification.md) under the [component capability contract](agent-plugin-capabilities.md).

---

## Prime Agent

> Withdrawn 2026-10-09; evidence ledger (E-PRIME-01 through E-PRIME-11) removed 2026-10-12. The `@maestria/prime-agent` package and CLI `prime-agent` platform no longer exist, and no host-support claim remains. Prior evidence is retained in Git history; any re-promotion restarts qualification under [ADR-CORE-014](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md).

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
| E-PROJ-PI-01 | Pi | `before_agent_start` | Both files are re-read in full every turn from host-selected session cwd; a present-but-unusable file surfaces via notify plus STOP banner and the handler never throws because the host swallows handler errors | Package peer `^1.0.0`, resolved `1.0.1` on 2026-10-05; handler-error swallowing and whole-string `systemPrompt` return re-verified in the installed 1.0.1 runner source (`emitBeforeAgentStart` into `emitError`) | `packages/pi/src/rules.ts`; `packages/shared/pi/src/project-config.ts` | 2026-10-05 | tested: installed 1.0.1 source inspection + package/unit tests against real 1.0 types (no live runtime E2E) |
| E-PROJ-OMP-01 | OMP (retired native executable) | `before_agent_start` | Retired 2026-10-12 with `@maestria/omp`; the replacement native global rule supplies routing guidance without a per-turn interceptor. Prior evidence is in Git history | n/a | n/a | 2026-10-12 | retired |
| E-PROJ-PRIME-01 | Prime Agent | `before_agent_start` | Withdrawn 2026-10-09 with the package; evidence pruned 2026-10-12 (Git history) | n/a | n/a | 2026-10-12 | withdrawn |
| E-PROJ-HERMES-01 | Hermes | `pre_llm_call` | Retired 2026-10-10 with the Python adapter ([CORE-034](adr/core/ADR-CORE-034-consolidated-declarative-plugin.md)); Hermes now receives the four plugin skills only and no project-file injection. Prior evidence is in Git history | n/a | n/a | 2026-10-12 | retired |
| E-PROJ-SHARED-01 | All engines | Loader contract | Deterministic workflow-first order; root-only scope; sanitized relative-path diagnostics; symlink root canonicalized with resolved-target regular-file check; call-time checks are not an atomic snapshot; content stays subordinate and never waives safety, authorization, or host permissions; subagent auto-injection is unverified so briefs still carry constraints | Working-tree loaders | `packages/opencode/src/project-config.ts`; `packages/shared/pi/src/project-config.ts` | 2026-09-18 | tested: package/unit tests |

Capability notes: OpenCode transform injection is `Supported` and `Advisory`; Pi `before_agent_start` injection is `Supported` and `Advisory`. OMP, Prime Agent, and Hermes executable injection was retired with their adapters. STOP banners and notifications advise stopping and waiting; none of them programmatically cancels the model call, so none is labeled `Enforced`.

## Cross-cutting boundaries

This file is the dated evidence ledger for non-plugin runtimes. Plugin-host evidence lives in the [host verification register](plugin-host-verification.md) under the [component capability contract](agent-plugin-capabilities.md). The controlled support vocabulary, capability-versus-control rules, package boundaries, promotion and withdrawal gates, and reverification triggers are defined in [ADR-CORE-014](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md) and [ADR-CORE-005](adr/core/ADR-CORE-005-shared-agent-directives-core-sync.md).

---

## Sources

| Evidence ID | Runtime | Source | Review date | Test status |
| --- | --- | --- | --- | --- |
| E-CLI-01, E-CLI-02, E-CLI-03 | Claude Code, Codex CLI | `claude plugin --help`, `codex plugin --help`; `apps/maestria-cli/src/lib/platforms.ts` | 2026-08-13 | tested |
| E-JCODE-01, E-JCODE-03 | JCode | https://github.com/1jehuang/jcode | 2026-08-11 | not tested |
| E-JCODE-02 | JCode | https://jcode.sh/sdk | 2026-08-11 | not tested |
| E-CRUSH-01, E-CRUSH-02, E-CRUSH-03, E-CRUSH-04, E-CRUSH-05 | Crush | https://github.com/charmbracelet/crush | 2026-08-11 | not tested |
| E-PI-TOOLS-02 | Pi | `packages/pi/src/tools.ts`; `packages/shared/pi/src/commands-core.ts`; `packages/shared/pi/src/tools-core.ts` (working-tree snapshot; no pinned host source read for execution-mode behavior) | 2026-10-04 | not tested |
| E-DSH-01 | DeepSeek Harness | https://www.deepseek.com/harness/en/ ; https://github.com/deepseek-ai/deepseek-harness | 2026-09-06 | not tested |
| E-DSH-02, E-DSH-07 | DeepSeek Harness | https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/skills.md ; https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md ; https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/01-first-plugin.md | 2026-09-06 | tested: typecheck + unit tests |
| E-DSH-03, E-DSH-04, E-DSH-06 | DeepSeek Harness | https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/subagent.md ; https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/config-catalog.md ; https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/preset/agent-presets/README.md | 2026-09-06 | not tested |
| E-DSH-05 | DeepSeek Harness | https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/system-prompt.md | 2026-09-06 | tested |
| E-DSH-08 | DeepSeek Harness | https://registry.npmjs.org (npm view, 2026-09-06) | 2026-09-06 | tested: typecheck |
| E-PROJ-OC-01, E-PROJ-OC-02, E-PROJ-OC-03 | OpenCode | Pinned host `1.18.31` (`/tmp/opencode/src`) plus `packages/opencode/src/` | 2026-09-18 | tested: source inspection + package/unit tests (no live model run) |
| E-PI-SUB-01, E-PI-SUB-02, E-PI-SUB-03, E-PI-SUB-04, E-PI-TOOLS-01 | Pi | `packages/pi/node_modules/@gotgenes/pi-subagents/dist/public.d.ts` and `package.json` (resolved `21.9.0`); `node_modules/.pnpm/@earendil-works+pi-coding-agent@0.84.2_*/node_modules/@earendil-works/pi-coding-agent/dist/` (host `0.84.2` where those claims were read; `allToolNames` re-verified unchanged in the installed `1.0.1` host on 2026-10-05) | 2026-10-02 (claims); 2026-10-05 (`allToolNames` re-verification) | tested: source inspection + package/unit tests (no live runtime E2E) |
| E-PROJ-PI-01 | Pi | `packages/pi/src/rules.ts`; `packages/shared/pi/src/project-config.ts`; `node_modules/.pnpm/@earendil-works+pi-coding-agent@1.0.1_*/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js` (`emitBeforeAgentStart`, `emitError`) (working-tree snapshot; package peer `^1.0.0`, resolved `1.0.1` 2026-10-05; swallowing path and whole-string `systemPrompt` return re-verified in installed 1.0.1 runner source) | 2026-10-05 | tested: installed 1.0.1 source inspection + package/unit tests against real 1.0 types (no live runtime E2E) |
| E-PROJ-OMP-01 | OMP (retired native executable) | Retired 2026-10-12 with `@maestria/omp`; sources removed (Git history) | 2026-10-12 | retired |
| E-PROJ-PRIME-01 | Prime Agent | Withdrawn 2026-10-09; sources removed 2026-10-12 (Git history) | 2026-10-12 | withdrawn |
| E-PROJ-HERMES-01 | Hermes | Retired 2026-10-10 with the Python adapter; sources removed (Git history) | 2026-10-12 | retired |
| E-PROJ-SHARED-01 | All engines | Working-tree loaders (see Evidence section) | 2026-09-18 | tested: package/unit tests |
| E-PRIME-01 through E-PRIME-11 | Prime Agent | Withdrawn 2026-10-09; upstream and package sources removed 2026-10-12 (Git history) | 2026-10-12 | withdrawn |

Upstream sources above are research-only (`unpinned - reverify before implementation`). Reverify material claims before implementation, promotion, or re-promotion.
