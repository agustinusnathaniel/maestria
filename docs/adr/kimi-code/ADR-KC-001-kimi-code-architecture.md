# ADR-KC-001: Kimi Code Plugin Architecture - Declarative Skills, No Custom Subagents

## Status

Accepted (Revised 2026-06-17)

### Revision History

- **2026-06-12** - Original draft accepted with the orchestrator-skill pattern and the 7-specialist → 3-subagent mapping
- **2026-06-17** - Revised after `@maestria/opencode` v0.3.0/0.3.1/0.3.2 landed and Kimi Code source was reverified at v0.13.1. Corrects factual errors (hooks, compaction, install URL, permission scope), adds the `AgentSwarm` / swarm-mode integration as a first-class concern, revises the specialist mapping per the `@architect` review, and adds a recommended `[[hooks]]` block for `config.toml`

## Context

We built `@maestria/opencode` as a pure plugin with 3 hooks (config, system.transform, session.compacting) that registers 7 custom subagents and injects global rules programmatically. OpenCode's plugin SDK supports TypeScript entry points with lifecycle hooks - a powerful but platform-specific API.

Kimi Code exposes a different plugin model with fundamentally different capabilities:

| Capability | OpenCode Plugin SDK | Kimi Code Plugin System |
| --- | --- | --- |
| **Entry point** | TypeScript (npm package + hooks) | JSON manifest only (declarative) |
| **Custom subagents** | Yes - register via `config` hook | No - only 3 built-in: coder, explore, plan |
| **Global rules injection** | Yes - `system.transform` hook | Via AGENTS.md files at scan dirs (not plugin-managed) |
| **Extensions** | Hooks API (programmatic) | SKILL.md files (declarative) |
| **Permissions** | Programmatic per-agent | config.toml `[[permission.rules]]` |
| **Session start injection** | Via `system.transform` | Built-in `sessionStart.skill` field |
| **Build step** | Yes (TypeScript compilation) | No - purely declarative files |
| **Installation** | npm install → opencode.jsonc | `/plugins install <GitHub URL>` |

This is not a limitation of Kimi Code - it's a different philosophy. Kimi Code's plugin system is declarative by design: the user configures their agent through manifest, skills, and config files rather than through programmatic hooks. The orchestrator pattern (a skill loaded at session start that instructs the model on methodology) replaces the need for custom subagents and SDK hooks.

### What We Learned from OpenCode

ADR-CORE-002 established three principles that carry forward:

1. **Markdown is the source of truth** - agent behavior lives in editable markdown files, not TypeScript factories
2. **Agents are self-contained** - each agent file contains its full methodology
3. **Global rules are cross-cutting** - shared constraints that apply across all agents

For Kimi Code, these same principles apply, but the delivery mechanism changes: instead of a TypeScript plugin loading markdown from an npm package, the markdown files _are_ the plugin.

### Why Kimi Code Now?

- Kimi Code is gaining adoption as an AI coding assistant, and Maestria users work across platforms
- The `obra/superpowers` framework has 226k stars but no kimi-code variant - this fills a gap
- Declarative skills are simpler to author, install, and debug than SDK-backed plugins
- We validate whether a platform-agnostic core abstraction makes sense (see Future Considerations)

### What Changed Since the Original Draft

Since the original draft (2026-06-12), two significant changes inform this revision: (1) the opencode plugin shipped v0.3.0/0.3.1/0.3.2 with the Skill Prescription pattern and stronger orchestrator rules - this is the source of truth for what we port; (2) deeper verification against Kimi Code v0.13.1 source revealed the original ADR understated Kimi Code's capabilities (lifecycle hooks, `scope` field in permissions, sub-skills, `AgentSwarm` first-class tool) and overstated its constraints.

## Decision

### Choose: Declarative Skill-Based Plugin with Session-Start Orchestrator

**The plugin is a set of declarative files - no build step, no entry point, no hooks.** It consists of:

1. **`kimi.plugin.json`** - manifest declaring metadata, skills, and sessionStart.skill
2. **`skills/orchestrator/SKILL.md`** - loaded into every session start, instructs the main agent on methodology and delegation
3. **`skills/<name>/SKILL.md`** - one skill file per specialist, mapped onto Kimi Code's built-in subagents
4. **`rules/AGENTS.md`** - global rules; user places at `~/.kimi-code/` (auto-loaded by Kimi Code at session start)
5. **`INSTALL.md`** - step-by-step setup instructions (rules copy, config.toml edits)

