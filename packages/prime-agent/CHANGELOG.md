# @maestria/prime-agent

## 0.2.0

### Minor Changes

- [#203](https://github.com/agustinusnathaniel/maestria/pull/203) [`5d0f411`](https://github.com/agustinusnathaniel/maestria/commit/5d0f41176c2a1868d022896ea32e67dad0c00fbe) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add `@maestria/prime-agent`: a package delivering the Maestria methodology for Prime Agent as standard Agent Skills - 7 specialist roles, orchestrator, global-rules, handoff and iteration-limits aids, and fein/sonar/blitz workflow modes - generated from the canonical directives by the root sync pipeline (`skills/<name>/SKILL.md` with required `name`/`description` frontmatter) - plus a small, verified Prime/Pi extension (`dist/extension.mjs`, `pi.extensions`) covering workflow-mode slash commands (`/fein`, `/sonar`, `/blitz`, `/mode-clear`, `/maestria-status`) and `before_agent_start` mode prompt injection with session-scoped mode state (custom session entries, no filesystem writes). Prime Agent evidence was re-verified on 2026-08-13 at immutable upstream commit `7787f07415d843b9a800f6a4720e0c739bd608e5` (see ADR-CORE-014 and the runtime support matrix): the extension uses only the public extension API of the pinned fork, performs no tool interception, and has no runtime dependency on pi packages (the Prime-compatible fork version is unpublished on npm). Native recursive-subagent (`rlm`) dispatch and JSON/RPC headless mode remain deferred - the pinned fork exposes no public JS extension bridge for `rlm` - and no sandbox/enforcement claim is made.

### Patch Changes

- [#205](https://github.com/agustinusnathaniel/maestria/pull/205) [`ca061e4`](https://github.com/agustinusnathaniel/maestria/commit/ca061e423dccf5dbe9728e291d2e943fa3deedc0) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Reuse the npm pack dry-run result across package assertions so the packaging tests do not exceed Vitest's per-test timeout.
