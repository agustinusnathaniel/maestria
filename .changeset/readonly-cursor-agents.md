---
'@maestria/cursor': minor
'@maestria/core': patch
'maestria': minor
---

feat: @maestria/cursor plugin v0.1 — declarative Cursor IDE and CLI plugin

Initial release of the Cursor platform plugin:

- **7 specialist agents** synced from core (`agents/*.md`) with Cursor-adapted tool names (Read, Glob, Grep, StrReplace, Shell, Write)
- **Orchestrator skill** (`skills/orchestrator/SKILL.md`) with Task-based routing, handoff contracts, and maker/checker enforcement
- **Global rules** (`rules/maestria-global.mdc`, `alwaysApply: true`)
- **Workflow commands** — `/fein` (full pipeline), `/sonar` (research only), `/blitz` (fast implementation)
- **Two-layer maker/checker** — `readonly: true` runtime flag on adventurer/planner/reviewer agents blocks write tools at the Cursor runtime level, with prompt-level instructions as backup
- **CLI support** — `maestria install cursor`, `maestria update cursor`, `maestria uninstall cursor`, `maestria check cursor` via npm (`@maestria/cursor`)
- **Documentation** — installation guide, quick start, changelog, contributing guide, and ADR-CR-001
