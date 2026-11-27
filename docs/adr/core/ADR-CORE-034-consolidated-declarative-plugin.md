# ADR-CORE-034: Consolidated Declarative Plugin

## Status

Accepted (2026-10-10), Confidence: Medium. Its no-hooks stance is superseded by [CORE-037](ADR-CORE-037-hooks-as-deterministic-reinforcement.md), and its role roster by [CORE-035](ADR-CORE-035-main-loop-with-one-reviewer.md). Absorbed the portable-format record CORE-022, the Cursor record CR-001, and the Kimi Code record KC-001 on 2026-11-27.

## Context

Codex, Claude Code, Cursor, and Kimi Code shipped separate packages even though their methodology came from the same canonical directives. Agent Plugins v1 adds a vendor-neutral manifest and Agent Skills layout, and Devin, ZCode, OMP, and Hermes expose further declarative surfaces. Separate product identities and releases obscured which package users should install. OpenCode and Pi keep their own runtime adapters.

## Decision

Publish one `@maestria/agent-plugins` package from `packages/agent-plugins/`. Its root is directly installable: the portable `plugin.json` and each host manifest sit beside the generated resources, so Git and local loaders select the package root and npm archives expose the same layout. Generated resources are committed because Git consumers do not run the generator. Generation inputs live under `generation/` and are not published. The consolidated compiler is the only writer and composes every resource from `packages/core/agent-directives/`; no host directory becomes a second methodology source.

Resources follow core's semantic classes: roles in `agents/`, workflow modes in `commands/`, policy in rules or session files, reusable utilities in `skills/`. Each role and mode ships once for every Markdown host. A read-only role carries each host's control in one frontmatter block (`readonly` for Cursor, `disallowedTools: [Write, Edit]` for Claude Code, Kimi Code, and ZCode), because evidence on 2026-10-12 showed these hosts ignore keys meant for others. Codex gets generated TOML, which only the CLI installs. Profiles omit `model` so they use the session's model. Rules stay per host only where formats differ. The per-host mapping, the session files each host loads, and which hosts actually enforce each control live in the [capability contract](../../agent-plugin-capabilities.md) and `scripts/host-session-files.ts`.

### Portable format boundary

Agent Plugins v1 is a distribution format, not a runtime model, so it is never the canonical representation. The portable surface is the manifest plus generated utility skills; roles, modes, and policy are not converted into portable skills. It declares no MCP configuration, executable agents, commands, or hooks until a concrete host-neutral capability exists. `maestria plugin install` stages the npm package into the CLI cache or a chosen directory; staging does not install or activate it in a client.

### Hermes

Hermes consumes the portable package. Its former Python adapter (tool gates, mode commands and persistence, child tracking, an OpenCode subprocess bridge) is retired: it duplicated host-owned lifecycle and trust and added Python and host-version maintenance. That loss of adapter enforcement is accepted. Migration disables the old adapter only after the replacement installs, and leaves user files intact.

## Security Boundaries

The consuming host owns discovery, activation, permissions, trust, sandboxing, lifecycle, delegation, and session state. A shared frontmatter key is a request each host honors on its own terms: Cursor enforces `readonly` for project `.cursor/agents/` profiles but not for plugin-supplied ones (CLI probe, 2026-10-12), and Kimi's write-tool exclusions are filters, not a shell sandbox. Role names and prompt text are not permission identities. Describing a hook, command, or automation in documentation does not implement it; runtime behavior needs a shipped resource and host configuration.

## Consequences

- Users and maintainers share one plugin identity and release line, started above every retired package version so updates are not rejected as downgrades.
- One shared profile and command set removes per-host copies.
- Enforcement still differs by host, so the capability contract records it per host. A conforming package does not guarantee a client discovers or invokes every resource.
- More resources ship in one archive, so packed-artifact checks cover containment, reachability, and metadata, not just the source tree.
- Hermes loses adapter enforcement and mode persistence.

## Alternatives Considered

- **Keep independent declarative packages:** retains redundant release and discovery surfaces.
- **One universal runtime adapter:** rejected because hosts expose different execution, permission, and lifecycle contracts.
- **Per-host copies of identical profiles:** retired 2026-10-12; they differed only in frontmatter that every host reads selectively.
- **A nested `plugin/` bundle directory with `publishConfig.directory`:** retired 2026-10-11 because it made Git install paths unconventional.
- **Agent Plugins v1 as the canonical format, or runtime code in the portable package:** rejected because the format cannot express agents, commands, hooks, or permissions, and runtime code would make it client-specific.
- **A Kimi Code or Cursor runtime adapter:** rejected because their declarative surfaces carry the methodology without host-version and release maintenance.
- **Maintain compatibility packages indefinitely:** rejected by the owner because adoption does not justify the upkeep.

## Related Decisions

- [CORE-005](ADR-CORE-005-shared-agent-directives-core-sync.md): canonical methodology and generated projections.
- [CORE-020](ADR-CORE-020-hybrid-package-topology.md): narrow sharing boundaries.
- [Agent Plugins v1](https://agent-plugins.org/specification) and [Agent Skills](https://agentskills.io/specification) specifications.

## Date

2026-10-10; absorbed CORE-022 (2026-09-01), CR-001 (2026-07-21), and KC-001 (2026-06-12) on 2026-11-27.
