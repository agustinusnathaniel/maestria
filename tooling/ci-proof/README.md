# Bounded CI execution proof

This feature-branch experiment keeps all production CI files and commands intact. It tests one shared Vitest worker budget and overlapping independent work in one job. Local macOS runs establish compatibility only. Hosted acceptance requires at most three matched baseline/candidate pairs, median complete-job time at most 75% of baseline, equivalent checks, and no production runner-time increase. Independent review precedes push and dispatch.

## Evidence selected before implementation

The existing suites are the behavioral contract. No new unit tests or changed fixtures are needed. Preserve 15 workspace JS projects (86 files), the standalone root version suite (one file), and five Hermes Python files. Collect each original project with its own CWD/config, then compare exact file/test identities and final statuses, including intentional skips, with the shared runner. Preserve each original config and aliases; explicitly set roots, forks, isolation, and a shared maximum of three workers.

The candidate DAG must retain package builds, the additional OpenCode/Prime Agent test packs, Astro sync, format, sync, lint/type analysis, manifest validation, Python static checks and tests, standalone version tests, docs build, and the complete Bun hooks assertion. Lint waits for builds and Astro sync; JS tests wait for builds and test packs; docs rendering waits for lint. Docs suites read source/public inputs rather than `.astro` or `dist`; Astro sync must finish before lint or docs generation consumes its types.

Before implementing the DAG, the selected failure probes are disposable child processes exiting 23 in preparation, shared tests, and docs. Probes use the same scheduler and real spawned-child exit handling, record events, and assert aggregate failure and blocked dependent stages. They never modify actual source or suites. Normal execution records commands, CWDs, exit codes and start/end times; an assertion checks that every prerequisite completed successfully before a dependent stage began. Spawn errors, signals, nonzero exits and blocked dependencies fail closed. Independent already-running children are joined before exit. One local correctness repair is allowed, then any unresolved mismatch stops the experiment.

Evidence lives under ignored `artifacts/ci-proof/`. Visual evidence is not applicable because this experiment changes no rendered product surface. This README is the only affected documentation; user documentation, changelog and changesets are unaffected because the prototype is unpublished and experimental.

## Reproduction

Use a frozen install and the unchanged setup action's tool versions (Vite+ 0.3.1, Vitest 4.1.11, pnpm 12.4.1, Bun 1.4.2 and ruff 0.16.7). Python must satisfy the Hermes `>=3.11` declaration. From the repo root:

```sh
pnpm install --frozen-lockfile
pnpm build:ci
pnpm sync:docs
pnpm exec tsx tooling/ci-proof/collect.ts baseline
pnpm exec tsx tooling/ci-proof/collect.ts candidate
pnpm exec tsx tooling/ci-proof/compare.ts
pnpm check:ci > artifacts/ci-proof/baseline-check-final.log 2>&1
pnpm exec tsx tooling/ci-proof/cwd-proof.ts
pnpm exec tsx tooling/ci-proof/probes.ts
pnpm exec tsx tooling/ci-proof/run.ts
pnpm exec tsx tooling/ci-proof/verify-dag.ts
```

Collection reports record commands and CWDs; equivalence compares every file and test identity/status and records per-project counts. CWD evidence uses an optional Node import solely for the existing CLI setup/update suites, records real fork CWDs, and runs no external installs or mutations. `events.json` is the scheduler's incremental snapshot; `results.json` is its complete final stage record. Failure probes require child exit 23, aggregate exit 1, and successful ordered prerequisites for every stage that started.

The harness admits at most four stage child processes. The unchanged build task retains its own package scheduling, and the shared JS runner separately has three fork workers with isolation. This combines worker scheduling, fewer package runner processes, and dependency overlap; any improvement cannot be attributed solely to the worker budget. Candidate JSON reporting adds evidence overhead; baseline retains its original reporter.

After independent review, one push to `codex/ci-execution-proof` starts matched pair 1. Rerun that same workflow run at most twice for pairs 2 and 3. Do not push more commits or change the candidate between pairs. The workflow rejects attempts above three and has no main or PR trigger. Record full job durations including setup, evidence upload and cleanup, along with SHA, run attempt, runner/environment versions and cache observations. No local runtime number is a performance acceptance result, and no production PR follows until the hosted acceptance gate passes.
