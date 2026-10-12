## Claude Code Integration

### Global rules and specialist agents

The selected native agents embed their complete canonical role and global policy. Dispatch with the Agent tool using `maestria:adventurer`, `maestria:architect`, `maestria:builder`, `maestria:diagnose`, `maestria:planner`, `maestria:reviewer`, or `maestria:writer`. They do not depend on role or policy skills being installed or preloaded.

The manifest lists the shared root `agents/<role>.md` files explicitly, because Claude Code accepts only agent file paths. Research, architecture, and review agents deny `Write` and `Edit` through `disallowedTools`; that is a tool filter, so shell-mediated writes and judgment remain outside this guarantee. Profiles omit `model`, so each agent uses the main conversation's model. Keys meant for other hosts (`readonly`, `subagents`) are ignored by Claude Code. Plugin `permissionMode`, `hooks`, and `mcpServers` agent fields are ignored by Claude Code.

### Workflow commands

`/maestria:fein`, `/maestria:sonar`, and `/maestria:blitz` are explicit native command files. Each carries the complete mode, router, and global policy and preserves `$ARGUMENTS`. The two utility skills are `handoff` and `iteration-limits`.

See [Claude Code plugin components](https://code.claude.com/docs/en/plugins/components).
