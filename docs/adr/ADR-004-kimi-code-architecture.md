# ADR-004: Kimi Code Plugin Architecture — Declarative Skills, No Custom Subagents

## Status

Accepted

## Context

We built `@maestria/opencode` as a pure plugin with 3 hooks (config, system.transform, session.compacting)
that registers 7 custom subagents and injects global rules programmatically. OpenCode's plugin SDK
supports TypeScript entry points with lifecycle hooks — a powerful but platform-specific API.

Kimi Code exposes a different plugin model with fundamentally different capabilities:

| Capability                  | OpenCode Plugin SDK              | Kimi Code Plugin System                               |
| --------------------------- | -------------------------------- | ----------------------------------------------------- |
| **Entry point**             | TypeScript (npm package + hooks) | JSON manifest only (declarative)                      |
| **Custom subagents**        | Yes — register via `config` hook | No — only 3 built-in: coder, explore, plan            |
| **Global rules injection**  | Yes — `system.transform` hook    | Via AGENTS.md files at scan dirs (not plugin-managed) |
| **Extensions**              | Hooks API (programmatic)         | SKILL.md files (declarative)                          |
| **Permissions**             | Programmatic per-agent           | config.toml `[[permission.rules]]`                    |
| **Session start injection** | Via `system.transform`           | Built-in `sessionStart.skill` field                   |
| **Build step**              | Yes (TypeScript compilation)     | No — purely declarative files                         |
| **Installation**            | npm install → opencode.jsonc     | `/plugins install <GitHub URL>`                       |

This is not a limitation of Kimi Code — it's a different philosophy. Kimi Code's plugin system is
declarative by design: the user configures their agent through manifest, skills, and config files
rather than through programmatic hooks. The orchestrator pattern (a skill loaded at session start
that instructs the model on methodology) replaces the need for custom subagents and SDK hooks.

### What We Learned from OpenCode

ADR-002 established three principles that carry forward:

1. **Markdown is the source of truth** — agent behavior lives in editable markdown files, not TypeScript factories
2. **Agents are self-contained** — each agent file contains its full methodology
3. **Global rules are cross-cutting** — shared constraints that apply across all agents

For Kimi Code, these same principles apply, but the delivery mechanism changes: instead of a
TypeScript plugin loading markdown from an npm package, the markdown files _are_ the plugin.

### Why Kimi Code Now?

- Kimi Code is gaining adoption as an AI coding assistant, and Maestria users work across platforms
- The `obra/superpowers` framework has 226k stars but no kimi-code variant — this fills a gap
- Declarative skills are simpler to author, install, and debug than SDK-backed plugins
- We validate whether a platform-agnostic core abstraction makes sense (see Future Considerations)

## Decision

### Choose: Declarative Skill-Based Plugin with Session-Start Orchestrator

**The plugin is a set of declarative files — no build step, no entry point, no hooks.**
It consists of:

1. **`kimi.plugin.json`** — manifest declaring metadata, skills, and sessionStart.skill
2. **`skills/orchestrator/SKILL.md`** — loaded into every session start, instructs the main agent on methodology and delegation
3. **`skills/<name>/SKILL.md`** — one skill file per specialist, mapped onto Kimi Code's built-in subagents
4. **`rules/AGENTS.md`** — global rules; user places at `~/.kimi-code/` (auto-loaded by Kimi Code at session start)
5. **`INSTALL.md`** — step-by-step setup instructions (rules copy, config.toml edits)

### Skill-to-Subagent Mapping

Kimi Code has only 3 built-in subagents: `coder`, `explore`, `plan`. Our 7 specialists map as follows:

