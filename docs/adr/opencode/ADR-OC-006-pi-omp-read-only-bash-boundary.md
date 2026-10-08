# ADR-OC-006: Read-Only Bash Boundary for the Shared Pi/OMP Interceptor

## Status

Accepted (2026-09-24), Confidence: High

## Context

This decision was taken inside [ADR-OC-001](ADR-OC-001-tool-permission-design.md) and extracted into its own record on 2026-09-28, because it decides a different subject from that record: the shared Pi and OMP command interceptor, not the OpenCode agent permission design. The 2026-09-24 date is the date the decision was made. Extracting it changed neither the decision, its rationale, nor its consequences.

The shared Pi/OMP tool interceptor recognized a broad command-prefix list. That list included `find` and package-manager test forms. `find` can execute or delete through flags, and package-manager test or run forms can execute lifecycle scripts and mutate a workspace. A prefix check also does not by itself establish that every shell segment, substitution, redirect, or lookalike command is safe. `[verified]`

The decision narrowed the shared policy before the implementation owner wrote remediation tests. It did not change the historical OpenCode decisions in ADR-OC-001, and it does not claim that an OpenCode host enforces the same command parser at runtime.

## Decision

The shared Pi/OMP read-only Bash policy uses a small positive allowlist. A command is allowed only when its executable and, for Git, its subcommand are recognized exactly, every option is safe for that command, and every pipeline segment is independently safe.

The allowlist covers exact filesystem, text, location, and executable queries, plus the normalized read-only Git commands decided in [ADR-OC-007](ADR-OC-007-normalized-read-only-git-boundary.md). Every command token, option, and pipeline segment must pass the shared parser, so a safe prefix cannot hide a later mutation. Standard-stream duplication such as `2>&1` is allowed only as a parsed file-descriptor operation, never as permission to write a file.

The policy blocks `find`, package-manager execution, command or process substitution, file-target redirection, chaining, background work, lookalike command names, Git mutation, and unknown options. Destructive-pattern confirmation is a separate host path and cannot make a command read-only.

The maintained option lists and representative allow and deny cases live in [`bash-policy.ts`](../../../packages/shared/pi/src/bash-policy.ts) and its [behavior tests](../../../packages/shared/pi/tests/tools-core.test.ts). They are maintained there and are not restated here.

## Failure-mode inventory

The case IDs below retain the planned boundary contract. The [shared parser tests](../../../packages/shared/pi/tests/tools-core.test.ts) and `pnpm e2e:fail-closed` sample behavior; they do not prove every case or live-host enforcement.

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

## Security Boundaries

- A command is read-only only when the shared parser approves every token, option, and pipeline segment. A safe prefix never establishes safety for a later token.
- Standard-stream duplication is a parsed file-descriptor operation, never permission to write a file.
- Destructive-pattern confirmation is a separate host path and cannot make a command read-only.
- A negative result is a denial. An unparsed, unrecognized, or ambiguous command is denied before any host is invoked.

## Host-enforcement boundary

The current evidence for this decision is source and configuration inspection plus adapter tests against controlled fakes. It does not prove that a live OpenCode permission evaluator applies the same glob, prefix, or command-token semantics. A live host probe must record the host version, agent, tool name, representative command, returned decision, and process result before documentation calls this policy host-enforced. Until that probe exists, describe it as a configured shared policy or adapter restriction, not as live OpenCode enforcement.

## Consequences

### Positive

- The allowlist denies by default, so an unrecognized executable, option, or pipeline segment produces a denial rather than an allow.
- Segment-level parsing means a safe first segment cannot carry an unsafe later segment, which is the failure a prefix list cannot catch.

### Negative

- The reconnaissance surface is smaller, so agents must use file, text, location, and read-only Git queries instead of `find` or package scripts.
- Parser and option matrices require maintenance whenever a host adds a command or a flag.
- A package test can establish the adapter's return value, but it cannot establish a host sandbox or an unrelated host's live decision.

### Neutral

- The principle that permissions are coarse gates and directives carry policy is unaffected by this decision.

## Assumptions

- `[verified]` The pre-repair shared policy at the documented base commit included `find` and `pnpm test`/`npm test` prefixes, so those cases are behavior gaps for the remediation.
- `[inferred]` A tokenizer with explicit safe-option tables is safer than a growing prefix regular expression for the required command forms.
- `[verified]` No live OpenCode host probe is part of this decision, so the host-enforcement claim remains withheld.

## Alternatives Considered

The source amendment in [ADR-OC-001](ADR-OC-001-tool-permission-design.md) recorded no explicit pros and cons list. `[inferred]` The rejected design space below is recovered from the pre-existing design named in Context and from the constraints stated in Decision, not from a newly weighed comparison.

- **Keep the broad command-prefix list, including `find` and package-manager test prefixes.** Rejected because `find` can execute or delete through flags, package-manager test or run forms can execute lifecycle scripts and mutate a workspace, and a prefix check does not by itself establish that every shell segment, substitution, redirect, or lookalike command is safe. `BASH-04`, `BASH-05`, `BASH-09`, and `BASH-11` exist because of this rejection.
- **Grow a prefix regular expression instead of tokenizing with explicit safe-option tables.** Rejected because a tokenizer with explicit safe-option tables is safer than a growing prefix regular expression for the required command forms, and because only segment-level parsing stops a safe first segment from carrying an unsafe later one, which is the failure a prefix list cannot catch.
- **Let the host's destructive-pattern confirmation stand in for the read-only classification.** Rejected because destructive-pattern confirmation is a separate host path and cannot make a command read-only; the classification is settled by the shared parser before any host is invoked.
- **Describe the policy as live host-enforced OpenCode permission behavior.** Deferred rather than rejected, pending the live host probe that must record host version, agent, tool name, representative command, returned decision, and process result. Until that probe exists, this record calls the policy a configured shared policy or adapter restriction.

## Verification

Run the shared parser, Pi, and OMP package tests, and `pnpm e2e:fail-closed` for sampled integrated behavior. The E2E command writes one evidence file at `artifacts/fail-closed-evidence.json`; it is not proof of every inventory row. A live OpenCode host probe remains necessary before any enforcement claim.

## Related Decisions

- [ADR-CORE-028](../core/ADR-CORE-028-behavior-first-testing-and-evidence-preserving-reduction.md): the pre-code failure-mode inventory this decision's cases come from.
- [ADR-CORE-020](../core/ADR-CORE-020-hybrid-package-topology.md): shared Pi/OMP adapter ownership.
- [ADR-HM-003](../hermes/ADR-HM-003-credential-safe-subprocess-boundary.md): credential-safe subprocess boundary.
- [Testing Philosophy](../../testing.md): behavior-test selection and evidence requirements.

## Supersession

Extends [ADR-OC-001](ADR-OC-001-tool-permission-design.md), which keeps its original context, decision, consequences, and date. ADR-OC-001 continues to own the OpenCode agent permission design; this record owns the shared Pi/OMP read-only Bash boundary that its 2026-09-24 amendment introduced. ADR-OC-001's Status line names this record as the successor for that amendment.

## Date

2026-09-24
