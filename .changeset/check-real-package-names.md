---
'maestria': patch
---

`maestria check <platform>` now names the package the platform actually installs. Kimi Code, Cursor, OMP, Claude Code, Codex, and Hermes report `@maestria/agent-plugins` instead of a nonexistent `@maestria/<platform>` package such as `@maestria/kimi-code`; OpenCode and Pi messages are unchanged.
