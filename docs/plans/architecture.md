# Architecture: Maestria Meta-Agent

## Executive Summary

The maestria meta-agent is an Eve agent at `apps/maestria-agent/` that autonomously stewards the `@maestria/opencode` plugin and the monorepo around it. It uses Eve's built-in Telegram and GitHub channels, a sandbox-based monorepo integration, a filesystem-based learning store, and a dual-subagent architecture (reviewer + learner) to enforce the maker/checker split on its own work.

**What it does**: Maintains (runs checks, tests, builds), ships (changesets, versions, PRs, npm publish), self-improves (edits agent prompts and global rules), and self-learns (records session outcomes, analyzes patterns weekly, proposes improvements).

**Key design choices**:
- Monorepo code lives in a sandbox, not the filesystem of the deployment environment
- All changes flow through PRs — the agent never pushes directly to `main`
- Learnings persist as markdown files in `.maestria-learnings/`, git-tracked at the monorepo root
- A reviewer subagent (Claude Sonnet) validates every change; a learner subagent (Claude Opus) analyzes session patterns

## Agent Directory Structure

```
apps/maestria-agent/
├── package.json
├── tsconfig.json
├── .env.example
├── evals/
│   ├── maintenance.eval.ts
│   ├── shipping.eval.ts
│   └── self-learning.eval.ts
└── agent/
    ├── agent.ts                          # Model: anthropic/claude-opus-4.8
    ├── instructions.md                   # Core identity and rules
    ├── channels/
    │   ├── eve.ts                        # HTTP API (built-in, always available)
    │   ├── telegram.ts                   # Telegram bot via telegramChannel
    │   └── github.ts                     # GitHub App via githubChannel
    ├── tools/
    │   ├── vp_install.ts                 # Run vp install
    │   ├── vp_check.ts                   # Run vp check (fmt+lint+typecheck)
    │   ├── vp_test.ts                    # Run vp test
    │   ├── vp_build.ts                   # Run vp build
    │   ├── check_dependencies.ts         # Check outdated deps
    │   ├── read_agent.ts                 # Read agent .md with parsed frontmatter
    │   ├── read_rules.ts                 # Read global rules
    │   ├── read_changelog.ts             # Read package changelog
    │   ├── git_status.ts                 # Read-only git status
    │   ├── git_branch.ts                 # Create feature branch
    │   ├── create_changeset.ts           # Write .changeset file
    │   ├── version_packages.ts           # Run changeset version
    │   ├── publish_release.ts            # Run pnpm release (needsApproval: always)
    │   ├── create_pr.ts                  # Open GitHub PR (needsApproval: always)
    │   ├── update_agent.ts               # Edit agent .md (needsApproval: always)
    │   ├── update_rules.ts               # Edit rules/AGENTS.md (needsApproval: always)
    │   ├── propose_skill_change.ts       # Propose skill changes (needsApproval)
    │   ├── read_learnings.ts             # List and read stored learnings
    │   ├── record_learning.ts            # Write a new learning entry
    │   ├── read_session_log.ts           # Read session trace data
    │   └── propose_improvement.ts        # Create learning-based proposal
    ├── skills/
    │   ├── maintain.md                   # Maintenance diagnostic workflow
    │   ├── ship.md                       # Release workflow with approval gates
    │   ├── improve.md                    # Self-improvement workflow
    │   └── learn.md                      # Learning analysis workflow
    ├── schedules/
    │   ├── daily_check.ts                # Daily: vp install → vp check → vp test
    │   ├── weekly_dependency_audit.ts    # Weekly: check deps, report stale
    │   └── weekly_learning_review.ts     # Weekly: analyze sessions, propose improvements
    ├── subagents/
    │   ├── reviewer/                     # Reviews proposed changes (Claude Sonnet)
    │   │   ├── agent.ts
    │   │   ├── instructions.md
    │   │   └── tools/
    │   │       ├── review_diff.ts
    │   │       └── check_consistency.ts
    │   └── learner/                      # Analyzes session patterns (Claude Opus)
    │       ├── agent.ts
    │       ├── instructions.md
    │       ├── tools/
    │       │   ├── correlate_sessions.ts
    │       │   └── draft_improvement.ts
    │       └── sandbox/
    │           └── sandbox.ts
    ├── hooks/
    │   ├── session_recorder.ts           # Record session summary to learnings
    │   └── change_audit.ts              # Log all file changes
    └── sandbox/
        └── sandbox.ts                    # Clone monorepo, install deps, setup npmrc
```

