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
  skills/            - maestria's own methodology skills (`create-pull-request`, `docs-update`)
  commands/          - Workflow-mode sources (`fein`, `sonar`, `blitz`)
```

The consolidated `@maestria/agent-plugins` package lives at `packages/agent-plugins/` and is directly installable. Core remains the authoring home: roles belong to `specialists/`, modes to `commands/`, and policy to `rules.md` and host integration notes. Host manifests are hand-edited at the package root and validated by the generator; per-role profile metadata lives in the package's `generation/profiles.json`. Host integration notes stay here under `integrations/` and are composed into rules and Codex profiles; the package ships no separate integration guides.

Root host manifests and semantic agent, command, policy, and utility resources are tracked for Git consumers and ship at the same paths in npm archives. Root skills contain the `handoff` and `iteration-limits` utilities, each generated from one `rules.md` section (`Delegation and Context`, `Bounded Repair and Fail-Loud Behavior`) so they cannot drift from policy (edit the section, not the skill), plus the bundled methodology skills described below. Complete native profiles derive from canonical roles and global policy; modes derive from canonical commands, router, and policy. Each role ships once as `agents/<role>.md`, whose frontmatter carries every Markdown host's keys, plus a generated `agents/maestria-<role>.toml` for Codex. Portable discovery remains skills-only.

The consolidated compiler is the sole writer for this package's composed resources. It reuses core normalization/frontmatter helpers and validates canonical sources, required headings, profile metadata, manifest paths, size limits, and output containment before mutation. `scripts/sync-all` first preflights all other package configs without writes, then regenerates resources; `scripts/check-sync` remains read-only. There is no nested installation root. The standalone CLI remains in `apps/maestria-cli`.

Methodology skills that the rules name (`create-pull-request`, `docs-update`) are authored once under `skills/` here. `scripts/sync-bundled-skills.ts` (run by `scripts/sync-all`, guarded by `scripts/check-sync`) copies each into `skills/` of `@maestria/agent-plugins`, `@maestria/deepseek`, `@maestria/opencode`, and `@maestria/pi`; edit the skill here, never a copy. Runtimes maestria does not package get the agent-plugins copies through `npx skills add agustinusnathaniel/maestria`, which follows the Claude marketplace entry's relative source. Generic engineering skills that directives name by trigger (for example `architecture-decision-framework`) stay in their own repositories and are never vendored here. [CORE-005](../../../docs/adr/core/ADR-CORE-005-shared-agent-directives-core-sync.md) records these three ownership tiers.

Host notes live under `integrations/`; they define native invocation and activation without becoming independent role or mode sources. Native profile metadata belongs in generation inputs, while complete child instructions are composed from canonical specialists and policy. Canonical mode files define workflow behavior; generated entry points supply their required parent context and preserve user arguments.

## Reuse a Canonical Input in a Projection

Sync configs use a top-level `source` for the default canonical input. A file entry can set its own `source` path, relative to that sync config, when one generated output should reuse a different canonical input. The `source` override changes which input is rendered; it does not create another methodology source. A file entry can also set `section` to render only that `## heading` of its input, titled by the heading; this is how the `handoff` and `iteration-limits` skills project `rules.md`, and a missing heading fails the sync before any write.

Use per-file source overrides when an adapter needs to select a different canonical input. Keep native metadata and mechanical transforms in adapter inputs rather than copying prose into configuration. The consolidated compiler composes full specialist policy and complete workflow context instead of relying on removed role/mode skills.

After changing canonical input or projection metadata, run `scripts/sync-all` and `scripts/check-sync` from the repository root.

## How to Add a New Specialist

1. Create a new file in `specialists/<name>.md`
2. Define the role, task-specific judgment, acceptance evidence, and handoff. Use conditional skill triggers; keep shared contracts in `rules.md`.
3. Add the specialist to the delegation table in the orchestrator prompt
4. Add the projection to each relevant adapter sync config and the consolidated compiler/profile registry, then update native metadata required by that integration
5. Run the sync tool to generate plugin-specific agent files
