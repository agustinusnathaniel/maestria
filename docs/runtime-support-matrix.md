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
| DeepSeek Harness | Provisional | Bundle: agent preset + Cordis plugin + skills | shipped provisional bundle, verified against a real `dsh` run with a fake model | `maestria` agent preset with host-filtered specialist delegation tools, verified end to end against DSH `0.2.0-rc.2` without live inference | E-DSH-01 to E-DSH-05 | 2026-10-14 |

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

**Support level:** Provisional. **Delivery:** a DSH bundle declaring the `maestria` agent preset. **Disposition:** shipped provisional package. **Rationale:** DSH is a developer preview; the bundle is verified end to end against a real `dsh` `0.2.0-rc.2` run with a local fake model, not against live inference. Decision: [ADR-DSH-001](adr/deepseek/ADR-DSH-001-agent-preset-bundle.md).

### Evidence (reviewed 2026-10-14)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-DSH-01 | DeepSeek Harness | Distribution | A package declaring `dsh.bundle.patch` installs with `dsh plugin --profile <name> add` and joins that profile's bundle layers; `remove` (or pnpm's `uninstall` alias) drops it. Only the shipped `web` profile mounts the agent-preset registry | `@deepseek-ai/dsh` `0.2.0-rc.2` (`dsh-v0.2.0-rc.2`, `639ed015`) | `docs/user/develop/basic/publish.md`; `apps/cli/reference/README.md`; `packages/bundle/web-app/cordis.patch.yml` | 2026-10-14 | tested: `scripts/e2e/deepseek-evidence.ts` (real `dsh` install, boot, and removal) |
| E-DSH-02 | DeepSeek Harness | Agent presets | A preset is a `@deepseek-ai/dsh-agent-preset` row in a patch; preset directories are no longer read. A patch cannot insert into another preset's plugin list, because only `group: true` rows are indexed | `0.2.0-rc.2` | `packages/preset/agent-preset/README.md`; `vendor/include/src/index.ts` (`applyEntryPatches`) | 2026-10-14 | tested: E2E (preset activates and a session is created on it) |
| E-DSH-03 | DeepSeek Harness | Delegation tool | `dsh-tool-subagent` rows take `persona`, `toolFilter` (`allow`/`deny`), and `maxDepth`; a child joins its parent's preset, so preset-scoped prompt sections and variables reach it. The host adds its own `subagent` tool to every spawned child after the filter | `0.2.0-rc.2` | `packages/subagent/tool-subagent/src/index.ts`; `packages/subagent/subagent/src/child-agent.ts` (`applyChildComposition`) | 2026-10-14 | tested: E2E (reviewer and architect children's personas, rules, and tool lists) |
| E-DSH-04 | DeepSeek Harness | System prompt | `systemPrompt.variable()` values are not rescanned after substitution; a section with `interpolate: false` stays literal; `dsh-persona` requires `prefix` | `0.2.0-rc.2` | `packages/core/system-prompt/src/index.ts` (`renderPrompt`); `packages/preset/persona/src/index.ts` | 2026-10-14 | tested: E2E plus `packages/deepseek/tests/preset.test.ts` against the published `dsh-system-prompt` |
| E-DSH-05 | DeepSeek Harness | Skills | `dsh-skill-filesystem` `customSkillDirs` roots rank above user roots and below project roots; a Loader `!!js` expression resolves the installed package's `skills/` from the profile's base URL | `0.2.0-rc.2` | `packages/skill/skill-filesystem/src/index.ts`; `packages/bundle/web-app/presets/cordis.patch.yml` | 2026-10-14 | tested: E2E (skills listed from the installed bundle path) |

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-DSH-03 | `toolFilter` on specialist delegation tools | Supported | Enforced | Filtered tools are absent from the child's request; the host-added `subagent` tool remains, bounded by `maxDepth: 1` |
| E-DSH-03, E-DSH-04 | Personas, global rules, and skills | Supported | Advisory | Guidance only; assembly is not a permission boundary |
| E-DSH-01 | Sandbox, approvals, permission presets | Host-owned | Enforced by host | The bundle changes none of them |

### Statuses and gates

- **Promotion to `Native`:** a live-inference session on a released (non-preview) DSH line, plus a re-diff of the restated `standard` preset rows against that release.
- **Rollback:** `maestria uninstall deepseek` (or `dsh plugin --profile web remove @maestria/deepseek`); remove `packages/deepseek` and the CLI handler entry.

---

## Project customization loading (reviewed 2026-09-18)