### Plugin Surface (Constraints from Kimi Code Manifest)

The Kimi Code plugin system is deliberately narrow. Reading the manifest parser in `packages/agent-core/src/plugin/manifest.ts` (v0.13.1) and `plugin/types.ts`:

| Surface | Plugin can register? | Notes |
| --- | --- | --- |
| `mcpServers` | Yes | New MCP tools exposed to the main agent |
| `skills` (SKILL.md files) | Yes | Multiple per plugin, discovered from declared paths |
| `sessionStart.skill` | One per plugin | Auto-loads a single skill at session start (text only) |
| `skillInstructions` | Yes | Plugin-wide instruction string injected alongside skills |
| New subagent profile | **No** | Subagent types are hardcoded to `coder`, `explore`, `plan` (see `profile/default/agent.yaml`) |
| Custom built-in tools | **No** | `tools`, `commands`, `hooks`, `apps`, `inject`, `configFile`, `bootstrap` are silently dropped by the manifest parser (`UNSUPPORTED_RUNTIME_FIELDS`) |
| Modify `AgentSwarm` | **No** | Behavior is hardcoded in `packages/agent-core/src/tools/builtin/collaboration/agent-swarm.ts` |

The critical implication: **the 7 specialist identities cannot be registered as separate subagent types**. They must be encoded as persona content inside prompt templates that are dispatched through one of the 3 hardcoded subagent types. This is the load-bearing constraint that shapes everything below.

### Specialist → Subagent Profile Mapping

Kimi Code has only 3 built-in subagents: `coder`, `explore`, `plan`. Reading `profile/default/coder.yaml`, `explore.yaml`, and `plan.yaml` (v0.13.1):

- **`coder`** has `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebSearch`, `FetchURL`, `mcp__*`
- **`explore`** has `Bash` (read-only by prompt convention - no `Write`/`Edit`), `Read`, `Glob`, `Grep`, `WebSearch`, `FetchURL`
- **`plan`** has `Read`, `Glob`, `Grep`, `WebSearch`, `FetchURL` - no `Bash`, no `Write`/`Edit`

Our 7 specialists map as follows:

| Maestria Agent | Kimi Subagent | Rationale | SKILL.md Constraint |
| --- | --- | --- | --- |
| **Orchestrator** | Main agent (auto-loaded) | Loaded via `sessionStart.skill`; teaches methodology + delegation + swarm usage | Must NOT run heavy tools itself; routes work to specialists |
| **Builder** | `coder` | Has Write, Edit, Bash - exactly what's needed | None - default behavior is correct |
| **Adventurer** | `explore` | No Write/Edit tools; can read and run read-only Bash | Reinforce in persona: "Bash ONLY for read-only operations (ls, git log, git diff, find)" |
| **Planner** | `plan` | No Bash, no write tools - focused planning | None |
| **Reviewer** | `coder` | Mapping is functional but unsafe - must constrain | **MUST forbid editing**: "Produce a structured review report only. Do not edit files." |
| **Architect** | `coder` (revised) | `plan` has no Bash; architect needs validation commands (`which`, `npm view`) | None - default behavior is correct |
| **Writer** | `coder` (revised) | Main agent already has all tools; mapping to main gives no isolated context | None - default behavior is correct |
| **Diagnose** | `coder` (revised) | Main agent gives no isolated context; `coder` gives Bash for instrumentation | None - default behavior is correct |

**Mapping rationale:**

- **`builder` → `coder`**: Builder is an implementer. `coder` has the right permissions and context for focused implementation work.
- **`adventurer` → `explore`**: Adventurer is a codebase reconnaissance agent. `explore` is designed for reading and understanding code without modifying it. The persona must echo the explore profile's "Bash ONLY for read-only operations" rule, because the `explore` profile's `Bash` tool is technically a full Bash - the read-only behavior is prompt-enforced, not blocked at the tool layer.
- **`planner` → `plan`**: Planner and `plan` are a natural fit - both are designed for structured planning before implementation.
- **`reviewer` → `coder`**: Reviewer reads code and produces structured feedback. The `coder` subagent has the context needed, and the persona in `reviewer/SKILL.md` must explicitly forbid any file editing. The original mapping was dangerous; this constraint closes the hole.
- **`architect` → `coder`** (revised from `plan`): Architecture work needs occasional validation commands (e.g., `which`, `npm view`). `plan` has no `Bash`. Remapping to `coder` is the only way to keep those commands available.
- **`writer` → `coder`** (revised from main agent): Writing documentation benefits from isolated context - the main agent's conversation is the user's working context, and dumping the writer's intermediate reasoning into it pollutes the session. `coder` gives a fresh context for free.
- **`diagnose` → `coder`** (revised from main agent): Same isolation argument as `writer`, plus `coder` gives Bash access for git blame, git show, and instrumentation.

