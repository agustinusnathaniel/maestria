# @maestria/cursor

## 0.1.10

### Patch Changes

- [#213](https://github.com/agustinusnathaniel/maestria/pull/213) [`b6f3a09`](https://github.com/agustinusnathaniel/maestria/commit/b6f3a09d1be75e6f19e1d3736f71696df44f3c6d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Bound review and repair to material blockers, preserve narrow approval boundaries, and complete routine implementation delivery autonomously.

## 0.1.9

### Patch Changes

- [#210](https://github.com/agustinusnathaniel/maestria/pull/210) [`88cc573`](https://github.com/agustinusnathaniel/maestria/commit/88cc5738ac2b1d5c381bba58f7208498087b2bfa) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Keep normal engineering sessions autonomous through continuation, scope-frozen bounded repair, and reviewable PR delivery. Incomplete specialist work is recovered or reported as a structured blocker instead of becoming an implicit user checkpoint.

## 0.1.8

### Patch Changes

- [#199](https://github.com/agustinusnathaniel/maestria/pull/199) [`2955263`](https://github.com/agustinusnathaniel/maestria/commit/2955263a3788aea829c548bc56c7f6e7ff941637) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Agent directives now calibrate effort to task risk, prefer mature ecosystem solutions, converge reviews on material blockers, deliver routine engineering work through feature branches and PRs, and clean up task-owned background processes before completion.

## 0.1.7

### Patch Changes

- [#190](https://github.com/agustinusnathaniel/maestria/pull/190) [`96f2649`](https://github.com/agustinusnathaniel/maestria/commit/96f264911f8756ee3528277699deb96e8a1bc9d7) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify agent workflow contracts while preserving detailed specialist guidance. Routine validated commits on recognized feature branches remain autonomous after required review; push and later lifecycle actions stay separately gated. Add bounded repair and platform-enforcement notes, refresh generated projections, and retain explicit mode reset behavior and read-only sonar profiles where supported.

- [#194](https://github.com/agustinusnathaniel/maestria/pull/194) [`b1c67ed`](https://github.com/agustinusnathaniel/maestria/commit/b1c67eddcb46b0633166c0af25b5bfd336a33abb) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Simplify and re-align the shared agent directives around outcome, evidence, runtime authority, blind review, bounded repair, and autonomous routine work. Directives now avoid unnecessary orchestration ceremony, allow the host runtime to determine whether work is performed directly or delegated, prevent nested supervisors from duplicating scheduling and lifecycle work, and keep all generated platform projections synchronized.

## 0.1.6

### Patch Changes

- [#185](https://github.com/agustinusnathaniel/maestria/pull/185) [`79e753c`](https://github.com/agustinusnathaniel/maestria/commit/79e753c104c72a3403aded79ee6c49ed3cb2b5fe) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Streamline canonical agent directives by centralizing universal contracts, preserving orchestration behavior in compact form, and adding bounded autonomy, work-unit budgets, scope control, process lifecycle evidence, and checkpoint action boundaries.

## 0.1.5

### Patch Changes

- [#180](https://github.com/agustinusnathaniel/maestria/pull/180) [`8d77c40`](https://github.com/agustinusnathaniel/maestria/commit/8d77c4060fab81e20083ab1d8614600adfe258ee) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Make delegation more selective, keep handoffs concise, and let Sonar research
  start with the owning specialist while adding another specialist only when a
  distinct required output remains.

## 0.1.4

### Patch Changes

- [#157](https://github.com/agustinusnathaniel/maestria/pull/157) [`906f836`](https://github.com/agustinusnathaniel/maestria/commit/906f836a96a2f53e838c29d3a9e82d5c2336ba49) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Selective routing contract in the canonical orchestrator directives.

  **Three routes** - `direct` (host executes, no Maestria specialist spawn),
  `focused` (one targeted specialist, one reviewer for non-trivial
  work), and `full` (bounded recon, design, implementation, and review). The
  full pipeline is an explicit option for complex or high-risk work and for
  explicit `fein` requests, not the universal default.

  **Route guidance by task class** - explanation and discovery default to
  direct, tiny edits to direct or native builder with no automatic recon or
  review, ordinary code changes to focused, and complex or high-risk work to
  full with independent review where the host supports it. Scaling guardrails
  bound child spawns, parallel fan-out, architect/planner use, review lenses,
  and context compaction per route; they are bounds, not measured savings.

  **Explicit mode semantics** - `fein` selects the full route, `sonar` is
  research-only and does not implement, and `blitz` is an explicit
  low-risk/direct bypass that does not waive safety floors. An explicit user
  mode is honored subject to safety constraints. No platform claims to enforce
  modes identically or provide clean isolated contexts.

  **Maker/checker preserved** - every routed `@builder` change is followed by
  `@reviewer`; where the host cannot enforce separate sessions (e.g. Kimi, Pi,
  OMP, Hermes), the split is advisory and stated as such.

  **How this affects you:** Maestria no longer routes every turn through the
  full pipeline. Small explanations and tiny edits run directly or through one
  specialist; the full pipeline stays available for complex, high-risk, or
  explicitly `fein` work. No action required on your end - your agents apply
  the route contract automatically.

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
