---
"@maestria/kimi-code": patch
---

Fix duplicate skills, thin orchestrator, fix skillInstructions, trim AGENTS.md

- Removes duplicate `diagnose` from diagnose SKILL.md Load on trigger
- Removes duplicate `architecture-decision-records` (anthropics) from architect SKILL.md
- Removes non-existent `write-a-skill` (mattpocock/skills) from writer SKILL.md
- Installs `architecture-decision-framework` (agustinusnathaniel/skills)
- Adds missing source annotations to orchestrator SKILL.md Always load entries
- Thins orchestrator SKILL.md by removing ~67 lines of internal Kimi Code implementation details
- Fixes skillInstructions in kimi.plugin.json to tactical dispatch rules
- Removes redundant delegation table from rules/AGENTS.md
- Updates contributing, INSTALL, README, and ADR-009 to reflect current implementation
