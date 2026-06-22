# Implementation Plan: Maestria Meta-Agent

This plan breaks the build into seven sequential phases. Each phase has concrete deliverables, dependencies, verification criteria, and a rollback point. Phases are ordered so each unlocks the next.

**Framework**: [Flue](https://github.com/withastro/flue) — TypeScript agent framework by the Astro team, built on Pi. Deploys to GitHub Actions. Tools run directly in Node.js — no sandbox needed.

**Monorepo**: `agustinusnathaniel/maestria`, pnpm workspaces, Vite+, changesets.

**Version**: `@maestria/opencode` at **v0.4.6** (shipped on `main`). See [`VISION.md`](../VISION.md) and [`PATTERNS.md`](../PATTERNS.md) at the project root for the canonical project vision and design patterns.

## Phase 0: Existing Foundation (Shipped on `main`)

These components are already shipped on `main` and serve as the foundation for Phases 1-7. No additional work required.

- [x] **Plugin entry** — `packages/opencode/src/index.ts` with 3 hooks (`config`, `experimental.session.compacting`, `chat.message`)
- [x] **8 subagents** — `packages/opencode/agents/*.md` (orchestrator + 7 specialists)
- [x] **Global rules** — `packages/opencode/rules/AGENTS.md` injected via `input.instructions`
- [x] **Mode keyword system** — `packages/opencode/src/modes/` (fein/sonar/blitz)
- [x] **Commit authorization rules** — COMMIT PROTOCOL in orchestrator prompt
- [x] **9 ADRs** — ADR-001 through ADR-009, including ADR-008 (mode keywords) and ADR-009 (commit authorization)
- [x] **Release pipeline** — `.github/workflows/release.yml` (Changesets-based)

**Relationship to build phases:**
| Build Phase | Relation to Foundation |
|---|---|
| Phases 1-7 | Build the Flue meta-agent at `apps/maestria-agent/`, which runs alongside the existing plugin |
| Phase 3 (Shipping) | Overlaps with existing `release.yml` — Flue pipeline would replace/supplement it |
| Phase 6 (Reviewer) | The existing `reviewer.md` subagent is for interactive sessions; Flue reviewer is autonomous PR review |

## Phase 1: Scaffold + Maintenance (Foundation)

**Goal**: A working Flue agent that runs maestria maintenance commands and reports health daily via GitHub Actions.

**Relation to existing agents:** The maintenance skill reads from the 8 existing OpenCode subagents on `main` to assess project health.

**Dependencies**: None.

### Tasks

- [ ] **1.1** Scaffold Flue project at `apps/maestria-agent/`
  - Run `npx flue init --target github-actions` from `apps/maestria-agent/`
  - Creates `package.json`, `tsconfig.json`, `flue.config.ts`, `src/` scaffolding
  - Create `.env.example` with all 7 environment variables (see [Environment Variables](#environment-variables))
  - Run `pnpm install` from monorepo root to link workspace dependency

- [ ] **1.2** Configure `flue.config.ts`
  - Set `target: 'github-actions'`
  - Set `model: 'anthropic/claude-opus-4-8'`
  - Point `agents` and `workflows` to `src/agents/` and `src/workflows/`

- [ ] **1.3** Create root agent
  - `src/agents/maestria.ts`: `createAgent` with Claude Opus 4.8, `sandbox: local()`, HTTP route passthrough
  - `src/lib/base-instructions.ts`: agent identity string — role, authority model (no direct-to-main pushes), tool catalog, communication guidance
  - Reference [`VISION.md`](../VISION.md) and [`PATTERNS.md`](../PATTERNS.md) in the base instructions so the agent understands the project's vision, non-goals, and design patterns when analyzing or improving agent files
  - Register all Phase 1 tools and the `maintain` skill

- [ ] **1.4** Build maintenance tools (`src/tools/`)
  - `vp-install.ts` — `execSync('vp install', { cwd: process.cwd() })`, parse output
  - `vp-check.ts` — `execSync('vp check')`, return formatted pass/fail
  - `vp-test.ts` — `execSync('vp test')`, return formatted pass/fail
  - `vp-build.ts` — `execSync('vp run -r build')`, return build output
  - `check-dependencies.ts` — `execSync('pnpm outdated --json')`, parse and format
  - `read-agent.ts` — read agent `.md` from `packages/opencode/agents/` (input: `{ name }`). Agent files use the `yaml` library for frontmatter parsing — reading tools should use the same `yaml` library, not a custom parser.
  - `read-rules.ts` — read `packages/opencode/rules/AGENTS.md`
  - `read-changelog.ts` — read `packages/opencode/CHANGELOG.md`
  - Tools export `{ description, parameters, execute }` objects

- [ ] **1.5** Create maintenance skill
  - `src/skills/maintain.md`: install → check → test → build pipeline, report pass/fail per step
  - If a step fails: categorize error, fix if trivial, report if ambiguous

- [ ] **1.6** Create daily maintenance workflow
  - `.github/workflows/daily-check.yml`: cron `0 6 * * *`, `workflow_dispatch`, node 24, `npm install`, `npx flue run daily-check`
  - `src/workflows/daily-check.ts`: `init(maestria)` → `session.prompt('Run vp install, vp check, and vp test. Report results.')`
  - Reports via console initially; refactored to Telegram in Phase 2

- [ ] **1.7** Verify scaffold and maintenance
  - `flue connect maestria local` starts an interactive session
  - `flue run daily-check` runs the workflow and completes
  - All 8 tools are callable and return correct output
  - `maintain` skill guides the agent through the full pipeline

### Verification

- [ ] `flue connect maestria local` discovers the agent and starts a session
- [ ] All 8 maintenance tools are callable and return correct outputs
- [ ] `maintain` skill is loadable and the model follows its steps
- [ ] `flue run daily-check` completes successfully

**Rollback**: Delete `apps/maestria-agent/` and revert pnpm lockfile changes.

---

## Phase 2: Channels

**Goal**: Agent accessible via Telegram, GitHub, and local CLI.

**Dependencies**: Phase 1.

### Tasks

- [ ] **2.1** Install channel packages
  - `npm install @flue/telegram @flue/github`

- [ ] **2.2** Configure Telegram channel
  - `src/channels/telegram.ts`: `createTelegramChannel` with `botToken` from env, dispatch to maestria agent
  - Register bot via BotFather, set `TELEGRAM_BOT_TOKEN`
  - Set `MAESTRIA_ADMIN_CHAT_ID` for scheduled notifications

- [ ] **2.3** Configure GitHub channel
  - `src/channels/github.ts`: `createGitHubChannel` with GitHub App credentials
  - Create GitHub App on `agustinusnathaniel/maestria` with Issues R/W, PRs R/W, Contents R/W
  - Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`

- [ ] **2.4** Refactor daily-check workflow to report via Telegram
  - Update `src/workflows/daily-check.ts` to dispatch results through Telegram channel
  - Target `MAESTRIA_ADMIN_CHAT_ID` for the notification

- [ ] **2.5** Verify all three interaction surfaces
  - `flue connect maestria local` — local CLI session
  - Telegram bot responds to direct messages
  - GitHub `@maestria-agent` mention triggers agent response
  - `daily-check` schedule delivers results to Telegram chat

### Verification

- [ ] Local CLI: `flue connect maestria local` starts interactive session
- [ ] Telegram: bot responds to direct messages
- [ ] GitHub: `@maestria-agent` mention in PR triggers response
- [ ] `daily-check` workflow delivers results to Telegram chat

**Rollback**: Reverting channel files removes messaging surfaces but preserves maintenance capability.

---

## Phase 3: Shipping

**Goal**: Agent creates changesets, versions packages, opens PRs, and publishes to npm — with approval gates.

**Overlap with existing infrastructure:** A `release.yml` workflow already exists on `main` for Changesets-based publishing. The Flue shipping pipeline would replace or supplement it, adding an agent-driven decision layer.

**Dependencies**: Phase 1 (tools), Phase 2 (GitHub channel for PR creation).

### Tasks

- [ ] **3.1** Build shipping tools (`src/tools/`)
  - `git-status.ts` — `execSync('git status --porcelain')`, parse and return
  - `git-branch.ts` — create and switch to feature branch (input: `{ name }`)
  - `create-changeset.ts` — write `.changeset/*.md` (input: summary, package, bump type)
  - `version-packages.ts` — `execSync('pnpm version-packages')`
  - `publish-release.ts` — `execSync('pnpm release')`, gated with approval check
  - `create-pr.ts` — open GitHub PR via GitHub App installation token, gated with approval check

- [ ] **3.2** Write shipping skill
  - `src/skills/ship.md`: assess → changeset → version → review → PR → publish workflow
  - Guard rails: never push to main, never publish without approval, abort if tests fail

- [ ] **3.3** Configure git push auth
  - In GitHub Actions runner: set git `user.name` / `user.email` in the workflow step
  - `create-pr` tool: generate GitHub App installation token, configure git credential helper, push branch

- [ ] **3.4** Create release workflow (manual trigger)
  - `src/workflows/release.ts`: orchestrates the full ship pipeline
  - `.github/workflows/release.yml`: `workflow_dispatch` trigger

- [ ] **3.5** Verify full release flow end-to-end

### Verification

- [ ] All 6 shipping tools callable
- [ ] `ship` skill loadable and model follows its steps
- [ ] End-to-end: changeset → version → PR opened on GitHub
- [ ] `create-pr` and `publish-release` require human approval
- [ ] Git push works with GitHub App credential brokering

**Rollback**: Reverting shipping tools and skill removes release capability but preserves channels and maintenance.

---

## Phase 4: Self-Improvement

**Goal**: Agent reads and proposes changes to maestria agent prompts and global rules.

**Dependencies**: Phase 3 (shipping pipeline for PR creation).

### Tasks

- [ ] **4.1** Build improvement tools (`src/tools/`)
  - `update-agent.ts` — write new content to an agent `.md` file (input: `{ name, content }`), gated with approval. When parsing or modifying agent frontmatter, use the `yaml` library (not a custom parser) — this matches the implementation in `packages/opencode/src/index.ts`.
  - `update-rules.ts` — write new content to `rules/AGENTS.md` (input: `{ content }`), gated with approval
  - `propose-skill-change.ts` — write a draft skill change proposal (input: `{ skill, description, changes }`), gated with approval

- [ ] **4.2** Write improvement skill
  - `src/skills/improve.md`: analyze → diagnose → propose → apply workflow
  - Analyze: read all 8 agent files, rules, changelog, session logs
  - Diagnose: inconsistent terminology, missing skills, redundant rules, contradictions
  - Propose: draft changes with rationale per change
  - Apply: call update tools (with approval), then delegate to `ship` skill for PR

- [ ] **4.3** Integrate with shipping pipeline
  - `improve.md` references `ship.md` for the final apply step
  - All agent/rules edits go through PR, never directly to main

- [ ] **4.4** Verify agent reads an agent file, identifies a gap, proposes improvement as PR

### Verification

- [ ] `update-agent`, `update-rules`, `propose-skill-change` tools callable
- [ ] `improve` skill guides the agent through the full loop
- [ ] End-to-end: analyze agents → identify gap → propose change → PR opened with rationale
- [ ] All editing tools require human approval

**Rollback**: Reverting improvement tools and skill removes self-improvement but preserves shipping.

---

## Phase 5: Self-Learning

**Goal**: Agent records session outcomes via Durable Streams, analyzes patterns, and proposes self-improvements weekly.

**Dependencies**: Phase 4 (improvement tools for acting on proposals).

### Tasks

- [ ] **5.1** Initialize `.maestria-learnings/` at monorepo root
  - Create `README.md`, `sessions/`, `insights/` directories
  - Commit and push so the checkout in GitHub Actions picks it up

- [ ] **5.2** Configure Durable Streams
  - Flue records sessions automatically via built-in Durable Streams
  - No explicit hooks needed — session data available via `read-session-log` tool
  - Verify stream output is readable and contains session metadata

- [ ] **5.3** Build learning tools (`src/tools/`)
  - `read-learnings.ts` — list and read files in `.maestria-learnings/` (input: `{ path?, limit? }`)
  - `record-learning.ts` — write timestamped markdown to `sessions/` (input: title, summary, category, tags)
  - `read-session-log.ts` — read Durable Stream session trace
  - `propose-improvement.ts` — write insight proposal to `insights/` (input: title, problem, proposal, affectedFiles, rationale)

- [ ] **5.4** Create learner subagent
  - `src/agents/learner.ts` — `createAgent` with Claude Opus 4.8
  - Instructions: session analysis workflow — read all sessions, find patterns, draft improvements
  - Tools: `correlate-sessions.ts` (find repeated patterns), `draft-improvement.ts` (write structured proposals)

- [ ] **5.5** Write learning skill
  - `src/skills/learn.md`: delegate to learner → review findings → route proposals through `improve`
  - Add instruction to base instructions: "Call `record-learning` at the end of every substantive task"

- [ ] **5.6** Create weekly learning review schedule
  - `src/workflows/weekly-learning.ts`: `init(maestria)` → dispatch learning review
  - `.github/workflows/weekly-learning.yml`: cron `0 10 * * 0`, `workflow_dispatch`
  - Reports findings to Telegram via `MAESTRIA_ADMIN_CHAT_ID`

- [ ] **5.7** Verify session generates learning entry, weekly review produces improvement proposal

### Verification

- [ ] `.maestria-learnings/` exists in monorepo and is git-tracked
- [ ] `record-learning` writes session summaries to `sessions/`
- [ ] `read-learnings` and `read-session-log` return data
- [ ] Durable Streams capture session metadata automatically
- [ ] Learner subagent analyzes session files and drafts proposals
- [ ] `learn` skill orchestrates the learner → review → propose flow
- [ ] `weekly-learning` workflow triggers the full pipeline

**Rollback**: Reverting removes `.maestria-learnings/` and related files. Shipping and improvement remain.

---

## Phase 6: Reviewer Subagent

**Goal**: Maker/checker split enforced — all proposed changes reviewed before PR submission.

**Relation to existing reviewer:** The `@maestria/opencode` plugin already ships a `reviewer.md` subagent for interactive code review inside agent sessions. The Flue reviewer described here is a different concept — it performs autonomous PR review outside interactive sessions.

**Dependencies**: Phase 3 (shipping produces diffs), Phase 4 (improvement produces edits), Phase 5 (learning produces proposals).

### Tasks

- [ ] **6.1** Create reviewer subagent
  - `src/agents/reviewer.ts` — `createAgent` with Claude Sonnet 4.6
  - Instructions: review checklist — correctness, consistency, completeness, regression risk, style
  - Tools: `review-diff.ts` (fetch git diff, return structured review), `check-consistency.ts` (read all agents/rules, flag terminology conflicts, broken refs, contradictions)
  - Output: structured verdict (APPROVED / CHANGES_REQUESTED / COMMENT), summary, array of issues with severity, file, line, description, suggestion

- [ ] **6.2** Integrate reviewer into shipping pipeline
  - Update `ship.md`: add reviewer gate before PR creation
  - If CHANGES_REQUESTED: fix issues, re-review
  - If APPROVED or COMMENT: proceed to PR

- [ ] **6.3** Integrate reviewer into improvement pipeline
  - Update `improve.md`: add reviewer gate before applying agent/rules edits
  - `check-consistency` validates no contradictions introduced

- [ ] **6.4** Integrate reviewer into learning pipeline
  - Update `learn.md`: route learner proposals through reviewer before applying
  - Include reviewer summary in improvement PR

- [ ] **6.5** Verify any proposed change passes through reviewer before reaching PR stage

### Verification

- [ ] `reviewer` subagent callable with diff, returns structured feedback
- [ ] `check-consistency` identifies inconsistencies across agents/rules
- [ ] `ship` skill includes reviewer gate before PR
- [ ] `improve` / `learn` skills route proposals through reviewer
- [ ] Reviewer correctly distinguishes intentional patterns from issues

**Rollback**: Reviewer subagent is self-contained. Reverting removes the review gate but preserves all other functionality.

---

## Phase 7: Evals + Hardening

**Goal**: Test suites validate agent behavior. Edge cases handled. Deployment ready.

**Dependencies**: All prior phases.

### Tasks

- [ ] **7.1** Write maintenance eval
  - `evals/maintenance.eval.ts`: ask agent to run `vp-check`, verify it calls the tool and reports status

- [ ] **7.2** Write shipping eval
  - `evals/shipping.eval.ts`: ask agent to create a changeset, verify tool call and reply

- [ ] **7.3** Write self-learning eval
  - `evals/self-learning.eval.ts`: record a learning, delegate to learner, verify tools called

- [ ] **7.4** Hardening — error handling across all tools
  - All `execSync`-based tools: return `{ stdout, stderr, exitCode }`, don't throw on non-zero exit
  - `create-changeset`: validate bump type, handle missing `.changeset/` dir
  - `version-packages`: handle no changesets exist case
  - `create-pr`: handle rate limits, handle branch already has open PR
  - `publish-release`: verify `NPM_TOKEN` before attempt, handle 2FA
  - `update-agent` / `update-rules`: validate agent name exists, preserve line endings
  - `record-learning`: handle missing `.maestria-learnings/sessions/` dir
  - `read-learnings`: handle empty dir, limit file count to avoid context overflow
  - All skills: add "what to do if X fails" guidance per step

- [ ] **7.5** Create weekly dependency audit schedule
  - `src/workflows/weekly-audit.ts`: orchestrates dependency check
  - `.github/workflows/weekly-audit.yml`: cron `0 8 * * 1`, `workflow_dispatch`
  - Flags packages >2 majors behind, reports to Telegram

- [ ] **7.6** Final verification
  - Run all evals with `flue eval` (or equivalent test harness)
  - Trigger all workflows via `workflow_dispatch` and verify completion
  - Test error scenarios: missing env vars, git conflicts, npm publish failure
  - Verify all GitHub Actions workflows pass

- [ ] **7.7** Update monorepo `README.md` with meta-agent documentation

### Verification

- [ ] All three eval suites pass
- [ ] Agent handles error scenarios gracefully (returns errors, doesn't hang)
- [ ] All three GitHub Actions schedules dispatch correctly
- [ ] `flue connect maestria local` works for interactive debugging
- [ ] All `workflow_dispatch` triggers complete successfully

**Rollback**: Evals and hardening are additive. Reverting removes tests and polish but preserves all functionality.

---

## Phase Dependencies

```
Phase 1 (Scaffold + Maintenance)
  └─► Phase 2 (Channels)
        └─► Phase 3 (Shipping)
              └─► Phase 4 (Self-Improvement)
                    └─► Phase 5 (Self-Learning)
                          └─► Phase 6 (Reviewer)
                                └─► Phase 7 (Evals + Hardening)
```

Phases 6 and 5 could partially overlap (the reviewer subagent is standalone), but the integration tasks in 6.2-6.4 depend on the pipelines created in Phases 3-5. The strict ordering avoids integration rework.

## Source Directory Structure

```
apps/maestria-agent/
├── flue.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── agents/
│   │   ├── maestria.ts              # Root agent (Claude Opus 4.8)
│   │   ├── reviewer.ts              # Reviewer subagent (Claude Sonnet 4.6)
│   │   └── learner.ts               # Learner subagent (Claude Opus 4.8)
│   ├── lib/
│   │   └── base-instructions.ts     # Agent identity string
│   ├── tools/
│   │   ├── vp-install.ts
│   │   ├── vp-check.ts
│   │   ├── vp-test.ts
│   │   ├── vp-build.ts
│   │   ├── check-dependencies.ts
│   │   ├── read-agent.ts
│   │   ├── read-rules.ts
│   │   ├── read-changelog.ts
│   │   ├── git-status.ts
│   │   ├── git-branch.ts
│   │   ├── create-changeset.ts
│   │   ├── version-packages.ts
│   │   ├── publish-release.ts
│   │   ├── create-pr.ts
│   │   ├── update-agent.ts
│   │   ├── update-rules.ts
│   │   ├── propose-skill-change.ts
│   │   ├── read-learnings.ts
│   │   ├── record-learning.ts
│   │   ├── read-session-log.ts
│   │   ├── propose-improvement.ts
│   │   ├── review-diff.ts
│   │   ├── correlate-sessions.ts
│   │   ├── draft-improvement.ts
│   │   └── check-consistency.ts
│   ├── skills/
│   │   ├── maintain.md
│   │   ├── ship.md
│   │   ├── improve.md
│   │   └── learn.md
│   ├── channels/
│   │   ├── telegram.ts
│   │   └── github.ts
│   └── workflows/
│       ├── daily-check.ts
│       ├── release.ts
│       ├── weekly-learning.ts
│       └── weekly-audit.ts
├── .github/
│   └── workflows/
│       ├── daily-check.yml
│       ├── release.yml
│       ├── weekly-learning.yml
│       └── weekly-audit.yml
└── evals/
    ├── maintenance.eval.ts
    ├── shipping.eval.ts
    └── self-learning.eval.ts
```

## Key Assumptions

1. **Public GitHub repo**: `agustinusnathaniel/maestria` is public. GitHub Actions `checkout@v4` needs no auth. Git push (PR branches) uses GitHub App installation tokens.

2. **Tools run in the GitHub Actions runner**: No sandbox. `execSync` runs `vp`, `pnpm`, and `git` commands directly in the checked-out monorepo. Local development (`flue connect maestria local`) runs from the monorepo root — same filesystem, same commands.

3. **Durable Streams replace explicit hooks**: Flue records session metadata automatically. Phase 5 reads from Durable Streams rather than implementing custom `session_recorder` and `change_audit` hooks.

4. **Instructions are TypeScript strings**: Agent identity lives in `src/lib/base-instructions.ts` as an exported string. No `instructions.md` file.

5. **Flat tools directory**: All tools live in `src/tools/` — one file per tool, no subdirectories. Tools export `{ description, parameters, execute }` objects.

6. **NPM_TOKEN**: Referenced in `.env.example` and GitHub Actions secrets. The agent publishes `@maestria/opencode` using this token.

7. **All changes via PRs**: The agent never pushes directly to `main`. It creates feature branches, opens PRs, and waits for human approval.

8. **`.maestria-learnings/` at monorepo root**: Git-tracked, available in the GitHub Actions checkout. Agent commits learnings back to the repo.

9. **Deployment target is GitHub Actions**: The agent runs on schedule via `.github/workflows/*.yml`. Interactive sessions use `flue connect maestria local`. No Vercel deployment needed.

## Environment Variables

```bash
ANTHROPIC_API_KEY=           # Claude model access
TELEGRAM_BOT_TOKEN=          # Bot token from BotFather
GITHUB_APP_ID=               # GitHub App ID
GITHUB_APP_PRIVATE_KEY=      # GitHub App private key (PEM)
GITHUB_WEBHOOK_SECRET=       # GitHub webhook secret
NPM_TOKEN=                   # npm publish token
MAESTRIA_ADMIN_CHAT_ID=      # Telegram chat ID for notifications
```

All seven variables are stored as GitHub Actions secrets for scheduled workflows. For local development, they live in `.env` (git-ignored).

## Summary by Phase

| Phase                     | Effort                                   | New Files | Key Deliverable                           |
| ------------------------- | ---------------------------------------- | --------- | ----------------------------------------- |
| 0: Existing Foundation    | — (shipped)                              | —         | Already shipped on `main`                 |
| 1: Scaffold + Maintenance | Large (~8 tools, skill, workflow)        | ~13       | Agent boots, runs vp check                |
| 2: Channels               | Medium                                   | ~3        | Agent responds on Telegram, GitHub, CLI   |
| 3: Shipping               | Medium                                   | ~8        | Full release cycle with approval gates    |
| 4: Self-Improvement       | Medium                                   | ~4        | Agent edits its own prompts via PR        |
| 5: Self-Learning          | Large (tools, subagent, skill, workflow) | ~9        | Weekly learning review produces proposals |
| 6: Reviewer               | Medium                                   | ~5        | Maker/checker split enforced              |
| 7: Evals + Hardening      | Large (evals, hardening, final workflow) | ~6        | All evals pass, schedules trigger         |
