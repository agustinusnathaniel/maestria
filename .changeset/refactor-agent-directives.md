---
'@maestria/core': patch
'@maestria/cursor': patch
'@maestria/hermes': patch
'@maestria/kimi-code': patch
'@maestria/omp': patch
'@maestria/opencode': patch
'@maestria/pi': patch
---

Refactored all agent directive prompts for better structure, clarity, and cross-platform consistency:

- Restructured core prompts with clearer sections and emphasis on critical rules agents must follow
- Added structured handoff verification checklists to all specialist agents so handoffs between agents are more reliable
- Standardized "Before reporting done" completion checks across all agents, reducing premature sign-offs
- Added Parallelization table for safer multi-agent task execution when builders work in parallel
- Added Multi-Lens Review Swarm capability for comprehensive code review that catches more issues
- Made prompt instructions platform-agnostic so agents behave consistently across OpenCode, Cursor, Kimi Code, Pi, and other platforms
- Fixed several content gaps where important behavioral rules were compressed too aggressively