## Tools Catalog

### Maintenance

| Tool | Purpose | Input Schema | Approval |
|---|---|---|---|
| `vp_install` | Run `vp install` in monorepo sandbox | None | None |
| `vp_check` | Run `vp check` (format, lint, typecheck) | None | None |
| `vp_test` | Run `vp test` (test suite) | None | None |
| `vp_build` | Run `vp run -r build` (build all packages) | None | None |
| `check_dependencies` | Run `pnpm outdated --json`, return formatted output | None | None |
| `read_agent` | Read an agent markdown file from `packages/opencode/agents/` | `{ name: string }` | None |
| `read_rules` | Read `packages/opencode/rules/AGENTS.md` | None | None |
| `read_changelog` | Read `packages/opencode/CHANGELOG.md` | None | None |

### Shipping

| Tool | Purpose | Input Schema | Approval |
|---|---|---|---|
| `git_status` | Run `git status --porcelain`, return parsed file list | None | None |
| `git_branch` | Create and switch to a feature branch | `{ name: string }` | None |
| `create_changeset` | Write a `.changeset/*.md` file | `{ summary: string, package: string, type: "patch" \| "minor" \| "major" }` | None |
| `version_packages` | Run `pnpm version-packages` (bumps versions, updates CHANGELOG) | None | None |
| `publish_release` | Run `pnpm release` (publishes to npm) | None | **Always** |
| `create_pr` | Open a GitHub PR from current branch to `main` | `{ title: string, body: string }` | **Always** |

### Improvement

| Tool | Purpose | Input Schema | Approval |
|---|---|---|---|
| `update_agent` | Write new content to an agent `.md` file | `{ name: string, content: string }` | **Always** |
| `update_rules` | Write new content to `rules/AGENTS.md` | `{ content: string }` | **Always** |
| `propose_skill_change` | Write a proposed skill change as a draft | `{ skill: string, description: string, changes: string }` | Once |

### Learning

| Tool | Purpose | Input Schema | Approval |
|---|---|---|---|
| `read_learnings` | List and read files in `.maestria-learnings/` | `{ path?: string, limit?: number }` | None |
| `record_learning` | Write a timestamped markdown file to `.maestria-learnings/sessions/` | `{ title: string, summary: string, category: "bug" \| "improvement" \| "observation" \| "process", tags?: string[] }` | None |
| `read_session_log` | Read the current session's event trace | None | None |
| `propose_improvement` | Write an insight proposal to `.maestria-learnings/insights/` | `{ title: string, problem: string, proposal: string, affectedFiles: string[], rationale: string }` | Once |

## Skills Catalog

| Skill | Purpose | Trigger Conditions |
|---|---|---|
| `maintain.md` | Runs the full maintenance pipeline: install → check → test → build. Reports pass/fail for each step. | User asks "check the project", "run maintenance", or `daily_check` schedule fires |
| `ship.md` | Guides a full release: changeset → version → reviewer gate → PR → publish. All destructive steps require human approval. | User asks "release", "publish", "ship", "cut a version" |
| `improve.md` | Analyzes agent prompts, rules, and skills for quality issues. Proposes and applies changes. | User asks "improve the agents", "update the rules", or learner proposals need action |
| `learn.md` | Delegates to the learner subagent to analyze session patterns. Reviews findings and routes proposals through the improvement pipeline. | `weekly_learning_review` schedule fires or user asks "what have you learned?", "analyze sessions" |

