---
'@maestria/core': patch
'@maestria/opencode': patch
'@maestria/pi': patch
'@maestria/kimi-code': patch
---

Align orchestrator push rules with Branch Discipline

Remove the question() call when the commit protocol lands on main/master.
The Branch Discipline rule already states to never push to main - the
commit protocol now auto-checkouts a feature branch instead of asking.
Synced to all platform plugins.
