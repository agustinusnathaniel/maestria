# ADR-KC-001: Kimi Code Plugin Architecture - Declarative Skills, No Custom Subagents

## Status

Accepted (Revised 2026-06-17)

### Revision History

- **2026-06-12** - Original draft accepted with the orchestrator-skill pattern and the 7-specialist → 3-subagent mapping
- **2026-06-17** - Revised after the `@maestria/opencode` plugin shipped and Kimi Code source was reverified at v0.13.1. Corrects factual errors (hooks, compaction, install URL, permission scope), adds `AgentSwarm` / swarm-mode integration as a first-class concern, revises the specialist mapping per the `@architect` review, and adds a recommended `[[hooks]]` block for `config.toml`

## Context

`@maestria/opencode` is a TypeScript-SDK plugin with hooks and 7 registered subagents. Kimi Code's plugin model is declarative instead:

| Capability | OpenCode Plugin SDK | Kimi Code Plugin System |
| --- | --- | --- |
| **Entry point** | TypeScript npm package | JSON manifest only |
| **Custom subagents** | Register via `config` hook | 3 built-in only: coder, explore, plan |
| **Global rules injection** | `system.transform` hook | AGENTS.md files at scan dirs (not plugin-managed) |
| **Permissions** | Programmatic per-agent | `config.toml` `[[permission.rules]]` |
| **Session start injection** | Via `system.transform` | Built-in `sessionStart.skill` |
| **Build step** | TypeScript compilation | None - declarative files |
| **Installation** | npm install + config entry | `/plugins install <GitHub URL>` |

This is a different philosophy, not a limitation: declarative configuration replaces SDK hooks and custom subagents, and a session-start skill teaches the orchestrator pattern.

### What We Learned from OpenCode

ADR-CORE-002 established three principles that carry forward: markdown as the source of truth, self-contained agents, and cross-cutting global rules. For Kimi Code they hold, but the delivery changes: instead of a TypeScript plugin loading markdown from an npm package, the markdown files _are_ the plugin.

### Why Kimi Code Now?

- Kimi Code is gaining adoption, and Maestria users work across platforms
- `obra/superpowers` has no kimi-code variant, so this fills a gap
- Declarative skills are simpler to author, install, and debug than SDK-backed plugins
- It validates whether a platform-agnostic core abstraction makes sense (see Future Considerations)

### What Changed Since the Original Draft

The OpenCode plugin shipped its Skill Prescription pattern and stronger orchestrator rules (the source of truth for what we port), and deeper verification against Kimi Code v0.13.1 showed the draft understating the platform's capabilities (lifecycle hooks, permission `scope`, sub-skills, first-class `AgentSwarm`) and overstating its constraints.

## Decision

### Choose: Declarative Skill-Based Plugin with Session-Start Orchestrator

**The plugin is a set of declarative files - no build step, no entry point, no hooks:**

1. **`kimi.plugin.json`** - manifest declaring metadata, skills, and `sessionStart.skill`
2. **`skills/orchestrator/SKILL.md`** - loaded at every session start; methodology and delegation
3. **`skills/<name>/SKILL.md`** - one skill per specialist, mapped onto Kimi Code's built-in subagents
4. **`rules/AGENTS.md`** - global rules; the user places it at `~/.kimi-code/` (auto-loaded at session start)
5. **`INSTALL.md`** - setup instructions (rules copy, config.toml edits)

### Plugin Surface (Constraints from Kimi Code Manifest)

The plugin system is deliberately narrow. A plugin may register:

- `mcpServers` - new MCP tools for the main agent
- `skills` - multiple SKILL.md files, discovered from declared paths
- `sessionStart.skill` - one per plugin; auto-loads a single skill at session start (text only)
- `skillInstructions` - a plugin-wide instruction string

It cannot register a new subagent profile (types are hardcoded to `coder`, `explore`, `plan`), custom built-in tools (`tools`, `commands`, `hooks`, `apps`, `inject`, `configFile`, `bootstrap` are silently dropped by the manifest parser), or change `AgentSwarm` (behavior is hardcoded in the platform).

**Critical implication:** the 7 specialist identities cannot be separate subagent types; they must be encoded as persona content in prompt templates dispatched through one of the 3 built-in types.

### Specialist → Subagent Profile Mapping