## Subagents Design

### Reviewer — Guardian of the Maker/Checker Split

- **Model**: `anthropic/claude-sonnet-4.6`
- **Role**: Validates every proposed change before it reaches the PR stage
- **Tools**:
  - `review_diff` — Fetches a git diff and returns structured feedback
  - `check_consistency` — Reads all agent files and global rules, flags terminology conflicts, broken cross-references, and contradictory guidance
- **Output**: A structured review with verdict (APPROVED / CHANGES_REQUESTED / COMMENT), a 1-2 sentence summary, and an array of issues with severity, file, line, description, and suggestion
- **Why Sonnet**: Review is pattern-matching — checking for known issues, consistency violations, and style deviations. Sonnet is cheaper and faster than Opus while handling this class of work well.

### Learner — The Pattern Recognition Engine

- **Model**: `anthropic/claude-opus-4.8`
- **Role**: Analyzes accumulated session learnings to find recurring failure patterns, tool misuse, prompt gaps, and improvement opportunities
- **Tools**:
  - `correlate_sessions` — Reads all session files in `.maestria-learnings/sessions/` and identifies repeated patterns
  - `draft_improvement` — Writes a structured improvement proposal to `.maestria-learnings/insights/`
- **Output**: A summary with patterns found, ranked improvement proposals, and paths to draft proposal files
- **Why Opus**: Pattern detection across unstructured session logs requires reasoning — connecting dots between seemingly unrelated failures, inferring root causes, and crafting actionable proposals. This is Opus territory.

### Subagent Integration Points

- **Shipping pipeline**: Before `create_pr`, the agent delegates to `reviewer` to validate the diff
- **Improvement pipeline**: Before `update_agent` or `update_rules`, the agent delegates to `reviewer` for a consistency check
- **Learning pipeline**: The `learn` skill delegates to `learner` for analysis, then routes proposals through `reviewer` before applying changes

## Self-Learning Mechanism

### The Loop

```
SESSION → HOOK RECORDS → .maestria-learnings/sessions/
    → LEARNER SUBAGENT analyzes patterns
    → produces: 1. structured learning 2. improvement proposal
    → REVIEWER validates → PR OPENED → HUMAN APPROVES → MERGED
```

### Storage

Everything lives under `.maestria-learnings/` at the monorepo root:

```
.maestria-learnings/
├── README.md              # Purpose: git-tracked agent learning artifacts
├── sessions/              # Raw session summaries, one file per session
│   └── 2026-06-17T06-00-00Z-daily-maintenance-pass.md
└── insights/              # Analyzed patterns and proposals from learner
    └── pattern-repeated-vp-check-format-failures.md
```

All files are markdown, git-tracked, and human-readable. No database, no binary formats.

### Recording Mechanism

The agent records learnings during the session by calling `record_learning`. The `instructions.md` tells the root agent to call this tool at the end of every substantive task. A `session_recorder` hook logs metadata on `session.completed`, but the meaningful content comes from the model itself.

### Analysis Cadence

The `weekly_learning_review` schedule (Sundays 10:00 UTC) invokes the `learn` skill, which delegates to the `learner` subagent, reviews findings, and routes viable proposals through the improvement pipeline.

## Channels

### Telegram

Built-in via `telegramChannel` from `eve/channels/telegram`. The bot receives commands and delivers scheduled reports.

- **Environment**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET_TOKEN`, `MAESTRIA_ADMIN_CHAT_ID`
- **Registration**: BotFather for token, webhook points at `https://<deployment>/eve/v1/telegram`
- **Reactive**: Responds to direct messages and inline keyboard callbacks (approval buttons)
- **Proactive**: Schedules post maintenance results and learning summaries to `MAESTRIA_ADMIN_CHAT_ID`

