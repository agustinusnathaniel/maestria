# Runtime Support Matrix

Internal evidence ledger for runtime support and adapter policy. This is the supporting evidence for [ADR-CORE-014](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md). It records verified facts, `[inferred]` assumptions, capability vs control status, statuses and gates, evidence records, and sources. It is a living document for maintainers, not a public support promise.

## How to read this document

- **Reviewed:** the date on which the cited source was last verified. Reverify before implementation.
- **Verified:** a fact read directly from an official source on the review date.
- **`[inferred]`:** a reasonable assumption not directly confirmed by a cited source. Each is tagged with its evidence.
- **Support level** uses the controlled vocabulary from ADR-CORE-014 (`Native`, `Native candidate`, `Provisional`, `Deferred`, `Withdrawn`) and contains no delivery terms.
- **Capability** (`Supported`, `Available`, `Unverified`, `Unavailable`) records what a runtime can do.
- **Control** (`Enforced`, `Trust-gated`, `Ignored`, `Advisory`, `Not a sandbox`, `Unsupported`) records what a runtime actually enforces. Skills, MCP, plugin loading, subagents, and JSON/RPC are never labeled security `Enforced`.
- **Test status** is `tested` or `not tested`. Almost all evidence here is `not tested` and unpinned; treat it as research-only, not production support proof.
- **Pinned state:** each evidence record states the exact release/version/immutable commit/docs revision, or the exact text `unpinned - reverify before implementation`.
- **Evidence ID:** every snapshot, evidence, capability/control, and source row carries one or more `Evidence ID`s (for example `E-CLAUDE-01`) that are the traceability link to a complete evidence record. A complete evidence record is a row in the per-runtime Evidence tables below; it contains the runtime/surface, the claim, the pinned state, the source URL/path, the review date, and the test status. Section headings do not provide implicit metadata (runtime, review date, or source); each row is self-contained and must be read together with its evidence record, never inferred from its heading.

## Maestria CLI adapter evidence (reviewed 2026-08-13)

The CLI adapters are management wrappers, not new runtime capabilities. They stage the published npm package under `~/.cache/maestria/`, register a local marketplace with the host CLI, and use the host's native install/remove/list commands. They do not write Claude Code or Codex configuration.

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CLI-01 | Claude Code | Host CLI | `claude plugin marketplace add`, `install`, `uninstall`, and `list --json` are available for the user-scope adapter | Claude Code `2.1.217` | `claude plugin --help`; `apps/maestria-cli/src/lib/platforms.ts` | 2026-08-13 | tested |
| E-CLI-02 | Codex CLI | Host CLI | `codex plugin marketplace add`, `add`, `remove`, and `list --json` are available for the marketplace adapter | Codex CLI `0.145.0` | `codex plugin --help`; `apps/maestria-cli/src/lib/platforms.ts` | 2026-08-13 | tested |
| E-CLI-03 | Both | Distribution bridge | The adapter stages the published package and creates a local marketplace manifest; it does not edit host configuration files directly | Working-tree CLI implementation | `apps/maestria-cli/src/lib/platforms.ts` | 2026-08-13 | tested by code inspection |

## Snapshot

| Runtime | Support level | Delivery | Disposition | Rationale | Evidence ID | Reviewed |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Code | Native candidate | Plugin | candidate native plugin | Promotion gated on approved docs and a blind review | E-CLAUDE-01 | 2026-08-11 |
| Prime Agent | Native candidate | Skills-first | executable extension deferred | Skills-first delivery; executable extension deferred until API/security verification | E-PRIME-01 | 2026-08-11 |
| Codex CLI | Provisional | Projection | projection-plugin spike | Bounded projection/plugin spike; pin the exact CLI version before relying on it | E-CODEX-CLI-01 | 2026-08-11 |
| Codex desktop | Deferred | Common-subset projection | no CLI parity | Common-subset projection only; no CLI parity claim | E-CODEX-DESKTOP-01 | 2026-08-11 |
| JCode | Deferred | Projection | Deferred - projection/experiment only | No confirmed first-class package/extension API | E-JCODE-01 | 2026-08-11 |
| Crush | Deferred | Projection | Deferred - projection/experiment only | No confirmed first-class package/extension API | E-CRUSH-01 | 2026-08-11 |

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

**Support level:** Native candidate. **Delivery:** Skills-first. **Disposition:** executable extension deferred. **Rationale:** skills-first delivery; executable extension deferred until API/security verification.

