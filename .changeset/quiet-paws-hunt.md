---
"maestria": minor
---

feat: add `maestria check <platform>` command for plugin installation verification

New subcommand that checks whether a maestria plugin is installed on a given
platform by reading the platform's own configuration (e.g.
`~/.config/opencode/opencode.jsonc` for OpenCode). Exits 0 if installed, 1 if
not. Machine-readable JSON output by default — optimized for AI agent
consumption.
