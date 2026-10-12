
<!-- Generated from packages/core/agent-directives by scripts/sync-consolidated-plugin.ts. Do not edit directly. -->

## ZCode Integration

The overlay selects the shared `agents/` and `commands/` directories; ZCode reads these selectors as directories and loads only `.md` files, so the Codex TOML profiles are not loaded. Agents embed complete role and policy; commands embed the complete mode, router, and policy. Utility skills remain under root `skills/`. Research, architecture, and review profiles deny `Write` and `Edit` through `disallowedTools`; ZCode removes those tools from the subagent's tool list and ignores keys meant for other hosts. Shell access remains, so this is a tool filter, not a sandbox. ZCode has no plugin rules component, which is why profiles and commands carry the complete policy. Use the native agent and command controls exposed by ZCode and carry a complete task handoff.

See [ZCode plugins](https://zcode.z.ai/en/docs/plugin).
