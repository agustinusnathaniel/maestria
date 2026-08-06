# ADR-OC-007: Approval-Bound Landing Review

## Status

Accepted

## Context

ADR-OC-006 separated direct execution from landing review, but its landing route still exposed a model-visible reviewer dispatch and allowed shipping as soon as that dispatch had been attempted. Direct mode also allowed `bash` to run commit, push, and pull-request commands. Neither behavior made the maker/checker boundary an enforceable approval gate.

## Decision

The OpenCode plugin owns a fail-closed landing-review state machine and the `maestria_landing_review` tool. A direct turn can select the one-way `landing-review` route, which arms the state machine. The plugin tool then:

1. claims the armed state before doing asynchronous work, preventing a second concurrent invocation from creating another child;
2. computes an artifact digest from OpenCode's current `file.status` and the root session's `session.diff`;
3. creates exactly one child with `session.create({ body: { parentID } })`;
4. verifies the returned child ID and `parentID`, then prompts that exact child with `agent: "reviewer"`;
5. accepts exactly one text part containing a strict JSON object with only `verdict`, `artifactDigest`, `summary`, and `findings` fields;
6. recomputes the digest and enters `approved` only when the response identity, verdict, and both digests match.

The states are `inactive`, `armed`, `reviewing`, `rejected`, `failed`, `stale`, and `approved`. All root tools are blocked in `armed`, `reviewing`, `rejected`, `failed`, and `stale`. `approved` exposes only the tightly parsed shipping command language through `bash`. The plugin recomputes the digest before every approved shipping operation and again after it. Any change invalidates approval.

The command language accepts only individual `git status`, `git diff`, `git add`, `git commit`, `git push`, `vp check`, `vp test`, and `gh pr create/edit` commands. It rejects shell operators and expansions, force and delete pushes, primary-branch references (`main` and `master`), PR `--base`/`--head` primary targets, repository overrides, and unsafe commit flags such as `--amend` and `--no-verify`.

## API constraints

Implementation was checked against the installed `@opencode-ai/plugin@1.18.4` and `@opencode-ai/sdk@1.18.4` declarations and runtime surface, plus the official plugin and SDK documentation:

- `PluginInput` supplies an SDK `client`, project paths, and Bun's `$`; it does not expose a child-session creation primitive.
- The SDK does expose `client.session.create`, whose installed type accepts `body.parentID` and returns a request result whose `data` is a `Session` with `id` and optional `parentID` (the implementation handles both the installed request-result envelope and direct test doubles).
- `client.session.prompt` accepts `body.agent` and text `parts`, and returns a request result whose `data` is `{ info, parts }`. The installed 1.18.4 `SessionPromptData` type does **not** expose the newer documentation's `outputFormat`/structured-output field. The plugin therefore validates one returned text part with `JSON.parse` rather than claiming SDK-level structured-output enforcement.
- The digest uses the installed `client.file.status` and `client.session.diff` endpoints. It does not execute an unrestricted shell to derive policy state.
- `tool.execute.before` can throw to prevent a tool call, and `tool.execute.after` can observe the result. These hooks cannot prevent a user or another process from changing a worktree outside OpenCode, and they do not control external Git clients.

## Guarantees and limits

### Guarantees

- Direct root `bash` calls cannot run commit, push, or PR shipping commands.
- A landing review has at most one plugin-created reviewer child per root turn.
- The child is parent-bound to the root and the response must identify that child session.
- Malformed, rejected, identity-mismatched, digest-mismatched, failed, and stale reviews never enable root shipping.
- Approved shipping is limited to the parser's command language and is invalidated when the artifact digest changes.

### Limits

- This is per-plugin-instance in-memory state. Session cleanup or plugin restart removes the state and requires a new review.
- The digest is a host/API snapshot, not a cryptographic signature from Git or the reviewer. A compromised OpenCode server or plugin can bypass this policy.
- OpenCode permission configuration and other plugins remain independent policy layers. This plugin does not claim to replace them.
- The reviewer model's behavior is not made trustworthy by cryptography. Trust here means the plugin created the child, selected the configured `reviewer` agent, verified parentage, and verified the response session identity.

## Consequences

Positive:

- Landing approval is a programmatic state transition rather than a prompt instruction or a dispatch side effect.
- A changed artifact cannot reuse an old approval.
- The unsafe command surface is explicit, testable, and fail-closed.

Negative:

- The plugin must track OpenCode's SDK and hook contracts and update its digest adapter if those APIs change.
- The installed SDK's lack of structured-output support requires local strict JSON validation.

## References

- OpenCode Plugins: https://opencode.ai/docs/plugins/
- OpenCode SDK: https://opencode.ai/docs/sdk/
- Installed declarations: `@opencode-ai/plugin@1.18.4` and `@opencode-ai/sdk@1.18.4`

## Date

2026-08-06
