---
'maestria': patch
---

opencode install: always use `-g` flag

The `install` handler for OpenCode omitted the `-g` flag, so it always tried
to install at project level — which fails on machines where OpenCode is
configured globally. Since `install` is a one-time setup command, it should
default to global installation.

Now passes `-g --force` to `opencode plugin` on install.
