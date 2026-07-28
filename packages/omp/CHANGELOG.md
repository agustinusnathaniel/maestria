# @maestria/omp

## 0.2.6

### Patch Changes

- [#129](https://github.com/agustinusnathaniel/maestria/pull/129) [`7dc3df1`](https://github.com/agustinusnathaniel/maestria/commit/7dc3df17dce1707b80a018437bbf0c263c106bc0) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Blind review and fail-loud iteration exit for the review protocol.

  **Blind review** - The reviewer agent no longer receives the builder's
  handoff notes or self-assessment. It now evaluates only the diff,
  requirements, and acceptance criteria. This removes a bias: the reviewer
  was previously primed by the builder's own narrative about what changed,
  rather than judging the code against the spec directly.

  **Fail-loud iteration exit** - When the review loop runs 3 cycles with
  unresolved issues, instead of silently documenting the gap and proceeding,
  the pipeline now stops and escalates. It produces a structured report of
  what's still blocking and requires your explicit override to continue.

  **How this affects you:** Reviews are more objective now. If a review
  stalls, you'll get a clear report of what's blocking it rather than a
  quiet pass. No action required on your end - your agents handle the new
  protocol automatically.

## 0.2.5

### Patch Changes

- [#133](https://github.com/agustinusnathaniel/maestria/pull/133) [`8ed34dd`](https://github.com/agustinusnathaniel/maestria/commit/8ed34ddbbe42b1bfe8b8dda8a91f61ac779a078a) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Extract shared state-core module (state types, transforms, persistence, review, render) and agent-deployment utilities from OMP and PI into @maestria/shared-pi. Deepen OMP and PI monolithic state modules into focused sub-modules with clear separation of concerns.

- Updated dependencies [[`8ed34dd`](https://github.com/agustinusnathaniel/maestria/commit/8ed34ddbbe42b1bfe8b8dda8a91f61ac779a078a)]:
  - @maestria/shared-pi@0.2.0

## 0.2.4

### Patch Changes

- [#120](https://github.com/agustinusnathaniel/maestria/pull/120) [`5c18e3c`](https://github.com/agustinusnathaniel/maestria/commit/5c18e3c6abb32a439a6ae705422f2ab3ce2c305d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - fix: remove npm: prefix from omp package specifiers to avoid bun self-alias dependency loop

## 0.2.3

### Patch Changes

- [#108](https://github.com/agustinusnathaniel/maestria/pull/108) [`a2e2b8a`](https://github.com/agustinusnathaniel/maestria/commit/a2e2b8a061749c268e30eda82be43f6b1dbaf507) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Refactored all agent directive prompts for better structure, clarity, and cross-platform consistency:

  - Restructured core prompts with clearer sections and emphasis on critical rules agents must follow
  - Added structured handoff verification checklists to all specialist agents so handoffs between agents are more reliable
  - Standardized "Before reporting done" completion checks across all agents, reducing premature sign-offs
  - Added Parallelization table for safer multi-agent task execution when builders work in parallel
  - Added Multi-Lens Review Swarm capability for comprehensive code review that catches more issues
  - Made prompt instructions platform-agnostic so agents behave consistently across OpenCode, Cursor, Kimi Code, Pi, and other platforms
  - Fixed several content gaps where important behavioral rules were compressed too aggressively

## 0.2.2

### Patch Changes

- [#113](https://github.com/agustinusnathaniel/maestria/pull/113) [`183b4b8`](https://github.com/agustinusnathaniel/maestria/commit/183b4b8e11f39298e8236b24d22747de02a917c6) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - refactor: defer module-level file I/O to prevent fatal-yet-silent plugin loading failures

  Module-level readFileSync and homedir() calls across opencode, pi, and omp
  platforms could crash the entire plugin at import time if files were missing
  or the runtime lacked the required API (e.g., findPackageJSON in Bun).

  Changes:

  - opencode: lazy-load mode prompts via Proxy with error fallback
  - pi/omp: lazy-load mode prompts via getModePrompt() cache
  - pi/omp: defer homedir() from module scope to function body
  - opencode: add import-from-dist smoke test
  - CI: add Bun smoke test job to catch runtime incompatibilities early

## 0.2.1

### Patch Changes

- [#106](https://github.com/agustinusnathaniel/maestria/pull/106) [`ba91d36`](https://github.com/agustinusnathaniel/maestria/commit/ba91d36ba612cd2c634e3a73071047a5f50f46b4) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Updated dependencies across packages: diff ^9.0.0, zod ^4.4.3, @clack v1.x, effect beta.100, astro 7.1.3, and more

## 0.2.0

### Minor Changes

- [#104](https://github.com/agustinusnathaniel/maestria/pull/104) [`040f23a`](https://github.com/agustinusnathaniel/maestria/commit/040f23ad223a455b8095cb1edc9dca0a7a0a1fc7) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - feat: add Oh My Pi (omp) platform plugin

  New `@maestria/omp` package adds maestria support for the Oh My Pi coding agent:

  - 7 specialist agents (adventurer, architect, builder, diagnose, planner, reviewer, writer)
  - Workflow mode commands: /fein, /sonar, /blitz
  - Review mode with tool blocking and dangerous pattern detection
  - Session state tracking and compaction preservation
  - Structured handoff via /handoff command
  - CLI integration: `maestria install omp`, `maestria update omp`
  - Agent methodology synced from canonical core source
