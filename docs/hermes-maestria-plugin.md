# @maestria/hermes: Plugin Architecture

## Purpose

Record the design rationale and trust boundaries of the Hermes adapter. This is not an installation guide or a complete inventory of the plugin's registrations.

## Audience

Contributors changing the Hermes adapter or its relationship to the shared methodology.

## Architecture

The seven Maestria specialists and their workflow are methodology identities, not Hermes-specific agents or tool grants. Their canonical instructions live in [`packages/core/agent-directives/`](../packages/core/agent-directives/); Hermes projects those instructions through its plugin API. The [orchestrator directive](../packages/core/agent-directives/specialists/orchestrator.md) owns task routing and pipeline selection.

The adapter uses Hermes-native capabilities such as `delegate_task` and host LLM calls instead of adding a second subagent or reasoning system. Maestria does not depend on which Hermes memory provider is enabled and does not add a memory layer; memory remains a host concern.

Hermes serves general work across research, content, analysis, strategy, operations, and software engineering. The OpenCode adapter is coding-focused. Hermes can use its own tools for small coding tasks and optionally route complex coding work through the OpenCode CLI from a trusted top-level session.

## Delegated-child trust boundary

The approved policy is recorded in [ADR-HM-002](adr/hermes/ADR-HM-002-orchestration-policy.md); the Hermes runtime and canonical directives are authoritative for current behavior.

- A specialist name in a delegation brief is a routing label. Hermes child roles describe native topology (`leaf` or `orchestrator`), not Maestria permissions.
- User or delegation text cannot grant capabilities. Every delegated child receives the same fixed read, research, and LLM-only policy; children cannot write, execute code, run a shell, delegate further, or invoke OpenCode.
- Direct tool use requires a positively identified trusted top-level session. Ambiguous or invalid child state fails closed. Sonar and direct blitz use fixed allowlists.
- Review and landing requirements are advisory because Hermes has no native review-state or landing gate. Delegated builder writes remain deferred until Hermes exposes an authenticated capability channel; code changes run in a trusted top-level fein session.

## Coding work

The `opencode_route` tool is optional and available only to a trusted top-level fein session. Small tasks can use Hermes tools directly; complex or risky coding tasks can route to OpenCode with a structured brief. Results return to the top-level session for review and integration. A delegated child cannot write or invoke this route.

## Current implementation and evidence

Current installation and user guidance live in the [package README](../packages/hermes/README.md). The registered plugin surface is defined in `packages/hermes/plugin.yaml` and `packages/hermes/src/maestria_hermes/`; package tests cover its runtime behavior. The plugin manifest, source, and tests are the source of truth for current commands, skills, tools, and hooks.

[ADR-HM-001](adr/hermes/ADR-HM-001-long-lived-goals-scope.md) records the long-lived-goals boundary. [ADR-CORE-005](adr/core/ADR-CORE-005-shared-agent-directives-core-sync.md) records canonical directive ownership and projection.

## Dated evidence

- 2026-09-25: The trust boundary and source pointers were checked against ADR-HM-002, the Hermes plugin manifest, runtime hooks, and canonical orchestrator and builder skills. `[verified]`

## Next step

Check the package source and relevant ADRs before changing the adapter. Use the package README for installation and use.