### GitHub

Built-in via `githubChannel` from `eve/channels/github`. The GitHub App receives PR/issue events and @mentions.

- **Environment**: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`
- **Permissions**: Issues (R/W), Pull Requests (R/W), Contents (R/W), Metadata (R)
- **Reactive**: `@maestria-agent` mentions in PR comments trigger agent responses with PR diff context
- **Push auth**: The `create_pr` tool generates an installation token in the app runtime, writes it to the sandbox as a credential helper file, and uses it for `git push`

### CLI/HTTP

Always active — the built-in Eve HTTP API. No configuration required.

- `POST /eve/v1/session` — start a session
- `GET /eve/v1/session/:id/stream` — stream responses
- Local dev TUI via `eve dev`

## Schedule Design

| Schedule | Cron | Action | Channel |
|---|---|---|---|
| `daily_check` | `0 6 * * *` | Dispatches maintenance task: "Run the full maintenance pipeline, report status" | Telegram |
| `weekly_dependency_audit` | `0 8 * * 1` | Dispatches dependency check: "Check outdated deps, flag anything >2 majors behind" | Telegram |
| `weekly_learning_review` | `0 10 * * 0` | Dispatches learning analysis: "Analyze this week's sessions, propose improvements" | Telegram |

All three schedules are independent and can run in parallel. They use Eve's `receive()` pattern to dispatch a message to the agent via the Telegram channel, which starts a new session:

```ts
import { defineSchedule } from "eve/schedules";
import telegram from "../channels/telegram.js";

export default defineSchedule({
  cron: "0 6 * * *",
  async run({ receive, waitUntil, appAuth }) {
    const chatId = process.env.MAESTRIA_ADMIN_CHAT_ID;
    waitUntil(
      receive(telegram, {
        message: "Run the full maintenance pipeline...",
        target: { chatId },
        auth: appAuth,
      }),
    );
  },
});
```

## Trade-Off Analysis

### 1. Self-Learning Storage: Filesystem vs. SQLite vs. Vector DB

**Chosen: `.maestria-learnings/` directory with markdown files**

The learning store is a directory of timestamped markdown files at the monorepo root. No database, no index, no query engine.

**Why**:
- Git-native PR review — learnings are just files in the repo, reviewable like any other change
- Zero dependencies — nothing to provision, migrate, or maintain
- Markdown aligns with the project's format
- Sufficient for the scale (tens of sessions per week, not thousands)

**Rejected alternatives**:
- **SQLite**: Binary format can't be reviewed in git PRs. Adds a build dependency. Requires schema maintenance.
- **Vector DB** (Pinecone, pgvector): Massive overkill. The learner subagent already uses an LLM for pattern recognition — semantic search adds nothing for this scale. Introduces infrastructure costs and vendor lock-in.

### 2. Monorepo Integration: Sandbox vs. Tool-Based vs. Hybrid

**Chosen: Sandbox-based execution**

The monorepo is cloned at bootstrap into `/workspace/maestria` in the sandbox. All `vp` and `git` commands run inside the sandbox's filesystem. The app runtime never touches monorepo files directly.

**Why**:
- Works identically on local dev (Docker/microsandbox) and Vercel (Firecracker microVMs)
- Eve-native pattern — sandboxes are a first-class concept in Eve
- Isolated execution — a `git` or `npm` failure in the sandbox can't affect the deployment environment
- Clean state — each session starts from a fresh sandbox, so no residual state from previous sessions

**Rejected alternatives**:
- **Tool-based** (run commands on the Vercel deployment filesystem): The deployment environment doesn't have the monorepo filesystem. `vp` and `git` commands wouldn't work without a checkout.
- **Hybrid** (some tools in sandbox, some in app runtime): Creates dual code paths — tools that work locally break on Vercel and vice versa. The full-sandbox approach avoids this entirely.

**Cost**: ~30 seconds to clone and install dependencies at bootstrap. Acceptable for an agent that runs scheduled tasks, not real-time requests.

### 3. Model Selection: Opus for Reasoning, Sonnet for Review

**Chosen**: Claude Opus 4.8 for the root agent and learner subagent, Claude Sonnet 4.6 for the reviewer subagent.

**Why**:
- **Opus for reasoning**: Prompt design, pattern detection in unstructured session logs, and crafting actionable improvement proposals require deep reasoning. These are the tasks where Opus's bigger context window and stronger analytical capability matter.
- **Sonnet for review**: Code review is mostly pattern-matching — checking for known issues, style violations, and consistency gaps. Sonnet is cheaper, faster, and handles this class of work effectively.

There's no need for a third model tier. Two models cover the spectrum: reasoning (Opus) and pattern-matching (Sonnet).

## Architecture Decision Records

These ADRs extend the project's existing record in `docs/adr/` (ADR-001 through ADR-007).

---

### ADR-008: Monorepo Integration Strategy

**Status**: Proposed

**Date**: 2026-06-17

## Context

The maestria meta-agent, living at `apps/maestria-agent/`, needs to run commands on the parent monorepo: `vp install`, `vp check`, `vp test`, `git` operations, and changeset versioning. These commands require the full monorepo filesystem — `package.json`, `pnpm-workspace.yaml`, `node_modules`, and the git working tree.

The agent deploys to Vercel. The Vercel deployment environment runs the agent's own application code; it does not have the monorepo filesystem. Running `vp check` in the deployment environment would fail because there's nothing to check.

## Decision

Use **sandbox-based execution** for all monorepo operations.

At agent bootstrap, the sandbox clones `https://github.com/agustinusnathaniel/maestria.git` into `/workspace/maestria` and runs `pnpm install`. All tools execute commands inside this sandbox via `sandbox.run({ command: "cd /workspace/maestria && ..." })`.

