# @maestria/kimi-code

A Kimi Code plugin that ships a native system-prompt contract, an orchestrator, and 7 specialist skills for engineering workflows with swarm-aware orchestration.

> This package is part of the Maestria project. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope.

## Installation

```bash
# Recommended: via the maestria CLI
pnpx maestria@latest install kimi-code
pnpx maestria@latest status

# Update (latest by default; pin with --version)
pnpx maestria@latest update kimi-code
```

See [INSTALL.md](https://github.com/agustinusnathaniel/maestria/blob/main/packages/kimi-code/INSTALL.md) for the full checklist, including the recommended `[[hooks]]` and `[[permission.rules]]` tool-layer safety configuration.

## What It Provides

- **8 core skills** - `orchestrator` (auto-loaded at session start) plus builder, adventurer, architect, planner, reviewer, writer, and diagnose personas, loaded on demand via the `Skill` tool.
- **Native workflow commands** - `/maestria:fein`, `/maestria:sonar`, and `/maestria:blitz` are registered through Kimi's plugin `commands` field.
- **Swarm-aware orchestration** - routes 2 or more uniform items through Kimi Code's `AgentSwarm` for parallel fan-out.
- **System-prompt rules** - `SYSTEM.md` is contributed through Kimi's native `systemPromptPath`; no global `AGENTS.md` file is written.

## Support / Platform Notes

- Kimi Code 0.38.0+ supports plugin system-prompt contributions and custom agents; this package uses the native system-prompt path and keeps specialist identities in skills and prompt templates for compatibility.
- Persona text is advisory; tool-layer enforcement comes from the user-applied `[[hooks]]`/`[[permission.rules]]` blocks documented in `INSTALL.md`.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/kimi-code/) on the docs site
- [Installation checklist](https://github.com/agustinusnathaniel/maestria/blob/main/packages/kimi-code/INSTALL.md)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/kimi-code/CHANGELOG.md)

## Contributing

See [Contributing](https://maestria.sznm.dev/kimi-code/contributing/) on the docs site.

## License

MIT
