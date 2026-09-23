---
"maestria": patch
---

Fail loud when `--compact` is passed to `maestria check` or `maestria doctor`. These commands have no compact rendering, so they now exit 1 with guidance to use `--json` or `--quiet` instead of silently ignoring the flag.
