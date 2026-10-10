# ADR-CR-001: Cursor Declarative Plugin for IDE and CLI

## Status

Accepted (2026-07-21). Package topology consolidated by [CORE-034](../core/ADR-CORE-034-consolidated-declarative-plugin.md) on 2026-10-10; the Cursor integration decision and host boundaries remain.

## Context

Cursor IDE and Cursor CLI (`agent`) share a declarative plugin format for rules, skills, agents, and commands. Unlike OpenCode, this integration does not use a TypeScript runtime SDK. Cursor's native agent metadata supports a read-only setting, while hard tool denial through plugin hooks was not part of the selected design.

## Decision

Use Cursor's declarative plugin surface for both IDE and CLI. Generate shared methodology resources from the canonical directives and keep Cursor-specific aliases and native profiles in the Cursor integration. Current projections live in `packages/agent-plugins/plugin/agents/cursor/` and `packages/agent-plugins/plugin/integrations/cursor/`; CORE-034 supersedes the former standalone package layout.

Configure native `readonly: true` metadata for adventurer, planner, and reviewer profiles, backed by prompt guidance. This records the intended host control; package metadata does not by itself establish live runtime enforcement. The portable skills format does not enforce read-only behavior.

## Consequences

- One declarative integration serves Cursor IDE and CLI without a runtime adapter.
- Native read-only metadata expresses a stronger maker/checker control than prompt guidance alone, but live enforcement must be verified against the host and is not established by this record.
- Marketplace publication and programmatic hooks were outside the original decision; distribution and enforcement claims depend on Cursor's current host behavior.
- Consolidation removes a separate package and release identity while preserving Cursor-specific projections.

## Alternatives Considered

- **Use a programmatic Cursor runtime or hooks:** rejected because the selected plugin surface is declarative and no such runtime was needed for the integration.
- **Maintain a separate Cursor package:** superseded by CORE-034, which consolidates declarative integrations under one package.
- **Use prompt-only maker/checker constraints:** weaker than the available native read-only metadata for the relevant profiles.

## Related Decisions

- [CORE-005](../core/ADR-CORE-005-shared-agent-directives-core-sync.md): canonical directives and generated projections.
- [CORE-007](../core/ADR-CORE-007-cli-package-plugin-management.md): CLI platform handlers.
- [KC-001](../kimi-code/ADR-KC-001-kimi-code-architecture.md): declarative integration precedent.

## Date

2026-07-21; consolidated 2026-10-10.