### Evidence (reviewed 2026-08-11)

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-PRIME-01 | Prime Agent | Identity | Prime Agent is an open-source RLM coding and research agent built on the Pi ecosystem: "Our agent and TUI is built on top of `pi`" (earendil-works/pi) | unpinned - reverify before implementation | https://github.com/PrimeIntellect-ai/prime-agent | 2026-08-11 | not tested |
| E-PRIME-02 | Prime Agent | Subagents | `rlm(...)` spawns real child agents (subagents) for parallel or background work | unpinned - reverify before implementation | https://github.com/PrimeIntellect-ai/prime-agent | 2026-08-11 | not tested |
| E-PRIME-03 | Prime Agent | Skills | Skills implement the Agent Skills standard (`SKILL.md` + frontmatter) and can be Python-backed (a Python package installed into the persistent IPython kernel) | unpinned - reverify before implementation | https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/skills.md | 2026-08-11 | not tested |
| E-PRIME-04 | Prime Agent | Skill discovery | Skill discovery paths include `~/.prime/agent/skills/`, `.prime/agent/skills/`, `~/.agents/skills/`, `.agents/skills/`, and `pi.skills` entries in `package.json` | unpinned - reverify before implementation | https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/skills.md | 2026-08-11 | not tested |
| E-PRIME-05 | Prime Agent | Skill consumption | Prime Agent can consume skills from other harnesses by adding their directories to settings, including `~/.claude/skills` and `~/.codex/skills` | unpinned - reverify before implementation | https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/skills.md | 2026-08-11 | not tested |
| E-PRIME-06 | Prime Agent | Headless modes | JSON mode and RPC mode exist for headless automation and integrations | unpinned - reverify before implementation | https://github.com/PrimeIntellect-ai/prime-agent | 2026-08-11 | not tested |
| E-PRIME-07 | Prime Agent | Execution boundary | "Prime Agent executes model-generated Python and project commands with your user permissions. Its worker and kernel processes improve lifecycle isolation and recovery; they are not a security sandbox." | unpinned - reverify before implementation | https://github.com/PrimeIntellect-ai/prime-agent | 2026-08-11 | not tested |

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-PRIME-03 | Skills (Agent Skills standard, Python-backed) | Supported | Advisory | Loaded on demand; Python-backed skills install into kernel; loading is not a security control |
| E-PRIME-02 | Subagent dispatch (`rlm`) | Supported | Advisory | Programmatic subagents; dispatch is not a security control |
| E-PRIME-06 | JSON/RPC headless modes | Available | Advisory | For automation and integrations; not a security control |
| E-PRIME-07 | Execution sandbox | Unavailable | Not a sandbox | Model-generated Python/commands run with user permissions |

### Statuses and gates

- **Promotion to `Native`:** verify a stable, supported package API for an executable extension beyond skills-first delivery; verify the security model (not a sandbox, so restrict to trusted repositories and skills); ship a skills-first package via the sync pipeline; `scripts/check-sync` passes.
- **Rollback:** revert the generated package; canonical content stays in core.
- **Withdrawal:** if no stable executable-extension API exists, keep the executable extension deferred and downgrade or remove package-level claims.
- **Re-promotion:** no automatic re-promotion; only after re-verification.

---

## Codex CLI

**Support level:** Provisional. **Delivery:** Projection. **Disposition:** projection-plugin spike. **Rationale:** bounded projection/plugin spike; pin the exact CLI version before relying on it.

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

The projection spike pins its implementation baseline to local `codex-cli 0.145.0`. The corresponding upstream release tag is `rust-v0.145.0`, which resolves to commit `25af12f`.

| Evidence ID | Runtime | Surface | Claim | Pinned | Source | Review date | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-CODEX-CLI-07 | Codex CLI | Version identity | The local CLI reports `codex-cli 0.145.0`; the matching upstream release is `rust-v0.145.0` | `0.145.0`; commit `25af12f` | `codex --version`; https://github.com/openai/codex/releases/tag/rust-v0.145.0 | 2026-08-13 | tested |
| E-CODEX-CLI-08 | Codex CLI | Plugin bundle | A plugin requires `.codex-plugin/plugin.json` and can expose skills from a `skills/` directory; the plugin name provides the component namespace | `rust-v0.145.0` plugin specification | https://github.com/openai/codex/blob/rust-v0.145.0/codex-rs/skills/src/assets/samples/plugin-creator/references/plugin-json-spec.md; https://developers.openai.com/plugins/build/plugins | 2026-08-13 | tested |
| E-CODEX-CLI-09 | Codex CLI | Hook handlers | The pinned source executes configured command handlers; prompt and agent handlers are parsed but skipped | `rust-v0.145.0` | https://github.com/openai/codex/blob/rust-v0.145.0/codex-rs/hooks/src/engine/discovery.rs | 2026-08-13 | tested: source inspection |
| E-CODEX-CLI-10 | Codex CLI | Plugin hook trust | Non-managed plugin hooks require managed status, a matching trusted hash, or an explicit bypass before command execution | `rust-v0.145.0` | https://github.com/openai/codex/blob/rust-v0.145.0/codex-rs/hooks/src/engine/discovery.rs; https://github.com/openai/codex/blob/rust-v0.145.0/codex-rs/hooks/src/registry.rs | 2026-08-13 | tested: source inspection |
| E-CODEX-CLI-11 | Codex CLI | Maestria projection | The package generates 14 skills from the canonical directives and ships no hooks, MCP server, model configuration, or `AGENTS.md` writer; the separate Maestria CLI provides npm-backed marketplace staging | `packages/codex` on this branch | `packages/codex/sync.config.ts`; `packages/codex/skills/`; `apps/maestria-cli/src/lib/platforms.ts` | 2026-08-13 | tested after sync |

