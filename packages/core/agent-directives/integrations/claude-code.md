## Claude Code and ZCode Integration

A maestria SessionStart hook supplies this always-on core at session start, after `/clear`, and after compaction, followed by project-root `.maestria/workflow.md` and `.maestria/rules.md` when present. The mode commands (`/maestria:fein`, `/maestria:sonar`, `/maestria:blitz` on Claude Code) carry only the mode body. Dispatch the independent review to the plugin's `reviewer` agent (`maestria:reviewer` on Claude Code).

maestria PreToolUse hooks block git hook bypasses and ask before commits or pushes to protected branches, force pushes, commands that discard work, edits to generated files, and PR or commit text with an email address. The rules above apply whether or not a hook runs.
