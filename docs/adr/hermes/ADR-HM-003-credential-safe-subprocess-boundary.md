# ADR-HM-003: Credential-Safe Hermes Subprocess Boundary

## Status

Accepted (2026-09-24). Implementation verification is pending.

## Context

The Hermes `opencode_route` tool delegates a goal to the OpenCode CLI. The pre-repair handler at the documented base commit called `subprocess.run` with an argument vector, captured text output, inherited the parent environment, and returned truncated `stdout`, `stderr`, and exception text as JSON. Those are useful baseline behaviors, but they do not define a credential-safe boundary. A child can print a token, a host exception can include a command or environment value, and an inherited environment can expose unrelated credentials to the child. `[verified]`

The subprocess is a delegation convenience, not a sandbox. Hermes controls the host process and credentials, and the plugin cannot promise isolation from the CLI, the host, or the user's account. The decision therefore covers data handling, process lifetime, and observable failure results without claiming a new security boundary. `[verified]`

The test-audit remediation is authorized before implementation. The complete pre-code inventory is recorded in [`docs/testing.md`](../../testing.md#pre-code-remediation-inventories). This ADR records the decision and the cases that the implementation owner must select tests for before writing code.

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

The rows below are the minimum cases for the first implementation test pass. Each row names the observable result and a planned evidence target. The builder must write the test before the corresponding implementation change.

| ID | Input or failure | Required observable result | First test or check | Planned evidence target |
| --- | --- | --- | --- | --- |
| SUB-01 | Child exits zero with bounded stdout and stderr | Return `completed`, the return code, and sanitized bounded output; do not report a model or host guarantee | Subprocess adapter test with a fake executable and captured streams | `hermes-subprocess/SUB-01.json` |
| SUB-02 | Child exits non-zero | Return `failed` with the code and sanitized bounded diagnostics; never return `completed` or raw stderr | Fake executable exits with a non-zero code and a sentinel token | `hermes-subprocess/SUB-02.json` |
| SUB-03 | Child exceeds the timeout | Terminate and reap the process, return `timeout`, and omit raw partial output | Fake executable blocks past a short test timeout | `hermes-subprocess/SUB-03.json` |
| SUB-04 | Executable is absent | Return a clear unavailable-executable error without a traceback; do not claim a child ran | Isolated `PATH` with no `opencode` executable | `hermes-subprocess/SUB-04.json` |
| SUB-05 | Workdir is missing, a file, inaccessible, or not a directory | Return invalid-workdir error before spawn; do not fall back to an unintended directory | Temporary workdir matrix with each invalid kind | `hermes-subprocess/SUB-05.json` |
| SUB-06 | Stdout or stderr exceeds its cap | Return a bounded value with a truncation marker; retain no unbounded buffer in the result or artifact | Fake executable emits more than both caps | `hermes-subprocess/SUB-06.json` |
| SUB-07 | Stdout contains a credential sentinel | Redact the sentinel everywhere visible to the caller and artifact | Inject a known secret into fake stdout | `hermes-subprocess/SUB-07.json` |
| SUB-08 | Stderr contains a credential sentinel | Redact the sentinel and preserve only a safe diagnostic | Inject a known secret into fake stderr | `hermes-subprocess/SUB-08.json` |
| SUB-09 | Exception text contains a credential sentinel | Return a safe internal-error category with sanitized detail; never expose `str(exception)` or a traceback | Fake runner raises an exception containing a sentinel | `hermes-subprocess/SUB-09.json` |
| SUB-10 | Sanitizer support is missing or fails to initialize | Fail closed before spawning; return a safe sanitizer-unavailable error and no child output | Replace the sanitizer seam with an unavailable fake | `hermes-subprocess/SUB-10.json` |
| SUB-11 | Parent environment contains unrelated and required variables | Pass only the approved runtime and credential entries; do not pass an unrelated sentinel, and never record secret values | Inspect the exact child `argv`, `cwd`, and `env` through a fake runner | `hermes-subprocess/SUB-11.json` |
| SUB-12 | Goal or context contains shell syntax | Treat it as one data argument; do not execute substitutions, pipelines, or chained commands | Pass metacharacters and a sentinel command in the prompt | `hermes-subprocess/SUB-12.json` |
| SUB-13 | Child creates or leaves a descendant process | Reap or terminate the process group on success, failure, and timeout; leave no owned child behind | Fake executable starts a child and exits on each path | `hermes-subprocess/SUB-13.json` |

## Repair Amendment (2026-09-24): Process Ownership and Redaction Boundary

### Decision

1. On POSIX, start the child in an owned process group. The adapter owns cleanup for success, non-zero exit, timeout, leader early exit, and descendants that ignore `SIGTERM`.
2. Cleanup sends `SIGTERM`, waits a bounded grace period, escalates to `SIGKILL`, reaps the leader, and verifies that the owned group has disappeared. If verification fails, return `cleanup_failed`; do not return a normal result.
3. On Windows, create and own a Job Object for the child. If Job Object ownership is unavailable, fail closed before spawn and return a fixed unsupported-platform result.
4. Do not expose runtime redaction metadata. Sanitized repair artifacts may contain only fixed labels and booleans, never values, hashes, lengths, snippets, environment, or raw output.

The complete `SUB-OWN-*`, `SUB-ART-*`, and related repair case IDs, regeneration command, and artifact schema are recorded in [`docs/testing.md`](../../testing.md#hermes-subprocess-ownership-and-artifact-repair-cases). These are pre-code contracts, not claims that the current runtime passes them.

The canonical package test is `pnpm --filter @maestria/hermes test`. Process cases start from a unique empty project root and isolate `HOME`, `HERMES_HOME`, XDG roots, `TMPDIR`, `PYTHONPATH`, `PATH`, the fake executable, and the artifact root. The separate evidence generator is `python3 packages/hermes/scripts/generate_repair_artifacts.py --artifact-root <outside-repository-root>`; it is not a replacement for the package-scoped Hermes test command, and each run must use fresh staging. Redaction metadata is artifact-only, with fixed labels and booleans, and is never runtime metadata.

### Ownership failure inventory

| ID | Required result | Regeneration and artifact |
| --- | --- | --- |
| SUB-OWN-01 | POSIX success terminates, reaps, and verifies an empty owned group | `pnpm --filter @maestria/hermes test`; `repair/SUB-OWN-01.json` |
| SUB-OWN-02 | POSIX non-zero exit still cleans and verifies the whole group | `pnpm --filter @maestria/hermes test`; `repair/SUB-OWN-02.json` |
| SUB-OWN-03 | Timeout escalates from `SIGTERM` to `SIGKILL`, reaps, and verifies before returning `timeout` | `pnpm --filter @maestria/hermes test`; `repair/SUB-OWN-03.json` |
| SUB-OWN-04 | Leader early exit does not release ownership of descendants | `pnpm --filter @maestria/hermes test`; `repair/SUB-OWN-04.json` |
| SUB-OWN-05 | A descendant ignoring `SIGTERM` is killed and verified gone | `pnpm --filter @maestria/hermes test`; `repair/SUB-OWN-05.json` |
| SUB-OWN-06 | Unverified group cleanup returns `cleanup_failed` | `pnpm --filter @maestria/hermes test`; `repair/SUB-OWN-06.json` |
| SUB-OWN-07 | Windows without Job Object ownership fails closed before spawn | `pnpm --filter @maestria/hermes test`; `repair/SUB-OWN-07.json` |
| SUB-ART-01 | Artifacts contain only fixed labels and booleans, with no runtime redaction metadata or raw values | `pnpm --filter @maestria/hermes test`; `repair/SUB-ART-01.json` |

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
- [`docs/testing.md`](../../testing.md#repair-contract-cases): repair case IDs, artifact schema, and regeneration commands.

## Date

2026-09-24
