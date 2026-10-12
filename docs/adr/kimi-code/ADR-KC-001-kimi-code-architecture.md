# ADR-KC-001: Kimi Code Declarative Integration

## Status

Accepted (2026-06-12; revised 2026-06-17). Consolidated 2026-10-10: Kimi now selects native profiles, complete workflow commands, primary-session policy, and utility skills from `@maestria/agent-plugins`. Current behavior is defined by the [Kimi integration source](../../../packages/core/agent-directives/integrations/kimi-code.md), [manifest](../../../packages/agent-plugins/kimi.plugin.json), and [consolidated compiler](../../../scripts/sync-consolidated-plugin.ts). Live dispatch and reload remain unverified; see the [runtime support matrix](../../runtime-support-matrix.md).

## Context

Kimi Code exposes a declarative plugin format, unlike the OpenCode runtime SDK. At the v0.13.1 version inspected for this decision, it provided three built-in child profiles (`coder`, `explore`, and `plan`) and no custom subagent registration. The host owns plugin discovery, permissions, hooks, and session behavior; manifest compatibility must be checked against the installed host version. Current [Kimi plugin documentation](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html#plugin-agents) supports native plugin agents. That historical built-in-profile mapping is retired by the current native projection.

## Decision

Use Kimi's declarative plugin surface. The original integration mapped maestria specialists onto Kimi's built-in profiles and loaded an orchestrator skill at session start. The consolidated package selects the shared native profiles with complete role and policy instructions, the shared full commands, and a systemPromptPath bootstrap within the documented size limit. It does not suppress native agents or depend on removed role skills, session-start skills, or built-in persona remapping.

Do not treat specialist names or prompt text as host-enforced permission identities. Kimi's historical profile limits made some safety constraints prompt-level, and the consolidated integration still depends on host behavior for child permissions and manifest support.

## Consequences

- The declarative integration avoids a runtime adapter and duplicate skill corpus.
- The native profiles supply distinct specialist identities. Write-tool exclusions name Kimi's current `Write` and `Edit` tools (the earlier `WriteFile` and `StrReplaceFile` names matched nothing, corrected 2026-10-12); they are filters rather than shell sandboxes, and Kimi ignores model frontmatter.
- Permission and lifecycle guarantees remain host-owned; prompt guidance cannot establish runtime enforcement.
- Host schema changes can affect manifest fields, so current support claims remain bounded by the runtime support matrix.

## Alternatives Considered

- **Add a Kimi runtime adapter:** rejected because the host's declarative plugin surface is sufficient for the shared methodology and aliases, while a runtime adapter would add host-version and release maintenance.
- **Represent every specialist as a distinct native subagent:** unavailable in the original inspected version; selected now that the documented native plugin-agent format supports it.
- **Duplicate role skills in the Kimi package:** rejected during consolidation because core directives remain the canonical methodology source.

## Related Decisions

- [CORE-005](../core/ADR-CORE-005-shared-agent-directives-core-sync.md): canonical directives and generated projections.
- [CORE-020](../core/ADR-CORE-020-hybrid-package-topology.md): host-specific adapters and narrow sharing boundaries.
- [CORE-034](../core/ADR-CORE-034-consolidated-declarative-plugin.md): consolidated package topology.

## Date

2026-06-12; revised 2026-06-17; consolidated 2026-10-10.
