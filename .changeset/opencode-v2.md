---
'@maestria/opencode-v2': minor
---

Add maestria for OpenCode V2: the orchestrator and seven specialist agents with the same prompts and permission policy as `@maestria/opencode`, global rules on every agent-loop and compaction request, and `fein`, `sonar`, and `blitz` workflow modes through bare keywords or slash commands. Expanded modes persist with the prompt, keep attachments, and update desktop and web history.

Bundle the `create-pull-request` and `docs-update` skills that the global rules name; a project skill with the same ID takes precedence. The `handoff` and `iteration-limits` skills are no longer registered because their guidance is part of the global rules. Project `.maestria/workflow.md` and `.maestria/rules.md` are read fresh for every agent-loop and compaction request, and unusable files block the request. Requires OpenCode and `@opencode/plugin` 2.0.28 with `effect` 4.
