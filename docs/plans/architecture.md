# Architecture: Maestria Meta-Agent

## Executive Summary

The maestria meta-agent is a [Flue](https://flueframework.com/) agent at `apps/maestria-agent/` that autonomously stewards the `@maestria/opencode` plugin and the monorepo around it. Aligned with `@maestria/opencode` **v0.4.6** (shipped on `main`). It runs directly in the Node.js runtime — no sandbox, no clone — and uses Flue's Durable Streams for session recording, GitHub Actions for scheduling, and PR review for approval gates.

**What it does**: Maintains (runs checks, tests, builds), ships (changesets, versions, PRs, npm publish), self-improves (edits agent prompts and global rules), and self-learns (records sessions automatically via Durable Streams, analyzes patterns weekly, proposes improvements).

**Key design choices**:

- Direct execution in the monorepo — `execSync('vp check')` runs where the code lives
- Deploys as a GitHub Action with the repo already checked out
- Durable Streams replace `.maestria-learnings/` for session recording
- All changes flow through PRs — the agent never pushes directly to `main`
- A reviewer subagent (Claude Sonnet) validates every change; a learner subagent (Claude Opus) analyzes session patterns
- Ecosystem packages (`@flue/telegram`, `@flue/github`) handle channel integration
- No vendor lock-in — any LLM, any host, any deploy target
- This design aligns with maestria's design patterns in [`PATTERNS.md`](../PATTERNS.md) (Pipeline Composition, Maker/Checker Split) and fulfills the vision defined in [`VISION.md`](../VISION.md).

## What's Already Shipped

The `@maestria/opencode` plugin at **v0.4.6** (shipped on `main`) provides the foundation:

| Component                                  | Location                            | Status  |
| ------------------------------------------ | ----------------------------------- | ------- |
| Plugin entry with 3 hooks                  | `packages/opencode/src/index.ts`    | Shipped |
| 8 subagents (orchestrator + 7 specialists) | `packages/opencode/agents/*.md`     | Shipped |
| Global rules                               | `packages/opencode/rules/AGENTS.md` | Shipped |
| Mode keyword system (fein/sonar/blitz)     | `packages/opencode/src/modes/`      | Shipped |
| 9 ADRs (001-009)                           | `docs/adr/`                         | Shipped |
| Release pipeline                           | `.github/workflows/release.yml`     | Shipped |

**Relationship with this plan:** The OpenCode plugin handles interactive AI coding workflows (inside the agent session). The meta-agent described in this document is a **complementary Flue-based system** for autonomous scheduled tasks outside interactive sessions. The two systems share the same monorepo but serve different runtimes.

---

## Alignment with Maestria Project Docs

The meta-agent design explicitly maps to maestria's canonical project documents at the monorepo root.

### VISION.md

The meta-agent fulfills the maestria vision of a maintainer that "assists with maintenance, analysis, and improvement proposals." All changes flow through human review — the agent creates branches, opens PRs, and never pushes directly to `main`. This aligns with VISION.md's **curation-driven evolution** principle:

- **"No auto-extraction"** — The learner subagent analyzes Durable Streams and proposes improvements via PRs. No automated commits, no implicit learning.
- **"No telemetry"** — Durable Streams are local-only, stored within the monorepo. No network calls from session recording.
- **"No vendor lock-in"** — Built on Flue (not Eve), deployed to GitHub Actions (self-hosted), any LLM provider. See [Why Flue (Not Eve)](#why-flue-not-eve) for the full comparison.

### PATTERNS.md — Pipeline Composition

The meta-agent's phases (maintain → ship → improve → learn) follow the Pipeline Composition pattern. Each phase is a sequential stage with structured handoffs:

| Meta-Agent Phase | Pipeline Stage                                  | Purpose                               |
| ---------------- | ----------------------------------------------- | ------------------------------------- |
| Maintain         | `vp install → vp check → vp test → vp build`    | Run project checks, report health     |
| Ship             | Changeset → version → review → PR → publish     | Cut releases with approval gates      |
| Improve          | Analyze → diagnose → propose → apply            | Edit agent prompts and global rules   |
| Learn            | Session analysis → pattern detection → proposal | Self-improvement via learner subagent |

Each arrow is a handoff contract — the output of one stage is the input briefing for the next.

### PATTERNS.md — Maker/Checker Split

The reviewer subagent enforces the maker/checker split:

- **`edit: deny`** — The reviewer has no write tools. It reads diffs and returns structured feedback but cannot modify files.
- **Completions promise** — Success criteria defined before work begins. The reviewer checks the promise, not its opinion.
- **Integration** — Reviewer gates every pipeline that produces changes (shipping, improvement, learning). No change reaches a PR without passing through the reviewer first.

For the full pattern definitions, see [`PATTERNS.md`](../PATTERNS.md).

## Why Flue (Not Eve)

We evaluated two frameworks for the maestria meta-agent: **Eve** (Vercel's filesystem-first agent framework) and **Flue** (Astro team's code-first agent framework). After comparing both against our requirements — monorepo integration, deployment simplicity, and session recording — we chose Flue.

| Decision Factor     | Our Requirement                 | Flue                                 | Eve                                 |
| ------------------- | ------------------------------- | ------------------------------------ | ----------------------------------- |
| Monorepo execution  | Run `vp check` on the real repo | `execSync()` in repo directory       | Clone into sandbox (~30s bootstrap) |
| Deployment          | GitHub-native, no new platform  | GitHub Action (repo pre-checked out) | Vercel (separate platform)          |
| Session recording   | Persist across restarts         | Built-in: Durable Streams            | Custom implementation required      |
| Vendor independence | No lock-in to a single host     | Any LLM, any host                    | Vercel-required for production      |
| Auth for git push   | Push release branches           | GitHub Actions `GITHUB_TOKEN`        | GitHub App credential brokering     |

The sandbox approach alone was a dealbreaker. Eve requires cloning the entire monorepo into a sandbox at bootstrap (~30 seconds, plus git credential management). Flue runs in-process — the monorepo is already on disk. For an agent that runs scheduled maintenance multiple times a day, 30 seconds of bootstrap per run adds real friction.

The comparison table below breaks down every dimension we evaluated.

**Why this matters for the maestria vision:** Flue delivers the multi-platform independence VISION.md calls for — zero vendor lock-in (any LLM, any host), self-hosted deployment (GitHub Actions, no external infra), and all changes flowing through PRs (curation-driven evolution, not auto-commits). The framework choice is itself an implementation of maestria's principles.

## Flue Framework

Flue is a TypeScript agent framework by the Astro team (Fred K. Schott). It reached 1.0 Beta in June 2026.

**Architecture**: Flue is built on [Pi](https://pi.dev), an open-source minimal terminal coding harness by Earendil Inc. (Mario Zechner). Pi and Claude Code share the same harness-driven architecture pattern — architectural convergence, not shared code. Pi is not the engine inside Claude Code.

**Key concepts**:

| Concept             | Description                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agents**          | Autonomous, stateful. Defined with `createAgent(() => ({ model, tools, skills, instructions }))`. Run in-process — no sandbox required.     |
| **Workflows**       | Deterministic, code-guided operations. `export async function run({ init, payload }) { ... }`. Entry points for scheduled tasks.            |
| **Channels**        | Connect via ecosystem packages: `@flue/slack`, `@flue/github`, `@flue/telegram`, `@flue/discord`, `@flue/linear`. Use `dispatch()` pattern. |
| **Skills**          | Markdown files imported with `import skill from './SKILL.md' with { type: 'skill' }`. Works like Vite's asset imports.                      |
| **Durable Streams** | Append-only log for all sessions. Built-in recovery on restart. Replaces our custom `.maestria-learnings/` directory.                       |
| **Deploy targets**  | Node.js, Cloudflare Workers, GitHub Actions, Render, Fly.io, Docker, AWS, SST, Railway                                                      |
| **Observability**   | OpenTelemetry, Braintrust, Sentry                                                                                                           |
| **CLI**             | `flue connect <agent> local` for interactive TUI, `flue run <workflow>` for workflows, `flue dev` for dev server                            |
| **Limitations**     | No built-in cron (we use GitHub Actions). No built-in approval gates (we use PR review).                                                    |

**Source layouts**: `.flue/`, `src/`, or root. We use `src/`.

**Relevant packages**:

- `@flue/runtime` — core agent runtime
- `@flue/cli` — CLI for dev, connect, run
- `@flue/slack` — Slack channel
- `@flue/github` — GitHub channel
- `@flue/telegram` — Telegram channel

## Flue Project Structure

```
apps/maestria-agent/
├── flue.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── agents/
│   │   └── maestria.ts              # The autonomous meta-agent
│   ├── workflows/
│   │   ├── daily-check.ts           # vp install → vp check → vp test
│   │   ├── weekly-audit.ts          # Dependency audit
│   │   └── weekly-learning.ts       # Analyze sessions, propose improvements
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
│   │   └── propose-improvement.ts
│   ├── channels/
│   │   ├── telegram.ts              # @flue/telegram
│   │   └── github.ts                # @flue/github
│   ├── skills/
│   │   ├── maintain.md
│   │   ├── ship.md
│   │   └── learn.md
│   └── lib/
│       ├── internal-api.ts          # Shared utilities
│       └── base-instructions.ts     # Agent identity
├── .github/
│   └── workflows/
│       ├── daily-check.yml
│       ├── weekly-audit.yml
│       └── weekly-learning.yml
└── evals/
    ├── maintenance.eval.ts
    ├── shipping.eval.ts
    └── self-learning.eval.ts
```

## Agent Definition

The root agent lives at `src/agents/maestria.ts`. It uses Flue's `createAgent` with the `src/` source layout:

```ts
import { createAgent } from "@flue/runtime";
import { telegram } from "@flue/telegram";
import { github } from "@flue/github";

import maintainSkill from "../skills/maintain.md" with { type: "skill" };
import shipSkill from "../skills/ship.md" with { type: "skill" };
import learnSkill from "../skills/learn.md" with { type: "skill" };

import { vpInstall } from "../tools/vp-install";
import { vpCheck } from "../tools/vp-check";
// ... all other tool imports
import { baseInstructions } from "../lib/base-instructions";

export default createAgent(() => ({
  model: "anthropic/claude-opus-4-8",
  instructions: baseInstructions,
  skills: [maintainSkill, shipSkill, learnSkill],
  tools: [
    vpInstall,
    vpCheck,
    vpTest,
    vpBuild,
    checkDependencies,
    readAgent,
    readRules,
    readChangelog,
    gitStatus,
    gitBranch,
    createChangeset,
    versionPackages,
    publishRelease,
    createPr,
    updateAgent,
    updateRules,
    proposeSkillChange,
    readLearnings,
    recordLearning,
    readSessionLog,
    proposeImprovement,
  ],
  channels: [telegram, github],
}));
```

Instructions are TypeScript strings, not Markdown files. The `base-instructions.ts` file exports the identity, authority model, and tool usage guidance. This keeps instructions co-located with the code that defines the agent, making them easier to type-check and refactor.

## Tools Catalog

All tools run `execSync` directly in the monorepo directory. No sandbox indirection — the repo is already checked out on disk (GitHub Actions) or at the developer's working directory (local `flue dev`).

### Maintenance

| Tool                 | Purpose                                                 | Input              | Approval |
| -------------------- | ------------------------------------------------------- | ------------------ | -------- |
| `vp_install`         | Run `vp install`                                        | None               | None     |
| `vp_check`           | Run `vp check` (format, lint, typecheck)                | None               | None     |
| `vp_test`            | Run `vp test`                                           | None               | None     |
| `vp_build`           | Run `vp run -r build`                                   | None               | None     |
| `check_dependencies` | Run `pnpm outdated --json`, format output               | None               | None     |
| `read_agent`         | Read an agent markdown from `packages/opencode/agents/` | `{ name: string }` | None     |
| `read_rules`         | Read `packages/opencode/rules/AGENTS.md`                | None               | None     |
| `read_changelog`     | Read `packages/opencode/CHANGELOG.md`                   | None               | None     |

### Shipping

| Tool               | Purpose                                          | Input                                                                       | Approval |
| ------------------ | ------------------------------------------------ | --------------------------------------------------------------------------- | -------- |
| `git_status`       | Run `git status --porcelain`, return parsed list | None                                                                        | None     |
| `git_branch`       | Create and switch to a feature branch            | `{ name: string }`                                                          | None     |
| `create_changeset` | Write a `.changeset/*.md` file                   | `{ summary: string, package: string, type: "patch" \| "minor" \| "major" }` | None     |
| `version_packages` | Run `pnpm version-packages`                      | None                                                                        | None     |
| `publish_release`  | Run `pnpm release` (publishes to npm)            | None                                                                        | **Once** |
| `create_pr`        | Open a GitHub PR from feature branch to `main`   | `{ title: string, body: string }`                                           | **Once** |

### Improvement

| Tool                   | Purpose                                  | Input                                                     | Approval |
| ---------------------- | ---------------------------------------- | --------------------------------------------------------- | -------- |
| `update_agent`         | Write new content to an agent `.md` file | `{ name: string, content: string }`                       | **Once** |
| `update_rules`         | Write new content to `rules/AGENTS.md`   | `{ content: string }`                                     | **Once** |
| `propose_skill_change` | Write a proposed skill change as a draft | `{ skill: string, description: string, changes: string }` | Once     |

### Learning

| Tool                  | Purpose                                                    | Input                                                                                                                 | Approval |
| --------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| `read_session_log`    | Read current session's Durable Stream events               | None                                                                                                                  | None     |
| `read_learnings`      | Query past sessions from Durable Streams                   | `{ path?: string, limit?: number }`                                                                                   | None     |
| `record_learning`     | Write a structured observation to a database or filesystem | `{ title: string, summary: string, category: "bug" \| "improvement" \| "observation" \| "process", tags?: string[] }` | None     |
| `propose_improvement` | Write an insight proposal                                  | `{ title: string, problem: string, proposal: string, affectedFiles: string[], rationale: string }`                    | Once     |

## Skills Catalog

| Skill         | Purpose                                                                                                                                                     | Trigger Conditions                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `maintain.md` | Runs the full maintenance pipeline: install → check → test → build. Reports pass/fail for each step.                                                        | User asks "check the project", "run maintenance", or `daily-check` workflow fires          |
| `ship.md`     | Guides a full release: changeset → version → reviewer gate → PR → publish. Destructive steps require human approval.                                        | User asks "release", "publish", "ship", "cut a version"                                    |
| `learn.md`    | Delegates to the learner subagent to analyze session patterns from Durable Streams. Reviews findings and routes proposals through the improvement pipeline. | `weekly-learning` workflow fires or user asks "what have you learned?", "analyze sessions" |

## Subagents Design

The dual subagent architecture is the same concept as the Eve-based design, adapted to Flue's agent composition model. Subagents are defined as Flue agents and composed into the root agent or invoked as child tasks.

### Reviewer — Guardian of the Maker/Checker Split

- **Model**: `anthropic/claude-sonnet-4.6`
- **Role**: Validates every proposed change before it reaches the PR stage
- **Tools**:
  - `review_diff` — Fetches a git diff and returns structured feedback
  - `check_consistency` — Reads all agent files and global rules, flags terminology conflicts, broken cross-references, and contradictory guidance
- **Output**: A structured review with verdict (`APPROVED` / `CHANGES_REQUESTED` / `COMMENT`), a 1-2 sentence summary, and an array of issues with severity, file, line, description, and suggestion
- **Why Sonnet**: Review is pattern-matching — checking for known issues, consistency violations, and style deviations. Sonnet is cheaper and faster than Opus while handling this class of work well.

### Learner — The Pattern Recognition Engine

- **Model**: `anthropic/claude-opus-4.8`
- **Role**: Analyzes accumulated session data from Durable Streams to find recurring failure patterns, tool misuse, prompt gaps, and improvement opportunities
- **Tools**:
  - `correlate_sessions` — Reads session data from Durable Streams and identifies repeated patterns
  - `draft_improvement` — Writes a structured improvement proposal
- **Output**: A summary with patterns found, ranked improvement proposals, and paths to draft proposal files
- **Why Opus**: Pattern detection across unstructured session logs requires reasoning — connecting dots between seemingly unrelated failures, inferring root causes, and crafting actionable proposals. This is Opus territory.

### Subagent Integration Points

- **Shipping pipeline**: Before `create_pr`, the agent delegates to `reviewer` to validate the diff
- **Improvement pipeline**: Before `update_agent` or `update_rules`, the agent delegates to `reviewer` for a consistency check
- **Learning pipeline**: The `learn` skill delegates to `learner` for analysis, then routes proposals through `reviewer` before applying changes

## Self-Learning Mechanism

### The Loop

```
SESSION → DURABLE STREAMS (automatic, append-only)
    → LEARNER SUBAGENT analyzes patterns from stream data
    → produces: 1. structured learning 2. improvement proposal
    → REVIEWER validates → PR OPENED → HUMAN APPROVES → MERGED
```

### Durable Streams (Session Recording)

Flue records every session to an append-only log — Durable Streams. No hooks to configure, no timers to set. The stream captures the full event trace: tool calls, model responses, errors, and completions.

On restart (after a deploy or crash), Flue reads the stream and recovers agent state. This means the agent never loses context between sessions — it picks up where it left off.

### Structured Learning Storage

Durable Streams handle session recording. For structured observations — the kind a human might want to search or review — we optionally back the `read_learnings` and `record_learning` tools with a database adapter (Postgres, SQLite, or filesystem). The default uses markdown files in `.maestria-learnings/` at the monorepo root, git-tracked for PR reviewability.

```
.maestria-learnings/
├── README.md              # Purpose: git-tracked agent learning artifacts
├── sessions/              # Structured session summaries (optional, complementing Durable Streams)
└── insights/              # Analyzed patterns and proposals from learner
```

If Durable Streams provide enough queryable data for the weekly analysis, the filesystem store can be dropped entirely. We start with both and prune what's redundant.

### Analysis Cadence

The `weekly-learning` GitHub Actions workflow (Sundays 10:00 UTC) triggers `flue run weekly-learning`, which invokes the `learn` skill, delegates to the `learner` subagent, reviews findings, and routes viable proposals through the improvement pipeline.

## Channels

### Telegram

Via `@flue/telegram`. The bot receives commands and delivers scheduled reports.

- **Environment**: `TELEGRAM_BOT_TOKEN`, `MAESTRIA_ADMIN_CHAT_ID`
- **Registration**: BotFather for token
- **Reactive**: Responds to direct messages
- **Proactive**: Workflows post maintenance results and learning summaries to `MAESTRIA_ADMIN_CHAT_ID`

### GitHub

Via `@flue/github`. The agent responds to PR/issue events and @mentions.

- **Environment**: `GITHUB_TOKEN` (provided automatically by GitHub Actions)
- **Permissions**: Issues (R/W), Pull Requests (R/W), Contents (R/W), Metadata (R)
- **Reactive**: `@maestria-agent` mentions in PR comments trigger agent responses with PR diff context
- **Push auth**: `GITHUB_TOKEN` is available in the Actions runtime — no credential brokering needed, unlike sandbox-based approaches

### CLI

Via `flue connect maestria local`. Interactive TUI for local development. No configuration required.

## Schedule Design

Flue has no built-in cron. We use GitHub Actions scheduled workflows to trigger Flue workflows:

A `release.yml` workflow already exists on `main` for Changesets-based publishing. The 3 planned workflows below are additions that complement the existing release pipeline.

| GitHub Action         | Cron         | Triggers                                      | Reports to |
| --------------------- | ------------ | --------------------------------------------- | ---------- |
| `daily-check.yml`     | `0 6 * * *`  | `flue run daily-check` → maintenance pipeline | Telegram   |
| `weekly-audit.yml`    | `0 8 * * 1`  | `flue run weekly-audit` → dependency check    | Telegram   |
| `weekly-learning.yml` | `0 10 * * 0` | `flue run weekly-learning` → session analysis | Telegram   |

Each workflow is a thin shell around `flue run <workflow>`:

```yaml
# .github/workflows/daily-check.yml
name: Daily Check
on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch: # Manual trigger for testing
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
      - run: pnpm install
      - run: pnpm flue run daily-check
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          MAESTRIA_ADMIN_CHAT_ID: ${{ secrets.MAESTRIA_ADMIN_CHAT_ID }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

All three workflows are independent and can run in parallel. The `workflow_dispatch` trigger lets us test scheduling manually.

## Eve vs Flue: Full Comparison

This table documents our evaluation of both frameworks across every dimension relevant to the maestria meta-agent.

| Dimension                | Flue                                                                                   | Eve                                                      |
| ------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Philosophy**           | Code-first — TypeScript modules with explicit composition                              | Filesystem-first — directory IS the definition           |
| **Runtime**              | Pi harness + Durable Streams                                                           | Vercel Workflow SDK                                      |
| **Deploy targets**       | Node.js, Cloudflare Workers, GitHub Actions, Render, Fly.io, Docker, AWS, SST, Railway | Vercel (primary)                                         |
| **Vendor lock-in**       | Zero — any LLM, any host                                                               | Requires Vercel for production                           |
| **Cron/schedules**       | External: GitHub Actions workflows                                                     | Built-in: `schedules/*.ts`                               |
| **Telegram channel**     | `@flue/telegram` ecosystem package                                                     | Built-in: `telegramChannel` from `eve/channels/telegram` |
| **GitHub channel**       | `@flue/github` ecosystem package                                                       | Built-in: `githubChannel` from `eve/channels/github`     |
| **Tool definition**      | Explicit: imports in `createAgent()`                                                   | Auto-discovered: one file = one tool                     |
| **Subagents**            | Explicit: composed in code                                                             | Declarative: `subagents/` directory                      |
| **Session recording**    | Built-in: Durable Streams                                                              | Custom implementation needed                             |
| **Learning storage**     | Database adapters (Postgres, SQLite, etc.) or filesystem                               | Filesystem (`.maestria-learnings/`)                      |
| **Approval gates**       | PR review as approval mechanism                                                        | First-class: `needsApproval` with inline UI              |
| **Evals**                | External (Braintrust, custom)                                                          | Built-in test suites                                     |
| **Maturity**             | 1.0 Beta (June 2026)                                                                   | Beta (June 2026)                                         |
| **Monorepo integration** | Direct: `execSync()` in repo directory                                                 | Sandbox clone (~30s bootstrap)                           |
| **Git push auth**        | `GITHUB_TOKEN` in Actions runtime                                                      | GitHub App credential brokering                          |
| **Local dev**            | `flue dev` + `flue connect`                                                            | `eve dev`                                                |
| **Built by**             | Astro team (Fred K. Schott)                                                            | Vercel (Next.js team)                                    |

## Reference Project: personal-agent-template

We studied the official Eve reference project at [vercel-labs/personal-agent-template](https://github.com/vercel-labs/personal-agent-template) to understand Eve's patterns before making the comparison. Key findings that influenced our decision:

- **Two-service Vercel deployment** via `vercel.json` with `experimentalServices` — adds deployment complexity
- **Instructions as TypeScript** — uses `defineDynamic` + `session.started` hooks for dynamic context injection. Flue does this natively with TypeScript instruction strings.
- **Flat tools**: Tools live directly in `agent/tools/` — no subdirectories. Flue's explicit import model makes this even simpler.
- **Approval pattern**: `import { always } from "eve/tools/approval"` — canonical import. We replicate this conceptually with PR review gates in Flue.
- **Internal API pattern**: Agent → HTTP Bearer token → Nuxt API for database access. Flue avoids this indirection by running in-process.
- **Connections**: MCP via `defineMcpClientConnection` with Vercel Connect for auth
- **Package.json imports alias**: `"#*": "./agent/*"` for cleaner relative imports
- **No schedules or subagents** in that template — simpler agent pattern than what we need

## Trade-Off Analysis

### 1. Runtime: Direct Execution vs. Sandbox

**Chosen: Direct execution in the Node.js runtime.**

All `vp` and `git` commands run via `execSync` in the current working directory. The monorepo is already checked out — on disk in GitHub Actions, or at the developer's working directory during local development.

**Why**:

- Zero bootstrap time — no clone, no install on every run
- Identical behavior in dev and CI — same filesystem, same `node_modules`
- No credential brokering for git push — `GITHUB_TOKEN` is in the environment
- Simpler mental model — tools run where you'd expect them to run

**Rejected**: Sandbox-based execution (Eve's model). ~30 seconds per run to clone and install. Requires maintaining a separate sandbox configuration. Git operations need credential brokering between the app runtime and sandbox. The isolation benefit isn't worth the complexity for a single-repo agent.

### 2. Session Recording: Durable Streams vs. Filesystem

**Chosen: Durable Streams (Flue built-in) with optional structured storage.**

Flue records every session to an append-only log automatically. No hooks to write, no timers to miss. On restart, the agent reads the stream and recovers state.

For structured observations that a human might want to browse or search, we optionally maintain `.maestria-learnings/` as git-tracked markdown files. If Durable Streams prove sufficient for the weekly analysis, we drop the filesystem store.

**Why**:

- Zero implementation — Durable Streams come with Flue
- Crash recovery — stream replays on restart
- Complete trace — every tool call, model response, and error is captured
- The structured store (`.maestria-learnings/`) adds human-readability when needed

**Rejected**: Filesystem-only (the original Eve plan). Requires hooks, recording discipline in instructions, and manual session summary writing. Durable Streams give us all of this for free.

### 3. Model Selection: Opus for Reasoning, Sonnet for Review

**Chosen**: Claude Opus 4.8 for the root agent and learner subagent, Claude Sonnet 4.6 for the reviewer subagent.

**Why**:

- **Opus for reasoning**: Prompt design, pattern detection in unstructured session logs, and crafting actionable improvement proposals require deep reasoning. Opus's bigger context window and stronger analytical capability matter here.
- **Sonnet for review**: Code review is mostly pattern-matching — checking for known issues, style violations, and consistency gaps. Sonnet is cheaper, faster, and handles this class of work effectively.

Two models cover the spectrum: reasoning (Opus) and pattern-matching (Sonnet).

### 4. Scheduling: GitHub Actions vs. Built-in Cron

**Chosen: GitHub Actions scheduled workflows.**

Flue has no built-in cron. We define three GitHub Actions workflows with `schedule` triggers that invoke `flue run <workflow>`. Each workflow checks out the repo, installs dependencies, and dispatches the Flue workflow.

**Why**:

- Already in the deployment target — no new infrastructure
- `workflow_dispatch` gives us manual trigger for testing
- Same runtime as the agent — the workflow runs in the same GitHub Actions environment
- Secrets management via GitHub Secrets — no separate secret store

**Rejected**: External cron service (adds infrastructure), Eve's built-in schedules (requires framework change).

## Architecture Decision Records

These ADRs extend the project's decision record in `docs/adr/` (ADR-001 through ADR-009). ADR-008 (mode keywords) and ADR-009 (commit authorization) are **Accepted** and already shipped on `main`.

---

### ADR-011: Framework Selection — Flue over Eve

**Status**: Proposed

**Date**: 2026-06-18

## Context

The maestria meta-agent needs a framework to host its agent logic, tools, channels, and scheduling. The agent lives at `apps/maestria-agent/` within the monorepo and needs to:

1. Run maintenance commands (`vp check`, `vp test`, `vp build`) on the monorepo
2. Execute git operations (branch, commit, push) for releases
3. Deploy to GitHub Actions — not a separate platform
4. Record sessions for self-learning analysis
5. Connect to Telegram and GitHub channels

Two frameworks were evaluated: **Eve** (Vercel, filesystem-first, sandbox-based) and **Flue** (Astro team, code-first, direct execution).

## Decision

Use **Flue** as the agent framework.

Flue runs agents directly in the Node.js runtime. The monorepo is already on disk — no sandbox clone at bootstrap. It deploys as a GitHub Action with the repo pre-checked out. Durable Streams handle session recording without custom implementation.

## Consequences

**Positive**:

- `execSync('vp check')` runs instantly — no 30-second sandbox bootstrap
- GitHub Actions deployment — no new platform to manage
- Durable Streams give us session recording for free
- Zero vendor lock-in — any LLM, any host
- `@flue/telegram` and `@flue/github` ecosystem packages cover our channel needs
- Explicit tool composition in TypeScript (not directory auto-discovery) matches our preferences

**Negative**:

- No built-in cron — we add GitHub Actions scheduled workflows
- No built-in approval gates — we use PR review instead
- Flue is newer than Eve (1.0 Beta, same timeframe)
- Pi (Flue's runtime) is an additional dependency to understand
- Smaller ecosystem than Eve at this stage

## Alternatives Considered

**Eve** (Vercel's agent framework):

- Rejected primarily for sandbox overhead. Cloning the monorepo at bootstrap adds ~30 seconds to every session. For an agent that runs scheduled maintenance daily, this is real friction.
- Vercel-only deployment locks us into a platform. The maestria monorepo is already on GitHub — deploying to GitHub Actions keeps everything in one place.
- Eve's `needsApproval` and built-in schedules are nice, but we can replicate both with PR review and GitHub Actions.

---

### ADR-012: Scheduling via GitHub Actions

**Status**: Proposed

**Date**: 2026-06-18

## Context

The maestria meta-agent needs scheduled execution for daily maintenance, weekly dependency audits, and weekly learning reviews. Flue has no built-in cron mechanism. We need to trigger Flue workflows on a schedule.

## Decision

Use **GitHub Actions scheduled workflows** to invoke `flue run <workflow>`.

Three workflows run on cron schedules:

- `daily-check.yml` — `0 6 * * *` (daily at 06:00 UTC)
- `weekly-audit.yml` — `0 8 * * 1` (Mondays at 08:00 UTC)
- `weekly-learning.yml` — `0 10 * * 0` (Sundays at 10:00 UTC)

Each workflow checks out the repo, installs dependencies via pnpm, and runs the corresponding Flue workflow. Secrets are managed through GitHub Secrets.

## Consequences

**Positive**:

- No additional infrastructure — GitHub Actions is the deployment target
- `workflow_dispatch` gives us manual trigger for testing
- Secrets management via GitHub Secrets
- Workflow logs visible in GitHub Actions UI
- Free for public repos (within usage limits — our schedule is low-frequency)

**Negative**:

- Scheduled workflows can be delayed during high GitHub Actions load (rare, acceptable)
- Three workflow YAML files to maintain
- No "fire on agent event" scheduling — only time-based. Not needed for our use case.

## Alternatives Considered

**External cron service** (cron-job.org, healthchecks.io, etc.):

- Rejected because it adds an external dependency. GitHub Actions already provides scheduling. An external service would need to reach the agent via HTTP, adding a network hop and an auth surface.

**Eve's built-in schedules**:

- Rejected because it requires using Eve as the framework. The scheduling feature alone doesn't justify the framework tradeoffs from ADR-011.

---

### ADR-013: Approval via PR Review

**Status**: Proposed

**Date**: 2026-06-18

## Context

The maestria meta-agent makes changes to the codebase: agent prompt edits, global rule updates, npm publishes, and self-improvement proposals. Every change needs a human approval gate. The rule from `AGENTS.md` is "maker/checker split — your work is reviewed by @reviewer before it lands."

Eve provides `needsApproval` as a first-class concept with inline UI. Flue has no built-in approval mechanism. We need a way to enforce that no change reaches `main` without human review.

## Decision

Use **PR review as the approval mechanism** for all agent-proposed changes.

The agent workflow for any change:

1. Agent creates a feature branch
2. Agent makes changes (edit prompts, update rules, bump versions, etc.)
3. Agent delegates to reviewer subagent for automated validation
4. Agent opens a PR against `main` (using `create_pr` tool)
5. Human reviews the PR diff, comments, approves, or requests changes
6. On human approval, the PR is merged

The agent never pushes directly to `main`. The `publish_release` tool only runs after a PR is merged (human must initiate or approve the publish command).

## Consequences

**Positive**:

- Git-native — approval is a PR review, which every developer already understands
- Full diff visibility — the human sees exactly what changed
- Reviewer subagent catches issues before human review, reducing review burden
- No custom approval UI to build or maintain
- Works across channels — Telegram can notify about PRs, GitHub handles the review

**Negative**:

- No inline approval buttons in Telegram — human must click through to GitHub
- PR creation adds latency (seconds, acceptable for non-real-time workflows)
- Requires the human to check GitHub for pending PRs (mitigated by Telegram notifications)

## Alternatives Considered

**Custom approval webhook** with Telegram inline buttons:

- Rejected as over-engineering. Building a webhook endpoint that receives button callbacks from Telegram and routes them to the agent's approval flow adds a custom code path. PR review is simpler, more robust, and already understood by the maintainer.

**Eve's `needsApproval`**:

- Rejected because it requires switching to Eve. The approval feature alone doesn't justify the framework tradeoffs from ADR-011.

## Environment Variables

```
# LLM
ANTHROPIC_API_KEY=              # Anthropic API key for Claude access

# Telegram (@flue/telegram)
TELEGRAM_BOT_TOKEN=             # Bot token from BotFather
MAESTRIA_ADMIN_CHAT_ID=         # Telegram chat ID for schedule dispatches

# GitHub (@flue/github)
GITHUB_TOKEN=                   # Provided automatically by GitHub Actions

# npm publish
NPM_TOKEN=                      # npm publish token for @maestria/opencode
```

All secrets are stored in GitHub Secrets and injected into the Actions runtime. The `GITHUB_TOKEN` is provided automatically by GitHub Actions — no manual configuration needed.

## References

### Flue

- Flue homepage: <https://flueframework.com/>
- Flue quickstart: <https://flueframework.com/docs/getting-started/quickstart/>
- Flue 1.0 Beta announcement: <https://flueframework.com/blog/flue-1-0-beta/>
- Flue start guide: <https://flueframework.com/start.md>
- Flue GitHub: <https://github.com/withastro/flue>

### Pi (Flue's runtime)

- Pi homepage: <https://pi.dev>
- Pi docs: <https://pi.dev/docs/latest>
- Pi GitHub: <https://github.com/earendil-works/pi>

### Eve (evaluated, not chosen)

- Eve homepage: <https://vercel.com/eve>
- Eve introduction blog: <https://vercel.com/blog/introducing-eve>
- Agent Stack blog: <https://vercel.com/blog/agent-stack>
- Eve docs: <https://eve.dev/docs/introduction>
- Eve GitHub: <https://github.com/vercel/eve>
- Reference project: <https://github.com/vercel-labs/personal-agent-template>

### maestria

- maestria GitHub: <https://github.com/agustinusnathaniel/maestria>