### Capability vs control

| Evidence ID | Mechanism | Capability | Control | Note |
| --- | --- | --- | --- | --- |
| E-CODEX-CLI-10 | Non-managed plugin command hooks | Supported | Trust-gated | Plugin command hooks require managed status, a matching trusted hash, or an explicit bypass |
| E-CODEX-CLI-10 | Managed hook policy and trust bypass | Available | Advisory | These are host controls and explicit exceptions, not Maestria enforcement paths |
| E-CODEX-CLI-09 | Hooks (prompt/agent types) | Unavailable | Unsupported | Parsed but skipped by the pinned source |
| E-CODEX-CLI-08 | Plugin manifest and skills | Supported | Advisory | Skills are the bounded projection surface; they do not enforce delegation, role permissions, or review |

### Statuses and gates

- **Version sensitivity gate:** the spike baseline is pinned to `codex-cli 0.145.0` / `rust-v0.145.0` (`25af12f`). Reverify after CLI upgrades or material plugin/hook changes.
- **Projection boundary:** keep the package skills-only. Do not add hooks, MCP, installer, model configuration, or `AGENTS.md` generation without a new decision and security review.
- **Promotion to `Native`:** establish a stable supported executable-extension API, verify its security model, produce a projection via the sync pipeline, and pass `scripts/check-sync`.
- **Rollback:** remove the projection/plugin spike.
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

## Statuses and gates (resolved open questions)

Each previously unresolved question now has an explicit status or gate:

- Claude Code: can the plugin-subagent field limitation be worked around while keeping the plugin distribution shape? **Gate:** keep plugin-subagent fields `Ignored` and do not rely on them; the workaround (project/user agent files) is a promotion-gate item, not an open question.
- Prime Agent: is there a stable supported API for an executable extension beyond skills-first delivery? **Gate:** executable extension stays deferred until the API is verified; promotion to `Native` requires it.
- Codex CLI: which exact CLI version introduced the trust-gated hook flow and plugin support? **Gate:** pin the version before any projection is relied on; until pinned, keep `Provisional`.
- JCode and Crush: is there a first-class package/extension distribution API, or is projection the only supported path? **Status:** `Deferred` - projection/experiment only, until a first-class API is confirmed.

## Sources

| Evidence ID | Runtime | Source | Review date | Test status |
| --- | --- | --- | --- | --- |
| E-CLAUDE-01, E-CLAUDE-02 | Claude Code | https://code.claude.com/docs/en/plugins | 2026-08-11 | not tested |
| E-CLAUDE-04, E-CLAUDE-05 | Claude Code | https://code.claude.com/docs/en/hooks | 2026-08-11 | not tested |
| E-CLAUDE-06, E-CLAUDE-07 | Claude Code | https://code.claude.com/docs/en/sub-agents | 2026-08-11 | not tested |
| E-CLAUDE-03 | Claude Code | https://code.claude.com/docs/en/plugin-marketplaces | 2026-08-11 | not tested |
| E-CLAUDE-08 | Claude Code | `packages/claude-code/tests/plugin.test.ts`, `packages/claude-code/package.json` (working-tree snapshot) | 2026-08-12 | tested |
| E-PRIME-01, E-PRIME-02, E-PRIME-06, E-PRIME-07 | Prime Agent | https://github.com/PrimeIntellect-ai/prime-agent | 2026-08-11 | not tested |
| E-PRIME-03, E-PRIME-04, E-PRIME-05 | Prime Agent | https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/skills.md | 2026-08-11 | not tested |
| E-CODEX-CLI-01 | Codex CLI | https://github.com/openai/codex | 2026-08-11 | not tested |
| E-CODEX-CLI-02 | Codex CLI | https://developers.openai.com/codex (docs index) | 2026-08-11 | not tested |
| E-CODEX-CLI-03, E-CODEX-CLI-04, E-CODEX-CLI-05, E-CODEX-CLI-06 | Codex CLI | https://developers.openai.com/codex/hooks | 2026-08-11 | not tested |
| E-CODEX-DESKTOP-01, E-CODEX-DESKTOP-02 | Codex desktop | https://developers.openai.com/codex (docs index) | 2026-08-11 | not tested |
| E-JCODE-01, E-JCODE-03 | JCode | https://github.com/1jehuang/jcode | 2026-08-11 | not tested |
| E-JCODE-02 | JCode | https://jcode.sh/sdk | 2026-08-11 | not tested |
| E-CRUSH-01, E-CRUSH-02, E-CRUSH-03, E-CRUSH-04, E-CRUSH-05 | Crush | https://github.com/charmbracelet/crush | 2026-08-11 | not tested |

Upstream sources above are research-only (`unpinned - reverify before implementation`) and must be reverified before implementation, promotion, or re-promotion. E-CLAUDE-08 is a local working-tree package snapshot (`Working-tree package snapshot; verify at landing`), not an upstream research source.

## Related

- [ADR-CORE-014: Runtime Support and Adapter Policy](adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md)
