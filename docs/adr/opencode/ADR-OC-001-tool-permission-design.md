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

| Allowed form | Representative inputs | Boundary |
| --- | --- | --- |
| Filesystem queries | `ls -la`, `cat package.json`, `head -5 file`, `tail -20 file` | No command or option that writes, executes, or substitutes another process |
| Text queries | `grep pattern src/`, `rg pattern src/` | No preprocessor, output-file, or execution flag |
| Location and executable queries | `pwd`, `which node` | Exact executable token only; no lookalike prefix |
| Read-only Git queries | `git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium status --short`; the same exact prefix with guarded `diff`, `log`, `show`, or `branch` | Bare and lookalike forms, `git branch` mutation flags, custom format/pretty, signature formats, and every unlisted Git subcommand are blocked |
| Safe pipelines | `git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium log --no-ext-diff --no-textconv --oneline \| head -5` | Every segment must independently be allowlisted; a safe prefix cannot hide a later mutation |
| Standard-stream duplication | `ls -la 2>&1` | Allowed only when the implementation preserves parsed file-descriptor duplication; file-target stderr redirects remain blocked |

Every allowed Git segment starts with the exact prefix `git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium`. `diff`, patch-capable `log`, and `show` must then start their subcommand options with `--no-ext-diff --no-textconv`; metadata-only `log` uses the same guards in this implementation. `branch` permits only narrow listing and inspection forms such as no arguments, `--list`, `--show-current`, `-a`, `-r`, `--contains`, `--no-contains`, `--merged`, and `--no-merged`. Delete, copy, rename, custom `--format` or `--pretty`, signature, and unknown flags remain blocked. Option validation rejects file-writing and unknown flags.

The following forms are blocked before any permission exception or dangerous-pattern confirmation can allow them:

- Every `find` form, including a bare `find`, `-delete`, `-exec`, `-execdir`, `-ok`, `-okdir`, `-print`, `-print0`, `-ls`, `-printf`, `-fprint`, `-fprintf`, and `-fls`.
- Package-manager test or run forms, including `pnpm test`, `pnpm run`, `pnpm exec`, `npm test`, `npm run`, `npx`, `yarn`, `bun run`, and equivalent corepack or package-runner forms.
- Command substitution, including `$(...)`, backticks, and process substitution forms such as `<(...)` and `>(...)`.
- Output redirection to a file, including `>`, `>>`, `2>`, `2>>`, `&>`, and `>|`, even when the command before the redirect is read-only.
- Chained mutations or background work, including `;`, `&&`, `||`, newline, `&`, and a pipeline containing an unapproved segment such as `ls | rm`.
- Prefix lookalikes such as `lsass`, `gitx status`, `git statusx`, `pwdx`, and `whichfoo`.
- Unsafe Git mutations, including `add`, `commit`, `checkout`, `switch`, `restore`, `reset`, `clean`, `rm`, `mv`, `push`, `pull`, `fetch`, `merge`, `rebase`, `stash`, `tag` mutation, `remote`, `config`, `worktree`, `submodule`, and output-writing options. An unrecognized Git subcommand fails closed.
- The existing destructive patterns, such as `rm -rf /`, disk writes, `eval`, shell-piped downloads, and `crontab -r`, remain outside the read-only classifier. A dangerous-pattern confirmation is a separate host path and must not turn a command into a read-only query for this policy.

The parser must not use a raw `startsWith` test. It must tokenize the command, validate exact command names and subcommands, recognize only the permitted safe options, and reject malformed or ambiguous input. A harmless `2>&1` is not a general redirection exception. If an implementation cannot preserve that exact standard-stream behavior, it must block the form and record the contract change before tests are accepted.

### Failure-mode inventory

