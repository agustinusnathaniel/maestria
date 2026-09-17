---
'@maestria/opencode-v2': minor
---

feat: add opencode-v2 POC package for V2 plugin API

New experimental package that ports Maestria's methodology to the OpenCode V2 beta plugin API using Plugin.define() pattern, ctx.agent.transform() for agent registration, ctx.reference.transform() for global rules, ctx.session.hook() for mode detection and keyword stripping, plus command, skill, and tool transforms. Package-local sync/prebuild scripts are intentionally absent; regeneration stays owned by the root sync pipeline (scripts/sync-all) with verification via scripts/check-sync.
