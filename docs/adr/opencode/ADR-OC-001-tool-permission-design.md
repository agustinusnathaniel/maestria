# ADR-OC-001: Tool Permission Design - Permissive by Default, Policy in Directives

## Status

Accepted. Amended 2026-09-24 for the shared Pi/OMP read-only Bash boundary and the normalized Git repair contract.

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

| Agent        | Rationale                                                                        |
| ------------ | -------------------------------------------------------------------------------- |
| Architect    | Type info; goToDefinition for dependency tracing                                 |
| Builder      | goToDefinition/findReferences during implementation - primary code-writing agent |
| Planner      | Structure understanding for plans                                                |
| Adventurer   | More precise codebase navigation                                                 |
| Diagnose     | goToDefinition for call chain tracing                                            |
| Reviewer     | Type info for correctness checks                                                 |
| Orchestrator | Structural understanding for delegation                                          |

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

## Amendment (2026-09-24): Narrowed Pi/OMP Read-Only Bash Boundary

### Context

The shared Pi/OMP tool interceptor currently recognizes a broad command-prefix list. That list includes `find` and package-manager test forms. `find` can execute or delete through flags, and package-manager test or run forms can execute lifecycle scripts and mutate a workspace. A prefix check also does not by itself establish that every shell segment, substitution, redirect, or lookalike command is safe. `[verified]`

The amendment narrows the shared policy before the implementation owner writes remediation tests. It does not change the historical OpenCode decisions above, and it does not claim that an OpenCode host enforces the same command parser at runtime.

### Decision

The shared Pi/OMP read-only Bash policy uses a small positive allowlist. A command is allowed only when its executable and, for Git, its subcommand are recognized exactly, every option is safe for that command, and every pipeline segment is independently safe.

The allowlist covers exact filesystem, text, location, and executable queries, plus normalized read-only Git commands defined in the repair amendment below. Every command token, option, and pipeline segment must pass the shared parser; a safe prefix cannot hide a later mutation. Standard-stream duplication such as `2>&1` is allowed only as a parsed file-descriptor operation, never as permission to write a file.

The policy blocks `find`, package-manager execution, command or process substitution, file-target redirection, chaining, background work, lookalike command names, Git mutation, and unknown options. Destructive-pattern confirmation is a separate host path and cannot make a command read-only. The maintained option lists and representative allow/deny cases live in [`bash-policy.ts`](../../../packages/shared/pi/src/bash-policy.ts) and its [behavior tests](../../../packages/shared/pi/tests/tools-core.test.ts).

### Failure-mode inventory

These case IDs preserve the original failure-mode inventory. The [shared parser tests](../../../packages/shared/pi/tests/tools-core.test.ts) cover representative forms, and `pnpm e2e:fail-closed` samples the integrated boundary; neither produces one artifact per case.

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

### Host-enforcement boundary

The current evidence for this decision is source and configuration inspection plus adapter tests against controlled fakes. It does not prove that a live OpenCode permission evaluator applies the same glob, prefix, or command-token semantics. A live host probe must record the host version, agent, tool name, representative command, returned decision, and process result before documentation calls this policy host-enforced. Until that probe exists, describe it as a configured shared policy or adapter restriction, not as live OpenCode enforcement.

### Consequences

- The shared Pi/OMP reconnaissance surface is smaller, so agents must use file, text, location, and read-only Git queries instead of `find` or package scripts.
- Parser and option matrices require maintenance when a host adds a command or flag.
- A package test can establish the adapter's return value, but it cannot establish a host sandbox or an unrelated host's live decision.
- The historical principle that permissions are coarse gates and directives carry policy remains in force.

### Assumptions

- `[verified]` The pre-repair shared policy at the documented base commit included `find` and `pnpm test`/`npm test` prefixes, so those cases are behavior gaps for the remediation.
- `[inferred]` A tokenizer with explicit safe-option tables is safer than a growing prefix regular expression for the required command forms.
- `[verified]` No live OpenCode host probe is part of this documentation change; the host-enforcement claim remains withheld.

### Verification

