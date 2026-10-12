---
"@maestria/agent-plugins": minor
"@maestria/opencode": minor
"@maestria/pi": minor
---

Bundle the `create-pull-request` and `docs-update` skills in every maestria package, so the global rules never point an agent at a skill it does not have. `@maestria/agent-plugins` now ships four skills on every plugin host (Claude Code, Codex, Cursor, Kimi Code, Devin, ZCode, OMP, Hermes), `@maestria/pi` loads them from its `skills/` folder, and the `@maestria/opencode` plugin registers its bundled `skills/` folder through `skills.paths`. The copies are generated from the repository-root `skills/`, which stays the `skills.sh` source for runtimes maestria does not package. If you installed either skill separately, remove that copy to avoid a duplicate (`maestria update` removes copies the CLI installed).
