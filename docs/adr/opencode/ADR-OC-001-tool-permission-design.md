# ADR-OC-001: Tool Permission Design - Permissive by Default, Policy in Directives

## Status

Accepted (2026-06-13). The 2026-09-24 shared Pi/OMP Bash and Git decisions live in [OC-006](ADR-OC-006-pi-omp-read-only-bash-boundary.md) and [OC-007](ADR-OC-007-normalized-read-only-git-boundary.md). Correction (2026-09-28): the historical `pwd` example below is not the live orchestrator policy; [the sync config](../../../packages/opencode/sync.config.ts) owns generated permissions. The orchestrator uses default deny with a narrow allow pattern, not that example's per-tool list.

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

The earlier skill-install procedure followed the same principle: routine web prompts added friction without changing tool-choice policy.

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

## Permission Lessons Consolidated (2026-10-03)

The 2026-07-03 MCP investigation left implicit MCP access unchanged. Permission audits must include server-prefixed tools: built-in denials do not establish a blanket MCP denial. At the time, one narrow server did not justify a heuristic plugin hook; explicit per-server denial was the preferred response if bypassing delegation became observed behavior. Prompt-only restraint is advisory, and a server rename or newly configured server requires fresh permission evidence.

The per-commit user-question checkpoint was retired in August 2026 because it reset existing authorization, interrupted routine delivery, and conflicted with the autonomy contract. Validated, in-scope feature-branch commits follow canonical authorization and required independent review; runtime permissions still govern who can execute them. Merge and release remain separate boundaries. Historical release notes describe the earlier checkpoint, not current instructions.

## Host-enforcement boundary

Retained because it constrains how this record's own permission claims may be described. The current evidence for the read-only Bash and Git policy is source and configuration inspection plus adapter tests against controlled fakes. It does not prove that a live OpenCode permission evaluator applies the same glob, prefix, or command-token semantics. A live host probe must record the host version, agent, tool name, representative command, returned decision, and process result before documentation calls that policy host-enforced. Until that probe exists, describe it as a configured shared policy or adapter restriction, not as live OpenCode enforcement.

An OpenCode permission glob is coarse, non-token-level host configuration. A permission entry described in this record, or carried in a generated agent projection, is not evidence of the normalized read-only Git policy. A broad `git*` style permission is an implementation-role capability. The normalization itself is decided in [ADR-OC-007](ADR-OC-007-normalized-read-only-git-boundary.md).

## Supersession

Extended by two records, extracted on 2026-09-28, because each decides a subject other than this record's:

- [ADR-OC-006](ADR-OC-006-pi-omp-read-only-bash-boundary.md) owns the shared Pi/OMP read-only Bash boundary introduced by the 2026-09-24 amendment.
- [ADR-OC-007](ADR-OC-007-normalized-read-only-git-boundary.md) owns the normalized read-only Git boundary introduced by the 2026-09-24 repair amendment.

This record keeps its original context, decision, consequences, and date, and continues to own the OpenCode agent permission design: the coarse-gate principle, the individual tool permissions, the audit that produced them, and the lessons learned. The failure inventories live with those two decisions; the host-enforcement boundary here constrains claims about OpenCode permission entries.

## Date

2026-06-13
