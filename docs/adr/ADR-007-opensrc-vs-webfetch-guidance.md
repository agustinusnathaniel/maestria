# ADR-007: Opensrc vs Webfetch Guidance — Scoped Queries to Webfetch, Whole Repos to Opensrc

## Status

Accepted

## Context

Agents frequently need to access external repositories on GitHub, GitLab, and BitBucket — whether to understand how a library works, read documentation, or investigate an issue. The agents have two tools for this:

- **`webfetch`** — HTTP GET, returns rendered content. Good for single pages, docs sites, changelogs.
- **`opensrc`** (via the `vercel-labs/opensrc` skill) — clones a repo to a global cache, prints a local path. Good for multi-file exploration.

Before the guidance was established, agents used the wrong tool for the wrong scale:

- `webfetch`-ing a multi-file repo one file at a time burned tokens and missed cross-file context
- Using `opensrc` for a single README page was overkill (clone overhead)

The orchestrator's CRITICAL RULE #9 also suffered from a related problem: `webfetch` could hang, and the orchestrator had no fallback behavior for that case.

## Decision

### Core Guidance

Apply this two-way filter:

| Query type                                                                                                       | Tool                        | Rationale                                                                                      |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| **Scoped query** — single file, single page, known URL, docs site                                                | `webfetch`                  | One request, immediate result. No clone overhead.                                              |
| **Whole repo** — "how is X implemented in library Y", multi-file investigation, pattern search across a codebase | `opensrc path <owner/repo>` | Clones once to global cache. `read`/`glob`/`grep` work locally. No file-by-file HTTP requests. |

**Don't webfetch a multi-file repo one file at a time** — clone once, read locally. This is the anti-pattern the guidance exists to prevent.

### Agents With the Guidance

Applied to 6 agents initially, narrowed to 5 after user feedback:

| Agent        | Guidance                                                             | Format                                                                                       |
| ------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Orchestrator | CRITICAL RULE #9                                                     | Structured paragraph + `opensrc` for repos, `webfetch` for pages, fallback if webfetch hangs |
| Adventurer   | Rules bullet                                                         | "External repos: opensrc for big repos, webfetch for single pages"                           |
| Architect    | Rules bullet + "Use opensrc for investigating external dependencies" | Two bullets in Rules                                                                         |
| Builder      | Rules bullet                                                         | "External repos: opensrc for big repos, webfetch for single pages"                           |
| Diagnose     | Rules bullet                                                         | "External repos: opensrc for big repos, webfetch for single pages"                           |
| Reviewer     | Rules bullet                                                         | "External repos: opensrc for big repos, webfetch for single pages"                           |

**Excluded (after user feedback):**

- **Writer** — documentation agent; its external references are typically single-page (docs sites, changelogs). Does not need repo-scale access guidance.
- **Planner** — planning agent; its work is local (reading the current codebase, not external repos). Does not need the guidance.

### Global Rules

`rules/AGENTS.md` was updated with the scoped-vs-whole-repo distinction inline:

> - **Use `opensrc` for repos; `webfetch` for pages** — when analyzing a GitHub/GitLab/BitBucket repo or any multi-file code reference, run `opensrc path <owner/repo>`. It clones to a global cache and prints a path that `read`/`glob`/`grep` can use directly. For a single file, a specific page, or a known URL, `webfetch` is fine. Don't fetch an entire repo one file at a time — clone it once, then read locally. Use `--cwd` to resolve versions from the current project.

The permission context for this choice is documented in ADR-006 (Tool Permission Design — Permissive by Default, Policy in Directives).

### Orchestrator's Webfetch Hang Fallback

The orchestrator's CRITICAL RULE #9 was also updated with a fallback: if a webfetch hangs, proceed without the result and surface the skip in the next user-facing message. Do not block waiting for a webfetch to complete. This was extracted from commit `23278a0` ("unstick webfetch by skipping approval + preferring local tools").

## Consequences

- Positive: Agents no longer webfetch repos one file at a time — massive token savings
- Positive: `opensrc` gives access to `read`/`glob`/`grep` on cloned repos — richer analysis
- Positive: Single-page queries still use `webfetch` — fast, no clone overhead
- Positive: Global rules encode the distinction — even agents without the per-agent bullet benefit
- Positive: Writer and planner stay lean — no irrelevant guidance
- Positive: Orchestrator's webfetch hang fallback prevents agent deadlock
- Negative: Must remember to load the `opensrc` skill before using it — it's a skill, not a built-in tool
- Negative: `opensrc path` is a `bash` command, which is `ask` for most agents — requires an approval for each clone
- Negative: The guidance adds ~5-8 lines per agent file — small but cumulative

## Lessons Learned

1. **Don't apply the guidance to all agents by default.** The first pass added the guidance to all 7 agents. The user pointed out that planner and writer don't deal with external repos — adding the rule to them was noise. Narrowing to the 5 relevant agents made the guidance meaningful.

2. **The orchestrator needed its own version with a hang fallback.** The per-agent guidance is "use openscr for repos, webfetch for pages." The orchestrator's guidance needed to also say "if webfetch hangs, proceed without." This was discovered when a webfetch blocked the orchestrator from delegating.

3. **The anti-pattern (fetch a repo one file at a time) is more common than expected.** During Phase 2 development, agents instinctively used `webfetch` for everything because it's the simpler tool to invoke (no skill to load, no bash command). The explicit anti-pattern warning ("Don't webfetch a multi-file repo one file at a time") was added because the positive guidance alone wasn't enough to prevent this.

4. **Tool choice guidance belongs in `## Rules`, not in the skill prescription.** An early draft put the opensrc guidance in the skill prescription section. It was moved to `## Rules` because it's a decision-rule, not a skill-loading directive. The rule format ("when X, use Y") is clearer there.

5. **`--cwd` matters.** The global rules note "Use `--cwd` to resolve versions from the current project" — this was added after discovering that `opensrc path` without `--cwd` resolves versions against the cloned repo, not the user's project. Subtle but critical for correct analysis.

## Date

2026-06-13
