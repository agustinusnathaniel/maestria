---
"@maestria/agent-plugins": minor
---

Plugin hooks reinforce rules the directives already state, on every host that runs them. Claude Code and ZCode now get the always-on core from a SessionStart hook at session start, after `/clear`, and after compaction, so their mode commands carry only the mode body. Claude Code, ZCode, Codex, Cursor, and Devin add project-root `.maestria/workflow.md` and `.maestria/rules.md` at session start. On Claude Code, ZCode, Codex, Cursor, Devin, and Kimi Code, hooks block `--no-verify` and ask before commits or pushes to protected branches, force pushes, and commands that discard work, before edits to generated files, and before PR or commit text that contains an email address; hosts that cannot ask block with a message that approval is needed. The hooks need `node` on `PATH`; turn them off with your host's settings for plugin hooks.
