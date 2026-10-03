# Implementation Plan: Maestria Meta-Agent

This plan breaks the meta-agent into five phases. Each phase builds on the previous and has concrete verification criteria. Phases are ordered so each unlocks the next.

**Monorepo:** `agustinusnathaniel/maestria`, pnpm workspaces, vite-plus, changesets.

**Current versions:** `@maestria/opencode` v0.5.2, `@maestria/core` v0.3.1, `@maestria/pi` v0.3.2, `@maestria/kimi-code` v0.3.2.

**Framework:** None. The meta-agent uses GitHub Actions scheduled workflows, shell scripts, and the existing monorepo tooling. No separate agent framework required.

---

## Phase 1: Foundation

**Status:** Mostly done. The infrastructure the meta-agent operates on is already shipped. This phase documents what exists and identifies any remaining gaps.

**Goal:** A verified, documented foundation that the remaining phases build on.

### Existing Components

- [x] **Canonical source** — `packages/core/agent-directives/` with 8 specialist prompts, orchestrator prompt, and consolidated rules. Pure Markdown, no platform-specific syntax.
- [x] **Sync pipeline** — `packages/core/scripts/sync.ts` (config-driven pipeline) backed by 6 library modules. Supports `--check`, `--diff`, `--dry-run`.
- [x] **Plugin sync configs** — `packages/opencode/sync.config.ts`, `packages/pi/sync.config.ts`, `packages/kimi-code/sync.config.ts`.
- [x] **Sync orchestration** — `scripts/sync-all` (iterates over packages/\*/sync.config.ts) and `scripts/check-sync` (CI mode).
- [x] **CLI tool** — `apps/maestria-cli/` with `install`, `update`, `status` commands. Uses Effect v4 + citty.
- [x] **Project workflow** — `.maestria/workflow.md` (sequencing guidance) and `.maestria/rules.md` (non-negotiable project rules).
- [x] **CI integration** — `check-sync` runs as part of `vp check` via vite-plus task configuration. Generated directories excluded from `vp fmt`.
- [x] **Release pipeline** — `pnpm changeset` → `pnpm version-packages` → `pnpm release` with npm provenance.
- [x] **Namespaced ADRs** — `docs/adr/core/`, `docs/adr/opencode/`, `docs/adr/kimi-code/`, `docs/adr/pi/` with prefix-scoped numbering.
- [x] **Published packages** — `@maestria/opencode` (v0.5.2), `@maestria/core` (v0.3.1), `@maestria/pi` (v0.3.2), `@maestria/kimi-code` (v0.3.2).

### Remaining Tasks

- [ ] **1.1** Verify `check-sync` runs correctly in CI and on clean checkouts
- [ ] **1.2** Document canonical content ownership rules (edit `packages/core/agent-directives/`, never generated copies) — done in `packages/core/agent-directives/README.md`
- [ ] **1.3** Ensure `scripts/check-sync` runs as a blocking CI gate (pre-merge, not just as part of `vp check`)

### Verification

- [ ] `bash scripts/check-sync` exits 0 on clean state
- [ ] Editing a canonical source file + running `scripts/sync-all` regenerates all 3 plugin outputs
- [ ] `pnpm check` passes (includes check-sync, lint, typecheck)
- [ ] `pnpm test` passes across all packages
- [ ] `pnpm build` produces correct output for all packages

---

## Phase 2: Automated Maintenance

**Status:** Partially done. Basic CI runs on every commit. Scheduled runs are not yet configured.

**Goal:** GitHub Actions workflows that run the full maintenance pipeline on a schedule and report results.

**Dependencies:** Phase 1.

### Tasks

- [ ] **2.1** Create daily health check workflow - `.github/workflows/daily-check.yml` - Cron: `0 6 * * *` (daily at 06:00 UTC) - Steps: checkout → pnpm install → `pnpm check` → `pnpm test` → `bash scripts/check-sync` - On failure: create a GitHub issue with the failure details - Manual trigger via `workflow_dispatch`

- [ ] **2.2** Create weekly sync audit workflow - `.github/workflows/weekly-sync-audit.yml` - Cron: `0 8 * * 1` (Mondays at 08:00 UTC) - Steps: checkout → `bash scripts/check-sync --diff` → compare with last week's state - On drift detected: open a PR to sync or create an issue explaining the drift

- [ ] **2.3** Create weekly dependency audit workflow - `.github/workflows/weekly-deps.yml` - Cron: `0 10 * * 1` (Mondays at 10:00 UTC) - Steps: `pnpm outdated --json` → parse and format → create issue if any dependencies are >2 majors behind - Exclude devDependencies and peerDependencies unless they're security-critical

