---
'@maestria/pi': patch
---

The research-only mode (`/sonar`) now also blocks the `maestria_subagent` tool, so it dispatches no subagents as its mode prompt says. Before, only the `subagent` tool from `@gotgenes/pi-subagents` was blocked.
