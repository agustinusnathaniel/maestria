# ADR-HM-003: Credential-Safe Hermes Subprocess Boundary

## Status

Accepted (2026-09-24). The adapter is implemented; complete case-by-case verification remains pending.

## Context

The Hermes `opencode_route` tool delegates a goal to the OpenCode CLI. The pre-repair handler at the documented base commit called `subprocess.run` with an argument vector, captured text output, inherited the parent environment, and returned truncated `stdout`, `stderr`, and exception text as JSON. Those are useful baseline behaviors, but they do not define a credential-safe boundary. A child can print a token, a host exception can include a command or environment value, and an inherited environment can expose unrelated credentials to the child. `[verified]`

The subprocess is a delegation convenience, not a sandbox. Hermes controls the host process and credentials, and the plugin cannot promise isolation from the CLI, the host, or the user's account. The decision therefore covers data handling, process lifetime, and observable failure results without claiming a new security boundary. `[verified]`

The failure-mode inventory below records the intended contract. [Testing Philosophy](../../testing.md) explains how to select tests; the inventory is not evidence that every case passes.

## Goals

- Prevent raw credentials from entering the tool result, logs, exceptions, or retained test artifacts.
- Use an argument vector, an explicit working directory, a bounded timeout, and bounded output capture.
- Give callers a clear, structured result for success, non-zero exit, timeout, missing executable, invalid working directory, and other failures.
- Propagate only an explicitly approved child environment, with credential values treated as secrets even when they are required by the CLI.
- Clean up the child process and temporary data on every exit path.
- Keep the boundary honest: package tests prove the adapter contract, not a live Hermes or OpenCode host guarantee.

## Non-Goals

- No shell evaluation, command interpolation, or arbitrary executable selection.
- No new sandbox, container, credential broker, or process-isolation guarantee.
- No promise that OpenCode itself is safe, that its output is trustworthy, or that Hermes redacts secrets on the plugin's behalf.
- No change to the route tool's public goal, workdir, or context contract in this decision.
- No new package dependency unless the implementation owner can justify a sanitizer that is available in the supported Python environment.

## Decision

### Execution boundary

1. Invoke `opencode` with an argument vector equivalent to `opencode run <prompt>`, with shell evaluation disabled. `goal` and `context` are data passed as one argument, never parsed as shell syntax.
2. Validate and resolve `workdir` before spawning. A missing path, a file, an inaccessible path, or a path that is not a directory produces a structured error and no child process.
3. Apply a finite timeout. The current five-minute timeout is the baseline. On timeout, terminate and reap the child, then return a timeout result without exposing raw partial output.
4. Capture stdout and stderr with explicit limits. The current 2,000-character stdout and 500-character stderr limits are the initial caps. Add a visible truncation marker, and never use output length as a substitute for redaction.
5. Sanitize stdout, stderr, exception text, and any diagnostic before returning or logging it. A sanitizer unavailable at runtime is a fail-closed precondition: do not spawn the child and do not return raw output.

### Environment and logging boundary

- Build the child environment from an explicit allowlist of runtime variables required to locate the executable and run the child, plus credential variables explicitly approved for the OpenCode integration. Do not pass the complete parent environment by default.
- A required credential may be passed to the child, but its value must not appear in the result, logs, exception text, or artifacts. Redaction uses the known secret values and conservative credential-shaped patterns, but no redaction metadata is returned or recorded.
- Do not log the complete goal, context, command line, or environment. A diagnostic may use a fixed status label; repair artifacts do not retain paths, output sizes, or other dynamic metadata.
- A successful child result is not a claim that the child obeyed project policy. The host remains responsible for its own permissions and credentials.

### Result contract

Return one JSON object with a status category and any contract-approved sanitized output or error. Do not return runtime redaction metadata such as matched patterns, redaction counts, hashes, lengths, secret labels, environment metadata, or descriptions of what was removed. Use distinct categories for completed, non-zero exit, timeout, unavailable executable, invalid workdir, internal error, and cleanup failure. A non-zero exit, timeout, exception, or unverified cleanup must not return a success category. Exceptions are converted to a safe category and sanitized detail; tracebacks and raw exception strings are not returned by default.

### Pre-code failure-mode inventory

The rows below retain the original failure-mode inventory; they do not imply that every case has a passing test.

| ID | Failure mode | Required result |
| --- | --- | --- |
| SUB-01 | Successful child | Return `completed` with bounded, sanitized output and its exit code. |
| SUB-02 | Non-zero exit | Return `failed` with the code and a safe diagnostic, never raw stderr. |
| SUB-03 | Timeout | Terminate and reap the process; omit raw partial output. |
| SUB-04 | Missing executable | Report unavailability without a traceback or a claim that the child ran. |
| SUB-05 | Missing, inaccessible, or non-directory workdir | Reject before spawn without falling back to another directory. |
| SUB-06 | Oversized stdout or stderr | Bound output and mark truncation. |
| SUB-07 | Credential in stdout | Redact it in every caller-visible result. |
| SUB-08 | Credential in stderr | Redact it and preserve only a safe diagnostic. |
| SUB-09 | Credential in exception text | Return a safe internal-error category without raw exception text. |
| SUB-10 | Unavailable sanitizer | Fail closed before spawn and return no child output. |
| SUB-11 | Unrelated parent environment entries | Pass only approved runtime and credential entries; never expose secret values. |
| SUB-12 | Shell syntax in goal or context | Pass it as data in one argument; execute no substitutions or chained commands. |
| SUB-13 | Descendant process | Clean up the owned group on success, failure, and timeout. |

