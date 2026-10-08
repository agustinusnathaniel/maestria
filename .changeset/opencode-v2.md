---
'@maestria/opencode-v2': minor
---

feat: add opencode-v2 package for the V2 plugin API

New package that ports Maestria's methodology to the stable OpenCode V2 plugin API (`@opencode/plugin` 2.x via the Effect entrypoint): 8 synced agents, the global rules reference, mode detection on the session context hook, 3 workflow commands, and core skills. The effect pin (4.0.0-rc.112) matches the plugin package's own dependency. Regeneration stays owned by the root sync pipeline (scripts/sync-all) with verification via scripts/check-sync.