### Swarm Usage (AgentSwarm + SwarmMode)

The main agent has access to `AgentSwarm` - a first-class tool for fanning out one prompt template across N independent items (`packages/agent-core/src/tools/builtin/collaboration/agent-swarm.ts`). Kimi Code also exposes a session-level `SwarmMode` toggled by `/swarm on|off` or `/swarm <task>` (the `/swarm` slash command also turns SwarmMode on and auto-exits when the turn completes).

The AgentSwarm tool fields (description, subagent_type, prompt_template, items, resume_agent_ids) are documented in the tool's own description - refer to that for field details.

**Exclusive-deny policy**: `AgentSwarm` cannot be paired with other tool calls in the same turn. The orchestrator cannot do "explore first, then swarm" in one turn - it must be two turns.

**Orchestrator's swarm design:**

- **Trigger for swarm**: when the user asks for the same kind of work on N≥3 independent items (e.g., "review these 50 files for security", "test these 20 endpoints", "refactor these 8 functions")
- **Default for ≥3 items**: `AgentSwarm` (cheaper per-item, scales to 128, rate-limit-aware retry, live TUI progress)
- **Default for 1–2 items or stateful work**: single `Agent` tool call (the `Agent` tool dispatches one subagent; context is shared only via the prompt argument)
- **Persona composition**: the orchestrator composes the `prompt_template` by inlining the specialist's persona content at the `{{item}}` position. Example (adventurer persona + file list):

  ```
  You are operating as the @adventurer specialist: read-only codebase reconnaissance.

  Investigate {{item}} and report:
  - Module purpose and main exports
  - Key types and their relationships
  - Callers of public functions
  - Test coverage and notable TODOs

  Use Bash only for read-only commands (ls, git log, git diff). Do not edit files.
  ```

**Result aggregation**: `AgentSwarm` returns the results of all its subagents. Each subagent outcome is one of: `completed`, `failed`, or `aborted`. The orchestrator uses `resume_agent_ids` to retry only the unfinished items.

### Routing Table

