# ADR-OC-002: Opensrc vs Webfetch Guidance - Scoped Queries to Webfetch, Whole Repos to Opensrc

## Status

Accepted

## Context

Agents frequently need to access external repositories on GitHub, GitLab, and BitBucket - to understand a library, read documentation, or investigate an issue. Two tools serve this:

- **`webfetch`** - HTTP GET, returns rendered content. Good for single pages, docs sites, changelogs.
- **`opensrc`** (via the `vercel-labs/opensrc` skill) - clones a repo to a global cache and prints a local path. Good for multi-file exploration.

Before the guidance existed, agents webfetched multi-file repos one file at a time, burning tokens and missing cross-file context, while using `opensrc` on a single README was clone overhead for nothing. The orchestrator's webfetch-hang guidance also lacked a fallback when `webfetch` hung.

## Decision

### Core Guidance

Apply this two-way filter:

| Query type | Tool | Rationale |
| --- | --- | --- |
| **Scoped query** - single file, single page, known URL, docs site | `webfetch` | One request, immediate result. No clone overhead. |
| **Whole repo** - "how is X implemented in library Y", multi-file investigation, pattern search | `opensrc path <owner/repo>` | Clones once to global cache; `read`/`glob`/`grep` work locally, with no file-by-file HTTP requests. |

**Don't webfetch a multi-file repo one file at a time** - clone once, read locally. This is the anti-pattern the guidance exists to prevent.

### Agents With the Guidance

Applied to 6 agents initially, narrowed to 5 after user feedback:

| Agent | Guidance |
| --- | --- |
| Orchestrator (now narrowed) | Global rules directive: "Webfetch may hang - don't block on it"; the tool-choice guidance and hang fallback moved to global rules (2026-06) after the read-side tools were stripped. |
| Adventurer, Builder, Diagnose, Reviewer | Rules bullet: "External repos: opensrc for big repos, webfetch for single pages" |
| Architect | That bullet plus "Use opensrc for investigating external dependencies" |

**Excluded (after user feedback):**

- **Writer** - its external references are typically single-page (docs sites, changelogs); no repo-scale guidance needed.
- **Planner** - its work is local (reading the current codebase, not external repos); no guidance needed.

### Global Rules

The global rules were updated with the scoped-vs-whole-repo distinction inline:

> **Use `opensrc` for repos; `webfetch` for pages** ... For a single file, a specific page, or a known URL, `webfetch` is fine. Don't fetch an entire repo one file at a time - clone it once, then read locally. Use `--cwd` to resolve versions from the current project.

The permission context for this choice is documented in ADR-OC-001.

### Orchestrator's Webfetch Hang Fallback

If a webfetch hangs, proceed without the result and surface the skip in the next user-facing message; never block waiting for a webfetch to complete. This was extracted from commit `23278a0` ("unstick webfetch by skipping approval + preferring local tools"). A later refactor stripped the orchestrator's read-side tools and moved the fallback to the global rules, where it applies uniformly to all 7 specialists.

## Consequences

- Positive: agents no longer webfetch repos one file at a time - major token savings.
- Positive: `opensrc` gives `read`/`glob`/`grep` access to cloned repos - richer analysis.
- Positive: single-page queries still use fast `webfetch`.
- Positive: global rules encode the distinction, so agents without the per-agent bullet benefit.
- Positive: writer and planner stay lean.
- Positive: the hang fallback prevents agent deadlock.
- Negative: the `opensrc` skill must be loaded before use - it's a skill, not a built-in tool.
- Negative: `opensrc path` is a `bash` command, which is `ask` for most agents - one approval per clone.

## Lessons Learned

1. **Don't apply the guidance to all agents by default.** Planner and writer don't deal with external repos; narrowing to the 5 relevant agents made the guidance meaningful.
2. **The orchestrator needed its own version with a hang fallback**, discovered when a webfetch blocked delegation.
3. **The anti-pattern is more common than expected.** Agents instinctively webfetch everything because it's simpler to invoke; positive guidance alone was not enough.
4. **Tool choice guidance belongs in `## Rules`, not in the skill prescription.** It's a decision rule, not a skill-loading directive.
5. **`--cwd` matters.** Without it, `opensrc path` resolves versions against the cloned repo, not the user's project - subtle but critical for correct analysis.

## Date

2026-06-13
