# ADR-KC-001: Kimi Code Plugin Architecture - Declarative Skills, No Custom Subagents

## Status

Accepted (2026-06-12; revised 2026-06-17)

### Revision History

- **2026-06-12** - Original draft accepted with the orchestrator-skill pattern and the 7-specialist → 3-subagent mapping
- **2026-06-17** - Revised after the `@maestria/opencode` plugin shipped and Kimi Code source was reverified at v0.13.1. Corrects factual errors (hooks, compaction, install URL, permission scope), adds `AgentSwarm` / swarm-mode integration, revises the specialist mapping per the `@architect` review, and adds a recommended `[[hooks]]` block for `config.toml`

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

This is a different philosophy, not a limitation: declarative configuration replaces SDK hooks and custom subagents, and a session-start skill teaches the orchestrator pattern. ADR-CORE-002's principles (markdown as source of truth, self-contained agents, cross-cutting global rules) carry forward, but the markdown files _are_ the plugin rather than content loaded by a TypeScript package.

## Decision

### Choose: Declarative Skill-Based Plugin with Session-Start Orchestrator

The plugin is a set of declarative files: `kimi.plugin.json` (manifest with the skills directory and `sessionStart.skill`), `skills/` (orchestrator plus one directory per specialist), `rules/AGENTS.md` (user-placed, see below), and `README.md` / `INSTALL.md`. The current package also ships `commands/` (mode commands) and `SYSTEM.md` via `systemPromptPath`; see `packages/kimi-code/kimi.plugin.json` for the authoritative manifest shape.

### Plugin Surface (Constraints from Kimi Code Manifest)

A plugin may register `mcpServers`, `skills`, one `sessionStart.skill` (single text-only skill auto-loaded at session start), and a `skillInstructions` string. It cannot register a new subagent profile (types are hardcoded to `coder`, `explore`, `plan`), custom built-in tools (`tools`, `commands`, `hooks`, `apps`, `inject`, `configFile`, `bootstrap` are silently dropped by the manifest parser), or change `AgentSwarm` (hardcoded in the platform).

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

> **Note (2026-09-22).** The table above is the 2026-06-17 decision record. The shipped package has since remapped architect and reviewer to `plan` and writer and diagnose to `coder` (see `skillInstructions` in `packages/kimi-code/kimi.plugin.json` and the routing table in `packages/kimi-code/skills/orchestrator/SKILL.md`), and the swarm fan-out threshold is now 2+ uniform items rather than the N≥3 recorded below. The orchestrator skill is the operational source for the current mapping; this ADR is not re-deciding it here.

### Swarm Usage (AgentSwarm + SwarmMode)