The sandbox backend (`defaultBackend()`) uses Firecracker microVMs on Vercel and Docker/microsandbox locally. The bootstrap step only re-runs when the `revalidationKey` changes.

## Consequences

**Positive**:
- Works identically on local dev and Vercel — no environment-specific code paths
- Isolated execution — sandbox failures can't corrupt the deployment environment
- Clean ephemeral state — each session starts from a fresh sandbox
- Eve-native — sandboxes are a first-class concept in Eve

**Negative**:
- ~30 second bootstrap cost per agent deploy (clone + install)
- Sandbox can only access GitHub for git operations and npm for publishing (no general internet access for security)
- If the GitHub repo is private, the sandbox needs an auth token for clone — the current repo is public, so this is deferred

## Alternatives Considered

**Tool-based** (run commands directly on deployment filesystem):
- Rejected because the Vercel deployment environment doesn't have the monorepo filesystem. Commands like `vp check` would have nothing to check.

**Hybrid** (some tools in sandbox, some in app runtime):
- Rejected because it creates dual code paths. A tool that works locally (filesystem access) would fail on Vercel (no filesystem). The full-sandbox approach is simpler and guarantees consistency.

---

### ADR-009: Self-Learning Storage

**Status**: Proposed

**Date**: 2026-06-17

## Context

The maestria meta-agent records session outcomes and analyzes patterns to propose self-improvements. This data needs to persist across sessions and deployments, be reviewable by humans, and integrate with the existing PR-based change workflow.

The data volume is small: tens of session summaries per week, each a few hundred bytes of markdown. Weekly analysis produces a handful of insight proposals.

## Decision

Store all learning artifacts in a `.maestria-learnings/` directory at the monorepo root, using timestamped markdown files. The directory is git-tracked and seeded into the sandbox via the monorepo clone.

**Structure**:

```
.maestria-learnings/
├── README.md              # Purpose and format docs
├── sessions/              # One file per session
└── insights/              # Analyzed patterns and proposals
```