| Maestria Agent | Kimi Subagent | Rationale |
| --- | --- | --- |
| **Orchestrator** | Main agent (auto-loaded) | `sessionStart.skill`; teaches methodology, delegation, and swarm usage; must route heavy work to specialists |
| **Builder** | `coder` | Write, Edit, Bash |
| **Adventurer** | `explore` | No Write/Edit; persona must restate "Bash ONLY for read-only operations (ls, git log, git diff, find)" |
| **Planner** | `plan` | No Bash, no write tools |
| **Reviewer** | `coder` | **MUST forbid editing**: "Produce a structured review report only. Do not edit files." |
| **Architect** | `coder` (revised) | `plan` lacks Bash; architecture needs validation commands (`which`, `npm view`) |
| **Writer** | `coder` (revised) | Isolated context; the main session is the user's working context |
| **Diagnose** | `coder` (revised) | Isolated context plus Bash for instrumentation |

The non-obvious constraints are prompt-enforced, not tool-enforced: `explore`'s Bash is a full shell, and `coder`'s Write/Edit are excluded from review only by persona instruction.

### Swarm Usage (AgentSwarm + SwarmMode)

`AgentSwarm` is a first-class tool for fanning one prompt template across N independent items; `SwarmMode` is toggled by `/swarm on|off` or `/swarm <task>` and auto-exits when the turn completes. Its fields (description, subagent_type, prompt_template, items, resume_agent_ids) are documented in the tool's own description.

**Exclusive-deny policy**: `AgentSwarm` must be the only tool call in its turn, so "explore first, then swarm" takes two turns.

**Orchestrator's swarm design:**

- **Trigger**: the same kind of work across N≥3 independent items (e.g., "review these 50 files for security")
- **Default for ≥3 items**: `AgentSwarm` (cheaper per item, rate-limit-aware retry, live progress)
- **Default for 1-2 items or stateful work**: a single `Agent` call, sharing context only via the prompt
- **Persona composition**: inline the specialist's persona content into `prompt_template` at the `{{item}}` position
- **Aggregation**: each subagent outcome is `completed`, `failed`, or `aborted`; `resume_agent_ids` retries only the unfinished items

### Routing Table

The orchestrator skill embeds this routing table, which the model uses to pick the right persona and `subagent_type` (or fall back to a single `Agent` call for work that does not fit a subagent profile):

| Request type | subagent_type | Persona |
| --- | --- | --- |
| Reconnaissance / exploration | `explore` | @adventurer |
| Architecture / design | `coder` | @architect |
| Multi-phase planning | `plan` | @planner |
| Implementation / code changes | `coder` | @builder |
| Bug tracing / root cause | `coder` | @diagnose |
| Code review / QA | `coder` | @reviewer (persona **MUST forbid editing**) |
| Documentation | `coder` | @writer |
| Swarm fan-out (≥3 independent items) | varies | inlined in `prompt_template`; no `Agent` call alongside |

### Comparison: OpenCode vs. Kimi Code Plugin

| Feature | OpenCode Plugin (`@maestria/opencode`) | Kimi Code Plugin (`@maestria/kimi-code`) |
| --- | --- | --- |
| **Swarm fan-out** | Not used (sequential `task()`) | First-class `AgentSwarm` + `SwarmMode` |
| **Lifecycle hooks** | Plugin SDK hooks | `[[hooks]]` in `config.toml` (user-managed, suggested in INSTALL.md) |
| **Compaction** | `session.compacting` plugin hook | `experimental.micro_compaction` plus `/compact`; `PreCompact`/`PostCompact` observe only |
| **Package management** | npm (versioned, published) | GitHub URL; latest by default, pin via ref/tag/sha |
| **Skill overrides** | Not supported | Built-in - users can edit SKILL.md files |
| **Plugin capabilities** | SDK-based (hooks, programmatic) | Declarative only (manifest + markdown) |

### What Carries Over from OpenCode

- `!!!` critical rule markers and "Related Agents" cross-references in every SKILL.md
- The skill pattern, adapted: skills ship bundled, so "Check → Use → Suggest" becomes "load and use"
- Conventional Comments for review
- Markdown as source of truth and self-contained agent files - each SKILL.md is the plugin

### What We Lose vs. OpenCode