## Repair Amendment (2026-09-24): Process Ownership and Redaction Boundary

### Decision

1. On POSIX, start the child in an owned process group. The adapter owns cleanup for success, non-zero exit, timeout, leader early exit, and descendants that ignore `SIGTERM`.
2. Cleanup sends `SIGTERM`, waits a bounded grace period, escalates to `SIGKILL`, reaps the leader, and verifies that the owned group has disappeared. If verification fails, return `cleanup_failed`; do not return a normal result.
3. Windows execution requires an owned Job Object. The current adapter does not provide one, so it fails closed before spawn with `cleanup_unavailable`; Job Object cleanup remains future work.
4. Do not expose runtime redaction metadata. Sanitized repair artifacts may contain only fixed labels and booleans, never values, hashes, lengths, snippets, environment, or raw output.

The ownership cases below remain the planned contract. The current [consolidated E2E probe](../../../scripts/e2e/fail-closed-evidence.ts) samples subprocess success, timeout, output bounds, and platform cleanup availability; it does not establish every `SUB-*` case. The package tests are run with `pnpm --filter @maestria/hermes test`. No per-case repair artifact generator is maintained in this repository.

### Ownership failure inventory

| ID | Required result |
| --- | --- |
| SUB-OWN-01 | POSIX success terminates, reaps, and verifies an empty owned group. |
| SUB-OWN-02 | Non-zero exit still cleans and verifies the group. |
| SUB-OWN-03 | Timeout escalates from `SIGTERM` to `SIGKILL` before returning `timeout`. |
| SUB-OWN-04 | Leader exit does not release ownership of descendants. |
| SUB-OWN-05 | A descendant ignoring `SIGTERM` is killed and verified gone. |
| SUB-OWN-06 | Unverified cleanup returns `cleanup_failed`. |
| SUB-OWN-07 | Windows without Job Object ownership fails closed before spawn. |
| SUB-ART-01 | Retained evidence contains fixed labels and booleans, without raw values or redaction metadata. |

## Consequences

### Positive

- Tool results and retained evidence have a smaller credential exposure surface.
- Callers can distinguish process failure categories without parsing raw exception text.
- Tests can exercise the boundary with fake executables and temporary directories without contacting a live host.
- The implementation has an explicit environment and process-lifetime contract.

### Negative

- Output is less complete than raw capture, and users may need to rerun a task with a narrower prompt.
- A sanitizer dependency or explicit environment map adds maintenance and may need updating with the OpenCode CLI.
- Timeout and process-group cleanup require more platform-aware code than a direct `subprocess.run` call.
- The boundary still runs with the host user's authority. It is not a substitute for host permissions or a sandbox.

## Assumptions

- `[verified]` The pre-repair handler at the documented base commit invoked `subprocess.run` with `capture_output=True`, `text=True`, a 300-second timeout, and no explicit `env` map; it returned raw `stdout`, `stderr`, and exception text after simple truncation.
- `[verified]` The pre-repair package had no sanitizer contract at the route boundary; the repair implementation must satisfy the redaction and ownership contract before claiming credential-safe behavior.
- `[inferred]` The exact OpenCode credential variables and minimum non-secret runtime variables vary by installation. The implementation owner must pin and document the supported allowlist against the installed CLI before accepting SUB-11.
- `[verified]` Hermes owns host process credentials and tool authorization. This plugin cannot infer or guarantee host-level sandboxing from a subprocess result.

## Alternatives Considered

### Inherit the complete environment and return truncated output

Rejected. Truncation limits size but does not remove secrets, and inherited unrelated credentials increase exposure. The child needs an explicit environment map.

### Execute through a shell string

Rejected. Shell parsing expands substitutions, redirects output, and permits command chaining. The route boundary needs an argument vector and data-only prompt.

### Redact with an informal list of output patterns

Rejected alone. Pattern-only redaction misses values that come from the environment or exception objects. Redaction must cover known secret values and every output channel, and it must fail closed when unavailable.

### Add a full sandbox or credential broker

Deferred. It changes the host and deployment model and is outside this package boundary. The current decision limits data exposure without claiming isolation.

## Rollback

Revert the route-boundary implementation, its tests, and this ADR together. Do not restore raw exception or output handling as a partial rollback. If the sanitizer or environment contract cannot be supported by the pinned host, keep the route unavailable and report that limitation rather than silently passing unredacted data.

## Related Decisions

- [ADR-HM-000](ADR-HM-000-plugin-over-skills-only.md): Hermes plugin distribution and host-native enforcement boundary.
- [ADR-HM-002](ADR-HM-002-orchestration-policy.md): trusted top-level and role-neutral child capability policy.
- [ADR-OC-001](../opencode/ADR-OC-001-tool-permission-design.md): coarse OpenCode permission policy and host-enforcement limits.
- [ADR-CORE-028](../core/ADR-CORE-028-behavior-first-testing-and-evidence-preserving-reduction.md): pre-code test selection and repeatable evidence.
- [Testing Philosophy](../../testing.md): test selection and evidence requirements.

## Date

2026-09-24
