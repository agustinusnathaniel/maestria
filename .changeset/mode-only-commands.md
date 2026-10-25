---
"@maestria/agent-plugins": minor
---

Cursor and Kimi Code now use mode-only workflow commands from `mode-commands/`. These hosts already load the maestria router and global policy always-on (Cursor's always-apply rule, Kimi's `systemPromptPath`), so each `/fein`, `/sonar`, or `/blitz` invocation no longer repeats about 3,360 words of policy. Claude Code, ZCode, and OMP keep the complete commands in `commands/`.
