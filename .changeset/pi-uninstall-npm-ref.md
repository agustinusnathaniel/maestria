---
'maestria': patch
---

Fix `maestria uninstall pi` failing with `No matching package found for @maestria/pi`. The Pi uninstall now passes the `npm:@maestria/pi` package reference, matching the form `pi install` accepts. The shared `@gotgenes/pi-subagents` prerequisite is still left untouched.
