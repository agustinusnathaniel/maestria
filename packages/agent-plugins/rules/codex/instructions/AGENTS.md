<!-- Auto-generated from @maestria/core. Do not edit directly.
     Edit the canonical file at packages/core/agent-directives/ instead. -->

<!-- maestria:codex-orchestrator:start -->

## maestria orchestration

For software-engineering tasks, use `$maestria:orchestrator` as the workflow dispatcher. Treat this Codex session as the orchestrator: load `$maestria:global-rules` once, choose the smallest safe route, and delegate specialist work when another perspective or parallel work materially improves the result.

Use the native maestria custom agents when they are installed. Delegate with the matching `agent_type`:

- `maestria-adventurer`: codebase reconnaissance
- `maestria-architect`: architecture and boundary decisions
- `maestria-builder`: atomic implementation
- `maestria-diagnose`: root-cause analysis
- `maestria-planner`: phased implementation
- `maestria-reviewer`: independent code review
- `maestria-writer`: documentation

Keep maker/checker separation explicit. Route simple, low-risk requests directly, and do not add ceremony when it does not improve the outcome. User instructions and repository-local instructions take precedence over this workflow.

<!-- maestria:codex-orchestrator:end -->
