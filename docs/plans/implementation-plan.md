# Implementation Plan: Maestria Meta-Agent

This plan breaks the build into seven sequential phases. Each phase has tasks, dependencies, verification criteria, and a rollback point. Phases are ordered so that each one unlocks the next.

**Framework**: [Eve v0.11.x](https://www.npmjs.com/package/eve) — filesystem-first durable backend agents on Vercel.

**Monorepo**: `agustinusnathaniel/maestria`, pnpm workspaces, Vite+, changesets.

## Phase 1: Scaffold + Maintenance (Foundation)

**Goal**: A working Eve agent that runs maestria maintenance commands and reports health daily.

**Dependencies**: None.

### Tasks

- [ ] **1.1** Scaffold Eve agent at `apps/maestria-agent/`
  - Create `package.json` (name: `maestria-agent`, private, Eve + ai + zod deps)
  - Create `tsconfig.json` extending root, include `agent/**` and `evals/**`
  - Create `.env.example` with all 8 environment variables
  - Run `pnpm install` from monorepo root

- [ ] **1.2** Configure root agent
  - `agent/agent.ts`: defineAgent with model `anthropic/claude-opus-4.8`, compaction 0.75
  - `agent/instructions.md`: core identity, authority model (no direct-to-main pushes), tool catalog, communication guidance

- [ ] **1.3** Configure sandbox
  - `agent/sandbox/sandbox.ts`: clone monorepo at bootstrap into `/workspace/maestria`, install pnpm + Vite+, run `pnpm install`
  - Session policy: network egress limited to `github.com` and `registry.npmjs.org`
  - `revalidationKey` for cache-busting on deploy

- [ ] **1.4** Build maintenance tools
  - `vp_install.ts` — run `vp install` in sandbox
  - `vp_check.ts` — run `vp check`
  - `vp_test.ts` — run `vp test`
  - `vp_build.ts` — run `vp run -r build`
  - `check_dependencies.ts` — run `pnpm outdated --json`, parse and format
  - `read_agent.ts` — read agent `.md`, return content (input: `{ name }`)
  - `read_rules.ts` — read `rules/AGENTS.md`
  - `read_changelog.ts` — read `CHANGELOG.md`

- [ ] **1.5** Create maintenance skill
  - `agent/skills/maintain.md`: install → check → test → build pipeline, report pass/fail per step
  - If a step fails: categorize error, fix if trivial, report if ambiguous

- [ ] **1.6** Create daily health-check schedule
  - `agent/schedules/daily_check.ts`: cron `0 6 * * *`, fire-and-forget markdown form initially
  - Refactor to Telegram dispatch in Phase 2

- [ ] **1.7** Create `.env.example` (this completes the env var documentation)
- [ ] **1.8** Verify: `eve dev` starts, tools are callable, sandbox clones and runs `vp check`

### Verification

- [ ] `eve dev` starts the dev server and discovers all authored files
- [ ] All 8 maintenance tools are callable and return correct outputs
- [ ] Sandbox clones the monorepo at bootstrap and `vp install` completes
- [ ] `maintain` skill is loadable via `load_skill`
- [ ] `daily_check` schedule can be triggered via dev dispatch route and completes successfully

**Rollback**: Delete `apps/maestria-agent/` and revert pnpm lockfile changes.

---

## Phase 2: Channels

**Goal**: Agent accessible via Telegram, GitHub, and CLI/HTTP.

**Dependencies**: Phase 1.

### Tasks

- [ ] **2.1** Configure Telegram channel
  - `agent/channels/telegram.ts`: telegramChannel with bot username, media upload policy
  - Register bot via BotFather, set webhook to `https://<deployment>/eve/v1/telegram`
  - Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET_TOKEN`, `MAESTRIA_ADMIN_CHAT_ID`

- [ ] **2.2** Configure GitHub channel
  - `agent/channels/github.ts`: githubChannel with bot name, PR context config
  - Create GitHub App on `agustinusnathaniel/maestria` with Issues R/W, PRs R/W, Contents R/W
  - Set webhook to `https://<deployment>/eve/v1/github`
  - Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`

- [ ] **2.3** Document HTTP channel
  - `agent/channels/eve.ts`: eveChannel (always active, no config needed)
  - Create only if customization is needed; otherwise the default is fine

- [ ] **2.4** Refactor `daily_check` schedule to use Telegram
  - Switch from markdown form to handler form
  - Import Telegram channel, target `MAESTRIA_ADMIN_CHAT_ID`
  - Use `receive()` + `waitUntil()` pattern

- [ ] **2.5** Verify: agent responds on all three channels

### Verification

- [ ] Eve HTTP: `POST /eve/v1/session` returns `continuationToken`
- [ ] Telegram: bot responds to direct messages
- [ ] GitHub: `@maestria-agent` mention in PR triggers response with diff context
- [ ] `daily_check` schedule delivers results to Telegram chat

**Rollback**: Reverting channel files removes messaging surfaces but preserves maintenance capability.

---

## Phase 3: Shipping

**Goal**: Agent creates changesets, versions packages, opens PRs, and publishes to npm (with approval gates).

**Dependencies**: Phase 1 (tools, sandbox), Phase 2 (GitHub channel for PR creation).

### Tasks

- [ ] **3.1** Build shipping tools
  - `git_status.ts` — `git status --porcelain`, parse and return
  - `git_branch.ts` — create feature branch
  - `create_changeset.ts` — write `.changeset/*.md` (input: summary, package, bump type)
  - `version_packages.ts` — run `pnpm version-packages`
  - `publish_release.ts` — run `pnpm release`, `needsApproval: always()`
  - `create_pr.ts` — open GitHub PR, `needsApproval: always()`

- [ ] **3.2** Write shipping skill
  - `agent/skills/ship.md`: assess → changeset → version → review → PR → publish workflow
  - Guard rails: never push to main, never publish without approval, abort if tests fail

- [ ] **3.3** Configure git push auth
  - In sandbox `onSession`: set git user.name / user.email
  - In `create_pr` tool: generate GitHub App installation token, write to sandbox credential helper, push

- [ ] **3.4** Verify: full release flow end-to-end

### Verification

- [ ] All 6 shipping tools callable
- [ ] `ship` skill loadable and model follows its steps
- [ ] End-to-end: changeset → version → PR opened on GitHub
- [ ] `create_pr` and `publish_release` require human approval
- [ ] Git push from sandbox works with credential brokering

**Rollback**: Reverting shipping tools and skill removes release capability but preserves channels and maintenance.

---

## Phase 4: Self-Improvement

**Goal**: Agent reads and proposes changes to maestria agent prompts and global rules.

**Dependencies**: Phase 3 (shipping pipeline for PR creation).

### Tasks

- [ ] **4.1** Build improvement tools
  - `update_agent.ts` — write new content to agent `.md`, `needsApproval: always()`
  - `update_rules.ts` — write new content to `rules/AGENTS.md`, `needsApproval: always()`
  - `propose_skill_change.ts` — write a draft skill change proposal

- [ ] **4.2** Write improvement skill
  - `agent/skills/improve.md`: analyze → diagnose → propose → apply workflow
  - Analyze: read all 8 agent files, rules, changelog, session logs
  - Diagnose: inconsistent terminology, missing skills, redundant rules, contradictions
  - Propose: draft changes with rationale per change
  - Apply: call update tools (with approval), then delegate to `ship` skill for PR

- [ ] **4.3** Integrate with shipping pipeline
  - `improve.md` references `ship.md` for the final apply step
  - All agent/rules edits go through PR, never directly to main

- [ ] **4.4** Verify: agent reads an agent file, identifies a gap, proposes improvement as PR

### Verification

- [ ] `update_agent`, `update_rules`, `propose_skill_change` tools callable
- [ ] `improve` skill guides the agent through the full loop
- [ ] End-to-end: analyze agents → identify gap → propose change → PR opened with rationale
- [ ] All editing tools require human approval

**Rollback**: Reverting improvement tools and skill removes self-improvement but preserves shipping.

---

## Phase 5: Self-Learning

**Goal**: Agent records session outcomes, analyzes patterns, and proposes self-improvements weekly.

**Dependencies**: Phase 4 (improvement tools for acting on proposals).

### Tasks

- [ ] **5.1** Initialize `.maestria-learnings/` at monorepo root
  - Create `README.md`, `sessions/`, `insights/` directories
  - Commit and push so the sandbox's monorepo clone picks it up

- [ ] **5.2** Build learning tools
  - `read_learnings.ts` — list and read files in `.maestria-learnings/`
  - `record_learning.ts` — write timestamped markdown to `sessions/` (title, summary, category, tags)
  - `read_session_log.ts` — read current session's event trace
  - `propose_improvement.ts` — write insight proposal to `insights/`

- [ ] **5.3** Create hooks
  - `agent/hooks/session_recorder.ts` — logs session metadata on `session.completed`
  - `agent/hooks/change_audit.ts` — logs when `update_agent` / `update_rules` are called
  - Update `instructions.md` to instruct the agent: "Call `record_learning` at the end of every substantive task"

- [ ] **5.4** Create learner subagent
  - `agent/subagents/learner/agent.ts` — Claude Opus 4.8
  - `agent/subagents/learner/instructions.md` — session analysis workflow
  - `agent/subagents/learner/tools/correlate_sessions.ts` — read all sessions, find patterns
  - `agent/subagents/learner/tools/draft_improvement.ts` — write structured improvement proposals
  - `agent/subagents/learner/sandbox/sandbox.ts` — inherits default; lighter sandbox if isolation needed

- [ ] **5.5** Write learning skill
  - `agent/skills/learn.md`: delegate to learner → review findings → route proposals through `improve`

- [ ] **5.6** Create weekly learning review schedule
  - `agent/schedules/weekly_learning_review.ts`: cron `0 10 * * 0`, dispatches to Telegram

- [ ] **5.7** Verify: session generates learning entry, weekly review produces improvement proposal

### Verification

- [ ] `.maestria-learnings/` exists in monorepo and is git-tracked
- [ ] `record_learning` writes session summaries to `sessions/`
- [ ] `read_learnings` and `read_session_log` return data
- [ ] Learner subagent can analyze session files and draft proposals
- [ ] `learn` skill orchestrates the learner → review → propose flow
- [ ] `weekly_learning_review` schedule triggers the full pipeline
- [ ] `session_recorder` and `change_audit` hooks log metadata

**Rollback**: Reverting removes `.maestria-learnings/` and related files. Shipping and improvement remain.

---

## Phase 6: Reviewer Subagent

**Goal**: Maker/checker split enforced — all proposed changes reviewed before PR submission.

**Dependencies**: Phase 3 (shipping produces diffs), Phase 4 (improvement produces edits), Phase 5 (learning produces proposals).

### Tasks

- [ ] **6.1** Create reviewer subagent
  - `agent/subagents/reviewer/agent.ts` — Claude Sonnet 4.6
  - `agent/subagents/reviewer/instructions.md` — review checklist: correctness, consistency, completeness, regression risk, style
  - `agent/subagents/reviewer/tools/review_diff.ts` — fetch git diff and return structured review
  - `agent/subagents/reviewer/tools/check_consistency.ts` — read all agents/rules, flag terminology conflicts, broken refs, contradictions

- [ ] **6.2** Integrate reviewer into shipping pipeline
  - Update `ship.md`: add "Step 3.5: Review" before PR creation
  - If CHANGES_REQUESTED: fix issues, re-review
  - If APPROVED or COMMENT: proceed to PR

- [ ] **6.3** Integrate reviewer into improvement pipeline
  - Update `improve.md`: add reviewer gate before applying agent/rules edits
  - `check_consistency` validates no contradictions introduced

- [ ] **6.4** Integrate reviewer into learning pipeline
  - Update `learn.md`: route learner proposals through reviewer before applying
  - Include reviewer summary in improvement PR

- [ ] **6.5** Verify: any proposed change passes through reviewer before reaching PR stage

### Verification

- [ ] `reviewer` subagent callable with diff, returns structured feedback
- [ ] `check_consistency` identifies inconsistencies across agents/rules
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
  - `evals/maintenance.eval.ts`: ask agent to run vp_check, verify it calls the tool and reports status

- [ ] **7.2** Write shipping eval
  - `evals/shipping.eval.ts`: ask agent to create a changeset, verify tool call and reply

- [ ] **7.3** Write self-learning eval
  - `evals/self-learning.eval.ts`: record a learning, delegate to learner, verify tools called

- [ ] **7.4** Hardening — error handling
  - All sandbox-run tools: return `{ stdout, stderr, exitCode }`, don't throw on non-zero exit
  - `create_changeset`: validate bump type, handle missing `.changeset/` dir
  - `version_packages`: handle no changesets exist case
  - `create_pr`: handle rate limits, handle branch already has open PR
  - `publish_release`: verify NPM_TOKEN before attempt, handle 2FA
  - `update_agent` / `update_rules`: validate agent name exists, preserve line endings
  - `record_learning`: handle missing `.maestria-learnings/sessions/` dir
  - `read_learnings`: handle empty dir, limit file count to avoid context overflow
  - All hooks: wrap in try/catch so hook errors don't kill sessions
  - All skills: add "what to do if X fails" guidance per step

- [ ] **7.5** Create weekly dependency audit schedule
  - `agent/schedules/weekly_dependency_audit.ts`: cron `0 8 * * 1`
  - Dispatches `check_dependencies`, flags packages >2 majors behind

- [ ] **7.6** Final verification
  - Run all evals: `eve eval` passes all three
  - Run all schedules via dev dispatch routes
  - Test error scenarios: missing env vars, git conflicts, npm publish failure
  - Prepare for `vercel deploy`

- [ ] **7.7** Update monorepo `README.md` with meta-agent documentation

### Verification

- [ ] `eve eval` passes all three eval suites
- [ ] Agent handles error scenarios gracefully (returns errors, doesn't hang)
- [ ] All three schedules dispatch correctly via dev routes
- [ ] Dead-session recovery works (clean sandbox state on restart)
- [ ] Deployment ready for `vercel deploy`

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

Phases 6 and 5 could partially overlap (the reviewer subagent is standalone), but the integration tasks in 6.2-6.4 depend on the pipelines created in 3-5. The strict ordering avoids integration rework.

## Key Assumptions

1. **Public GitHub repo**: `agustinusnathaniel/maestria` is public. Git clone in sandbox requires no auth. Git push (PR branches) uses GitHub App credential brokering.

2. **Flat tool filenames**: Eve tool discovery uses path-derived naming. Tools use flat filenames (e.g., `tools/vp_install.ts` → tool `vp_install`). Subdirectory nesting is confirmed for hooks and schedules.

3. **Sandbox backend**: `defaultBackend()` — Firecracker microVMs on Vercel, Docker/microsandbox locally.

4. **`NPM_TOKEN`**: Referenced in `.env.example` for npm publish. The agent publishes `@maestria/opencode` using this token.

5. **All changes via PRs**: The agent never pushes directly to `main`. It creates feature branches, opens PRs, and waits for human approval.

6. **`.maestria-learnings/` at monorepo root**: Git-tracked, seeded into sandbox via monorepo clone. Agent commits learnings back to the repo.

## Summary by Phase

| Phase | Effort | New Files | Key Deliverable |
|---|---|---|---|
| 1: Scaffold + Maintenance | Large (~8 tools, sandbox, skill, schedule) | ~15 | Agent boots, runs vp check |
| 2: Channels | Medium | ~3 | Agent responds on Telegram, GitHub, HTTP |
| 3: Shipping | Medium | ~7 | Full release cycle with approval gates |
| 4: Self-Improvement | Medium | ~4 | Agent edits its own prompts via PR |
| 5: Self-Learning | Large (~2 tools, subagent, skill, schedule, hooks) | ~12 | Weekly learning review produces proposals |
| 6: Reviewer | Medium | ~5 | Maker/checker split enforced |
| 7: Evals + Hardening | Large (evals, hardening, final schedule) | ~6 | All evals pass, deployment ready |
