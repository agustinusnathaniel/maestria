---
'@maestria/hermes': patch
---

Orchestrator now defaults to single-thread execution for simple changes instead of always routing work through subagents. Complex tasks (multi-file, cross-domain, risky) still get delegated to specialists. Routine fixes and small features are faster with less context overhead — no change in how you use the plugin.