The orchestrator skill body (`skills/orchestrator/SKILL.md`) embeds this routing table. The model uses it to pick the right persona + `subagent_type` (or to fall back to a single `Agent` call when the work doesn't fit a subagent profile):

| Request type | subagent_type | Persona | Notes |
| --- | --- | --- | --- |
| Reconnaissance / exploration | `explore` | @adventurer | Read-only, batchable via AgentSwarm |
| Architecture / design | `coder` | @architect | Needs Bash for validation (`which`, `npm view`) |
| Multi-phase planning | `plan` | @planner | No Bash, planning-focused |
| Implementation / code changes | `coder` | @builder | Default for write work |
| Bug tracing / root cause | `coder` | @diagnose | Needs Bash for git blame, instrumentation |
| Code review / QA | `coder` | @reviewer | **MUST forbid editing in persona** |
| Documentation | `coder` | @writer | Default for write work |
| Swarm fan-out (≥3 independent items) | varies | inlined in `prompt_template` | Use `AgentSwarm`; no `Agent` call alongside |

### Comparison: OpenCode vs. Kimi Code Plugin

| Feature | OpenCode Plugin (`@maestria/opencode`) | Kimi Code Plugin (`@maestria/kimi-code`) |
| --- | --- | --- |
| **Entry point** | `src/index.ts` (TypeScript) | `kimi.plugin.json` (JSON manifest) |
| **Custom subagents** | 7 registered via `config` hook | 0 - personas encoded into prompt templates for 3 built-in subagents |
| **Global rules** | Auto-injected via `system.transform` | Placed at `~/.kimi-code/AGENTS.md` (auto-loaded from scan dirs) |
| **Skills** | Referenced by name, installed separately | Bundled as `skills/*/SKILL.md` |
| **Session start** | Implicit (system.transform runs every session) | Explicit `sessionStart.skill` field |
| **Swarm fan-out** | Not used (orchestrator does sequential `task()`) | First-class `AgentSwarm` tool + `SwarmMode` session state |
| **Permissions** | Programmatic per-agent in frontmatter | `config.toml [[permission.rules]]` with `scope` (turn / session / project / user) |
| **Lifecycle hooks** | `system.transform`, `session.compacting` (plugin SDK) | `[[hooks]]` in `config.toml` (user-managed, suggest in INSTALL.md) |
| **Compaction** | `session.compacting` (plugin SDK) | `experimental.micro_compaction = true` + `/compact` slash command; `PreCompact` / `PostCompact` hooks observe |
| **Build step** | `tsc` compilation | None - purely declarative files |
| **Installation** | npm install + opencode.jsonc entry | `/plugins install <GitHub URL>` |
| **Package management** | npm (versioned, published) | GitHub URL - latest release by default; pin to ref/tag/sha with URL form |
| **MCP servers** | Not used | Can declare in manifest under `mcpServers` (we don't, for now) |
| **Skill overrides** | Not supported | Built-in - user can edit SKILL.md files |
| **Plugin capabilities** | SDK-based (hooks, programmatic) | Declarative only (manifest + markdown); no custom subagent profiles or built-in tools |

### What Carries Over from OpenCode

| Principle                      | Adaptation for Kimi Code                              |
| ------------------------------ | ----------------------------------------------------- |
| `!!!` critical rule markers    | Same convention in all SKILL.md files                 |
| Agent cross-references         | Same in skills - "Related Agents" section             |
| Check → Use → Suggest (skills) | Skills are bundled, so pattern becomes "load and use" |
| Conventional Comments (review) | Same in `reviewer/SKILL.md`                           |
| Markdown as source of truth    | Same - SKILL.md IS the plugin                         |
| Self-contained agent files     | Same - each SKILL.md is self-contained                |

### What We Lose vs. OpenCode

- **No custom subagent identity** - Kimi Code hardcodes subagent types to `coder` / `explore` / `plan` (see `profile/default/agent.yaml`). A plugin cannot register a new subagent profile. The 7 specialist identities must be encoded as persona content in prompt templates - distinct subagent names, colors, and modes are not available.
- **No auto-injected global rules via plugin** - `rules/AGENTS.md` ships inside the plugin, but the user must place it at `~/.kimi-code/AGENTS.md` (or `$KIMI_CODE_HOME/AGENTS.md`). Kimi Code auto-loads AGENTS.md from scan directories; the plugin cannot inject the file itself.
- **No programmatic per-subagent permissions** - user must add `[[permission.rules]]` to `config.toml`. The `scope` field provides _temporal_ granularity (`turn-override`, `session-runtime`, `project`, `user`), but not per-subagent programmatic granularity. Subagent tool lists come from the hardcoded profile (coder/explore/plan), not from per-agent rules.
- **No `system.transform` equivalent** - Kimi Code has no plugin hook that injects or rewrites the system prompt. The available surfaces are `sessionStart.skill` (one text-injection at session start), `skillInstructions` (a static string), and the `UserPromptSubmit` hook (per-turn, user-managed). We document the `UserPromptSubmit` block in INSTALL.md as a functional approximation, but it is not plugin-managed.
- **No `session.compacting` plugin hook** - Kimi Code's compaction runs automatically via `experimental.micro_compaction = true` (default), and `/compact` triggers a manual compaction. The `PreCompact` and `PostCompact` hooks exist but are observation-only - return values are ignored. Plugins cannot inject content into compaction summaries.
- **Hooks are user-managed, not plugin-bundled** - `[[hooks]]` blocks are written to the user's `config.toml`, not to the plugin manifest. The plugin can _document_ recommended hooks in INSTALL.md, but the user must copy them in. This is a small install-friction increase; see the "Lifecycle Hooks (Recommended Setup)" section below.

## Proposed Package Structure

```
packages/kimi-code/
├── kimi.plugin.json              # Manifest: name, skills dir, sessionStart.skill name, interface
├── README.md                     # Installation & usage overview
├── INSTALL.md                    # Step-by-step: rules copy, config.toml edits, hooks block
├── skills/
│   ├── orchestrator/
│   │   └── SKILL.md              # sessionStart.skill - methodology, delegation, swarm usage
│   ├── builder/
│   │   └── SKILL.md              # Focused implementation (via coder subagent)
│   ├── adventurer/
│   │   └── SKILL.md              # Codebase reconnaissance (via explore subagent)
│   ├── planner/
│   │   └── SKILL.md              # Structured planning (via plan subagent)
│   ├── reviewer/
│   │   └── SKILL.md              # Code review with quality gates (via coder, no-edit persona)
│   ├── architect/
│   │   └── SKILL.md              # Architecture decisions & trade-off analysis (via coder)
│   ├── writer/
│   │   └── SKILL.md              # Documentation generation (via coder)
│   └── diagnose/
│       └── SKILL.md              # Root cause analysis (via coder)
└── rules/
    └── AGENTS.md                 # Global rules - user copies to ~/.kimi-code/
```

### Manifest Shape

The manifest name must match the regex `^[a-z0-9][a-z0-9_-]{0,63}$` (from `plugin/types.ts`, `PLUGIN_NAME_REGEX`); "maestria" passes. All fields are read by `parseManifest`; unknown fields are silently dropped with an info-level diagnostic. The fields `tools`, `commands`, `hooks`, `apps`, `inject`, `configFile`, `config_file`, and `bootstrap` are explicitly listed as unsupported and produce a diagnostic if present.

```json
{
  "name": "maestria",
  "version": "0.1.0",
  "description": "Maestria agent pack for Kimi Code - 8 specialized skills",
  "keywords": ["maestria", "agents", "orchestration", "kimi-code"],
  "author": {
    "name": "Agustinus Nathaniel",
    "email": "nathan@maestria.dev"
  },
  "homepage": "https://github.com/agustinusnathaniel/maestria",
  "license": "MIT",
  "skills": "./skills/",
  "sessionStart": {
    "skill": "orchestrator"
  },
  "skillInstructions": "Maestria agent pack: specialized skills for implementation, architecture, planning, review, documentation, diagnostics, and codebase exploration. See each skill's whenToUse field for invocation guidance.",
  "interface": {
    "displayName": "Maestria Agent Pack",
    "shortDescription": "8 specialized engineering workflow skills for Kimi Code",
    "longDescription": "Maestria packages 7 specialist personas (builder, adventurer, planner, reviewer, architect, writer, diagnose) plus an orchestrator skill that auto-loads at session start. The orchestrator composes personas into prompt templates for Kimi Code's 3 built-in subagents (coder, explore, plan) and uses AgentSwarm for parallel fan-out.",
    "developerName": "Agustinus Nathaniel",
    "websiteURL": "https://github.com/agustinusnathaniel/maestria"
  }
}
```

### SKILL.md Frontmatter Pattern

Each skill follows the directory form (a subdirectory with `SKILL.md`). The `name` and `description` fields are required for the directory form; the flat form (`skills/<name>.md`) inherits the filename as `name` and the first non-empty body line as `description` (truncated to 240 characters). Reading `packages/agent-core/src/skill/parser.ts` (v0.13.1) and `skill/types.ts`:

```markdown
---
name: builder
description: Focused implementation - write code, run tests, check quality gates
type: prompt
whenToUse: >
  Feature implementation, bug fixing, test writing, refactoring within a single task scope


disableModelInvocation: false
safe: true
arguments:
  - task
---

Body with $ARGUMENTS, $0, $1 placeholders for task instructions.
```

**Frontmatter fields** (from `parser.ts` `normalizeMetadata` + the parser's full type signature):

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | Yes (directory form) | The skill's name; `sessionStart.skill` and `/skill:<name>` reference it. Names are case-insensitive. |
| `description` | string | Yes (directory form) | One-line summary; the model uses this to decide when to use the skill. |
| `type` | string | No | `prompt` (default), `inline` (same semantics as `prompt`), `flow` (manual invocation only - not available for automatic model invocation), `reference` (also supported but not model-activatable). Other values are skipped with `UnsupportedSkillTypeError`. |
| `whenToUse` | string | No | Aliases: `when-to-use`, `when_to_use`. Description of when the skill should be triggered. |
| `disableModelInvocation` | boolean | No | Aliases: `disable-model-invocation`, `disable_model_invocation`. When `true`, the model cannot invoke the skill automatically; the user must use `/skill:<name>`. |
| `safe` | boolean | No | Hint that the skill is safe to run without user confirmation. |
| `arguments` | string[] or string | No | List of named parameters (e.g., `arguments: target mode` or `arguments: [target, mode]`). Referenced in the body as `$<name>`, `$0`, `$1`, `$ARGUMENTS`, `$ARGUMENTS[0]`. |
| `isSubSkill` | boolean | No | Internal marker; the orchestrator skill should NOT set this. |
| `hasSubSkill` | boolean | No | When `true`, the skill can dispatch sub-skills (see "Sub-skill nesting" below). |

**Body parsing** (from `parser.ts`): the parser scans the body for fenced code blocks and exposes them as `skill.mermaid` and `skill.d2` strings (the first ` ```mermaid ` and ` ```d2 ` blocks, respectively). These are surfaced to the agent in the rendered prompt for visual diagrams.

**Sub-skill nesting** (from `skill/scanner.ts` and `skill/builtin/sub-skill.ts`): when a skill has `hasSubSkill: true`, the model can invoke other skills from within its body. The platform enforces a hard cap of **3 levels of nesting**; beyond that, skill invocations are terminated. Implication: the orchestrator skill (level 1) can dispatch persona skills (level 2) which can dispatch one more layer (level 3) - the hierarchy maxes out at 3. A future orchestrator-of-orchestrators pattern would need a different solution.

### Lifecycle Hooks (Recommended Setup)

Kimi Code's `[[hooks]]` blocks live in the user's `config.toml` (`~/.kimi-code/config.toml` or `$KIMI_CODE_HOME/config.toml`) - they are not part of the plugin manifest. INSTALL.md documents the following block for users to paste into their config. The hooks are sourced from Kimi Code's own docs (`docs/en/customization/hooks.md`) and adjusted for Maestria's needs.

```toml
# Block destructive bash commands. The script below matches Kimi Code's
# example and is the recommended minimum; tighten for your environment.
[[hooks]]
event = "PreToolUse"
matcher = "Bash"
command = "node ~/.kimi-code/hooks/block-dangerous-bash.mjs"
timeout = 5

# Append a session-start reminder to every user message. This is the closest
# available approximation of OpenCode's system.transform text injection:
# the hook can return text on stdout, which Kimi Code appends to the context.
# (See "Blockable events" in hooks.md - UserPromptSubmit is one of three.)
[[hooks]]
event = "UserPromptSubmit"
matcher = ""
command = "echo 'Maestria active: delegate via the orchestrator skill. Prefer @adventurer for recon, @architect for design, @builder for implementation, @diagnose for bugs, @reviewer for QA, @writer for docs, @planner for multi-phase work.'"
timeout = 5

# Observe compaction cycles. These are observation-only - return values are
# ignored - but useful for logging.
[[hooks]]
event = "PreCompact"
matcher = ".*"
command = "echo \"compact start: $(date -Is)\" >> ~/.kimi-code/compact.log"
timeout = 5

[[hooks]]
event = "PostCompact"
matcher = ".*"
command = "echo \"compact end:   $(date -Is)\" >> ~/.kimi-code/compact.log"
timeout = 5
```

The companion script `~/.kimi-code/hooks/block-dangerous-bash.mjs` is the example from Kimi Code's docs verbatim (it returns exit code 2 to block, with `console.error` describing why):

```js
let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  const payload = JSON.parse(input);
  const command = payload.tool_input?.command ?? '';
  if (command.includes('rm -rf')) {
    console.error('Dangerous command detected, blocked');
    process.exit(2);
  }
});
```

**Blockable vs. observation-only events** (from `hooks.md`): `PreToolUse`, `UserPromptSubmit`, and `Stop` are blockable - their return values affect the main flow. Everything else (`PostToolUse`, `SessionStart`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PostCompact`, `Notification`, etc.) fires and forgets. The hooks above use this distinction deliberately: `PreToolUse` blocks, `UserPromptSubmit` injects text, and the compaction hooks only log.

**Subagent hooks** are particularly relevant for the orchestrator. `SubagentStart` and `SubagentStop` are observation-only and fire on every subagent dispatch, which makes them suitable for telemetry without affecting execution.

### Global Rules (rules/AGENTS.md)

The user places this file at `~/.kimi-code/AGENTS.md` (or `$KIMI_CODE_HOME/AGENTS.md`). It is automatically loaded by Kimi Code at session start and injected into the system prompt, along with project-level AGENTS.md files. It contains the cross-cutting rules from ADR-CORE-001 that apply across all platforms (e.g., "use opensrc instead of API calls", "don't assume - verify against actual code"). Platform-specific rules (e.g., OpenCode orchestration patterns) are excluded.

Note: Unlike OpenCode's `system.transform` hook which a plugin controls directly, Kimi Code's AGENTS.md loading is automatic from scan directories but not plugin-managed. The plugin bundles the file as `rules/AGENTS.md` for convenience; the user must place it.

## Consequences

### Positive

- **No build step** - plugin is purely declarative files; edit, commit, install
- **Simple installation** - single `/plugins install <GitHub URL>` command; no npm, no version management
- **Platform-native patterns** - uses Kimi Code's skill system as designed, no fighting the platform
- **User-editable** - every SKILL.md can be edited by the user without rebuilding or re-publishing
- **Fills a gap** - `obra/superpowers` has no kimi-code variant; this is the first structured agent pack for the platform
- **Validates the abstraction question** - experience with 2 platforms reveals what a shared core would look like

### Negative

- **Manual rules placement** - rules ship as `rules/AGENTS.md` but must be manually placed at `~/.kimi-code/` (it IS auto-loaded from scan dirs, but the plugin can't place it).
- **Manual permissions** - user must hand-edit `config.toml` for per-tool permissions. The `scope` field gives temporal granularity (turn / session / project / user), but not per-subagent programmatic granularity.
- **No custom subagent identity** - all 7 specialists run under one of 3 built-in subagent names (`coder`, `explore`, `plan`). The persona content in the prompt is the only differentiator. The orchestrator skill carries the routing table.
- **No auto-update mechanism on the default URL** - `/plugins install <GitHub URL>` follows the latest release by default, so updates arrive when a new release is published, but the user must re-run `/plugins install` to fetch them (no npm-style `^0.1.0` semver, no auto-update on session start). Mitigation: the marketplace UI shows `update <local> → <latest>` when a newer version is available.
- **No `session.compacting` plugin hook** - Kimi Code's `micro_compaction` runs automatically and `/compact` triggers a manual run, but the plugin cannot inject content into compaction summaries. The `PreCompact` / `PostCompact` hooks are observation-only.
- **Installation has more moving parts than OpenCode** - 4 steps: `/plugins install <url>`, copy `rules/AGENTS.md` to `~/.kimi-code/`, hand-edit `config.toml` for `[[permission.rules]]`, hand-edit `config.toml` for the recommended `[[hooks]]` block. The INSTALL.md checklist covers all four.

### Risks

- **User forgets AGENTS.md copy** - rules are missing silently. Mitigation: INSTALL.md with checklist, and each SKILL.md can reference "see AGENTS.md for global rules" as a reminder.
- **User modifies bundled skills** - updates via `/plugins install` overwrite changes. Mitigation: document this in INSTALL.md and recommend forking the plugin for customizations.
- **User forgets to install the recommended `[[hooks]]` block** - destructive bash commands and per-turn context injection are silently unavailable. Mitigation: INSTALL.md is a checklist, and the orchestrator skill's `whenToUse` reminds the user that hooks augment the experience.
- **Reviewer → `coder` is dangerous without an explicit no-edit constraint** - the `coder` profile has `Write` and `Edit` tools. Without a hard "produce a structured review report only" line in the persona, the reviewer could "fix" issues it found, which violates the maker/checker split. Mitigation: the `reviewer/SKILL.md` persona opens with "Do not edit files. Produce a structured review report only." and the orchestrator routing table flags this constraint. Future hardening: explore whether Kimi Code adds a per-subagent `disable` rule for the `Write`/`Edit` tools (no such API exists in v0.13.1).
- **Architect was originally mapped to `plan`; remapped to `coder`** - `plan` has no `Bash` tool, which blocks architect's validation commands (`which`, `npm view`). Remapping to `coder` recovers those commands at the cost of being able to edit files. Mitigation: the architect persona in `architect/SKILL.md` is structured so the model only uses Bash for read-only validation, but the tool is technically available. We accept the trade-off.
- **Subagents cannot use the Skill tool** - the `coder`, `explore`, and `plan` profiles do not include `Skill` in their tool lists (only the main `agent` profile does; see `profile/default/agent.yaml`). This means a subagent dispatched by the orchestrator cannot load additional skills mid-task. The only path to inject specialist identity into a subagent is to inline the persona content in the `prompt` (or `prompt_template`, for `AgentSwarm`). The orchestrator skill body documents this constraint.
- **`AgentSwarm`'s exclusive-deny policy forbids combining it with other tool calls in the same turn** - the tool's exclusive-deny declaration conflicts with every other tool's file-access declaration, and the tool description states "If `AgentSwarm` is called, that call must be the only tool call in the response." Implication: the orchestrator cannot "explore first, then swarm" in a single turn - exploration must happen in turn N, swarm in turn N+1. Mitigation: the orchestrator skill explicitly describes the two-turn pattern; the `resume_agent_ids` field can re-feed failed subagents without losing the items already completed.
- **Sub-skill hierarchy maxes out at 3 levels** - Kimi Code terminates skill invocations beyond depth 3. The orchestrator (level 1) → persona skill (level 2) → ??? (level 3) hierarchy is at the cap. A future "orchestrator-of-orchestrators" or skill-chained pipeline would need a different solution. No mitigation today; revisit if Kimi Code raises the limit.

## What We're NOT Doing

1. **Not shipping MCP servers in the manifest** - the manifest supports `mcpServers` (one MCP server config per entry, validated against `McpServerConfigSchema`), and `mcpServers` would be the way to ship plugin-specific tools if we later need them (for example, a project-specific logger or a remote test runner). We don't need them now; if a future specialist requires a tool that the built-ins don't cover, the right move is to add an `mcpServers` block to the manifest, not to fork the subagent profile.
2. **Not including a plugin SDK** - Kimi Code's plugin system is declarative-only; there is no SDK to wrap or abstract.
3. **Not building for non-kimi-code platforms yet** - this package is kimi-code-specific. We build for one platform at a time until we have 3+ and can justify a core abstraction.
4. **Not extracting `packages/core/`** - no shared library between opencode and kimi-code yet. Each package is independent, with documented conventions that align by design.
5. **Not publishing to npm** - Kimi Code installs from GitHub URLs. The package lives in the monorepo for development but is installed from its GitHub path.

## Future Considerations

### Platform-Agnostic Core (After 3+ Platforms)

When we support 3+ platforms (OpenCode, Kimi Code, and one more such as Cursor or Copilot), we should consider extracting a `packages/core/` that defines:

- A canonical agent schema (frontmatter shape, section conventions)
- A skill registry (which skills exist, their responsibilities, their cross-references)
- Platform adapters that translate the canonical schema into each platform's format

This ADR's mapping table (7 specialists → 3 Kimi Code subagents) would become part of the Kimi Code adapter, not the core schema.

### Potential Platforms to Consider Next

- **Cursor** - `.cursor/rules/` with `.mdc` files; declarative, similar to Kimi Code
- **Copilot** - `copilot-instructions.md` with `SKILL.md`-like extensions via `scripts/`
- **Windsurf** - `.windsurfrules` with tool configurations

Each platform will have its own ADR and mapping table before any core extraction is attempted.

### Skill Composition

If Kimi Code adds support for skill chaining or composite skills in the future, the orchestrator's session-start role could be expanded to dynamically compose skills based on the user's task. This is speculative - no design work until the platform supports it.

### Sub-Skill Hierarchy

`hasSubSkill: true` lets a parent skill dispatch child skills, and the platform currently allows up to 3 levels of nesting. The current design uses 1 level (the orchestrator skill is the parent; personas are inlined into `prompt_template`s rather than loaded as separate sub-skills). If we ever need an orchestrator-of-orchestrators pattern, the nesting cap is the bottleneck - revisit when Kimi Code raises the limit or when a different composition primitive lands.

### Dual-Path Swarm Entry

`/swarm <task>` is a user-invoked shortcut that toggles `SwarmMode` to `manual` and dispatches the task - the user can bypass the orchestrator entirely with this command. Documented separately from the orchestrator's "decide-to-swarm" path so users have a direct escape hatch when they already know they want fan-out. Today the two paths converge: both end up calling the `AgentSwarm` tool. If they ever diverge (e.g., a custom swarm persona that the orchestrator doesn't know about), the routing table in the orchestrator skill is the single place to teach the model when to use which.

## Related Decisions

- ADR-CORE-001 (global rules scope filter) - applied here: cross-cutting rules ship as `rules/AGENTS.md`; agent-specific rules inline in each SKILL.md
- ADR-CORE-002: Pure plugin architecture for opencode (established the "markdown as source of truth" principle)
- ADR-CORE-003: Agent conventions (!!! markers, cross-references, skill pattern - carried forward into SKILL.md)

## Date

2026-06-12 (original); 2026-06-17 (revised)