| Maestria Agent   | Kimi Code Subagent | Skill File            | Direction                                                                 |
| ---------------- | ------------------ | --------------------- | ------------------------------------------------------------------------- |
| **Orchestrator** | Main agent         | `orchestrator/`       | Loaded via `sessionStart.skill` — instructs main agent on methodology     |
| **Builder**      | `coder`            | `builder/SKILL.md`    | Deployed via coder subagent with builder instructions                     |
| **Adventurer**   | `explore`          | `adventurer/SKILL.md` | Deployed via explore subagent with reconnaissance instructions            |
| **Planner**      | `plan`             | `planner/SKILL.md`    | Deployed via plan subagent with planning methodology                      |
| **Reviewer**     | `coder`            | `reviewer/SKILL.md`   | Deployed via coder subagent + orchestrator instructions on when to review |
| **Architect**    | `plan`             | `architect/SKILL.md`  | Deployed via plan subagent with architecture methodology                  |
| **Writer**       | Main agent         | `writer/SKILL.md`     | Deployed on main agent for documentation tasks                            |
| **Diagnose**     | Main agent         | `diagnose/SKILL.md`   | Deployed on main agent for debugging tasks                                |

**Mapping rationale:**

- **`builder` → `coder`**: Builder is an implementer. Kimi Code's `coder` subagent has the right permissions and context for focused implementation work.
- **`adventurer` → `explore`**: Adventurer is a codebase reconnaissance agent. Kimi Code's `explore` subagent is designed for reading and understanding code without modifying it.
- **`planner` → `plan`**: Planner and `plan` are a natural fit — both are designed for structured planning before implementation.
- **`reviewer` → `coder`**: Reviewer reads code and produces structured feedback. The `coder` subagent has the context needed, and the orchestrator instructs when to invoke it for review.
- **`architect` → `plan`**: Architecture decisions require planning-level thinking. The `plan` subagent has the deliberation scope needed.
- **`writer` → main agent**: Writing documentation requires full context of the codebase. The main agent (with orchestrator methodology) is best suited.
- **`diagnose` → main agent**: Debugging spans multiple files and requires the full context of the session.

### Comparison: OpenCode vs. Kimi Code Plugin

