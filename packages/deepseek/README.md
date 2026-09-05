# @maestria/deepseek

Maestria methodology for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): the specialist pipeline as Agent Skills, a native Cordis plugin, and a full agent preset with per-specialist subagent delegation.

## Status / Support Boundary

DeepSeek Harness is a developer-preview runtime, so this package is **provisional**: it typechecks against the published `@deepseek-ai/*` RC type packages and is unit-tested, but it has not been verified against a live `dsh` deployment. See the [runtime support matrix](https://github.com/agustinusnathaniel/maestria/blob/main/docs/runtime-support-matrix.md) and [ADR-CORE-023](https://github.com/agustinusnathaniel/maestria/blob/main/docs/adr/core/ADR-CORE-023-deepseek-harness-projection.md).

The package has three layers, usable independently:

- **Generated skills** (`skills/`) — 14 Agent-Skills `SKILL.md` directories (7 specialists, `orchestrator`, `global-rules`, `handoff`, `iteration-limits`, and the `fein`, `sonar`, `blitz` workflow modes), discoverable by any DSH skill root.
- **Cordis plugin** (`dist/`) — a function plugin (`name: 'maestria'`, `inject: ['systemPrompt', 'skills']`) that registers the workflow-routing prompt section, optionally the global-rules section, one named prompt variable per specialist persona, and a `ctx.skills` provider exposing the generated skill tree. Type-only imports; zero runtime dependencies on the host.
- **Agent preset** (`preset/maestria/`) — a full coding-agent composition derived from DSH's shipped `standard` preset, with the Maestria orchestrator persona, the methodology plugin, and seven `maestria_<role>` subagent delegation tools carrying specialist personas.

Skills and prompt sections are advisory capabilities, not security enforcement. DeepSeek Harness owns tool restrictions (`toolFilter`), sandboxing, approvals, and permission presets. Read-only roles carry advisory notes; the preset does not ship a `toolFilter` because denied tool names depend on the host composition and unknown names fail startup.

## Installation

See [INSTALL.md](./INSTALL.md) for the skills-only route and the `maestria install deepseek` preset route.

## Documentation

- [User-facing documentation](https://maestria.sznm.dev/)
- [Runtime support matrix](https://github.com/agustinusnathaniel/maestria/blob/main/docs/runtime-support-matrix.md)

## Development

```bash
scripts/sync-all
scripts/check-sync
pnpm --filter @maestria/deepseek test
```

Do not edit `skills/` directly. Edit the canonical directive or this package's sync configuration, then regenerate the projection.

## License

MIT. The agent preset is derived from the `standard` preset in `deepseek-ai/deepseek-harness`, which is BSD-3-Clause licensed; that notice is preserved in `preset/maestria/agent.cordis.yml`.
