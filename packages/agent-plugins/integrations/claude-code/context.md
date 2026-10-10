<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

## Claude Code Integration

### Global rules

Each specialist agent preloads its role skill and the universal `maestria:global-rules` skill. If either is missing from context, stop and report the missing skill before proceeding.

### Specialist agents

Delegate with the Agent tool using the scoped agent names in Specialist Ownership above.

`maestria:adventurer`, `maestria:planner`, and `maestria:reviewer` deny the `Write` and `Edit` tools at the runtime level (read-only research and review roles).

### Workflow mode skills

| Invocation | Pipeline |
| --- | --- |
| `/maestria:fein` | Full pipeline: recon -> design -> implement -> review |
| `/maestria:sonar` | Research only: owning specialist -> optional distinct specialist -> STOP |
| `/maestria:blitz` | Fast path: direct or `maestria:builder` (skip optional ceremony; required review remains) |

### Platform notes

- Methodology and skills are advisory guidance, not hard security enforcement. Tool restrictions (`disallowedTools`) are enforced by Claude Code; everything else is prompt guidance.
- Plugin agent frontmatter `permissionMode`, `hooks`, and `mcpServers` are ignored by Claude Code; do not rely on them.
