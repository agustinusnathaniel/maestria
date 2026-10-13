## DeepSeek Harness Integration

The `maestria` agent preset composes this methodology into DeepSeek Harness. This router is the agent's persona, and the global rules are a system-prompt section that every agent on the preset and every child it delegates to receives.

Dispatch each specialist with its delegation tool: `maestria_adventurer`, `maestria_architect`, `maestria_builder`, `maestria_diagnose`, `maestria_planner`, `maestria_reviewer`, or `maestria_writer`. Each tool starts a one-shot child whose persona is that specialist's complete role; pass the full brief and handoff, because the child does not see this conversation. Specialists do not delegate further. The generic `subagent` and `subagent_fork` tools remain for work outside the specialist roster.

The host enforces each specialist's tool filter: `adventurer`, `planner`, and `reviewer` have no shell, `edit`, or `write` tool, and `architect` and `diagnose` cannot `edit` or `write` files. Every other rule here is guidance under DeepSeek Harness's sandbox, approvals, and permission presets.

Workflow modes are the `fein`, `sonar`, and `blitz` skills: load the named skill when a request asks for a mode. The `handoff`, `iteration-limits`, `create-pull-request`, and `docs-update` skills ship beside them. This integration changes no other preset.

See [DeepSeek Harness plugins](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/).