- [ ] **2.4** Configure Dependabot or Renovate for automated dependency updates - Enable for patch and minor updates (PRs auto-created) - Major updates as separate PRs requiring human review - Group related dependencies to reduce PR noise

- [ ] **2.5** Configure health check dashboard - Create a GitHub issue template for automated reports - Use GitHub Actions summaries for workflow results - Ensure failure notifications reach the maintainer

### Verification

- [ ] `daily-check` workflow runs on schedule and on `workflow_dispatch`
- [ ] Failing check creates a GitHub issue with relevant logs
- [ ] `weekly-sync-audit` detects intentional drift and opens issue
- [ ] `weekly-deps` correctly identifies outdated dependencies
- [ ] Dependabot/Renovate opens PRs for patch/minor updates automatically
- [ ] All workflows pass on a clean monorepo state

---

## Phase 3: Automated Shipping

**Status:** Partially done. Release commands exist but are manual. Automated end-to-end shipping is not configured.

**Goal:** A workflow that creates changesets, versions packages, opens release PRs, and publishes to npm — all with human approval gates.

**Dependencies:** Phase 2 (reliable CI must pass before release).

### Tasks

- [ ] **3.1** Assess the existing release workflow - Check `.github/workflows/release.yml` (if it exists) or the current release process documentation - Identify gaps between manual and automated process

- [ ] **3.2** Create release preparation workflow - `.github/workflows/prepare-release.yml` - Trigger: manual (`workflow_dispatch`) with inputs for bump type (patch/minor/major) and a summary of changes - Steps: 1. Verify `bash scripts/check-sync` passes (mandatory pre-release gate) 2. Run `pnpm changeset` with the specified bump type 3. Run `pnpm version-packages` to bump versions and generate changelogs 4. Create a branch `release/v{next-version}` 5. Open a PR against `main` with the version bumps and changelog - The PR title and body should be auto-generated from changeset summaries

- [ ] **3.3** Create publish workflow - `.github/workflows/publish.yml` - Trigger: PR merge to main (check for `release/` branch pattern or specific label) - Steps: 1. Checkout main at the merged commit 2. Verify `bash scripts/check-sync` 3. Build all packages (`pnpm build`) 4. Run `pnpm release` (which runs `changeset publish`) 5. Verify npm packages are published at the expected versions 6. Cross-platform sync verification post-release

- [ ] **3.4** Create version sync check post-release - After publish, verify that `scripts/check-sync` still passes (canonical source changes during the release should not break sync) - If sync is broken, open a blocking issue immediately

- [ ] **3.5** Document the release process - Update `CONTRIBUTING.md` with the automated release workflow

### Verification

- [ ] `prepare-release` workflow creates a version bump PR with correct changelog
- [ ] PR is labelled appropriately for human review
- [ ] `publish` workflow runs after PR merge and publishes to npm
- [ ] Published packages are installable and functional
- [ ] Post-release sync check passes
- [ ] Full dry run on a test branch passes before enabling on main

---

## Phase 4: Self-Improvement

**Status:** Planned. No automation exists for this phase yet.

**Goal:** The meta-agent analyzes the monorepo state, identifies improvement opportunities, and opens proposals as PRs.

**Dependencies:** Phase 2 (reliable maintenance pipeline), Phase 3 (shipping pipeline for getting proposals through review).

### Tasks

- [ ] **4.1** Create agent directive consistency checker - A script that reads all canonical source files and checks for: - Inconsistent terminology (same concept, different names across files) - Broken cross-references (a file references another that doesn't exist or has been renamed) - Stale skill prescriptions (referencing skills that don't exist or have been deprecated) - Contradictory guidance (two files say opposite things about the same topic) - Output: structured report with file references, severity, and suggestion

- [ ] **4.2** Create ADR gap detection workflow - `.github/workflows/adr-gap-check.yml` - Cron: monthly - Compares recent git changes to existing ADRs in the relevant namespace - If a pattern change, dependency addition, or structural change lacks an ADR, opens an issue suggesting a new ADR - Uses git log to detect changes of interest (new dependencies, new scripts, new config files, etc.)

- [ ] **4.3** Create sync health improvement workflow - `.github/workflows/sync-improvements.yml` - Cron: monthly - Analyzes `check-sync` history from CI logs - If the same sync pattern breaks repeatedly, opens a PR to improve the canonical source or the sync config to prevent the recurring drift - Example: if a platform-specific transform is consistently missing, suggest adding it to the default config

