# @maestria/prime-agent

## 0.3.4

### Patch Changes

- [#275](https://github.com/agustinusnathaniel/maestria/pull/275) [`56351de`](https://github.com/agustinusnathaniel/maestria/commit/56351debf73a97c24eb10826517e0d9aabeaca6b) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Refine specialist engineering judgment around trust-boundary normalization, feature-local seams, shared-interface compatibility, executable sources of truth, staged migrations, durable diagnostic knowledge, and operational documentation.

## 0.3.3

### Patch Changes

- [#269](https://github.com/agustinusnathaniel/maestria/pull/269) [`ef07bf7`](https://github.com/agustinusnathaniel/maestria/commit/ef07bf78a8e5f676c76b55680301bc7c839b68a9) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add conditional visual-evidence guidance for PR delivery: confirm the project targets GitHub with authenticated gh --attach support and an available capture tool before attaching a screenshot or short video for visual or behavioral changes. Vision is optional verification only, not a precondition.

- [#269](https://github.com/agustinusnathaniel/maestria/pull/269) [`ef07bf7`](https://github.com/agustinusnathaniel/maestria/commit/ef07bf78a8e5f676c76b55680301bc7c839b68a9) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add a global testing-judgment rule (test artifacts are opt-in, behavior over implementation shape, mocks only at external seams) and align reviewer and diagnose guidance with it.

## 0.3.2

### Patch Changes

- [#246](https://github.com/agustinusnathaniel/maestria/pull/246) [`e4b5d86`](https://github.com/agustinusnathaniel/maestria/commit/e4b5d867365aec4617fe349360e2b5f8407fb4ba) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Prefer self-explanatory code across all agent projections by emphasizing clear structure over explanatory comments and reserving comments for concise context the code cannot express.

## 0.3.1

### Patch Changes

- [#235](https://github.com/agustinusnathaniel/maestria/pull/235) [`6db422d`](https://github.com/agustinusnathaniel/maestria/commit/6db422d2b22429b52f1943fca4c9ee7374f8a5c6) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Enforce a shared human-facing output contract across all agent projections. Authored responses, comments, commits, pull request metadata, and documentation must avoid Unicode U+2014 while preserving code syntax, intentional literals, quoted source text, and user-provided text.

## 0.3.0

### Minor Changes

- [#226](https://github.com/agustinusnathaniel/maestria/pull/226) [`d0364a8`](https://github.com/agustinusnathaniel/maestria/commit/d0364a8d827e058a900bf88fd6048a21eb6efa4f) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Simplify agent directives for token efficiency. Consolidate delivery autonomy around an explicit terminal-artifact rule (reviewed changes on a pushed feature branch with an open PR), add transient-delegation-failure recovery duty, carry binding user constraints through every delegation brief, trim dead skill references into compact per-role skill catalogs, and align sync-config replace anchors with the revised canonical text.

## 0.2.2

### Patch Changes

- [#213](https://github.com/agustinusnathaniel/maestria/pull/213) [`b6f3a09`](https://github.com/agustinusnathaniel/maestria/commit/b6f3a09d1be75e6f19e1d3736f71696df44f3c6d) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Bound review and repair to material blockers, preserve narrow approval boundaries, and complete routine implementation delivery autonomously.

## 0.2.1

### Patch Changes

- [#210](https://github.com/agustinusnathaniel/maestria/pull/210) [`88cc573`](https://github.com/agustinusnathaniel/maestria/commit/88cc5738ac2b1d5c381bba58f7208498087b2bfa) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Keep normal engineering sessions autonomous through continuation, scope-frozen bounded repair, and reviewable PR delivery. Incomplete specialist work is recovered or reported as a structured blocker instead of becoming an implicit user checkpoint.

## 0.2.0

### Minor Changes

- [#203](https://github.com/agustinusnathaniel/maestria/pull/203) [`5d0f411`](https://github.com/agustinusnathaniel/maestria/commit/5d0f41176c2a1868d022896ea32e67dad0c00fbe) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add `@maestria/prime-agent`: a package delivering the Maestria methodology for Prime Agent as standard Agent Skills - 7 specialist roles, orchestrator, global-rules, handoff and iteration-limits aids, and fein/sonar/blitz workflow modes - generated from the canonical directives by the root sync pipeline (`skills/<name>/SKILL.md` with required `name`/`description` frontmatter) - plus a small, verified Prime/Pi extension (`dist/extension.mjs`, `pi.extensions`) covering workflow-mode slash commands (`/fein`, `/sonar`, `/blitz`, `/mode-clear`, `/maestria-status`) and `before_agent_start` mode prompt injection with session-scoped mode state (custom session entries, no filesystem writes). Prime Agent evidence was re-verified on 2026-08-13 at immutable upstream commit `7787f07415d843b9a800f6a4720e0c739bd608e5` (see ADR-CORE-014 and the runtime support matrix): the extension uses only the public extension API of the pinned fork, performs no tool interception, and has no runtime dependency on pi packages (the Prime-compatible fork version is unpublished on npm). Native recursive-subagent (`rlm`) dispatch and JSON/RPC headless mode remain deferred - the pinned fork exposes no public JS extension bridge for `rlm` - and no sandbox/enforcement claim is made.

### Patch Changes

- [#205](https://github.com/agustinusnathaniel/maestria/pull/205) [`ca061e4`](https://github.com/agustinusnathaniel/maestria/commit/ca061e423dccf5dbe9728e291d2e943fa3deedc0) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Reuse the npm pack dry-run result across package assertions so the packaging tests do not exceed Vitest's per-test timeout.