The following inventory is the minimum pre-code test selection for this amendment. The complete cross-platform inventory, including review, state, sandbox, and false-test cases, is in [`docs/testing.md`](../../testing.md#pre-code-remediation-inventories).

| ID | Failure mode or input | Required observable result | Planned test and artifact |
| --- | --- | --- | --- |
| BASH-01 | Safe filesystem, text, location, and Git queries | Allow the exact safe forms and safe options | Shared Pi/OMP parser table; `bash-policy/BASH-01.json` |
| BASH-02 | Safe pipeline with every segment approved | Allow only when every segment passes the same allowlist | Shared Pi/OMP parser table; `bash-policy/BASH-02.json` |
| BASH-03 | `2>&1` and other standard-stream duplication | Preserve the harmless form only if supported; never treat it as permission to write a file | Shared parser test; `bash-policy/BASH-03.json` |
| BASH-04 | Any `find` invocation, including delete, exec, ok, and output flags | Block every form before execution | Shared parser table; `bash-policy/BASH-04.json` |
| BASH-05 | Package-manager test, run, exec, and download forms | Block package-manager entry points because lifecycle scripts are outside the read-only boundary | Shared parser table; `bash-policy/BASH-05.json` |
| BASH-06 | Command or process substitution | Block `$(...)`, backticks, `<(...)`, and `>(...)` | Shared parser table; `bash-policy/BASH-06.json` |
| BASH-07 | File-target output or stderr redirection | Block all file writes, including `2>file` and `&>file` | Shared parser table; `bash-policy/BASH-07.json` |
| BASH-08 | Chained mutation, newline, background command, or unsafe pipeline segment | Block the whole command, not only the first prefix | Shared parser and handler tests; `bash-policy/BASH-08.json` |
| BASH-09 | Prefix lookalike or malformed command token | Block rather than normalize or partially match | Shared parser table; `bash-policy/BASH-09.json` |
| BASH-10 | Unsafe Git mutation or output-writing option | Block the command and preserve the current model and state | Shared parser and handler tests; `bash-policy/BASH-10.json` |
| BASH-11 | Dangerous destructive pattern behind a safe prefix | Keep it outside the read-only classifier; a dangerous-pattern confirmation must not make it read-only for this policy | Shared handler test; `bash-policy/BASH-11.json` |
| BASH-12 | Empty, whitespace-only, leading-separator, or ambiguous input | Block without throwing or invoking a host | Shared parser test; `bash-policy/BASH-12.json` |

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

Write the selected shared parser and Pi/OMP adapter tests before implementation. Run the shared Pi test command, the Pi and OMP package tests, and the Hermes package tests after implementation. Save sanitized artifacts under the naming convention in [`docs/testing.md`](../../testing.md#process-tests-and-artifacts), then run `git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium diff --no-ext-diff --no-textconv --check`. Do not edit generated projections or canonical agent directives for this amendment.

### Related

- [ADR-HM-003](../hermes/ADR-HM-003-credential-safe-subprocess-boundary.md): credential-safe subprocess boundary.
- [ADR-CORE-025](../core/ADR-CORE-025-consumer-driven-sync-and-adapter-simplification.md): shared Pi/OMP adapter ownership.
- [ADR-CORE-028](../core/ADR-CORE-028-behavior-first-testing-and-evidence-preserving-reduction.md): pre-code inventories and evidence-preserving tests.
- [`docs/testing.md`](../../testing.md): complete remediation inventories and artifact rules.

## Repair Amendment (2026-09-24): Normalized Read-Only Git Boundary

### Context

The earlier amendment narrowed the command family but still described Git commands as coarse examples. A prefix such as `git diff*` cannot establish that the invocation is patch-safe, normalized, free of external helpers, or protected from repository configuration. Bare `git diff`, `git log -p`, and `git show` therefore remain denied unless the normalized form is present.

### Decision

1. Every allowed Git segment starts with the exact prefix `git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium`. Diff-capable `diff`, `log`, and `show` forms then require `--no-ext-diff --no-textconv` in that order before parser-approved options. A bare `git diff`, `git log -p`, or `git show` is denied.
2. Safe `git status`, `git branch`, and metadata-only `log` forms use the same fixed prefix. Custom `--format` and `--pretty` options are removed; `--oneline` may remain safe. Signature placeholders, `--show-signature`, and branch signature formats are denied. The test environment also sets `GIT_PAGER=cat`, `GIT_OPTIONAL_LOCKS=0`, and `GIT_CONFIG_NOSYSTEM=1`, and points `GIT_CONFIG_GLOBAL` to an empty or unavailable file. Tests seed pager, lock, fsmonitor, hook, alias, external-diff, textconv, and configuration behavior, then assert the observed result. The signed-commit probe configures a temporary sentinel `gpg.program`: an unguarded signature display invokes it, while the normalized controls do not.
3. External diff commands, text conversion, helpers, aliases, arbitrary `-c` or `--config-env` values, `--exec-path`, `--git-dir`, `--work-tree`, mutation, shell substitution, redirection, output files, and unknown options are denied. Repository and user configuration cannot widen the policy.
4. OpenCode permission globs remain coarse, non-token-level host configuration. They must not claim the normalized prefix, signature, option, or configuration guarantees of the repair classifier, and cannot be described as live-host-enforced without a recorded host probe. A broad historical `git*` permission remains an implementation-role capability, not evidence of the read-only Git policy.

The complete repair inventory, stable case IDs, and regeneration commands are recorded in [`docs/testing.md`](../../testing.md#read-only-git-repair-cases). The repair cases are pre-code contracts and do not claim that the current implementation passes them.

### Failure inventory

| ID | Required result | Regeneration and artifact |
| --- | --- | --- |
| GIT-01 | Deny bare `git diff` | `GIT` family command; `repair/GIT-01.json` |
| GIT-02 | Deny bare `git log -p` | `GIT` family command; `repair/GIT-02.json` |
| GIT-03 | Deny bare `git show` | `GIT` family command; `repair/GIT-03.json` |
| GIT-04 | Allow only the exact normalized prefix and diff safety flags | `GIT` family command; `repair/GIT-04.json` |
| GIT-05 | Allow only normalized log/show inspection without custom format, pretty, or signature controls | `GIT` family command; `repair/GIT-05.json` |
| GIT-06 | Allow safe status, branch, and metadata-only log only with the exact prefix, disabled pager, locks, fsmonitor, and unsafe hooks; `--oneline` remains safe | `GIT` family command; `repair/GIT-06.json` |
| GIT-07 | Deny external diff, textconv, helper, alias, arbitrary config, custom format/pretty, signature placeholders, branch signature formats, and unknown options | `GIT` family command; `repair/GIT-07.json` |
| GIT-08 | Deny mutation, substitution, redirection, chaining, output files, and unknown subcommand options | `GIT` family command; `repair/GIT-08.json` |
| GIT-09 | Prove seeded configuration cannot enable hooks, fsmonitor, pager, or optional locks | `GIT` family command; `repair/GIT-09.json` |
| GIT-10 | Record that OpenCode globs are non-token-level and do not claim the same normalized, signature, option, or configuration guarantees without a host probe | `GIT` family command; `repair/GIT-10.json` |

### Consequences

- The read-only Git surface becomes explicit and reproducible, but callers must use normalized commands.
- Fixed configuration controls reduce repository-dependent behavior at the cost of maintaining a narrow safe-option matrix.
- OpenCode globs remain useful coarse configuration, while token-level safety stays in the shared Pi/OMP parser and is not overstated as host enforcement.
- A live OpenCode probe is a separate evidence requirement, not an assumption made by this ADR.

### Assumptions

- `[verified]` OpenCode permission entries are coarse glob or prefix patterns and do not expose a token-level normalized-command contract.
- `[verified]` The detailed repair cases and artifact rules are maintained in `docs/testing.md`.
- `[inferred]` The implementation owner will choose platform-appropriate fixed environment paths for empty Git configuration, fsmonitor, and hooks while preserving the fixed behavior contract.

### Verification

Regenerate the `GIT-*` artifacts with the `GIT` family command, then run the package-specific OpenCode and shared Pi/OMP checks. A host probe is required before using the phrase host-enforced. Do not edit generated projections or canonical agent directives for this amendment.

### Related

- [`docs/testing.md`](../../testing.md#read-only-git-repair-cases): repair inventory, artifact schema, and regeneration commands.
- [ADR-CORE-028](../core/ADR-CORE-028-behavior-first-testing-and-evidence-preserving-reduction.md): pre-code selection and evidence requirements.

## Date

2026-06-13
