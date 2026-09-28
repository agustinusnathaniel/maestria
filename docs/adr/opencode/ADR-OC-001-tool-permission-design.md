# ADR-OC-001: Tool Permission Design - Permissive by Default, Policy in Directives

## Status

Accepted. Amended 2026-09-24 for the shared Pi/OMP read-only Bash boundary and the normalized Git repair contract. Those two amendments are now [ADR-OC-006](ADR-OC-006-pi-omp-read-only-bash-boundary.md) and [ADR-OC-007](ADR-OC-007-normalized-read-only-git-boundary.md); see Supersession. Divergent-claim annotation (2026-09-28, recorded under [ADR-CORE-030](../core/ADR-CORE-030-adr-immutability-and-supersession.md) clause 7): the YAML block in Decision 3 does not match the live orchestrator frontmatter `[verified]`. The orchestrator does not use a per-tool bash allow list. It uses a default deny with a single narrow allow pattern, and it has no `pwd` entry; `pwd` appears in the other seven agent files. The authoritative source for that generated frontmatter is the `orchestrator.md` block in [packages/opencode/sync.config.ts](../../../packages/opencode/sync.config.ts), and [packages/opencode/agents/orchestrator.md](../../../packages/opencode/agents/orchestrator.md) is the projection it produces. The block is retained rather than relocated, because the content it shows is not present at that path, so the clause 6 precondition is unmet.

## Context

Each agent's YAML frontmatter defines tool permissions (`read`, `glob`, `grep`, `edit`, `bash`, `webfetch`, `skill`, `lsp`, etc.). The initial permissions were set per-agent during the Phase 2-4 rollout without a systematic audit. Auditing all 7 agents found four issue categories:

1. **Stale permissions** - `list` was referenced but had been absorbed into `read`
2. **Underspecified permissions** - `lsp` was missing from agents that benefit from code intelligence (goToDefinition, findReferences)
3. **Overly restrictive permissions** - `webfetch: ask` was tried for some agents, adding friction without policy benefit
4. **Missing diagnostic tools** - the orchestrator needed `pwd` for build/CI path checks

## Decision

### 1. Remove `list: allow` From All Agents

The `list` tool was absorbed into `read`, confirmed by inspecting the OpenCode source (`registry.ts` lists 16 built-ins; `list` is not among them). The `list: allow` line matched no tool. Removing it is hygienic: frontmatter should not suggest capabilities that don't exist.

### 2. Add `lsp: allow` to Relevant Agents

LSP operations (goToDefinition, findReferences, hover type info) reduce guesswork. Added to:

| Agents | Rationale |
| --- | --- |
| builder, architect | goToDefinition, findReferences, and hover type info; the primary code-writing and dependency-tracing agents |
| adventurer, diagnose, planner | Precise codebase navigation and call-chain tracing |
| reviewer, orchestrator | Type info for correctness checks, and structural understanding for delegation |

Writer was excluded (prose needs no code intelligence). The permission is conditionally active: LSP requires `OPENCODE_EXPERIMENTAL_LSP=true`, so the line is a no-op otherwise but safe to include.

### 3. Add `"pwd": allow` to Orchestrator's Bash

The orchestrator needed `pwd` for build/CI path checks during delegation planning, added as a specific subcommand in the bash allow-list:

```yaml
bash:
  '*': deny
  'pwd': allow
  # ... other allow-listed commands
```

### 4. Revert `webfetch: ask` - Keep `webfetch: allow` for All Agents

(The install-flow implications are documented in ADR-OC-000; this ADR covers the permission design principle.)

The first audit tried `webfetch: ask` for adventurer, builder, and diagnose. The user pointed out friction with no policy benefit: the opensrc-vs-webfetch guidance already lives in each agent's `## Rules` section, and `ask` would prompt on every web request, even legitimate single-page lookups. All three were reverted to `webfetch: allow`; every agent now allows it.

### 5. Post-Audit Amendment: Orchestrator Read-Side Tools

