---
'@maestria/pi': patch
---

Fix chain-mode {previous} substitution so previous results containing `$` sequences are inserted literally, and abort already-spawned subagents when a later parallel spawn fails so none are orphaned.
