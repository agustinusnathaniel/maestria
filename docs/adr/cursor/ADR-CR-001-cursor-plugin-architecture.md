# ADR-CR-001: Cursor Declarative Plugin for IDE and CLI

## Status

Accepted (2026-07-21). Package topology consolidated by [CORE-034](../core/ADR-CORE-034-consolidated-declarative-plugin.md) on 2026-10-10; the Cursor integration decision and host boundaries remain.

## Context

Cursor IDE and Cursor CLI (`agent`) share a declarative plugin format for rules, skills, agents, and commands. Unlike OpenCode, this integration does not use a TypeScript runtime SDK. Cursor's native agent metadata supports a read-only setting, while hard tool denial through plugin hooks was not part of the selected design.

## Decision

Use Cursor's declarative plugin surface for both IDE and CLI. Cursor consumes the shared native profiles and commands generated from the canonical directives, plus its own always-apply rule.

Configure native `readonly: true` metadata for adventurer, planner, and reviewer profiles, backed by prompt guidance. A Cursor CLI 2026.10.01 probe (2026-10-12) found that Cursor enforces `readonly` for project `.cursor/agents/` profiles but not for plugin-supplied profiles, so plugin read-only currently rests on prompt guidance. Project-level model configuration copies profiles into `.cursor/agents/`, where the flag is enforced. The portable skills format does not enforce read-only behavior.

## Consequences

- One declarative integration serves Cursor IDE and CLI without a runtime adapter.
- Native read-only metadata is enforced only where Cursor honors it (project profiles at the probed version); plugin profiles rely on prompt guidance until Cursor enforces the flag for them.
- Marketplace publication and programmatic hooks were outside the original decision; distribution and enforcement claims depend on Cursor's current host behavior.
- Consolidation removes a separate package and release identity; Cursor-specific content is limited to its rule and manifest.

## Alternatives Considered

- **Use a programmatic Cursor runtime or hooks:** rejected because the selected plugin surface is declarative and no such runtime was needed for the integration.
- **Maintain a separate Cursor package:** superseded by CORE-034, which consolidates declarative integrations under one package.
- **Use prompt-only maker/checker constraints:** weaker than the available native read-only metadata for the relevant profiles.

## Related Decisions

- [CORE-005](../core/ADR-CORE-005-shared-agent-directives-core-sync.md): canonical directives and generated projections.
- [CORE-007](../core/ADR-CORE-007-cli-package-plugin-management.md): CLI platform handlers.
- [KC-001](../kimi-code/ADR-KC-001-kimi-code-architecture.md): declarative integration precedent.

## Date

2026-07-21; consolidated 2026-10-10; enforcement evidence 2026-10-12.
