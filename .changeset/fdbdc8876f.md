---
'@maestria/hermes': patch
---

Default single-thread orchestration, delegate only for complex tasks

Updates the orchestrator skill to default to direct implementation rather than always delegating via `delegate_task`. Complex tasks (4+ files, multi-domain, risky, or explicit "Maestria mode") still use subagent delegation.

Changes:
- sync.config.ts: 5 replace rules adapting the "pure dispatcher" mandate for Hermes' full-tool orchestrator
- pre_llm.py: fein mode context updated to reflect single-thread default
- orchestrator/SKILL.md: regenerated from sync with new replace rules
- Version bumped to 0.1.4
