# @maestria/pi

A [Pi coding agent](https://pi.software/) extension that brings Maestria's structured agent orchestration - specialist delegation, workflow modes, and maker/checker review - to Pi.

> This package is part of Maestria. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope. The agents and skills are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md#3-the-sync-pipeline-core-concept).

## Installation

```bash
# Recommended: via the maestria CLI (installs the peer dependency too)
pnpx maestria@latest install pi

# Manual: install the required peer dependency first, then the extension
pi install npm:@gotgenes/pi-subagents
pi install npm:@maestria/pi
```

Uninstall via `pnpx maestria@latest uninstall pi`. The `@gotgenes/pi-subagents` peer dependency is shared with other Pi extensions; only remove it separately if nothing else needs it.

## What It Provides

- **4 methodology skills** - orchestrator dispatcher, global agent rules, handoff contract, and iteration limits, injected into every session via Pi's standard skill system.
- **3 workflow modes** - `/fein` (full pipeline), `/sonar` (research only), `/blitz` (fast implementation).
- **Compaction preservation** - session state survives compaction with structured summaries.
- **Subagent dispatch** - delegation via `@gotgenes/pi-subagents` with 7-field handoff validation.
- **Maker/checker split** - `/review` mode blocks destructive tools where Pi supports it.

## Support / Platform Notes

- Subagent dispatch depends on the `@gotgenes/pi-subagents` peer package; the maestria CLI installs it for you.
- The methodology is advisory prompt guidance; the maker/checker split is enforced at the tool level only where Pi supports review-mode tool blocking.
- Pi-specific: `@maestria/omp` is a separate package for Oh My Pi.
- The agents and skills are projections of the canonical core directives. To change behavior, edit `packages/core/agent-directives/` and re-run the sync pipeline - never edit the generated files under `agents/` or `skills/` directly.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/pi-omp/) on the docs site (shared with `@maestria/omp`)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/pi/CHANGELOG.md)

## License

MIT