- [ ] **4.4** Create CI pattern analysis workflow - `.github/workflows/ci-pattern-analysis.yml` - Cron: monthly - Analyzes CI failure logs from the past 30 days - Identifies recurring failure patterns (same test, same lint rule, same sync error appearing multiple times) - Opens an issue with suggestions for fixes (e.g., "test X has failed 3 times this month — consider mocking the external dependency")

### Verification

- [ ] Consistency checker identifies real inconsistencies in canonical source
- [ ] ADR gap detector catches changes that lack documentation
- [ ] Sync improvement workflow generates actionable PRs
- [ ] CI pattern analysis produces useful reduction in recurring failures
- [ ] All proposals go through PR review — no direct commits

---

## Phase 5: Learning & Analytics

**Status:** Planned. This is the most speculative phase and should only be pursued after phases 2-4 are stable.

**Goal:** Collect operational data, analyze trends, and use the analysis to drive further improvements. This phase adds instrumentation rather than new automation.

**Dependencies:** Phase 2 (maintenance data), Phase 3 (shipping data), Phase 4 (improvement data).

### Tasks

- [ ] **5.1** Instrument CI workflows with structured output - Each workflow writes a structured summary to a `ci-logs/` directory (or equivalent) with: - Exit code, duration, and key metrics per step - List of changed files (for shipping workflows) - Sync drift info (for sync audit workflows) - Format: JSON, versioned, append-only

- [ ] **5.2** Create trend analysis workflow - `.github/workflows/trend-analysis.yml` - Cron: monthly - Reads accumulated CI logs - Reports trends: - Test suite duration over time - Sync drift frequency per platform - Most common failure types - Release cycle duration - Opens a report issue with charts (text-based) and recommendations

- [ ] **5.3** Create agent prompt effectiveness analysis - Review closed issues and PRs for agent-related bugs or confusion - Cross-reference with canonical source changes in the same period - Identify if certain prompts consistently cause confusion or errors - Opens an issue with proposed improvements

- [ ] **5.4** Create improvement PR generator - Based on trend analysis and effectiveness data, generate structured PRs that: - Address the most common failure pattern from the past month - Update ADRs for undocumented decisions - Update canonical source to reflect lessons from CI data

### Verification

- [ ] CI logs are structured, versioned, and queryable
- [ ] Trend analysis produces useful reports (not noise)
- [ ] Prompt effectiveness analysis identifies at least one actionable improvement
- [ ] Improvement PR generator creates high-quality, focused PRs
- [ ] No data collection beyond what CI already produces — no telemetry, no external analytics services

---

## Phase Dependencies

```
Phase 1 (Foundation) — Mostly done
  └─► Phase 2 (Automated Maintenance) — Partially done
        └─► Phase 3 (Automated Shipping) — Partially done
              └─► Phase 4 (Self-Improvement) — Planned
                    └─► Phase 5 (Learning & Analytics) — Planned
```

Phases 2 and 3 can partially overlap (the shipping pipeline needs reliable CI from phase 2, but the workflow infrastructure is shared). Phase 4 depends on having both maintenance and shipping stable to generate meaningful improvement proposals. Phase 5 depends on all prior phases to generate sufficient data.

## Key Principles

1. **Framework-free.** All operations use shell scripts, TypeScript via `tsx`, and GitHub Actions YAML. No agent framework dependency.

2. **PR-gated.** Every file change goes through a pull request. The meta-agent creates branches and opens PRs — never pushes directly to main.

3. **Incremental.** Each phase adds one or two workflows. No big-bang deployments. Each addition is independently verifiable and reversible.

4. **Observable by default.** All workflow outputs are visible in GitHub Actions logs. Structured summaries are committed to the repo where possible.

5. **No telemetry.** No external analytics, no data collection beyond what GitHub Actions and git history already provide. Phase 5 uses CI artifacts, not external services.

6. **Canonical source authority.** The meta-agent must never edit generated platform files directly. All agent prompt changes go through `packages/core/agent-directives/` and the sync pipeline.

---

## Summary by Phase

| Phase | Effort | Key Deliverable | Status |
| --- | --- | --- | --- |
| 1: Foundation | Low (documentation + gap filling) | Verified, documented foundation | Mostly done |
| 2: Automated Maintenance | Medium | Daily/weekly scheduled health + sync + dep checks | Partially done |
| 3: Automated Shipping | Medium | End-to-end release pipeline with PR gates | Partially done |
| 4: Self-Improvement | Medium | Consistency checking, ADR gap detection, CI pattern analysis | Planned |
| 5: Learning & Analytics | Medium | Trend analysis, prompt effectiveness, improvement PR generation | Planned |
