# @maestria/omp

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
