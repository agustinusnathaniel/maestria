---
'@maestria/core': patch
'@maestria/opencode': patch
'@maestria/kimi-code': patch
'@maestria/pi': patch
---

Reorder conventional commit prefixes — refactor as default

`refactor` is now the default conventional commit prefix instead of
`feat`. `feat` is scoped to user-facing features only. Explicit
decision rule added: if a change doesn't introduce a new user-facing
capability, it's `refactor`, not `feat`.
