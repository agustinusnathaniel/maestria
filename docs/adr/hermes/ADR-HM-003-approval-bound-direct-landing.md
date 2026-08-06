# ADR-HM-003: Approval-Bound Landing for Hermes Direct Execution

## Status

Accepted (2026-08-06)

## Context

Hermes direct execution, including `/blitz`, intentionally does not delegate implementation to a Maestria child. That execution rule must not create a shipping bypass. A changed artifact needs one independent reviewer before a commit, push, or pull request is created.

Hermes provides two relevant public surfaces:

- `pre_verify` can keep a turn running after files were changed.
- `PluginContext.subagent_lifecycle` can launch a fresh child and returns an opaque `SubagentHandle` plus an immutable `SubagentResult`.

The lifecycle API only accepts the native roles `leaf` and `orchestrator`. It does not accept a Maestria `reviewer` role, and the child role is not a user-provided prompt marker. The plugin therefore identifies the reviewer by the host-issued handle, parent session, correlation ID, leaf role, depth, and result hash.

## Decision

For a direct session with changed paths:

1. Capture a digest of the changed paths.
2. Launch exactly one native Hermes lifecycle child with `role="leaf"`, the read-only `file` toolset, and a Maestria-owned correlation ID.
3. Wait for the terminal lifecycle result.
4. Approve only when the result is `SUCCEEDED`, ready, hash-valid, associated with the returned host-issued handle, and contains exactly this typed payload:

   ```json
   {
     "protocol": "hermes-landing-review/v1",
     "verdict": "approved",
     "artifact_digest": "<captured digest>"
   }
   ```

5. Block commit, push, and PR creation until that transition is approved.
6. After approval, re-compute the captured digest before every shipping tool call. Allow only one bounded commit, feature-branch push, or PR-create operation. Compound commands, force pushes, and pushes to `main` or `master` remain blocked.

Malformed, rejected, stale, timed-out, hash-invalid, mismatched, or untrusted results remain rejected. A changed artifact invalidates the prior approval. Prompt text, including `[MAESTRIA_ROLE: ...]`, never grants a role or approval.

## Public API limitation

The current Hermes public lifecycle implementation exposes `SubagentResult.structured_payload`, but its `_run` implementation currently leaves that field as `None` and places the child response only in `summary`. The plugin does **not** promote `summary` JSON to an approval because prose is not a host-authenticated typed verdict. Consequently, the real current public API fails closed after the reviewer runs and shipping remains blocked until Hermes provides a populated structured verdict through that public result field. Tests use a native-shaped result with a typed payload to exercise the approved transition without weakening the production guard.

The public handle capability and result hash provide lifecycle identity and immutability checks, but they are not a cryptographic signature over reviewer intent. A future Hermes typed-result contract should preserve the protocol, handle binding, result hash, and artifact digest checks.

## Consequences

### Positive

- Direct execution remains zero-child during implementation.
- Landing cannot proceed without a single host-owned reviewer transition.
- Prompt marker spoofing cannot grant write access or approval.
- Approval is invalidated by any artifact mutation.
- Primary-branch and force pushes remain prohibited even after approval.

### Negative

- With the current public Hermes API, no real review can approve shipping because `structured_payload` is not populated.
- The digest covers the paths reported by Hermes `pre_verify`; Hermes does not currently provide a complete original-requirements field in that hook.

## References

- Hermes public plugin lifecycle API: https://hermes-agent.nousresearch.com/docs/developer-guide/subagent-lifecycle-api
- Hermes plugin hook reference: https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks
- `packages/hermes/src/maestria_hermes/landing_review.py`
- ADR-HM-002: Hermes orchestrator defaults to single-thread execution
