---
'@maestria/opencode': patch
---

Fix mode prompts not loading after plugin install

Mode keywords (fein/sonar/blitz) would fail silently when the plugin was loaded from an installed package because the prompt files path didn't resolve correctly after bundling. Now uses Node's built-in package detection to always find the right directory.