- **No custom subagent identity** - subagent types are hardcoded to `coder`/`explore`/`plan`; the 7 specialists are persona content, without distinct names, colors, or modes.
- **No plugin-injected global rules** - `rules/AGENTS.md` ships in the plugin but must be placed at `~/.kimi-code/AGENTS.md` (`$KIMI_CODE_HOME/AGENTS.md`); the platform auto-loads scan directories, the plugin cannot place the file.
- **No programmatic per-subagent permissions** - users add `[[permission.rules]]` to `config.toml`; `scope` gives temporal granularity but not per-subagent granularity.
- **No `system.transform` equivalent** - the surfaces are `sessionStart.skill` (one text injection at startup), `skillInstructions` (a static string), and a user-managed `UserPromptSubmit` hook documented in INSTALL.md as an approximation.
- **No compaction injection** - compaction runs automatically and `/compact` triggers a manual run, but the observation-only `PreCompact`/`PostCompact` hooks cannot inject content into summaries.
- **Hooks are user-managed, not plugin-bundled** - `[[hooks]]` blocks live in the user's `config.toml`, not the manifest; the plugin documents them in INSTALL.md, but the user must copy them in.

## Proposed Package Structure

Only declarative files: `kimi.plugin.json` (manifest with the skills directory and `sessionStart.skill`), `skills/` (orchestrator plus one directory per specialist), `rules/AGENTS.md`, and `README.md` / `INSTALL.md`.

### Manifest Shape

The manifest name must match `^[a-z0-9][a-z0-9_-]{0,63}$` ("maestria" passes). Unknown fields are dropped with a diagnostic, and the unsupported fields listed above are explicitly rejected. The manifest declares the skills path, `sessionStart.skill`, and `skillInstructions`.

### SKILL.md Frontmatter Pattern

Each skill uses the directory form (`skills/<name>/SKILL.md`); `name` and `description` are required (the flat form inherits the filename and first body line). Optional fields: `type` (default `prompt`; `flow` is manual-invocation only), `whenToUse`, `disableModelInvocation`, `safe`, `arguments`, `hasSubSkill`. Bodies reference arguments as `$ARGUMENTS`, `$0`, `$1`, or `$<name>`.

Sub-skill nesting caps at **3 levels**: the orchestrator (level 1) can dispatch persona skills (level 2), which can dispatch one more layer. A future orchestrator-of-orchestrators pattern would need a different solution.

### Lifecycle Hooks (Recommended Setup)

`[[hooks]]` and `[[permission.rules]]` blocks live in the user's `config.toml`, not the plugin manifest; the [installation guide](https://maestria.sznm.dev/kimi-code/getting-started/installation/) documents the optional session controls you can add there:

- `PreToolUse` on `Bash` - block destructive commands (the documented example exits 2 to block)
- `UserPromptSubmit` - append a session reminder to every user message; the closest approximation of system-prompt injection
- `PreCompact` / `PostCompact` - observation-only logging of compaction cycles

`PreToolUse`, `UserPromptSubmit`, and `Stop` are blockable (return values affect the main flow); other events fire and forget. Subagent start/stop hooks are observation-only and suit telemetry.

### Global Rules (rules/AGENTS.md)

The user places the file at `~/.kimi-code/AGENTS.md` (`$KIMI_CODE_HOME/AGENTS.md`); Kimi Code auto-loads it from scan directories at session start and injects it alongside project-level AGENTS.md files. It carries ADR-CORE-001's cross-cutting rules; platform-specific rules (e.g., OpenCode orchestration patterns) are excluded. AGENTS.md loading is automatic but not plugin-managed, so the plugin bundles the file while the user must place it.

## Consequences

### Positive

- **No build step, simple installation** - declarative files; one `/plugins install <GitHub URL>` command, no npm or version management
- **Platform-native patterns** - uses Kimi Code's skill system as designed
- **User-editable** - every SKILL.md can be edited without rebuilding or re-publishing
- **Fills a gap and validates the abstraction question** - the first structured agent pack for the platform, and two platforms show what a shared core would need

### Negative

- **Manual rules placement** - `rules/AGENTS.md` must be copied to `~/.kimi-code/` by the user
- **Manual permissions** - users hand-edit `config.toml`; `scope` gives temporal, not per-subagent, granularity
- **No custom subagent identity** - all 7 specialists run under 3 built-in subagent names, differentiated only by persona content
- **No auto-update on the default URL** - re-running `/plugins install` fetches the latest release; there is no npm-style semver or session-start update (the marketplace UI shows updates)
- **No compaction injection** - compaction is automatic and plugin-inaccessible; the hooks are observation-only
- **More install steps than OpenCode** - install the plugin, copy `rules/AGENTS.md`, add `[[permission.rules]]`, add the recommended `[[hooks]]` block