Run the shared parser, Pi, and OMP package tests and `pnpm e2e:fail-closed` for sampled integrated behavior. The E2E command writes one evidence file at `artifacts/fail-closed-evidence.json`; it is not proof of every inventory row. A live OpenCode host probe remains necessary before an enforcement claim.

### Related

- [ADR-HM-003](../hermes/ADR-HM-003-credential-safe-subprocess-boundary.md): credential-safe subprocess boundary.
- [ADR-CORE-025](../core/ADR-CORE-025-consumer-driven-sync-and-adapter-simplification.md): shared Pi/OMP adapter ownership.
- [ADR-CORE-028](../core/ADR-CORE-028-behavior-first-testing-and-evidence-preserving-reduction.md): pre-code inventories and evidence-preserving tests.
- [Testing Philosophy](../../testing.md): behavior-test selection and evidence requirements.

## Repair Amendment (2026-09-24): Normalized Read-Only Git Boundary

### Context

The earlier amendment narrowed the command family but still described Git commands as coarse examples. A prefix such as `git diff*` cannot establish that the invocation is patch-safe, normalized, free of external helpers, or protected from repository configuration. Bare `git diff`, `git log -p`, and `git show` therefore remain denied unless the normalized form is present.

### Decision

1. Every allowed Git segment starts with the exact prefix `git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium`. Diff-capable `diff`, `log`, and `show` forms then require `--no-ext-diff --no-textconv` in that order before parser-approved options. A bare `git diff`, `git log -p`, or `git show` is denied.
2. Safe `git status`, `git branch`, and metadata-only `log` forms use the same fixed prefix. Custom `--format` and `--pretty` options are removed; `--oneline` may remain safe. Signature placeholders, `--show-signature`, and branch signature formats are denied. A future process-level probe should seed pager, lock, fsmonitor, hook, alias, external-diff, textconv, and signature behavior in a temporary repository and check that the normalized command avoids them; the current parser and consolidated E2E tests do not perform that probe.
3. External diff commands, text conversion, helpers, aliases, arbitrary `-c` or `--config-env` values, `--exec-path`, `--git-dir`, `--work-tree`, mutation, shell substitution, redirection, output files, and unknown options are denied. Repository and user configuration must not widen the policy.
4. OpenCode permission globs remain coarse, non-token-level host configuration. They must not claim the normalized prefix, signature, option, or configuration guarantees of the repair classifier, and cannot be described as live-host-enforced without a recorded host probe. A broad historical `git*` permission remains an implementation-role capability, not evidence of the read-only Git policy.

The case IDs below retain the repair contract. Current executable checks live in the [shared parser tests](../../../packages/shared/pi/tests/tools-core.test.ts) and consolidated E2E probe; they sample the inventory rather than proving every case.

### Failure inventory

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

### Consequences

- The read-only Git surface becomes explicit and reproducible, but callers must use normalized commands.
- Fixed configuration controls reduce repository-dependent behavior at the cost of maintaining a narrow safe-option matrix.
- OpenCode globs remain useful coarse configuration, while token-level safety stays in the shared Pi/OMP parser and is not overstated as host enforcement.
- A live OpenCode probe is a separate evidence requirement, not an assumption made by this ADR.

### Assumptions

- `[verified]` OpenCode permission entries are coarse glob or prefix patterns and do not expose a token-level normalized-command contract.
- `[verified]` This ADR retains the repair case IDs; the executable parser checks live in `packages/shared/pi/tests/tools-core.test.ts`.
- `[inferred]` The implementation owner will choose platform-appropriate fixed environment paths for empty Git configuration, fsmonitor, and hooks while preserving the fixed behavior contract.

### Verification

Run the shared Pi/OMP tests and `pnpm e2e:fail-closed` for sampled behavior. A live host probe is required before using the phrase host-enforced.

### Related

- [Testing Philosophy](../../testing.md): test selection and artifact requirements.
- [ADR-CORE-028](../core/ADR-CORE-028-behavior-first-testing-and-evidence-preserving-reduction.md): pre-code selection and evidence requirements.

## Date

2026-06-13
