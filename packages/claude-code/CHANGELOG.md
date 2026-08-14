# @maestria/claude-code

## 0.2.3

### Patch Changes

- [#213](https://github.com/agustinusnathaniel/maestria/pull/213) [`b6f3a09`](https://github.com/agustinusnathaniel/maestria/commit/b6f3a09d1be75e6f19e1d3736f71696df44f3c6d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Bound review and repair to material blockers, preserve narrow approval boundaries, and complete routine implementation delivery autonomously.

## 0.2.2

### Patch Changes

- [#210](https://github.com/agustinusnathaniel/maestria/pull/210) [`88cc573`](https://github.com/agustinusnathaniel/maestria/commit/88cc5738ac2b1d5c381bba58f7208498087b2bfa) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Keep normal engineering sessions autonomous through continuation, scope-frozen bounded repair, and reviewable PR delivery. Incomplete specialist work is recovered or reported as a structured blocker instead of becoming an implicit user checkpoint.

## 0.2.1

### Patch Changes

- [#195](https://github.com/agustinusnathaniel/maestria/pull/195) [`8850e68`](https://github.com/agustinusnathaniel/maestria/commit/8850e680561538e6697815b24692f30829c53641) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Claude Code plugin metadata now stays aligned with package versions: release-time version sync is generalized across plugins (replacing the Hermes-only script) and a `--check` mode fails the build on drift, so the published plugin artifact can no longer diverge from npm metadata. Local usage, installation, quick-start, and contributing docs are now available on the docs site.

- [#199](https://github.com/agustinusnathaniel/maestria/pull/199) [`2955263`](https://github.com/agustinusnathaniel/maestria/commit/2955263a3788aea829c548bc56c7f6e7ff941637) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Agent directives now calibrate effort to task risk, prefer mature ecosystem solutions, converge reviews on material blockers, deliver routine engineering work through feature branches and PRs, and clean up task-owned background processes before completion.

## 0.2.0

### Minor Changes

- [#189](https://github.com/agustinusnathaniel/maestria/pull/189) [`e744f0d`](https://github.com/agustinusnathaniel/maestria/commit/e744f0dde8b7e99f5ed18534a56c4d6d04304e6c) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add declarative Claude Code plugin package generated from canonical directives: 7 specialist agents with global-rules skill preloading, orchestrator and global-rules skills, and fein/sonar/blitz workflow commands. `adventurer`, `planner`, and `reviewer` deny Write/Edit via `disallowedTools` (user-authorized). Local validation via `claude plugin validate --strict`; marketplace distribution is follow-up work.

### Patch Changes

- [#190](https://github.com/agustinusnathaniel/maestria/pull/190) [`96f2649`](https://github.com/agustinusnathaniel/maestria/commit/96f264911f8756ee3528277699deb96e8a1bc9d7) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Clarify agent workflow contracts while preserving detailed specialist guidance. Routine validated commits on recognized feature branches remain autonomous after required review; push and later lifecycle actions stay separately gated. Add bounded repair and platform-enforcement notes, refresh generated projections, and retain explicit mode reset behavior and read-only sonar profiles where supported.

- [#194](https://github.com/agustinusnathaniel/maestria/pull/194) [`b1c67ed`](https://github.com/agustinusnathaniel/maestria/commit/b1c67eddcb46b0633166c0af25b5bfd336a33abb) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Simplify and re-align the shared agent directives around outcome, evidence, runtime authority, blind review, bounded repair, and autonomous routine work. Directives now avoid unnecessary orchestration ceremony, allow the host runtime to determine whether work is performed directly or delegated, prevent nested supervisors from duplicating scheduling and lifecycle work, and keep all generated platform projections synchronized.
