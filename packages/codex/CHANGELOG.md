# @maestria/codex

## 0.2.1

### Patch Changes

- [#204](https://github.com/agustinusnathaniel/maestria/pull/204) [`2ec96b2`](https://github.com/agustinusnathaniel/maestria/commit/2ec96b28a0edf38c5d513c5d708c6694303e1676) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add Maestria CLI compatibility for the Claude Code and Codex CLI plugin packages. The CLI detects
  both hosts, stages the published npm package into a local marketplace, and delegates install,
  update, status, check, and uninstall operations to the host plugin manager.

## 0.2.0

### Minor Changes

- [#200](https://github.com/agustinusnathaniel/maestria/pull/200) [`05dab91`](https://github.com/agustinusnathaniel/maestria/commit/05dab914689811e86d978b9b3378be91665e7da6) Thanks [@agustinusnathaniel](https://github.com/agustinusnathaniel)! - Add a provisional Codex CLI projection package that generates Maestria's
  canonical specialist and workflow directives as Codex plugin skills.

## 0.1.0

Initial provisional Codex CLI projection. It packages the canonical Maestria
specialist, orchestration, rules, handoff, iteration-limit, and workflow-mode
directives as Codex skills through `.codex-plugin/plugin.json`.
