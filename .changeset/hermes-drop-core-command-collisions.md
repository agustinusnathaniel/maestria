---
'@maestria/hermes': patch
---

`/review` and `/plan` now run Hermes' built-in commands instead of being swallowed.

Both names belong to Hermes core, so the plugin could not claim them. Because
the plugin intercepts its own slash commands before Hermes resolves them,
typing `/review` silently discarded your message, switched the plugin into
fein mode, and never reached the real command - Hermes' `/review`, which
spawns an independent review subagent.

The plugin now registers five commands: `/fein`, `/sonar`, `/blitz`,
`/mode`, and `/mode-clear`. Nothing is lost by dropping its own `/review`
and `/plan` - both only switched to fein mode, and its reviewer and planner
specialists already run as pipeline stages under `/fein`.

A regression test now checks every registered command against Hermes' live
command registry, so a future command that collides with a core one fails a
test instead of quietly swallowing your message again.