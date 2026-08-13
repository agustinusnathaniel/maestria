# @maestria/pi

A [Pi coding agent](https://pi.software/) extension that brings Maestria's structured agent orchestration to Pi.

> This package is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope. The agents and skills in this package are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](../../CONTRIBUTING.md#3-the-sync-pipeline-core-concept). Runtime support status is tracked in [ADR-CORE-014](../../docs/adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md) and the [runtime support matrix](../../docs/runtime-support-matrix.md).

## Motivation

Pi is a capable coding agent, but like every raw LLM harness it needs structure to be reliable for production engineering work. Maestria encodes that structure: a clear methodology, specialist roles, explicit handoffs, and workflow modes. `@maestria/pi` brings that methodology to Pi as a native extension - skills loaded through Pi's standard skill system, subagent dispatch, and session state that survives compaction.

## Goals

- **Standard skill-based delivery** - behavioral instructions are injected via Pi's native skill mechanism (`SKILL.md` files registered in `pi.skills`), not custom event hooks.
- **3 workflow modes** - `fein` (full pipeline), `sonar` (research only), `blitz` (fast implementation).
- **Compaction preservation** - session state survives compaction with structured summaries.
- **Subagent dispatch** - delegation via `@gotgenes/pi-subagents` with 7-field handoff validation.
- **Maker/checker split** - review mode blocks destructive tools and flags dangerous bash patterns.

## Non-Goals

- **Does NOT replace Pi's own runtime** - subagent dispatch, permissions, and session lifecycle remain Pi's responsibility.
- **Does NOT enforce methodology as a sandbox** - skills, rules, and role prompts are advisory guidance; the maker/checker split is tool-level where Pi supports it.
- **Does NOT require a specific model** - model selection is Pi configuration.
- **Does NOT cover Oh My Pi** - `@maestria/omp` is a separate package for OMP; this package targets Pi specifically.

## Status / Support Boundary

`@maestria/pi` is a native Pi extension published to npm and installed through Pi's package mechanism (or the maestria CLI). It uses the Pi extension API for subagent dispatch and tool gating where supported; the methodology itself is advisory prompt guidance.

## Installation

### Recommended: via maestria CLI

```bash
pnpx maestria@latest install pi
```

The CLI automatically installs both `@gotgenes/pi-subagents` (required peer dependency for subagent dispatch) and `@maestria/pi` in the correct order.

### Alternative: manual Pi CLI

```bash
# Install required peer dependency first
pi install npm:@gotgenes/pi-subagents

# Install the extension
pi install npm:@maestria/pi
```

### Uninstall

```bash
# Via maestria CLI (removes @maestria/pi)
pnpx maestria@latest uninstall pi
```

Note: `@gotgenes/pi-subagents` is a shared dependency that other Pi extensions may use. Only remove it if no other extensions need it:

```bash
pi uninstall @gotgenes/pi-subagents
```

## What It Provides

- **4 Methodology Skills** - Orchestrator dispatcher, global agent rules, handoff contract, and iteration limits - automatically injected into every session via Pi's standard skill system (`SKILL.md` files registered in `pi.skills`).
- **3 Workflow Modes** - `fein` (full pipeline), `sonar` (research only), `blitz` (fast implementation).
- **Compaction Preservation** - session state survives compaction with structured summaries.
- **Subagent Dispatch** - delegation via `@gotgenes/pi-subagents` with 7-field handoff validation.
- **Maker/Checker Split** - review mode blocks destructive tools and flags dangerous bash patterns.

### Commands

| Command | Description |
| --- | --- |
| `/fein <goal>` | Set workflow mode to full pipeline (recon → design → impl → review) |
| `/sonar <goal>` | Set workflow mode to research only (recon → design → stop) |
| `/blitz <goal>` | Set workflow mode to fast implementation (builder directly) |
| `/review <target>` | Enter review mode - blocks destructive tools, sets read-only toolset |
| `/restore-model` | Restore the original model and tools active before review mode |
| `/handoff <goal>` | Generate a structured handoff prompt for a new task context |
| `/review-model <model-id>` | Set which model to use when entering review mode |
| `/maestria-status` | Show current maestria session state including handoff history |

## Limitations / Platform Notes

- Subagent dispatch depends on the `@gotgenes/pi-subagents` peer package; install it first (the maestria CLI does this for you).
- The maker/checker split is enforced at the tool level where Pi supports review-mode tool blocking; role prompts are otherwise advisory.
- The agents and skills are projections of the canonical core directives. To change behavior, edit `packages/core/agent-directives/` and re-run the sync pipeline - never edit the generated files under `agents/` or `skills/` directly.

## Development

```bash
# Install dependencies
pnpm install

# Sync agents/skills from core
pnpm exec tsx ../core/scripts/sync.ts --verbose

# Build
vp pack

# Test
vp test

# Format, lint, type-check
vp check
```

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/pi-omp/) on the docs site (shared with `@maestria/omp`)
- [Changelog](CHANGELOG.md)

## License

MIT
