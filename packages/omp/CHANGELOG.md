# @maestria/omp

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