### Risks

- **User forgets the AGENTS.md copy** - rules are missing silently. Mitigation: INSTALL.md checklist and skills referencing AGENTS.md.
- **User modifications are overwritten** - `/plugins install` overwrites edits to bundled skills. Mitigation: fork the plugin for customizations.
- **User skips the recommended hooks** - destructive-command blocking and per-turn reminders are unavailable. Mitigation: INSTALL.md checklist and the orchestrator's `whenToUse` reminder.
- **Reviewer → `coder` needs the no-edit constraint** - `coder` has Write and Edit, so without the persona's no-edit line a reviewer could "fix" what it finds and violate the maker/checker split. Mitigation: the persona and routing table flag it; no per-subagent tool-disable API exists.
- **Architect was remapped from `plan` to `coder`** - `plan` has no Bash, blocking validation (`which`, `npm view`); `coder` restores it while making write tools technically available. Mitigation: the persona restricts Bash to read-only validation.
- **Subagents cannot use the Skill tool** - the profiles exclude `Skill`, so a dispatched subagent cannot load further skills; specialist identity must be inlined in the prompt or `prompt_template`.
- **`AgentSwarm` is exclusive-deny** - it must be the only tool call in its turn, so exploration and swarm fan-out take two turns. Mitigation: the orchestrator skill documents the pattern; `resume_agent_ids` re-feeds unfinished items.
- **Sub-skill hierarchy caps at 3 levels** - the orchestrator → persona chain is at the cap; an orchestrator-of-orchestrators pipeline needs a different solution. Revisit if the limit is raised.

## What We're NOT Doing

1. **Not shipping MCP servers in the manifest** - `mcpServers` is how plugin-specific tools would ship; the answer is an `mcpServers` block, not a forked subagent profile.
2. **Not including a plugin SDK** - the plugin system is declarative-only; there is no SDK to wrap or abstract.
3. **Not building for non-kimi-code platforms yet** - one platform at a time until 3+ justify a core abstraction.
4. **Not extracting `packages/core/`** - each package stays independent with documented conventions that align by design.
5. **Not publishing to npm** - Kimi Code installs from GitHub URLs; the package lives in the monorepo but is installed from its GitHub path.

## Future Considerations

### Platform-Agnostic Core (After 3+ Platforms)

With 3+ platforms (OpenCode, Kimi Code, plus one such as Cursor or Copilot), consider extracting a `packages/core/` defining a canonical agent schema, a skill registry, and platform adapters. This ADR's mapping table would become part of the Kimi Code adapter, not the core schema.

### Potential Platforms to Consider Next

- **Cursor** - `.cursor/rules/` with `.mdc` files; declarative, like Kimi Code
- **Copilot** - `copilot-instructions.md` with `SKILL.md`-like extensions via `scripts/`
- **Windsurf** - `.windsurfrules` with tool configurations

Each platform will have its own ADR and mapping table before any core extraction is attempted.

### Skill Composition

If Kimi Code adds skill chaining or composite skills, the orchestrator's session-start role could dynamically compose skills from the user's task. Speculative; no design work until the platform supports it.

### Sub-Skill Hierarchy

`hasSubSkill: true` lets a parent skill dispatch child skills within the 3-level cap. The current design uses 1 level: personas are inlined into prompt templates rather than loaded as sub-skills. An orchestrator-of-orchestrators pattern would hit the cap; revisit if the limit is raised.

### Dual-Path Swarm Entry

`/swarm <task>` toggles `SwarmMode` and dispatches the task, bypassing the orchestrator as a direct escape hatch. Both paths converge on `AgentSwarm` today; if they diverge, the routing table is the single place to teach the model which to use.

## Related Decisions

- ADR-CORE-001 (global rules scope filter) - applied here: cross-cutting rules ship as `rules/AGENTS.md`; agent-specific rules inline in each SKILL.md
- ADR-CORE-002: Pure plugin architecture for opencode (established the "markdown as source of truth" principle)
- ADR-CORE-003: Agent conventions (!!! markers, cross-references, skill pattern - carried forward into SKILL.md)

## Date

2026-06-12 (original); 2026-06-17 (revised)
