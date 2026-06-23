# ADR-OC-001: Tool Permission Design — Permissive by Default, Policy in Directives

## Status

Accepted

## Context

Each agent's YAML frontmatter defines tool permissions (`read`, `glob`, `grep`, `edit`, `bash`, `webfetch`, `skill`, `lsp`, etc.). The initial permissions were set per-agent during the Phase 2-4 rollout, but there was no systematic audit of which permissions each agent actually needed.

During the session spanning commits `259a72a` through `d2e0671`, we performed a comprehensive permission audit across all 7 agents. Three categories of issues emerged:

1. **Stale permissions** — `list` was referenced but does not exist as a tool in opencode v1.17.3
2. **Underspecified permissions** — `lsp` was not granted to agents that benefit from code intelligence (goToDefinition, findReferences)
3. **Overly restrictive permissions** — `webfetch: ask` was tried for some agents, adding friction without policy benefit
4. **Missing diagnostic tools** — the orchestrator needed `pwd` for build/CI path checks

## Decision

### 1. Remove `list: allow` From All Agents

The `list` tool was absorbed into `read` in opencode v1.17.3. Confirmed by inspecting the opencode source (`registry.ts` lists 16 built-ins; `list` is not among them). The `list: allow` line was a no-op — it matched no tool.

Removing it is hygienic. A misleading `list` entry suggests a capability that doesn't exist as a separate tool. Agents should not have frontmatter entries for nonexistent tools.

### 2. Add `lsp: allow` to Relevant Agents

LSP operations (goToDefinition, findReferences, hover type info) provide code intelligence that reduces guesswork. These were added to:

| Agent        | Rationale                                                                              |
| ------------ | -------------------------------------------------------------------------------------- |
| Architect    | Needs type info for architecture decisions, goToDefinition for dependency tracing      |
| Builder      | Needs goToDefinition/findReferences during implementation — primary code-writing agent |
| Planner      | Needs structure understanding for plan creation                                        |
| Adventurer   | Codebase reconnaissance — LSP improves navigation precision                            |
| Diagnose     | Bug tracing — goToDefinition for call chain tracing                                    |
| Reviewer     | Code review — type info for correctness checks                                         |
| Orchestrator | Coordination — needs structural understanding for delegation                           |

Writer was excluded (no code intelligence needed for prose).

The `lsp` permission is conditionally active — LSP operations are only available when `OPENCODE_EXPERIMENTAL_LSP=true` is set. The permission line is a no-op if the flag isn't set, but safe to include.

### 3. Add `"pwd": allow` to Orchestrator's Bash

The orchestrator needed `pwd` for diagnostic use — build/CI path checks during delegation planning. Added as a specific subcommand in the bash allow-list:

```yaml
bash:
  '*': deny
  'pwd': allow
  # ... other allow-listed commands
```

### 4. Revert `webfetch: ask` — Keep `webfetch: allow` for All Agents

(The install-flow implications of this decision are documented in ADR-OC-000. This ADR covers the permission design principle.)

The first audit (`259a72a`, "audit tool permissions for 7 agents + revert webfetch: ask") attempted `webfetch: ask` for adventurer, builder, and diagnose. The user pointed out this created friction with no policy benefit: the opensrc-vs-webfetch guidance is already encoded in each agent's `## Rules` section. Permission-level `ask` would prompt the user on every web request, even for legitimate single-page lookups.

All three were reverted to `webfetch: allow`. Every agent now has `webfetch: allow`.

### 5. Post-Audit Amendment: Orchestrator Read-Side Tools