Dated evidence for root `.maestria/workflow.md` then `.maestria/rules.md` loading. Order is workflow first, then rules, on every engine. Scope is project root only with no ancestor or nested lookup. Absent or empty files leave defaults unchanged. Diagnostics name only the relative file and the failure kind. This section records loading evidence only; support levels in the [snapshot](#snapshot) are unchanged.

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-PROJ-OC-01 | OpenCode | `session.hook('context')`, `session.hook('compaction')` | Global rules and project files are appended as fresh system parts to every agent-loop and compaction request; an unusable project file fails the request before the model is called | Host `2.0.28`, `@opencode/plugin` `2.0.28` | `packages/opencode/src/session.ts`; `scripts/e2e/opencode-evidence.ts` | 2026-10-14 | tested: real-host E2E with a local fake provider (no live model run) |
| E-PROJ-OC-02 | OpenCode | V1 hooks | Retired 2026-10-14 with the OpenCode V1 adapter (`@maestria/opencode` 0.8.0 and earlier); prior evidence is in Git history | n/a | n/a | 2026-10-14 | retired |
| E-PROJ-OC-03 | OpenCode | Project root | Root is the plugin location's project directory, or the location directory when OpenCode reports the global project as `/` | Host `2.0.28` | `packages/opencode/src/session.ts`; `@opencode/plugin` `Location.Info` | 2026-10-14 | tested: real-host E2E with a local fake provider |
| E-PROJ-PI-01 | Pi | `before_agent_start` | Both files are re-read in full every turn from host-selected session cwd; a present-but-unusable file surfaces via notify plus STOP banner and the handler never throws because the host swallows handler errors | Package peer `^1.0.0`, resolved `1.0.1` on 2026-10-05; handler-error swallowing and whole-string `systemPrompt` return re-verified in the installed 1.0.1 runner source (`emitBeforeAgentStart` into `emitError`) | `packages/pi/src/rules.ts`; `packages/shared/pi/src/project-config.ts` | 2026-10-05 | tested: installed 1.0.1 source inspection + package/unit tests against real 1.0 types (no live runtime E2E) |
| E-PROJ-OMP-01 | OMP (retired native executable) | `before_agent_start` | Retired 2026-10-12 with `@maestria/omp`; the replacement native global rule supplies routing guidance without a per-turn interceptor. Prior evidence is in Git history | n/a | n/a | 2026-10-12 | retired |
| E-PROJ-PRIME-01 | Prime Agent | `before_agent_start` | Withdrawn 2026-10-09 with the package; evidence pruned 2026-10-12 (Git history) | n/a | n/a | 2026-10-12 | withdrawn |
| E-PROJ-HERMES-01 | Hermes | `pre_llm_call` | Retired 2026-10-10 with the Python adapter ([CORE-034](adr/core/ADR-CORE-034-consolidated-declarative-plugin.md)); Hermes now receives the four plugin skills only and no project-file injection. Prior evidence is in Git history | n/a | n/a | 2026-10-12 | retired |
| E-PROJ-SHARED-01 | All engines | Loader contract | Deterministic workflow-first order; root-only scope; sanitized relative-path diagnostics; symlink root canonicalized with resolved-target regular-file check; call-time checks are not an atomic snapshot; content stays subordinate and never waives safety, authorization, or host permissions; subagent auto-injection is unverified so briefs still carry constraints | Working-tree loaders | `packages/shared/project-config/src/`; `packages/shared/pi/src/project-config.ts` | 2026-09-18 | tested: package/unit tests |

Capability notes: OpenCode session-hook injection is `Supported` and `Advisory`; Pi `before_agent_start` injection is `Supported` and `Advisory`. OMP, Prime Agent, and Hermes executable injection was retired with their adapters. STOP banners and notifications advise stopping and waiting; none of them programmatically cancels the model call, so none is labeled `Enforced`.

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
| E-DSH-01 to E-DSH-05 | DeepSeek Harness | `deepseek-ai/deepseek-harness` tag `dsh-v0.2.0-rc.2` (`639ed015`); `@deepseek-ai/dsh` `0.2.0-rc.2` from npm | 2026-10-14 | tested: real-host E2E with a local fake model (no live inference) |
| E-PROJ-OC-01, E-PROJ-OC-03 | OpenCode | `packages/opencode/src/session.ts`; `scripts/e2e/opencode-evidence.ts` against OpenCode CLI `2.0.28` | 2026-10-14 | tested: real-host E2E with a local fake provider (no live model run) |
| E-PI-SUB-01, E-PI-SUB-02, E-PI-SUB-03, E-PI-SUB-04, E-PI-TOOLS-01 | Pi | `packages/pi/node_modules/@gotgenes/pi-subagents/dist/public.d.ts` and `package.json` (resolved `21.9.0`); `node_modules/.pnpm/@earendil-works+pi-coding-agent@0.84.2_*/node_modules/@earendil-works/pi-coding-agent/dist/` (host `0.84.2` where those claims were read; `allToolNames` re-verified unchanged in the installed `1.0.1` host on 2026-10-05) | 2026-10-02 (claims); 2026-10-05 (`allToolNames` re-verification) | tested: source inspection + package/unit tests (no live runtime E2E) |
| E-PROJ-PI-01 | Pi | `packages/pi/src/rules.ts`; `packages/shared/pi/src/project-config.ts`; `node_modules/.pnpm/@earendil-works+pi-coding-agent@1.0.1_*/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js` (`emitBeforeAgentStart`, `emitError`) (working-tree snapshot; package peer `^1.0.0`, resolved `1.0.1` 2026-10-05; swallowing path and whole-string `systemPrompt` return re-verified in installed 1.0.1 runner source) | 2026-10-05 | tested: installed 1.0.1 source inspection + package/unit tests against real 1.0 types (no live runtime E2E) |
| E-PROJ-OMP-01 | OMP (retired native executable) | Retired 2026-10-12 with `@maestria/omp`; sources removed (Git history) | 2026-10-12 | retired |
| E-PROJ-PRIME-01 | Prime Agent | Withdrawn 2026-10-09; sources removed 2026-10-12 (Git history) | 2026-10-12 | withdrawn |
| E-PROJ-HERMES-01 | Hermes | Retired 2026-10-10 with the Python adapter; sources removed (Git history) | 2026-10-12 | retired |
| E-PROJ-SHARED-01 | All engines | Working-tree loaders (see Evidence section) | 2026-09-18 | tested: package/unit tests |
| E-PRIME-01 through E-PRIME-11 | Prime Agent | Withdrawn 2026-10-09; upstream and package sources removed 2026-10-12 (Git history) | 2026-10-12 | withdrawn |

Upstream sources above are research-only (`unpinned - reverify before implementation`). Reverify material claims before implementation, promotion, or re-promotion.
