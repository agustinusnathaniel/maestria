## Kimi Code Integration

### Specialist → Subagent Routing

The Kimi manifest selects the shared root `agents/` directory, whose native `reviewer` Markdown profile embeds the complete role and the global policy parts it needs. Dispatch the independent review through Kimi's native Agent tool with the `reviewer` identity. Carry the task constraints and complete handoff; neither parent skill loading nor built-in coder/plan/explore mappings supply these identities.

Kimi profile fields include `tools`, `disallowedTools`, and `subagents`. The reviewer profile denies `Write` and `Edit` and sets `subagents: []` so it does not delegate further. This is a tool filter, not a shell sandbox. Profiles set no model; Kimi ignores keys meant for other hosts, such as `readonly`, and the active host chooses the model.

### Session instructions and modes

`systemPromptPath` selects this file, the package's root `kimi.system-prompt.md`, containing complete policy and routing plus mode instructions within Kimi's 32 KB limit; it carries only this host note, so other hosts' notes in the shared `AGENTS.md` do not count against that limit. Native mode commands under the shared root `commands/` carry full context and preserve arguments. The Kimi Integration plugin does not use `sessionStart.skill`, `skillInstructions`, or shared role skills.

See [Kimi plugin agents](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html#plugin-agents).
