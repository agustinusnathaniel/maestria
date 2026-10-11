
<!-- Generated from packages/core/agent-directives by scripts/sync-consolidated-plugin.ts. Do not edit directly. -->

## Claude Code Integration

### Global rules and specialist agents

The selected native agents embed their complete canonical role and global policy. Dispatch with the Agent tool using `maestria:adventurer`, `maestria:architect`, `maestria:builder`, `maestria:diagnose`, `maestria:planner`, `maestria:reviewer`, or `maestria:writer`. They do not depend on role or policy skills being installed or preloaded.

Research and review agents retain `disallowedTools: Write, Edit` and `model: inherit`. Those metadata fields are host controls; shell-mediated writes and judgment remain outside this guarantee. Plugin `permissionMode`, `hooks`, and `mcpServers` agent fields are ignored by Claude Code.

### Workflow commands

`/maestria:fein`, `/maestria:sonar`, and `/maestria:blitz` are explicit native command files. Each carries the complete mode, router, and global policy and preserves `$ARGUMENTS`. The two utility skills are `handoff` and `iteration-limits`.

See [Claude Code plugin components](https://code.claude.com/docs/en/plugins/components).
