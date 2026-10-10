# ADR-CORE-034: Consolidated Declarative Plugin

## Status

Accepted, Confidence: Medium.

## Context

Codex, Claude Code, Cursor, and Kimi Code shipped separate packages even though their workflow methodology comes from the same canonical directives. Agent Plugins adds a portable distribution, while Devin and ZCode expose additional declarative plugin surfaces. Maintaining separate product identities and releases obscures which package users should install.

The owner approved consolidating these distributions and removing the old package directories, then explicitly selected the portable distribution for Hermes in place of its Python adapter. Native runtime adapters for OpenCode, Pi, OMP, and Prime Agent remain separate.

## Decision

Publish one `@maestria/plugin` package from `packages/plugin/`. A portable root manifest and native host manifests identify the same versioned product. Root skills carry shared methodology; explicitly selected native agents, commands, rules, and integration resources preserve host contracts. Kimi keeps a separately selected persona projection where its dispatch and session-start behavior requires it.

Canonical shared methodology remains in `packages/core/agent-directives/`. Host-specific projection configs live with the consolidated integration resources. Sync checks cover both projections and derived bundle resources. No host-specific directory becomes a second methodology source.

Start the consolidated version line above every retired package version so ordinary updates are not rejected as downgrades. Keep the existing maestria CLI platform identifiers. Their installers consume the consolidated package while retaining host-native installation and managed-file ownership behavior. Remove the old source package directories and version targets; previously published packages and installed user content are not deleted by this repository migration.

The directories `skills`, `agents`, `automations`, `cli`, `rules`, `hooks`, `commands`, `integrations`, and `docs` have distinct ownership. Automation and hook documentation does not activate schedules or lifecycle scripts. The standalone CLI remains in `apps/maestria-cli`.

Hermes consumes the portable root manifest and discovers qualified skills through its host tools. Retire the Hermes Python adapter, its role gating, mode commands, subprocess bridge, and lifecycle hooks. On migration, disable the old adapter only after the replacement installs successfully; keep legacy files and user data intact.

## Consequences

- Users and maintainers share one declarative plugin identity and release lifecycle.
- Explicit host paths prevent duplicate skill discovery and accidental loading of another host's agents or commands.
- Native dispatch, permissions, persistence, and trust remain host-owned; a portable package does not establish runtime parity.
- Existing users update through their host installer or the maestria CLI; package names and source layout change.
- More resources ship in one archive, so packed-artifact validation must check containment, reachability, and metadata, not just source-tree existence.
- Devin and ZCode start as documented candidates. Live host verification remains separate from manifest and package validation.

## Alternatives Considered

- **Keep independent declarative packages:** preserves old source paths but retains redundant release and discovery surfaces.
- **One universal runtime adapter:** rejected because hosts expose different execution, permission, and lifecycle contracts.
- **A shared folder of unqualified native resources:** rejected because default and recursive discovery can load incompatible components or duplicate names.
- **Maintain compatibility packages indefinitely:** rejected by the owner because current adoption does not justify that additional maintenance surface.

## Related Decisions

- [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): canonical methodology and generated projections.
- [CORE-022](ADR-CORE-022-agent-plugins-portable-projection.md): portable format and host-owned runtime boundaries. This decision supersedes its separate-package topology while preserving those boundaries.
- [CORE-020](ADR-CORE-020-hybrid-package-topology.md): native adapters and neutral shared utilities.
- Host plugin references: [Claude Code components](https://code.claude.com/docs/en/plugins/components), [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins), [Cursor plugins](https://cursor.com/docs/reference/plugins.md), [Kimi Code plugins](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html) ([plugin agents](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html#plugin-agents)), [ZCode plugins](https://zcode.z.ai/en/docs/plugin), [Oh My Pi](https://omp.sh/) (docs unverified, JS-gated), [Devin file format](https://docs.devin.ai/cli/extensibility/plugins/overview) ([Customize product guide](https://docs.devin.ai/product-guides/plugins)).

## Date

2026-10-10
