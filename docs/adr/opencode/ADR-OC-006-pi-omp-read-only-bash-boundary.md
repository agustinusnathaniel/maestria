# ADR-OC-006: Read-Only Shell Boundary for the Pi Interceptor

## Status

Accepted (2026-09-24), Confidence: High. Absorbed the normalized Git record OC-007 on 2026-11-27. The filename keeps its original slug so incoming references stay valid; the retired OMP package was the other consumer until 2026-10-12.

## Context

Pi's tool interceptor decides which shell commands count as read-only; under `sonar` it blocks every other mutation. It once recognized a broad list of command prefixes, including `find` and package-manager test forms. `find` can execute or delete through flags, package-manager scripts can mutate a workspace, and a prefix check does not show that every pipeline segment, substitution, redirect, or lookalike name is safe. Git prefixes such as `git diff*` likewise cannot show that an invocation avoids pagers, hooks, external diff drivers, or repository configuration.

## Decision

The read-only policy in [`bash-policy.ts`](../../../packages/pi/src/bash-policy.ts) is a small positive allowlist. A command is allowed only when its executable (and, for Git, its subcommand) is recognized exactly, every option is safe for that command, and every pipeline segment is independently safe. It blocks `find`, package-manager execution, command and process substitution, file-target redirection, chaining, background work, lookalike names, and unknown options. Standard-stream duplication such as `2>&1` is allowed only as a parsed file-descriptor operation.

Git is allowed only behind one fixed prefix: `git --no-pager --no-optional-locks -c core.fsmonitor=false -c core.hooksPath=/dev/null -c log.showSignature=false -c format.pretty=medium`. Diff-capable `diff`, `log`, and `show` additionally require `--no-ext-diff --no-textconv` in that order, so bare `git diff`, `git log -p`, and `git show` are denied. Status, branch, and metadata-only log forms use the same prefix; custom `--format` and `--pretty`, signature controls, aliases, arbitrary `-c` or `--config-env`, `--exec-path`, `--git-dir`, `--work-tree`, helpers, and mutation are denied. The option tables and representative cases live in the policy and its [tests](../../../packages/pi/tests/bash-policy.test.ts), not here.

## Security Boundaries

- Only the parser's approval of every token, option, and segment makes a command read-only; a safe prefix never vouches for a later token.
- Repository and user configuration cannot widen the policy. The fixed Git prefix neutralizes pagers, hooks, fsmonitor, optional locks, and signature checks, and external diff and text conversion are denied so a repository cannot run code through a helper.
- An unparsed, unrecognized, or ambiguous command is denied before any host is invoked. Destructive-pattern confirmation is a separate host path and never makes a command read-only.
- OpenCode permission globs carrying the same prefix are host configuration, not this policy ([OC-001](ADR-OC-001-tool-permission-design.md)).

## Consequences

- The policy denies by default, and segment parsing stops a safe first segment from carrying an unsafe later one.
- Agents must use plain file, text, and normalized Git queries instead of `find` or package scripts, and the Git form is long and easy to get wrong.
- The option tables need upkeep when a host adds a command or flag.
- Known gaps: no seeded temporary repository proves the Git prefix avoids configured pagers, hooks, fsmonitor, aliases, external diff, textconv, and signatures, and no live host probe backs an enforcement claim. Parser tests and `pnpm e2e:fail-closed` sample behavior; they do not prove every case.

## Alternatives Considered

- **Keep the broad prefix list:** rejected for the reasons in Context.
- **Grow a prefix regular expression:** rejected because only token and segment parsing catches a safe first segment carrying an unsafe later one.
- **Let destructive-pattern confirmation stand in for classification:** rejected because confirming a dangerous command is not the same as proving a command harmless.
- **Trust repository Git configuration, or keep custom formats as conveniences:** rejected because configuration and format placeholders can run code or trigger signature checks.

## Date

2026-09-24; absorbed OC-007 (2026-09-24) on 2026-11-27.
