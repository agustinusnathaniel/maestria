# Changelog

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
