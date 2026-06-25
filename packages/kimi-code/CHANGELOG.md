# Changelog

## 0.3.0

### Minor Changes

- [#36](https://github.com/agustinusnathaniel/maestria/pull/36) [`d1bc253`](https://github.com/agustinusnathaniel/maestria/commit/d1bc253b9c4004ccf4ef09cfa9c8b1a7f99b39e7) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add `.maestria/` project workflow protocol to agent directives

  Projects using maestria's agent directives can now define
  `.maestria/workflow.md` for custom delegation sequencing and
  `.maestria/rules.md` for project-specific non-negotiable rules.
  The orchestrator loads these files via `@adventurer` delegation
  and propagates project rules to all subagents via delegation
  prompts.

  See ADR-CORE-006 for the design decision.

- [`665bf4b`](https://github.com/agustinusnathaniel/maestria/commit/665bf4b0aed6162ed93579a1f1c55e80fae887ec) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add effort anthropomorphism guard and writing style guidance to agent directives

  - **Critical Rule [#11](https://github.com/agustinusnathaniel/maestria/issues/11) (orchestrator):** "Don't anthropomorphize effort" — prevents the dispatcher from avoiding the correct specialist because an analysis "feels like too much work"
  - **Output Style section (orchestrator):** Guides the dispatcher to write for humans, avoiding AI-typical patterns like em dash overuse and promotional phrasing
  - **Global agent rules (rules.md):** Cross-agent versions of both — "Don't anthropomorphize effort" and "Write for humans" — so architect, planner, builder, and all other specialists also receive the guidance

## 0.2.1

### Patch Changes

- [#33](https://github.com/agustinusnathaniel/maestria/pull/33) [`c2075b6`](https://github.com/agustinusnathaniel/maestria/commit/c2075b69b3c44ec8a95ba3711ce4bc4d76e6d163) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Introduce @maestria/core as canonical source for agent directives with config-driven sync tool

  - Add packages/core/agent-directives/ with canonical specialist, orchestrator, and rules files
  - Add packages/core/scripts/sync.ts transform pipeline (replace, prepend, append, frontmatter)
  - Add per-plugin sync.config.ts for opencode, pi, and kimi-code
  - Add scripts/sync-all and scripts/check-sync with auto-discovery via glob
  - Wire sync check into vp check via vite.config.ts run.tasks
  - Document architecture decision in ADR-CORE-005

## 0.2.0

### Minor Changes

- [#8](https://github.com/agustinusnathaniel/maestria/pull/8) [`795995d`](https://github.com/agustinusnathaniel/maestria/commit/795995d8c43d7d5b4eb2818448b201ed7e607dc4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add a release pipeline for the kimi-code plugin: pushing a `@maestria/kimi-code@v<version>` tag now triggers a GitHub Action that uses `git subtree split` to hoist `packages/kimi-code/*` into a `release/kimi-code` branch where the manifest sits at the root. The install path in INSTALL.md and the docs site is updated to use the branch URL, giving users auto-update on re-install. See [ADR-010](https://github.com/agustinusnathaniel/maestria/blob/main/docs/adr/kimi-code/ADR-010-kimi-code-distribution.md) for the rationale.

- [#8](https://github.com/agustinusnathaniel/maestria/pull/8) [`795995d`](https://github.com/agustinusnathaniel/maestria/commit/795995d8c43d7d5b4eb2818448b201ed7e607dc4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Initial release of `@maestria/kimi-code` — declarative skill-based plugin for Kimi Code. Ships 8 SKILL.md files (orchestrator + 7 specialists), kimi.plugin.json manifest, global rules, and a swarm-aware orchestration pattern. See [ADR-011](https://github.com/agustinusnathaniel/maestria/blob/main/docs/adr/kimi-code/ADR-011-kimi-code-architecture.md) for the design.

### Patch Changes

- [#8](https://github.com/agustinusnathaniel/maestria/pull/8) [`795995d`](https://github.com/agustinusnathaniel/maestria/commit/795995d8c43d7d5b4eb2818448b201ed7e607dc4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Fix duplicate skills, thin orchestrator, fix skillInstructions, trim AGENTS.md

  - Removes duplicate `diagnose` from diagnose SKILL.md Load on trigger
  - Removes duplicate `architecture-decision-records` (anthropics) from architect SKILL.md
  - Removes non-existent `write-a-skill` (mattpocock/skills) from writer SKILL.md
  - Installs `architecture-decision-framework` (agustinusnathaniel/skills)
  - Adds missing source annotations to orchestrator SKILL.md Always load entries
  - Thins orchestrator SKILL.md by removing ~67 lines of internal Kimi Code implementation details
  - Fixes skillInstructions in kimi.plugin.json to tactical dispatch rules
  - Removes redundant delegation table from rules/AGENTS.md
  - Updates contributing, INSTALL, README, and ADR-011 to reflect current implementation

## 0.1.0

### Minor Changes

- Initial release of `@maestria/kimi-code` — declarative skill-based plugin for Kimi Code. Ships 8 SKILL.md files (orchestrator + 7 specialists), `kimi.plugin.json` manifest, global rules, and a swarm-aware orchestration pattern. See [ADR-011](https://github.com/agustinusnathaniel/maestria/blob/main/docs/adr/kimi-code/ADR-011-kimi-code-architecture.md) for the design.