After [commit `ecd3e16`](https://github.com/agustinusnathaniel/maestria/commit/ecd3e16) fixed the YAML parser, the orchestrator's strict lockdown was re-evaluated. It was briefly granted:

- `read: allow`, `glob: allow`, `grep: allow` - file existence checks, pattern-finding, reference confirmation
- `webfetch: deny`, `edit: deny`, `lsp: deny` - web research and deep intelligence belong to specialists, and `edit: deny` is the structural implementation boundary
- `bash`: `"*": deny`, allow-listed only

A **Read-Side Tool Policy** capped read/glob/grep at 3 calls per task before deeper recon had to be delegated to `@adventurer`.

> **Update (same session):** after real-world testing, the grant was reverted. The orchestrator with read tools consistently worked around delegation (grepping `node_modules`, finding alternative paths) instead of delegating to specialists. Structural permission denial is the only reliable enforcement for an LLM-based orchestrator.
>
> The orchestrator remains at `read`, `glob`, `grep`, `webfetch`, `lsp`, `edit`: `deny`. Commit history: `fc79183` (grant) → subsequent revert commit.

### Design Principle

**Permissions are permissive; directives encode policy.**

The permission system enforces coarse gates (web access, file edits, command execution). The directive system (`## Rules`, `## CRITICAL RULES`) guides fine-grained decisions such as opensrc vs. webfetch or testing before claiming done. This keeps frontmatter small (one entry per tool), policy explicit (in the rules, not permission flags), and friction minimal.

## Consequences

- Positive: frontmatter reflects actual tools, with no stale `list` entries.
- Positive: LSP-enabled agents get code intelligence when the experimental flag is on.
- Positive: `webfetch: allow` removes prompts for routine web lookups.
- Positive: the design principle (permissions permissive, directives encode policy) is clear and defensible.
- Positive: only the orchestrator denies general bash; subagents keep `bash: ask` as their most restrictive level.
- Negative: `lsp: allow` suggests a capability that is inactive without `OPENCODE_EXPERIMENTAL_LSP`.
- Negative: removing `list` entries could confuse users on OpenCode versions predating the absorption.

## Lessons Learned

1. **`list: allow` was conceptually confusing.** We assumed `list` was independent of `read`; auditing against the OpenCode source would have caught the no-op earlier.
2. **`webfetch: ask` was friction with no policy benefit.** Trusting an agent to choose opensrc vs. webfetch means trusting it to access the web at all.
3. **Permissions are a coarse gate, not a policy system.** Fine-grained policy belongs in the rules section.
4. **LSP permission is harmless when the flag isn't set**, and forward-looking when it is.
5. **Audit permissions after adding agents, not before.** The batch audit was the right call, though incremental audits catch no-ops earlier.

## Failure-mode inventory: read-only Bash

The case IDs below are the contract the read-only Bash decision is verified against. That decision is [ADR-OC-006](ADR-OC-006-pi-omp-read-only-bash-boundary.md). The [shared parser tests](../../../packages/shared/pi/tests/tools-core.test.ts) cover representative forms, and `pnpm e2e:fail-closed` samples the integrated boundary; neither produces one artifact per case.

| ID | Input or failure mode | Required result |
| --- | --- | --- |
| BASH-01 | Safe query forms | Allow exact names and safe options. |
| BASH-02 | Pipeline | Allow only when every segment is approved. |
| BASH-03 | `2>&1` | Allow parsed standard-stream duplication, never file redirection. |
| BASH-04 | `find` | Block every form before execution. |
| BASH-05 | Package-manager commands | Block lifecycle and download entry points. |
| BASH-06 | Command or process substitution | Block substitutions. |
| BASH-07 | File-target output or stderr redirect | Block the write. |
| BASH-08 | Chaining, newline, background work, or unsafe pipeline segment | Block the whole command. |
| BASH-09 | Prefix lookalike or malformed token | Block rather than partially match. |
| BASH-10 | Git mutation or output-writing option | Block without changing model or state. |
| BASH-11 | Destructive pattern behind a safe prefix | Do not classify it as read-only. |
| BASH-12 | Empty, leading-separator, or ambiguous input | Block without invoking a host. |

## Host-enforcement boundary

Retained because it constrains how this record's own permission claims may be described. The current evidence for the read-only Bash and Git policy is source and configuration inspection plus adapter tests against controlled fakes. It does not prove that a live OpenCode permission evaluator applies the same glob, prefix, or command-token semantics. A live host probe must record the host version, agent, tool name, representative command, returned decision, and process result before documentation calls that policy host-enforced. Until that probe exists, describe it as a configured shared policy or adapter restriction, not as live OpenCode enforcement.

An OpenCode permission glob is coarse, non-token-level host configuration. A permission entry described in this record, or carried in a generated agent projection, is not evidence of the normalized read-only Git policy. A broad `git*` style permission is an implementation-role capability. The normalization itself is decided in [ADR-OC-007](ADR-OC-007-normalized-read-only-git-boundary.md).

## Failure inventory: read-only Git

The case IDs below are the contract the normalized read-only Git decision is verified against. That decision is [ADR-OC-007](ADR-OC-007-normalized-read-only-git-boundary.md). Current executable checks live in the [shared parser tests](../../../packages/shared/pi/tests/tools-core.test.ts) and the consolidated E2E probe; they sample the inventory rather than proving every case.

| ID | Required result |
| --- | --- |
| GIT-01 | Deny bare `git diff`. |
| GIT-02 | Deny bare `git log -p`. |
| GIT-03 | Deny bare `git show`. |
| GIT-04 | Allow only the normalized prefix and diff safety flags. |
| GIT-05 | Reject custom format, pretty, and signature controls in log/show. |
| GIT-06 | Allow narrow status, branch, and metadata-only log forms under the normalized prefix. |
| GIT-07 | Deny external diff, text conversion, helpers, aliases, arbitrary config, and unknown options. |
| GIT-08 | Deny mutation, substitution, redirection, chaining, and output files. |
| GIT-09 | Prove seeded configuration cannot enable hooks, fsmonitor, pager, or optional locks. |
| GIT-10 | Keep OpenCode glob claims separate from token-level parser guarantees. |

## Supersession

Extended by two records, extracted on 2026-09-28 under [ADR-CORE-030](../core/ADR-CORE-030-adr-immutability-and-supersession.md), because each decides a subject other than this record's:

- [ADR-OC-006](ADR-OC-006-pi-omp-read-only-bash-boundary.md) owns the shared Pi/OMP read-only Bash boundary introduced by the 2026-09-24 amendment.
- [ADR-OC-007](ADR-OC-007-normalized-read-only-git-boundary.md) owns the normalized read-only Git boundary introduced by the 2026-09-24 repair amendment.

This record keeps its original context, decision, consequences, and date, and continues to own the OpenCode agent permission design: the coarse-gate principle, the individual tool permissions, the audit that produced them, and the lessons learned. The two failure inventories and the host-enforcement boundary above are retained because they constrain claims this record still makes about its own permission entries.

## Date

2026-06-13
