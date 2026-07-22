# @maestria/cursor

## 0.1.3

### Patch Changes

- [#108](https://github.com/agustinusnathaniel/maestria/pull/108) [`a2e2b8a`](https://github.com/agustinusnathaniel/maestria/commit/a2e2b8a061749c268e30eda82be43f6b1dbaf507) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Refactored all agent directive prompts for better structure, clarity, and cross-platform consistency:

  - Restructured core prompts with clearer sections and emphasis on critical rules agents must follow
  - Added structured handoff verification checklists to all specialist agents so handoffs between agents are more reliable
  - Standardized "Before reporting done" completion checks across all agents, reducing premature sign-offs
  - Added Parallelization table for safer multi-agent task execution when builders work in parallel
  - Added Multi-Lens Review Swarm capability for comprehensive code review that catches more issues
  - Made prompt instructions platform-agnostic so agents behave consistently across OpenCode, Cursor, Kimi Code, Pi, and other platforms
  - Fixed several content gaps where important behavioral rules were compressed too aggressively

## 0.1.2

### Patch Changes

- [#106](https://github.com/agustinusnathaniel/maestria/pull/106) [`ba91d36`](https://github.com/agustinusnathaniel/maestria/commit/ba91d36ba612cd2c634e3a73071047a5f50f46b4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Updated dependencies across packages: diff ^9.0.0, zod ^4.4.3, @clack v1.x, effect beta.100, astro 7.1.3, and more

## 0.1.1

### Patch Changes

- [#92](https://github.com/agustinusnathaniel/maestria/pull/92) [`e861360`](https://github.com/agustinusnathaniel/maestria/commit/e8613603e43315b403f87e66f428dfe4c1b62def) Thanks [@iyansr](https://github.com/iyansr)! - feat: @maestria/cursor plugin v0.1 — declarative Cursor IDE and CLI plugin

  Initial release of the Cursor platform plugin:

  - **7 specialist agents** synced from core (`agents/*.md`) with Cursor-adapted tool names (Read, Glob, Grep, StrReplace, Shell, Write)
  - **Orchestrator skill** (`skills/orchestrator/SKILL.md`) with Task-based routing, handoff contracts, and maker/checker enforcement
  - **Global rules** (`rules/maestria-global.mdc`, `alwaysApply: true`)
  - **Workflow commands** — `/fein` (full pipeline), `/sonar` (research only), `/blitz` (fast implementation)
  - **Two-layer maker/checker** — `readonly: true` runtime flag on adventurer/planner/reviewer agents blocks write tools at the Cursor runtime level, with prompt-level instructions as backup
  - **CLI support** — `maestria install cursor`, `maestria update cursor`, `maestria uninstall cursor`, `maestria check cursor` via npm (`@maestria/cursor`)
  - **Documentation** — installation guide, quick start, changelog, contributing guide, and ADR-CR-001

- [#103](https://github.com/agustinusnathaniel/maestria/pull/103) [`886dbd0`](https://github.com/agustinusnathaniel/maestria/commit/886dbd0b92256110d89f1549d7a96849950a2e82) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Sync workflow mode commands (fein/sonar/blitz) through canonical source pipeline, including Hermes

## 0.1.0

### Minor Changes

- Initial release of `@maestria/cursor` — declarative Cursor plugin for IDE and CLI.
- **7 specialist agents** synced from core (`agents/*.md`)
- **Orchestrator skill** (`skills/orchestrator/SKILL.md`) with Task-based routing
- **Global rules** (`rules/maestria-global.mdc`, `alwaysApply: true`)
- **Workflow commands** — `/fein`, `/sonar`, `/blitz`, `/orchestrate`
- CLI install: `maestria install cursor` → `~/.cursor/plugins/local/maestria`
