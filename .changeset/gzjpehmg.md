---
"@maestria/opencode": patch
---

Remove read-only bash permissions (git status/diff/log/show/branch, ls, which, pwd) from orchestrator — it is now a pure dispatcher. Any codebase inspection must go through @adventurer or @builder.
