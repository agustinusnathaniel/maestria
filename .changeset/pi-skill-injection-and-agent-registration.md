---
"@maestria/pi": minor
---

refactor: use Pi native skill system + pi-subagents agent registration

Replaced non-standard `before_agent_start` + `readFileSync` injection with Pi's standard patterns:

- **Skill-based injection:** Orchestrator dispatcher prompt and global agent rules now ship as `SKILL.md` files auto-discovered from `pi.skills` manifest field and injected by Pi's resource loader into every session's system prompt.
- **Pi-subagents agent registration:** 7 specialist agents defined as `.md` files with YAML frontmatter (`description`, `tools`, `prompt_mode: append`, `inherit_context: true`), deployed to `~/.pi/agent/agents/` at extension startup for pi-subagents discovery. Each specialist has role-specific tool isolation enforcing maker/checker split.
- Removed dead `prompts/` and `rules/` directories (synced but never consumed).
