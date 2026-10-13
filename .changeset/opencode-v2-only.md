---
'@maestria/opencode': minor
---

`@maestria/opencode` is now an OpenCode V2 plugin and no longer loads in OpenCode V1. On OpenCode V1, pin `@maestria/opencode@0.8.0`, the last V1 release. Install it with `opencode plugin add @maestria/opencode` (or `maestria install opencode`); OpenCode V2 ignores the V1 `plugin` array, so an existing entry there must move to `plugins`.

The orchestrator and seven specialists keep their prompts and permission policy, now as ordered V2 permission rules. Global rules and the project's `.maestria/workflow.md` and `.maestria/rules.md` reach every agent-loop and compaction request, and an unusable project file blocks the request. `fein`, `sonar`, and `blitz` work as bare keywords or slash commands: the expanded mode is stored with the prompt, keeps attachments, shows in desktop and web history, and applies only to that turn. Plugin options move to the V2 object form, `{ "package": "@maestria/opencode", "options": { "modes": { "disabledKeywords": [...] } } }`. The bundled `create-pull-request` and `docs-update` skills register through the plugin, and a project skill with the same ID takes precedence. Requires OpenCode and `@opencode/plugin` 2.0.28 with `effect` 4.
