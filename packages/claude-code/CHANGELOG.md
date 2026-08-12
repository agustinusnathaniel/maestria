# @maestria/claude-code

## 0.2.0

### Minor Changes

- [#189](https://github.com/agustinusnathaniel/maestria/pull/189) [`e744f0d`](https://github.com/agustinusnathaniel/maestria/commit/e744f0dde8b7e99f5ed18534a56c4d6d04304e6c) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add declarative Claude Code plugin package generated from canonical directives: 7 specialist agents with global-rules skill preloading, orchestrator and global-rules skills, and fein/sonar/blitz workflow commands. `adventurer`, `planner`, and `reviewer` deny Write/Edit via `disallowedTools` (user-authorized). Local validation via `claude plugin validate --strict`; marketplace distribution is follow-up work.

### Patch Changes

- [#190](https://github.com/agustinusnathaniel/maestria/pull/190) [`96f2649`](https://github.com/agustinusnathaniel/maestria/commit/96f264911f8756ee3528277699deb96e8a1bc9d7) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify agent workflow contracts while preserving detailed specialist guidance. Routine validated commits on recognized feature branches remain autonomous after required review; push and later lifecycle actions stay separately gated. Add bounded repair and platform-enforcement notes, refresh generated projections, and retain explicit mode reset behavior and read-only sonar profiles where supported.

- [#194](https://github.com/agustinusnathaniel/maestria/pull/194) [`b1c67ed`](https://github.com/agustinusnathaniel/maestria/commit/b1c67eddcb46b0633166c0af25b5bfd336a33abb) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Simplify and re-align the shared agent directives around outcome, evidence, runtime authority, blind review, bounded repair, and autonomous routine work. Directives now avoid unnecessary orchestration ceremony, allow the host runtime to determine whether work is performed directly or delegated, prevent nested supervisors from duplicating scheduling and lifecycle work, and keep all generated platform projections synchronized.
