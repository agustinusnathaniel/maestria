---
'maestria': patch
---

opencode install: use `-g` flag, drop `--force`

The `install` handler for OpenCode omitted the `-g` flag, so it tried to
install at project level — which fails when OpenCode is configured globally.
Also passed `--force` which the `plugin` subcommand doesn't support on first
install, causing the command to always fail.

Now passes `-g` only, which works both for first-time installs and upgrades.
