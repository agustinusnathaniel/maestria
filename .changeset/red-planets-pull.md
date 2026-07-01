---
"@maestria/opencode": patch
---

Strengthen commit authorization rules in orchestrator directive

- Add explicit COMMIT PROTOCOL section to the orchestrator prompt
- Harden CRITICAL RULE #3 with ZERO authorization after each commit
- Add Commit Policy section to global rules for all subagents
- Tighten prose and remove redundant language
