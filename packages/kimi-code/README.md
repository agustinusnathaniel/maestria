# @maestria/kimi-code

A Kimi Code plugin that ships a native system-prompt contract, an orchestrator, and specialist skills for engineering workflows with swarm-aware orchestration (7 specialists as of 2026-09-22; see What It Provides below for the current list).

> This package is part of the Maestria project. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Installation

```bash
# Recommended: via the maestria CLI
pnpx maestria@latest install kimi-code
pnpx maestria@latest status

# Update (latest by default; pin with --version)
pnpx maestria@latest update kimi-code
```

See [INSTALL.md](https://github.com/agustinusnathaniel/maestria/blob/main/packages/kimi-code/INSTALL.md) for the package-specific installation and verification checklist.

## What It Provides

- **Core skills** (8 as of 2026-09-22; see the [package directory](https://github.com/agustinusnathaniel/maestria/blob/main/packages/kimi-code/skills) for the current list) - `orchestrator` (auto-loaded at session start) plus builder, adventurer, architect, planner, reviewer, writer, and diagnose personas, loaded on demand via the `Skill` tool.
- **Native workflow commands** - `/maestria:fein`, `/maestria:sonar`, and `/maestria:blitz` are registered through Kimi's plugin `commands` field.
- **Swarm-aware orchestration** - routes 2 or more uniform items through Kimi Code's `AgentSwarm` for parallel fan-out.
- **System-prompt rules** - `SYSTEM.md` is contributed through Kimi's native `systemPromptPath`; no global `AGENTS.md` file is written.
- **Project customization (advisory)** - the orchestrator reads project-root `.maestria/workflow.md` then `.maestria/rules.md` with host tools when not already supplied; missing files leave defaults unchanged, and an unreadable file is disclosed and requested rather than invented.

## Support / Platform Notes

- Kimi Code 0.38.0+ supports plugin system-prompt contributions and custom agents; this package uses the native system-prompt path and keeps specialist identities in skills and prompt templates for compatibility.
- Persona text is advisory; tool-layer enforcement comes from the user-applied `[[hooks]]`/`[[permission.rules]]` blocks described in the [installation guide](https://maestria.sznm.dev/kimi-code/getting-started/installation/).

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/kimi-code/) on the docs site
- [Installation checklist](https://github.com/agustinusnathaniel/maestria/blob/main/packages/kimi-code/INSTALL.md)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/kimi-code/CHANGELOG.md)

## Contributing

See [Contributing](https://maestria.sznm.dev/kimi-code/contributing/) on the docs site.

## License

MIT