After [commit `ecd3e16`](https://github.com/agustinusnathaniel/maestria/commit/ecd3e16)
fixed the YAML parser (confirming subagents load correctly), the orchestrator's
strict lockdown was re-evaluated.

The orchestrator was granted `read: allow`, `glob: allow`, `grep: allow` with
the following safeguards:

| Boundary | Value                          | Rationale                                               |
| -------- | ------------------------------ | ------------------------------------------------------- |
| read     | allow                          | Quick verification — check file existence, skim exports |
| glob     | allow                          | Find files by pattern before delegation                 |
| grep     | allow                          | Confirm function/reference existence                    |
| webfetch | deny                           | Web research belongs to @adventurer/@architect          |
| edit     | deny                           | Structural boundary — orchestrator cannot implement     |
| lsp      | deny                           | Deep code intelligence is for specialists               |
| bash     | `"*": deny`, allow-listed only | Same as before — no arbitrary execution                 |

A **Read-Side Tool Policy** in the orchestrator's prompt caps read/glob/grep at
3 calls per task before deeper recon must be delegated to `@adventurer`.

> **Update (same session):** After real-world testing, this change was reverted.
> The orchestrator with read tools consistently exhibited workaround behavior —
> preferring to {grep} through `node_modules` and find alternative paths rather
> than delegating to specialist agents. This confirmed that structural permission
> denial is the only reliable enforcement for an LLM-based orchestrator.
>
> The orchestrator remains at:
>
> - `read`: deny
> - `glob`: deny
> - `grep`: deny
> - `webfetch`: deny
> - `lsp`: deny
> - `edit`: deny
>
> Full context in commit history: `fc79183` (grant) → subsequent revert commit.

### Design Principle

**Permissions are permissive; directives encode policy.**

The permission system enforces coarse gates:

- Can the agent access the web? → `webfetch: allow | ask | deny`
- Can the agent edit files? → `edit: allow | ask | deny`
- Can the agent run commands? → `bash: allow | ask | deny | { subcommand: policy }`

The directive system (`## Rules`, `## CRITICAL RULES`) guides fine-grained decisions:

- Should I use `opensrc` or `webfetch` for this task? → "opensrc for repos, webfetch for pages"
- Should I test before claiming done? → "Run tests before claiming done"
- Should I ask before editing? → Already handled by `edit: ask`

This separation keeps:

- Frontmatter small (one coarse entry per tool, not one per use case)
- Policy explicit (visible in the rules section, not hidden in permission flags)
- Friction minimal (no prompts for routine operations)

## Consequences

- Positive: No stale `list` entries — frontmatter reflects actual available tools
- Positive: LSP-enabled agents get code intelligence when the experimental flag is on
- Positive: `webfetch: allow` removes friction — no prompts for routine web lookups
- Positive: The design principle (permissions permissive, directives encode policy) is clear and defensible
- Positive: Only one agent (orchestrator) has `bash: deny` for general commands — all subagents have `bash: ask` as their most restrictive level, which is appropriate for their roles
- Negative: `lsp: allow` is a no-op when `OPENCODE_EXPERIMENTAL_LSP` is not set — the permission line suggests a capability that may not be active
- Negative: Removing `list` entries could be confusing if a user's opencode version predates v1.17.3 (unlikely for current users)

## Lessons Learned

1. **`list: allow` was conceptually confusing.** The entry existed because we assumed `list` was a read-side tool independent from `read`. It wasn't. Auditing against the actual opencode source (`registry.ts`) would have caught this earlier.

2. **`webfetch: ask` was friction with no policy benefit.** The experiment proved that if you trust an agent to decide when to use opensrc vs. webfetch (via `## Rules`), you should trust it to access the web at all. The `ask` level only adds a prompt without changing behavior.

3. **Permissions are a coarse gate, not a policy system.** Trying to encode fine-grained policy in the permission system (e.g., "allow webfetch but discourage for multi-file repos") is fighting the abstraction. The rules section is the right place for guidance.

4. **LSP permission is harmless even when the flag isn't set.** The `lsp` tool is gated behind `OPENCODE_EXPERIMENTAL_LSP=true`. Including `lsp: allow` is forward-looking — it works when the flag is set, and is a no-op otherwise. No reason to omit it.

5. **Audit permissions after adding agents, not before.** The permission audit was done as a batch after all 7 agents were written. Doing it incrementally per agent would have caught the `list` no-op earlier but at higher overhead. Batch audit was the right call.

## Date

2026-06-13
