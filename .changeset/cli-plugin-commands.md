---
"maestria": minor
---

`maestria plugin validate` is removed; `maestria plugin install` now stages only `@maestria/agent-plugins` from npm and no longer accepts a source argument (local directories and other packages are not staged). An existing `--destination` is still refused.
