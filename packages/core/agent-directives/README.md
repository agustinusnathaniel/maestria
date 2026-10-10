# Agent Directives

Canonical source of truth for agent directives across all plugins and the portable Agent Plugins projection.

## Purpose

This directory holds the shared methodology, rules, workflow modes, and skill prescriptions that define how pipeline agents operate. Every plugin-specific agent or skill file (`@adventurer`, `@architect`, etc.) is derived from these canonical sources.

**Do not edit plugin-specific agent files directly.** Edit here, then run the sync tool to propagate changes to all plugins.

## Directory Structure

```
agent-directives/
  README.md          - This file
  COMPOSITION.md     - Human-facing composition guidance
  agents/            - Host-native wrappers that load shared role skills
  aliases/           - Thin entry-point templates for shared workflow modes
  integrations/      - Host-specific notes that explain native adapter behavior
  specialists/       - Role definitions for the 8 pipeline agents (orchestrator + 7 specialists)
    adventurer.md    - Codebase reconnaissance
    architect.md     - Architecture decisions and ADRs
    builder.md       - Focused implementation
    diagnose.md      - Systematic bug tracing
    orchestrator.md  - Routing and delivery ownership
    planner.md       - Implementation plans
    reviewer.md      - Code review with quality gates
    writer.md        - Documentation writing
  rules.md           - Shared rules used across all agents
  commands/          - Workflow-mode sources (`fein`, `sonar`, `blitz`)
  skills/            - Shared handoff and iteration-limit sources
```

The consolidated `@maestria/agent-plugins` source package lives at `packages/agent-plugins/`. Core remains the authoring home; semantic component views group roles under `agents/`, modes under `commands/`, policy under `rules/`, and reusable utility guidance under `skills/`. Development-only configs and manifest inputs live under `generation/`. Host guide text is generated into the installation bundle; source host notes remain in core. No source integration directory mixes build configuration with runtime resources.

`plugin/` is the complete generated installation root, tracked for Git consumers and published as the npm archive root. It retains full host-required role/mode/global-rule skill exports and native profile metadata. These compatibility representations preserve host loading and public component names; they do not move semantic ownership back into source skills. Generate role definitions from canonical roles directly, not from role-skill exports. `scripts/sync-all` regenerates component views and the bundle; `scripts/check-sync` verifies both. The standalone CLI remains in `apps/maestria-cli`.

Methodology skills distributed as standalone skills (for example `create-pull-request`, `docs-update`) live once at the repository root under `skills/` and are not generated from this directory: the CLI invokes the official `skills` CLI to install them, and core keeps only the routing pointer. Do not copy skill bodies into plugin packages. The Claude Code plugin manifest for these standalone skills lives at `skills/.claude-plugin/plugin.json`.

Host-native agent wrappers live under `agents/` when a platform can preload the shared role skill directly. Keep them limited to host-specific loading behavior; the `specialists/` files and projected skills remain the methodology source of truth. Workflow aliases live under `aliases/` and select a shared mode skill without copying its procedure. Host notes live under `integrations/`; they document how a projection loads and delegates without duplicating the shared router.

## Reuse a Canonical Input in a Projection

Sync configs use a top-level `source` for the default canonical input. A file entry can set its own `source` path, relative to that sync config, when one generated output should reuse a different canonical input. The `source` override changes which input is rendered; it does not create another methodology source.

Use a per-file source override when an adapter needs a thin native wrapper or alias instead of copying a full specialist or mode body. For example, Claude Code's seven native agent profiles are generated from one wrapper in `agents/claude-wrapper.md`; each profile names its role skill and the shared global-rules skill in native frontmatter. Cursor and Kimi workflow aliases reuse `aliases/workflow.md` and substitute the selected mode name. Their behavior remains in the shared mode skills.

Keep the adapter-specific content in frontmatter, replacements, or integration notes. If the host cannot reliably preload the shared skill, retain the complete role guidance in that host's canonical specialist projection instead of using an empty wrapper. After changing an input or sync config, run `scripts/sync-all` and `scripts/check-sync` from the repository root.

## How to Add a New Specialist

1. Create a new file in `specialists/<name>.md`
2. Define the role, task-specific judgment, acceptance evidence, and handoff. Use conditional skill triggers; keep shared contracts in `rules.md`.
3. Add the specialist to the delegation table in the orchestrator prompt
4. Add the projection to each relevant `sync.config.ts` and update any host agent registry or metadata required by that integration
5. Run the sync tool to generate plugin-specific agent files
