---
"@maestria/agent-plugins": minor
"@maestria/opencode": minor
"@maestria/pi": minor
---

A new guard asks before a shell command prints the whole environment, which would put every secret in it into the transcript: `env` or `printenv` with no command or variable name, a bare `set`, `export` or `export -p`, `declare -x`, `declare -p`, or `typeset -x` with no names, and reading `/proc/<pid>/environ`, in any part of a pipeline, list, subshell, or command substitution and under wrappers such as `sudo`. Ordinary use stays allowed: `env FOO=1 node app.js`, `printenv HOME`, `set -e`, `export FOO=bar`, and these words as data in arguments, quoted text, or heredocs. The message tells the agent to read the one variable by name, and for a secret to check presence only (`[ -n "$NAME" ] && echo set`). It runs as a plugin hook on Claude Code, ZCode, Codex, Cursor, Devin, and Kimi Code (hosts that cannot ask block with a message that approval is needed), in OpenCode's permission prompt, and in Pi's `tool_call` and `!` shell commands.

Long chains of `env` wrappers remain checked without exhausting the call stack. Quoted or commented heredoc markers cannot hide a later environment dump from the guard. Attached option values such as `env -uSSH_AUTH_SOCK` are treated as variable names rather than flags.
