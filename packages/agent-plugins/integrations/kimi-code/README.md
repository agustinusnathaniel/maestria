
<!-- Generated from packages/core/agent-directives by scripts/sync-consolidated-plugin.ts. Do not edit directly. -->

## Specialist → Subagent Routing

The Kimi manifest selects only `agents/kimi-code/`, whose seven native Markdown profiles embed the complete role and global policy. Dispatch through Kimi's native Agent tool using the selected specialist identity: `adventurer`, `architect`, `builder`, `diagnose`, `planner`, `reviewer`, or `writer`. Carry the task constraints and complete handoff; neither parent skill loading nor built-in coder/plan/explore mappings supply these identities.

Kimi profile fields include `tools`, `disallowedTools`, and `subagents`. Research and review profiles deny `WriteFile` and `StrReplaceFile`. This is a tool filter, not a shell sandbox. The plugin profile format does not support a model field; the active host chooses the model.

## Session instructions and modes

`systemPromptPath` selects `rules/kimi-code/bootstrap.md`, containing complete policy and routing plus mode instructions within Kimi's 32 KB limit. Native mode commands under `commands/kimi-code/` carry full context and preserve arguments. The Kimi Integration plugin does not use `sessionStart.skill`, `skillInstructions`, or shared role skills.

See [Kimi plugin agents](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html#plugin-agents).
