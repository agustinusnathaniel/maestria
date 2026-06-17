# Global Agent Rules — @maestria/opencode

## Orchestration

- **!!! Don't assume** — verify against actual code and docs.
  Guesses lead to bugs.
- **!!! Read the docs first** — before writing code that touches
  unfamiliar tools, APIs, or migration paths, consult official
  documentation. Don't guess at API changes. This rule is scar
  tissue from repeated failures, not a preference.
- **Don't reference internal project names in explanations** — avoid
  leaking context outside the workspace.
- **Use `opensrc` for repos; `webfetch` for pages** — when analyzing a
  GitHub/GitLab/BitBucket repo or any multi-file code reference, run
  `opensrc path <owner/repo>` (e.g. `opensrc path facebook/react`).
  It clones to a global cache and prints a path that `read`/`glob`/`grep`
  can use directly. For a single file, a specific page, or a known
  URL, `webfetch` is fine. Don't fetch an entire repo one file at a
  time — clone it once, then read locally. Use `--cwd` to resolve
  versions from the current project.

## Delegation

When delegating work via `task()`, use only the 7 specialists below.
**Never delegate to `explore` or `general`** — they are built-in agents,
not part of the pipeline.

| Agent         | Role                                             | When to Delegate                                                                             |
| ------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `@adventurer` | Codebase reconnaissance, deep code understanding | Understanding unfamiliar code, tracing dependencies, gathering context before implementation |
| `@architect`  | Architecture decisions, trade-off analysis, ADRs | Choosing between approaches, technology evaluation                                           |
| `@builder`    | Focused implementation, single-task execution    | Feature work, bug fixes, test writing, refactors                                             |
| `@diagnose`   | Systematic bug tracing, root cause analysis      | Debugging regressions, production incidents, cryptic errors                                  |
| `@planner`    | Implementation plans with phased milestones      | Complex features requiring structured execution                                              |
| `@reviewer`   | Code review with quality gates                   | Pre-merge review, security audit, post-implementation QA                                     |
| `@writer`     | Documentation following structured patterns      | READMEs, API docs, changelogs, ADR transcription                                             |

## Context Management

- **Progressive disclosure** — start high-level, get specific as needed.
- **State checkpointing** — periodically summarize what's done, what's
  in progress, what's next.
- **Context pruning** — remove irrelevant context when no longer needed.
- **Completion promises** — define success criteria before starting work.
  "This task is complete when [verifiable conditions]."

## Web Platform Patterns

- **Responsive dialogs** — switch between side-sheet (desktop, ≥640px) and bottom drawer (mobile). Maps to platform conventions: mobile users expect bottom-sheet gestures, desktop users expect side panels.
- **Responsive skeletons** — skeleton layouts must mirror the actual content layout per breakpoint (table skeleton for desktop, card skeleton for mobile). A mismatched skeleton is worse than no skeleton.
- **Error boundaries with observability** — always-on global error handlers (window.onerror, unhandledrejection), lazy-loaded SDK (Sentry) on DSN config. Show recovery UI, never raw errors in production.
- **Security header validation** — single TypeScript source of truth, validated in CI across all deployment targets (Vercel, Netlify, Cloudflare headers). Prevents silent config drift.
- **Modern bundler over manual chunks** — trust Rolldown's built-in code splitting. Manual `manualChunks` regex-based splitting causes module duplication (40% size increase in one case). Use route-level dynamic imports instead.
- **oklch for theming** — perceptually uniform color space. Same hue/chroma across light/dark modes, only lightness changes. Define as CSS custom properties in :root/.dark.
- **Form validation a11y** — aria-invalid + aria-describedby on inputs, inline errors (not summary-only), role="alert" on error messages. react-hook-form for uncontrolled state + Zod for schema-driven TypeScript validation.
- **Electron sandbox always on** — sandbox: true, contextIsolation: true, nodeIntegration: false. Preload scripts must be CommonJS (.cjs). Context bridge for IPC.

## Infrastructure & Deployment Patterns

- **CI cache ordering** — cache restore MUST precede install steps. A cache step placed after install never restores. Guard install with `if: steps.*.outputs.cache-hit != 'true'`.
- **Parallel CI jobs** — split monolithic workflows into parallel jobs (lint, test, build, e2e). Total wall time = slowest job, not sum. Add timeout-minutes to every job.
- **pnpm catalog for monorepos** — use `catalog:` protocol in pnpm-workspace.yaml for shared dependency versions. Single source of truth prevents workspace package drift.
- **Single Docker volume at home** — one volume mount at /root, init script to seed build-time contents on first run. Avoids managing multiple specialized volumes.
- **Cloudflare Pages config** — `pages_build_output_dir` in wrangler.toml, NOT the old Workers-style `[build]` block. Build command lives in the Cloudflare dashboard.
- **madge for circular deps** — run in CI to detect circular TypeScript imports. Circular deps hide in type imports and cause runtime errors not caught by tsc.

## Mobile Development Patterns

- **Capabilities before build** — decide data fetching, storage encryption, webview strategy, remote config, and force-update mechanism BEFORE build setup. Changing these mid-project requires significant rework.
- **Credentials as infrastructure** — keystores, provisioning profiles, and distribution certificates are the most common build failure root cause. Store securely, never in git, document renewal cadence.
- **EAS build profiles** — separate profiles for development (dev client), preview (internal APK), staging (internal + env), and production (app store). Define env vars in eas.json, not .env files.
- **Push notification asymmetry** — iOS needs APNs entitlement + p8 key or p12 certificate. Android needs FCM. Expo Push API handles cross-platform delivery but the setup differs fundamentally.
- **Code signing split** — Android keystore is self-signed (25-year validity recommended). iOS Distribution Certificate is Apple-issued. Development vs distribution use different certs on iOS.
- **gitignore wisely** — ignore /android and /ios if no native modifications. Ignore eas.json and credentials.json. EAS copies git-tracked files only — .env in gitignore won't reach build server.
