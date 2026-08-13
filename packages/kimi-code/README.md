# @maestria/kimi-code

A declarative, manifest-based Kimi Code plugin that ships 8 specialized skills (orchestrator + 7 specialists) for engineering workflows with swarm-aware orchestration.

> This package is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope. The skills and rules in this package are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](../../CONTRIBUTING.md#3-the-sync-pipeline-core-concept). See [ADR-KC-001](../../docs/adr/kimi-code/ADR-KC-001-kimi-code-architecture.md) for the design rationale.

## Motivation

Kimi Code's plugin system is declarative - no SDK hooks, no build step. That is exactly the right surface for Maestria's methodology: the specialists are persona content in prompt templates, the orchestrator is a skill that routes work, and the global rules are a file Kimi Code auto-loads. `@maestria/kimi-code` packages that methodology so Kimi Code users get the same discipline, specialist delegation, and workflow modes as every other Maestria platform - without any toolchain.

## Goals

- **Declarative-only** - a manifest plus `skills/` and `rules/`; no TypeScript, no SDK hooks, no build step.
- **8 skills** - orchestrator + 7 specialist personas (builder, adventurer, architect, planner, reviewer, writer, diagnose).
- **Swarm-aware orchestration** - routes ≥3 uniform items through Kimi Code's `AgentSwarm` for parallel fan-out.
- **Global rules** - `rules/AGENTS.md` auto-loaded by Kimi Code at session start.
- **Tool-layer safety guidance** - `INSTALL.md` recommends `[[hooks]]` and `[[permission.rules]]` blocks for enforcement beyond persona text.

## Non-Goals

- **Does NOT include a build step** - the plugin is pure static config.
- **Does NOT define custom subagent identities** - Kimi Code hardcodes `coder`/`explore`/`plan`; the 7 specialist identities are persona content in prompt templates.
- **Does NOT enforce roles as a sandbox** - persona text is advisory; tool-layer safety comes from the user-managed `[[hooks]]`/`[[permission.rules]]` blocks documented in `INSTALL.md`.

## Status / Support Boundary

`@maestria/kimi-code` is a declarative Kimi Code plugin published to npm. It installs via `npm pack @maestria/kimi-code` through the maestria CLI (which extracts it into `~/.kimi-code/plugins/managed/maestria`) or manually. Persona text is advisory; tool-layer enforcement depends on the recommended permission/hook config the user applies.

## Installation

See [INSTALL.md](./INSTALL.md) for the full checklist. Quick start:

```bash
pnpx maestria@latest install kimi-code
pnpx maestria@latest status
```

The CLI pulls `@maestria/kimi-code` from npm and extracts it into `~/.kimi-code/plugins/managed/maestria`.

### Updating

```bash
pnpx maestria@latest update kimi-code
```

Updates follow the latest release by default. Pin to a specific version with:

```bash
pnpx maestria@latest update kimi-code --version 0.4.6
```

## What It Provides

### The 8 Skills at a Glance

| Skill | Subagent | Purpose |
| --- | --- | --- |
| `orchestrator` | main | Auto-loaded at session start. Methodology, delegation, swarm. |
| `builder` | `coder` | Focused implementation - atomic tasks, write code, run tests. |
| `adventurer` | `explore` | Codebase reconnaissance - read-only exploration, structured reports. |
| `architect` | `coder` | Architecture decisions, trade-offs, ADRs. |
| `planner` | `plan` | Multi-phase implementation plans, success criteria, rollback. |
| `reviewer` | `coder` | Code review with quality gates - no editing, structured feedback. |
| `writer` | `coder` | Documentation - READMEs, API docs, changelogs, ADR transcription. |
| `diagnose` | `coder` | Root cause analysis - 6-step methodology, blast-radius audit. |

The orchestrator's `whenToUse` field teaches the model when to dispatch each persona. The 7 specialists are loaded on demand via the `Skill` tool.

### Design Philosophy

This plugin is built on the **Harness Engineering** principle: `Agent = Model + Harness`. The 6 harness components map directly to plugin features:

| Component         | Plugin Mapping                                                               |
| ----------------- | ---------------------------------------------------------------------------- |
| **Instructions**  | `rules/AGENTS.md` placed at `~/.kimi-code/AGENTS.md` (auto-loaded)           |
| **Tools**         | Skill prescription per specialist; `AgentSwarm` for parallel fan-out         |
| **Sandboxes**     | Subagent profile tool lists (`coder`/`explore`/`plan`); `permission.rules`   |
| **Orchestration** | `sessionStart.skill` (orchestrator auto-loads); `Agent` / `AgentSwarm` tools |
| **Guardrails**    | `!!!` rule markers in every SKILL.md; iteration limits; persona constraints  |
| **Observability** | `PreCompact` / `PostCompact` hooks (observation-only); structured handoffs   |

### How It Works

1. **Plugin loads** - Kimi Code parses `kimi.plugin.json` from the installed location.
2. **Skills discovered** - `skills/` is walked; each `SKILL.md` is parsed and registered.
3. **Session start** - `sessionStart.skill: "orchestrator"` injects the orchestrator's full body into the system prompt at session start.
4. **Rules loaded** - `~/.kimi-code/AGENTS.md` (which the user copies from `rules/AGENTS.md`) is auto-loaded by Kimi Code's session-start context preparer.
5. **Specialists dispatched** - the orchestrator loads specialist skills via the `Skill` tool and inlines them into `Agent` / `AgentSwarm` prompts.
6. **Swarm fan-out** - for ≥3 uniform items, `AgentSwarm` runs the same persona against a list of items, returning a single `<agent_swarm_result>` envelope.

### Declarative-Only

Unlike OpenCode's plugin SDK, Kimi Code's plugin system is **declarative** - no TypeScript, no SDK hooks, no build step. This means:

- **No build step** - edit, commit, install.
- **No programmatic hooks** - the orchestrator skill carries the methodology, and Kimi Code's `[[hooks]]` blocks (user-managed) cover the rest.
- **No custom subagent identity** - Kimi Code hardcodes `coder`/`explore`/`plan`. The 7 specialist identities are encoded as persona content in prompt templates.

## Limitations / Platform Notes

- Persona text is advisory; the recommended `[[hooks]]` and `[[permission.rules]]` blocks in `INSTALL.md` are the tool-layer enforcement path.
- The generated skills and rules are projections of the canonical core directives. To change behavior, edit `packages/core/agent-directives/` and re-run the sync pipeline - never edit the generated files under `skills/` or `rules/` directly.

## Development

```bash
# Sync skills/rules from core
cd packages/kimi-code && pnpm exec tsx ../core/scripts/sync.ts --verbose

# Test (manifest schema, frontmatter, rules budget, persona safety)
pnpm --filter @maestria/kimi-code test

# Format, lint, type-check (repo root)
vp check
```

## Contributing

See [Contributing](/kimi-code/contributing/) on the docs site.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/kimi-code/) on the docs site
- [Installation checklist](INSTALL.md)
- [Changelog](CHANGELOG.md)

## Related

- [`@maestria/opencode`](../opencode/README.md) - the OpenCode variant of this plugin (TypeScript SDK, programmatic hooks).

## License

MIT