`AgentSwarm` fans one prompt template across N independent items (fields documented in the tool's own description); `SwarmMode` is toggled by `/swarm on|off` or `/swarm <task>` and auto-exits when the turn completes.

**Exclusive-deny policy**: `AgentSwarm` must be the only tool call in its turn, so "explore first, then swarm" takes two turns.

**Orchestrator's swarm design:** default to `AgentSwarm` for the same kind of work across N≥3 independent items (cheaper per item, rate-limit-aware retry, live progress); a single `Agent` call for 1-2 items or stateful work. Specialist persona content is inlined into `prompt_template` at the `{{item}}` position; `resume_agent_ids` retries only unfinished items (`completed` / `failed` / `aborted` per subagent).

### Routing Table

The orchestrator skill embeds the model-facing routing table (persona plus `subagent_type` per request type, with swarm fan-out inlined in `prompt_template` and no alongside `Agent` call). The table above records the ADR decision; the skill holds the current operational copy.

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
| **Lifecycle hooks** | Plugin SDK hooks | `[[hooks]]` in `config.toml` (user-managed, suggested in the [installation guide](https://maestria.sznm.dev/kimi-code/getting-started/installation/)) |
| **Compaction** | `session.compacting` plugin hook | `experimental.micro_compaction` plus `/compact`; `PreCompact`/`PostCompact` observe only |
| **Package management** | npm (versioned, published) | GitHub URL; latest by default, pin via ref/tag/sha |
| **Skill overrides** | Not supported | Built-in - users can edit SKILL.md files |
| **Plugin capabilities** | SDK-based (hooks, programmatic) | Declarative only (manifest + markdown) |

### What Carries Over from OpenCode

`!!!` critical rule markers and "Related Agents" cross-references in every SKILL.md; the skill pattern adapted to bundled skills ("load and use"); Conventional Comments for review; markdown as source of truth with each SKILL.md self-contained.

### What We Lose vs. OpenCode

- **No custom subagent identity** - 7 specialists run under 3 built-in names, differentiated only by persona content.
- **No plugin-injected global rules** - `rules/AGENTS.md` ships in the plugin but the user places it at `~/.kimi-code/AGENTS.md` (`$KIMI_CODE_HOME/AGENTS.md`); the platform auto-loads scan directories, the plugin cannot place the file.
- **No programmatic per-subagent permissions** - users add `[[permission.rules]]` to `config.toml`; `scope` gives temporal granularity but not per-subagent granularity.
- **No `system.transform` equivalent** - the surfaces are `sessionStart.skill`, `skillInstructions`, and a user-managed `UserPromptSubmit` hook documented in the installation guide as an approximation.
- **No compaction injection** - `PreCompact`/`PostCompact` observe only; compaction summaries are plugin-inaccessible.
- **Hooks are user-managed, not plugin-bundled** - `[[hooks]]` blocks live in the user's `config.toml`; the plugin documents them in the [installation guide](https://maestria.sznm.dev/kimi-code/getting-started/installation/) (including the `PreToolUse` Bash guard, `UserPromptSubmit` reminder, and `PreCompact`/`PostCompact` logging), but the user copies them in.

> **Note (2026-09-22).** The shipped orchestrator skill reports the `Skill` tool as available to the `plan` and `coder` profiles (pre-load persona content only for `explore`), which relaxes the "subagents cannot use the Skill tool" risk recorded under Risks below. Sub-skill nesting still caps at 3 levels. The skill is the operational source; the risk entry below is retained as the original constraint record.

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
- **User skips the recommended hooks** - destructive-command blocking and per-turn reminders are unavailable. Mitigation: the installation guide's checklist and the orchestrator's `whenToUse` reminder.
- **Reviewer → `coder` needs the no-edit constraint** - `coder` has Write and Edit, so without the persona's no-edit line a reviewer could "fix" what it finds and violate the maker/checker split (see [ADR-CORE-012](../core/ADR-CORE-012-deterministic-review-signals-fail-loud-exit.md)). Mitigation: the persona and routing table flag it; no per-subagent tool-disable API exists.
- **Architect was remapped from `plan` to `coder`** - `plan` has no Bash, blocking validation (`which`, `npm view`); `coder` restores it while making write tools technically available. Mitigation: the persona restricts Bash to read-only validation.
- **Subagents cannot use the Skill tool** - the profiles exclude `Skill`, so a dispatched subagent cannot load further skills; specialist identity must be inlined in the prompt or `prompt_template`. (See the 2026-09-22 note above for the current relaxation.)
- **`AgentSwarm` is exclusive-deny** - it must be the only tool call in its turn, so exploration and swarm fan-out take two turns. Mitigation: the orchestrator skill documents the pattern; `resume_agent_ids` re-feeds unfinished items.
- **Sub-skill hierarchy caps at 3 levels** - the orchestrator → persona chain is at the cap; an orchestrator-of-orchestrators pipeline needs a different solution. Revisit if the limit is raised.

## What We're NOT Doing

1. **Not shipping MCP servers in the manifest** - `mcpServers` is how plugin-specific tools would ship; the answer is an `mcpServers` block, not a forked subagent profile.
2. **Not including a plugin SDK** - the plugin system is declarative-only; there is no SDK to wrap or abstract.
3. **Not building for non-kimi-code platforms yet** - one platform at a time until 3+ justify a core abstraction. (Superseded in intent by ADR-CORE-020's hybrid topology; this entry records the original sequencing decision.)
4. **Not extracting `packages/core/`** - each package stays independent with documented conventions that align by design. (Superseded by the `packages/core/` extraction; retained as history.)
5. **Not publishing to npm** - Kimi Code installs from GitHub URLs; the package lives in the monorepo but is installed from its GitHub path.

## Future Considerations

With 3+ platforms, consider extracting a canonical agent schema, skill registry, and platform adapters (this mapping table would become the Kimi Code adapter). Each new platform gets its own ADR and mapping table before any core extraction. Speculative items deferred until the platform supports them: skill chaining / composite skills, orchestrator-of-orchestrators within the 3-level sub-skill cap, and `/swarm <task>` as a direct escape hatch converging on `AgentSwarm` (the routing table stays the single place to teach which path to use).

## Related Decisions

- ADR-CORE-001 (global rules scope filter) - applied here: cross-cutting rules ship as `rules/AGENTS.md`; agent-specific rules inline in each SKILL.md
- ADR-CORE-002: Pure plugin architecture for opencode (established the "markdown as source of truth" principle)
- ADR-CORE-003: Agent conventions (!!! markers, cross-references, skill pattern - carried forward into SKILL.md)

## Date

2026-06-12 (original); 2026-06-17 (revised)