| Feature                 | OpenCode Plugin (`@maestria/opencode`)         | Kimi Code Plugin (`@maestria/kimi-code`)                        |
| ----------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| **Entry point**         | `src/index.ts` (TypeScript)                    | `kimi.plugin.json` (JSON manifest)                              |
| **Custom subagents**    | 7 registered via `config` hook                 | 0 — maps onto 3 built-in subagents                              |
| **Global rules**        | Auto-injected via `system.transform`           | Placed at `~/.kimi-code/AGENTS.md` (auto-loaded from scan dirs) |
| **Skills**              | Referenced by name, installed separately       | Bundled as `skills/*/SKILL.md`                                  |
| **Session start**       | Implicit (system.transform runs every session) | Explicit `sessionStart.skill` field                             |
| **Permissions**         | Programmatic per-agent in frontmatter          | Manual in `config.toml [[permission.rules]]`                    |
| **Build step**          | `tsc` compilation                              | None — purely declarative files                                 |
| **Installation**        | npm install + opencode.jsonc entry             | `/plugins install <GitHub URL>`                                 |
| **Package management**  | npm (versioned, published)                     | GitHub URL (pinned to commit/tag)                               |
| **MCP servers**         | Not used                                       | Can declare in manifest (but we don't)                          |
| **Skill overrides**     | Not supported                                  | Built-in — user can edit SKILL.md files                         |
| **Plugin capabilities** | SDK-based (hooks, programmatic)                | Declarative only (manifest + markdown)                          |

### What Carries Over from OpenCode

| Principle                      | Adaptation for Kimi Code                              |
| ------------------------------ | ----------------------------------------------------- |
| `!!!` critical rule markers    | Same convention in all SKILL.md files                 |
| Agent cross-references         | Same in skills — "Related Agents" section             |
| Check → Use → Suggest (skills) | Skills are bundled, so pattern becomes "load and use" |
| Conventional Comments (review) | Same in `reviewer/SKILL.md`                           |
| Markdown as source of truth    | Same — SKILL.md IS the plugin                         |
| Self-contained agent files     | Same — each SKILL.md is self-contained                |

### What We Lose vs. OpenCode

- **No custom subagents** — cannot register new agents with distinct modes/colors/permissions. Must map onto 3 built-in subagents.
- **No auto-injected global rules** — rules ship as `rules/AGENTS.md` but must be placed at `~/.kimi-code/AGENTS.md` by the user (the file IS auto-loaded by Kimi Code from scan directories, but cannot be injected by a plugin).
- **No programmatic permissions** — user must manually add `[[permission.rules]]` sections to `config.toml`. No per-specialist granularity.
- **No system.transform** — can't inject or modify session system prompts programmatically. The orchestrator skill + AGENTS.md are the only injection points.
- **No session.compacting** — cannot preserve cross-session task state. Kimi Code handles this internally.

## Proposed Package Structure

```
packages/kimi-code/
├── kimi.plugin.json              # Manifest: name, skills dir, sessionStart.skill name, interface
├── README.md                     # Installation & usage overview
├── INSTALL.md                    # Step-by-step: rules copy, config.toml edits
├── skills/
│   ├── orchestrator/
│   │   └── SKILL.md              # sessionStart.skill — methodology & delegation
│   ├── builder/
│   │   └── SKILL.md              # Focused implementation (via coder subagent)
│   ├── adventurer/
│   │   └── SKILL.md              # Codebase reconnaissance (via explore subagent)
│   ├── planner/
│   │   └── SKILL.md              # Structured planning (via plan subagent)
│   ├── reviewer/
│   │   └── SKILL.md              # Code review with quality gates (via coder subagent)
│   ├── architect/
│   │   └── SKILL.md              # Architecture decisions & trade-off analysis (via plan subagent)
│   ├── writer/
│   │   └── SKILL.md              # Documentation generation (main agent)
│   └── diagnose/
│       └── SKILL.md              # Root cause analysis (main agent)
└── rules/
    └── AGENTS.md                 # Global rules — user copies to ~/.kimi-code/
```

### Manifest Shape

```json
{
  "name": "maestria",
  "description": "Maestria agent pack for Kimi Code — 8 specialized skills",
  "version": "0.1.0",
  "skills": "./skills/",
  "sessionStart": {
    "skill": "orchestrator"
  },
  "skillInstructions": "Maestria agent pack: specialized skills for implementation, architecture, planning, review, documentation, diagnostics, and codebase exploration. See each skill's whenToUse field for invocation guidance.",
  "interface": {
    "displayName": "Maestria Agent Pack",
    "shortDescription": "8 specialized engineering workflow skills",
    "developerName": "Agustinus Nathaniel"
  }
}
```

### SKILL.md Frontmatter Pattern

Each skill follows the directory form (a subdirectory with `SKILL.md`). The `name` field in frontmatter
is what `sessionStart.skill` references and what `/skill:<name>` uses for invocation. The flat form
(`skills/<name>.md` with no subdirectory) is also supported but directory form is recommended:

```markdown
---
name: builder
description: Focused implementation — write code, run tests, check quality gates
type: prompt
whenToUse: >
  Feature implementation, bug fixing, test writing, refactoring
  within a single task scope
arguments:
  - task
---

Body with $ARGUMENTS, $0, $1 placeholders for task instructions.
```

### Global Rules (rules/AGENTS.md)

The user places this file at `~/.kimi-code/AGENTS.md` (or `$KIMI_CODE_HOME/AGENTS.md`).
It is automatically loaded by Kimi Code at session start and injected into the system prompt,
along with project-level AGENTS.md files. It contains the cross-cutting rules
from ADR-001 that apply across all platforms (e.g., "use opensrc instead of API calls",
"don't assume — verify against actual code"). Platform-specific rules (e.g., OpenCode
orchestration patterns) are excluded.

Note: Unlike OpenCode's `system.transform` hook which a plugin controls directly,
Kimi Code's AGENTS.md loading is automatic from scan directories but not plugin-managed.
The plugin bundles the file as `rules/AGENTS.md` for convenience; the user must place it.

## Consequences

### Positive

- **No build step** — plugin is purely declarative files; edit, commit, install
- **Simple installation** — single `/plugins install <GitHub URL>` command; no npm, no version management
- **Platform-native patterns** — uses Kimi Code's skill system as designed, no fighting the platform
- **User-editable** — every SKILL.md can be edited by the user without rebuilding or re-publishing
- **Fills a gap** — `obra/superpowers` has no kimi-code variant; this is the first structured agent pack for the platform
- **Validates the abstraction question** — experience with 2 platforms reveals what a shared core would look like

### Negative

- **Manual rules placement** — rules ship as `rules/AGENTS.md` but must be manually placed at `~/.kimi-code/` (it IS auto-loaded from scan dirs, but the plugin can't place it).
- **Manual permissions** — user must hand-edit `config.toml` for per-tool permissions. No programmatic per-agent granularity.
- **No custom subagent identity** — builder, reviewer, and adventurer all run under built-in subagent names. The skill instructions are the only differentiator.
- **No auto-update mechanism** — GitHub URL installation pins to a commit; no npm-style `^0.1.0` semver. User must manually re-install for updates.
- **No compacting hooks** — cannot preserve task state across sessions (less critical for declarative plugins, but a capability loss).
- **Slightly more installation friction** — 3 steps vs. OpenCode's 2 (npm install + config entry → /plugins install + AGENTS.md copy + config.toml edit).

### Risks

- **User forgets AGENTS.md copy** — rules are missing silently. Mitigation: INSTALL.md with checklist, and each SKILL.md can reference "see AGENTS.md for global rules" as a reminder.
- **User modifies bundled skills** — updates via `/plugins install` overwrite changes. Mitigation: document this in INSTALL.md and recommend forking the plugin for customizations.
- **Config.toml permissions are coarse** — cannot differentiate builder (needs bash) from adventurer (should not edit). Mitigation: conservative default rules with `ask` for edit/bash.

## What We're NOT Doing

1. **Not building MCP servers** — the manifest supports `mcpServers` declarations, but our agents don't need external tool integrations at this scope.
2. **Not including a plugin SDK** — Kimi Code's plugin system is declarative-only; there is no SDK to wrap or abstract.
3. **Not building for non-kimi-code platforms yet** — this package is kimi-code-specific. We build for one platform at a time until we have 3+ and can justify a core abstraction.
4. **Not extracting `packages/core/`** — no shared library between opencode and kimi-code yet. Each package is independent, with documented conventions that align by design.
5. **Not publishing to npm** — Kimi Code installs from GitHub URLs. The package lives in the monorepo for development but is installed from its GitHub path.

## Future Considerations

### Platform-Agnostic Core (After 3+ Platforms)

When we support 3+ platforms (OpenCode, Kimi Code, and one more such as Cursor or Copilot),
we should consider extracting a `packages/core/` that defines:

- A canonical agent schema (frontmatter shape, section conventions)
- A skill registry (which skills exist, their responsibilities, their cross-references)
- Platform adapters that translate the canonical schema into each platform's format

This ADR's mapping table (7 specialists → 3 Kimi Code subagents) would become part of the
Kimi Code adapter, not the core schema.

### Potential Platforms to Consider Next

- **Cursor** — `.cursor/rules/` with `.mdc` files; declarative, similar to Kimi Code
- **Copilot** — `copilot-instructions.md` with `SKILL.md`-like extensions via `scripts/`
- **Windsurf** — `.windsurfrules` with tool configurations

Each platform will have its own ADR and mapping table before any core extraction is attempted.

### Skill Composition

If Kimi Code adds support for skill chaining or composite skills in the future, the orchestrator's
session-start role could be expanded to dynamically compose skills based on the user's task.
This is speculative — no design work until the platform supports it.

## Related Decisions

- ADR-001: Global rules scope filter (what goes in rules/AGENTS.md vs. agent files)
- ADR-002: Pure plugin architecture for opencode (established the "markdown as source of truth" principle)
- ADR-003: Agent conventions (!!! markers, cross-references, skill pattern — carried forward into SKILL.md)

## Date

2026-06-12