**Format**: Each session file has a title, session ID, timestamp, category, optional tags, and a free-text summary. Insight files follow a structured format: problem, proposed change, affected files, rationale.

## Consequences

**Positive**:
- Git-native review — learnings appear in PRs like any other file change
- Zero dependencies — no database, no index, no infrastructure
- Human + agent readable — markdown is the project's native format
- Deployment-agnostic — works everywhere git works

**Negative**:
- No structured query — searching requires glob + grep or the learner subagent's LLM
- Scale ceiling — this design works for tens of sessions per week. If the agent were recording thousands of sessions daily, a database would be necessary. That scale is not anticipated.

## Alternatives Considered

**SQLite** (`maestria-learnings.db`):
- Rejected because binary files aren't git-reviewable. A PR that changes the database would show an unreadable diff. The project's workflow depends on PR review for all changes, including learnings.

**Vector DB** (Pinecone, pgvector, etc.):
- Rejected as overkill. At this data volume, the learner subagent (Claude Opus) can read all session files in one pass. Vector search would add infrastructure cost and complexity for no benefit.

---

### ADR-010: Subagent Architecture

**Status**: Proposed

**Date**: 2026-06-17

## Context

The maestria meta-agent needs two distinct capabilities that are best handled by separate sub-models:

1. **Change review**: Every proposed change (agent edits, rule updates, improvement proposals, PRs) needs validation before being shipped. The rule from `AGENTS.md` is "maker/checker split — your work is reviewed by @reviewer before it lands."

2. **Pattern analysis**: The weekly learning review requires reading unstructured session summaries, identifying recurring failures, and proposing concrete improvements. This is analytical work that benefits from a larger model.

Both capabilities involve sub-tasks that are self-contained, making them good candidates for subagent delegation.

## Decision

Create **two subagents**: a `reviewer` (Claude Sonnet 4.6) and a `learner` (Claude Opus 4.8).

The root agent delegates to these subagents at specific points in the workflow:

- **Reviewer gate**: Before creating a PR, before editing agent/rules files, before applying learner proposals
- **Learner gate**: During the weekly learning review, on user request ("analyze sessions")

The subagents have their own tools and instructions, scoped to their specific jobs. They don't share state — the parent agent passes context in the delegation message.

## Consequences

**Positive**:
- Enforces maker/checker split — the model that writes the change is not the model that reviews it
- Right-sized models — cheaper/faster Sonnet for pattern-matching review, more capable Opus for pattern-recognition analysis
- Clean separation — each subagent has focused instructions and a small tool set, reducing context bloat
- Independent iteration — subagent prompts and tools can be improved without touching the root agent

**Negative**:
- Adds two subagent configurations to maintain (instructions, tools, model version pins)
- Subagent delegation adds latency (additional API round trips)

## Alternatives Considered

**Single agent** (root agent does everything):
- Rejected because there's no maker/checker split. The rule "your work is reviewed by @reviewer before it lands" can't be satisfied if the same model generates and reviews changes.

**External review service** (separate deployment, API):
- Rejected because it adds infrastructure dependency. Eve subagents are co-deployed with the parent agent — no separate service to provision, monitor, or pay for.

## Environment Variables

```
TELEGRAM_BOT_TOKEN=            # Bot token from BotFather
TELEGRAM_WEBHOOK_SECRET_TOKEN= # Secret for webhook validation
GITHUB_APP_ID=                 # GitHub App ID
GITHUB_APP_PRIVATE_KEY=        # GitHub App private key (PEM)
GITHUB_WEBHOOK_SECRET=         # GitHub webhook secret
NPM_TOKEN=                     # npm publish token
MAESTRIA_ADMIN_CHAT_ID=        # Telegram chat ID for schedule dispatches
AI_GATEWAY_API_KEY=            # Vercel AI Gateway key
```
