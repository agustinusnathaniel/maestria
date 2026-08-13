# @maestria/kimi-code

A declarative, manifest-based Kimi Code plugin that ships 8 specialized skills (orchestrator + 7 specialists) for engineering workflows with swarm-aware orchestration.

> This package is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope. The skills and rules are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](../../CONTRIBUTING.md#3-the-sync-pipeline-core-concept).

## Installation

```bash
# Recommended: via the maestria CLI (pulls the package from npm into ~/.kimi-code/plugins/managed/maestria)
pnpx maestria@latest install kimi-code
pnpx maestria@latest status

# Update (latest by default; pin with --version)
pnpx maestria@latest update kimi-code
```

See [INSTALL.md](./INSTALL.md) for the full checklist, including the recommended `[[hooks]]` and `[[permission.rules]]` tool-layer safety configuration.

## What It Provides

- **8 skills** - `orchestrator` (auto-loaded at session start) plus builder, adventurer, architect, planner, reviewer, writer, and diagnose personas, loaded on demand via the `Skill` tool.
- **Swarm-aware orchestration** - routes ≥3 uniform items through Kimi Code's `AgentSwarm` for parallel fan-out.
- **Global rules** - `rules/AGENTS.md` auto-loaded by Kimi Code at session start.
- **Declarative-only** - manifest plus `skills/` and `rules/`; no TypeScript, SDK hooks, or build step.

## Support / Platform Notes

- Kimi Code hardcodes its `coder`/`explore`/`plan` subagents; the 7 specialist identities are persona content in prompt templates, not custom subagent definitions.
- Persona text is advisory; tool-layer enforcement comes from the user-applied `[[hooks]]`/`[[permission.rules]]` blocks documented in `INSTALL.md`.
- The generated skills and rules are projections of the canonical core directives. To change behavior, edit `packages/core/agent-directives/` and re-run the sync pipeline - never edit the generated files under `skills/` or `rules/` directly.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/kimi-code/) on the docs site
- [Installation checklist](INSTALL.md)
- [Changelog](CHANGELOG.md)

## Contributing

See [Contributing](/kimi-code/contributing/) on the docs site.

## License

MIT
