## Specialist → Subagent Routing

The Kimi manifest selects the shared root `agents/` directory, whose seven native Markdown profiles embed the complete role and global policy. Dispatch through Kimi's native Agent tool using the selected specialist identity: `adventurer`, `architect`, `builder`, `diagnose`, `planner`, `reviewer`, or `writer`. Carry the task constraints and complete handoff; neither parent skill loading nor built-in coder/plan/explore mappings supply these identities.

Kimi profile fields include `tools`, `disallowedTools`, and `subagents`. Research and review profiles deny `Write` and `Edit`, and every profile sets `subagents: []` so specialists do not delegate further. This is a tool filter, not a shell sandbox. Profiles set no model; Kimi ignores keys meant for other hosts, such as `readonly`, and the active host chooses the model.

## Session instructions and modes

`systemPromptPath` selects `rules/kimi-code/bootstrap.md`, containing complete policy and routing plus mode instructions within Kimi's 32 KB limit. Native mode commands under the shared root `commands/` carry full context and preserve arguments. The Kimi Integration plugin does not use `sessionStart.skill`, `skillInstructions`, or shared role skills.

See [Kimi plugin agents](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html#plugin-agents).
