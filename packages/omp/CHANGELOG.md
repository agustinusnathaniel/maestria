# @maestria/omp

## 0.3.0

### Minor Changes

- [#145](https://github.com/agustinusnathaniel/maestria/pull/145) [`ea3d492`](https://github.com/agustinusnathaniel/maestria/commit/ea3d4920f4d01298c9decbd3dfc80551c82bcbf3) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Enforce pure dispatcher pattern on Pi and OMP with auto-detect mode keywords

  - **Pure dispatcher enforcement**: when a workflow mode (fein/sonar/blitz) is active, the orchestrator is now restricted to only delegation tools (`maestria_subagent`/`task`). Implementation tools like `bash`, `edit`, and `write` are blocked at the tool level, enforcing the maker/checker split automatically.
  - **Auto-detect mode keywords**: type `fein do X` at the start of any message and the plugin automatically strips the keyword and injects the mode prompt inline. No slash command needed.
  - **Refactor Pi and OMP plugins** to share common infrastructure behind the scenes, ensuring consistent behavior across both platforms.

## 0.2.8

### Patch Changes

- [#138](https://github.com/agustinusnathaniel/maestria/pull/138) [`28f1520`](https://github.com/agustinusnathaniel/maestria/commit/28f15209400e79a7691c923fa63188861199e624) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Move @maestria/shared-pi to devDependencies

  Reclassify the internal `@maestria/shared-pi` dependency from `dependencies` to
  `devDependencies` in both the pi and omp packages. This shared package is bundled
  into `dist/extension.mjs` at build time and is never published to npm.

  **Why this matters:** Without this fix, users updating pi or omp encounter npm
  install failures because `@maestria/shared-pi` is a private package. This is
  solely a dependency classification fix — no behavioral change for end users.

## 0.2.7

### Patch Changes

- [#136](https://github.com/agustinusnathaniel/maestria/pull/136) [`0bee77c`](https://github.com/agustinusnathaniel/maestria/commit/0bee77ca5d09b3f4000795d761eda473ec12d4bc) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Rule-override conditions and communication conventions for agent directives.

  **When to Break the Rules** - Added 6 explicit override conditions to the
  orchestrator prompt (user skip request, safety, mode override, frustration
  escalation, rule conflicts, explanation requests). This prevents rule
  rigidity by documenting when and how to deviate from defaults.

  **Communication conventions** - Two new shared rules adopted from
  established communication practice: report errors matter-of-factly
  (state problem, cause, and fix without hedging or drama) and lead with
  the action (first line actionable, context follows).

  **Review-commit handoff** - Review Triage now chains directly into the
  commit flow after approval (guarded against unresolved `[fix]` and
  `[escalate]` items), replacing the separate "Stop & Report" step.

  **How this affects you:** Agents now have clearer guidance on when to
  flex the rules and how to communicate. Error messages are more direct.
  Responses lead with something actionable rather than preamble. No action
  required on your end - your agents handle the new conventions automatically.

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
