# ADR-OC-007: Normalized Read-Only Git Boundary for the Shared Pi/OMP Interceptor

## Status

Accepted (2026-09-24), Confidence: High

## Context

This decision was taken inside [ADR-OC-001](ADR-OC-001-tool-permission-design.md) and extracted into its own record on 2026-09-28, because it decides a different subject from that record: the read-only Git boundary, not the OpenCode agent permission design. The 2026-09-24 date is the date the decision was made. Extracting it changed neither the decision, its rationale, nor its consequences.

The earlier read-only Bash amendment narrowed the command family but still described Git commands as coarse examples. A prefix such as `git diff*` cannot establish that the invocation is patch-safe, normalized, free of external helpers, or protected from repository configuration. Bare `git diff`, `git log -p`, and `git show` therefore remain denied unless the normalized form is present.

## Decision

1. Every allowed Git segment starts with the exact prefix `git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium`. Diff-capable `diff`, `log`, and `show` forms then require `--no-ext-diff --no-textconv` in that order before parser-approved options. A bare `git diff`, `git log -p`, or `git show` is denied.
2. Safe `git status`, `git branch`, and metadata-only `log` forms use the same fixed prefix. Custom `--format` and `--pretty` options are removed; `--oneline` may remain safe. Signature placeholders, `--show-signature`, and branch signature formats are denied. A future process-level probe should seed pager, lock, fsmonitor, hook, alias, external-diff, textconv, and signature behavior in a temporary repository and check that the normalized command avoids them; the current parser and consolidated E2E tests do not perform that probe.
3. External diff commands, text conversion, helpers, aliases, arbitrary `-c` or `--config-env` values, `--exec-path`, `--git-dir`, `--work-tree`, mutation, shell substitution, redirection, output files, and unknown options are denied. Repository and user configuration must not widen the policy.
4. OpenCode permission globs remain coarse, non-token-level host configuration. They must not claim the normalized prefix, signature, option, or configuration guarantees of the repair classifier, and cannot be described as live-host-enforced without a recorded host probe. A broad historical `git*` permission remains an implementation-role capability, not evidence of the read-only Git policy.

## Failure-mode inventory

The case IDs below retain the planned boundary contract. The [shared parser tests](../../../packages/shared/pi/tests/tools-core.test.ts) and `pnpm e2e:fail-closed` sample behavior; they do not prove every case or live-host enforcement.

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

## Security Boundaries

- The normalized prefix is the only admitted entry point for Git. A command that does not begin with it exactly is denied, including otherwise harmless forms such as bare `git diff`.
- Repository and user configuration cannot widen the policy. Arbitrary `-c` and `--config-env` values, aliases, hooks, fsmonitor, pager, and optional locks are denied rather than trusted.
- External diff commands and text conversion are denied, so a repository cannot reach code outside its own working tree through a helper.
- An OpenCode permission glob is not evidence of this policy. The token-level guarantees above hold only in the shared parser, and no live-host claim is available without a recorded host probe.

## Consequences

### Positive

- The policy denies by configuration and by prefix, so repository-local settings cannot re-enable a pager, hook, fsmonitor, or signature check inside an allowed segment.

### Negative

- The read-only Git surface becomes explicit and reproducible, but callers must use the normalized command form, which is long and easy to get wrong.
- Fixed configuration controls reduce repository-dependent behavior at the cost of maintaining a narrow safe-option matrix.
- OpenCode globs remain useful coarse configuration, while token-level safety stays in the shared Pi/OMP parser and is not overstated as host enforcement.
- A live OpenCode probe is a separate evidence requirement, not an assumption made by this decision.

### Neutral

- Where an OpenCode agent frontmatter carries the normalized prefix as a glob string, that is host configuration shaped like the policy. It is not a token-level guarantee and does not change what this decision decides.

## Assumptions

- `[verified]` OpenCode permission entries are coarse glob or prefix patterns and do not expose a token-level normalized-command contract.
- `[verified]` The executable parser checks for these cases live in `packages/shared/pi/tests/tools-core.test.ts`.
- `[inferred]` The implementation owner will choose platform-appropriate fixed environment paths for empty Git configuration, fsmonitor, and hooks while preserving the fixed behavior contract.

## Alternatives Considered

The source repair amendment in [ADR-OC-001](ADR-OC-001-tool-permission-design.md) recorded no explicit pros and cons list. `[inferred]` The rejected design space below is recovered from the superseded design named in Context and from the denials stated in Decision, not from a newly weighed comparison.

- **Keep Git commands as coarse prefix examples such as `git diff*`.** Rejected because such a prefix cannot establish that the invocation is patch-safe, normalized, free of external helpers, or protected from repository configuration. `GIT-01`, `GIT-02`, and `GIT-03` deny bare `git diff`, `git log -p`, and `git show` because of this rejection.
- **Use the broad historical `git*` OpenCode permission as the read-only Git boundary.** Rejected because a permission glob is coarse, non-token-level host configuration that cannot claim the normalized prefix, signature, option, or configuration guarantees of the parser. It remains an implementation-role capability, not evidence of this policy, which is what `GIT-10` keeps separate.
- **Trust repository and user Git configuration inside an allowed segment.** Rejected because configuration must not widen the policy: aliases, hooks, fsmonitor, pager, optional locks, and arbitrary `-c` or `--config-env` values are denied rather than trusted, and the fixed prefix neutralizes them. `GIT-07` and `GIT-09` exist because of this rejection.
- **Keep custom `--format` and `--pretty` options and signature controls as conveniences.** Rejected because they are removed from the safe surface: only `--oneline` may remain safe, and signature placeholders, `--show-signature`, and branch signature formats are denied. `GIT-05` exists because of this rejection.
- **Prove the normalized form against a seeded temporary repository now.** Deferred rather than rejected. The seed should cover pager, lock, fsmonitor, hook, alias, external-diff, textconv, and signature behavior, and check that the normalized command avoids them; the current parser and consolidated E2E tests do not perform that probe.

## Verification

Run the shared Pi/OMP tests and `pnpm e2e:fail-closed` for sampled behavior. A live host probe is required before using the phrase host-enforced.

## Related Decisions

- [ADR-OC-006](ADR-OC-006-pi-omp-read-only-bash-boundary.md): the read-only Bash boundary whose allowlist admits these normalized Git commands.
- [ADR-CORE-028](../core/ADR-CORE-028-behavior-first-testing-and-evidence-preserving-reduction.md): pre-code selection and evidence requirements.
- [Testing Philosophy](../../testing.md): test selection and artifact requirements.

## Supersession

Extends [ADR-OC-001](ADR-OC-001-tool-permission-design.md), which keeps its original context, decision, consequences, and date. ADR-OC-001 continues to own the OpenCode agent permission design; this record owns the normalized read-only Git boundary that its 2026-09-24 repair amendment introduced. ADR-OC-001's Status line names this record as the successor for that amendment.

## Date

2026-09-24
