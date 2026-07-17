---
"maestria": minor
---

feat: add `maestria check <platform>` command for plugin installation verification

New subcommand that checks whether a maestria plugin is installed on a given
platform by reading the platform's own configuration (e.g.
`~/.config/opencode/opencode.jsonc` for OpenCode). Exits 0 if installed, 1 if
not. Machine-readable JSON output by default — optimized for AI agent
consumption.

Also fixes the Hermes plugin's `_check_maestria_plugin()` to use
`maestria check opencode` instead of Node.js `require()` resolution, which
was broken because OpenCode stores plugins in its own config directory, not
in `node_modules/`.
