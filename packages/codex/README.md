# @maestria/codex

A provisional Codex CLI projection of Maestria's canonical agent methodology, packaged as namespaced `$maestria:*` skills inside a `.codex-plugin/plugin.json` bundle.

> This package is part of Maestria. See [VISION.md](https://github.com/agustinusnathaniel/maestria/blob/main/VISION.md) for the project vision, motivation, and scope. The skills are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](https://github.com/agustinusnathaniel/maestria/blob/main/CONTRIBUTING.md#3-the-sync-pipeline-core-concept).

## Status / Support Boundary

`Provisional` spike verified against the locally available `codex 0.145.0` on 2026-08-13. It demonstrates a generated skills projection and is not a production support promise; it does not claim Codex desktop parity. Reverify host marketplace and skills behavior when upgrading Codex.

## Installation

```bash
# Supported convenience path (requires Codex CLI and npm on PATH)
npx maestria install codex
npx maestria status
npx maestria update codex
npx maestria uninstall codex
```

The CLI stages the published npm package into a local marketplace under `~/.cache/maestria/` and runs `codex plugin add maestria@maestria`. Codex CLI exposes no plugin update command in the pinned surface, so `maestria update codex` refreshes the staged package, removes the plugin, and adds it again. Exact version pinning is not available. See [INSTALL.md](https://github.com/agustinusnathaniel/maestria/blob/main/packages/codex/INSTALL.md) for the full checklist and verification.

## What It Provides

- **14 namespaced skills** - `$maestria:global-rules`, `$maestria:orchestrator`, the 7 specialists (adventurer, architect, builder, diagnose, planner, reviewer, writer), `$maestria:handoff`, `$maestria:iteration-limits`, and the workflow modes `$maestria:fein`, `$maestria:sonar`, `$maestria:blitz`.
- **Maestria CLI compatibility** - install, status, check, update, and uninstall through the CLI.

## Support / Platform Notes

- Skills-only projection: workflow modes ship as skills, not slash commands, because the verified surface for this spike is the plugin `skills/` directory.
- Read-only specialist boundaries are documented guidance, not tool enforcement; Codex's own sandbox, approvals, and hook trust controls remain the host boundary.
- No hooks, MCP servers, model configuration, or `AGENTS.md` writer are shipped.
- Support remains provisional until the pinned Codex CLI behavior and the marketplace/plugin install flow are reverified. Evidence baseline: [runtime support matrix](https://github.com/agustinusnathaniel/maestria/blob/main/docs/runtime-support-matrix.md) and [ADR-CORE-014](https://github.com/agustinusnathaniel/maestria/blob/main/docs/adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md).
- The skills are projections of the canonical core directives. To change behavior, edit `packages/core/agent-directives/` and re-run the sync pipeline - never hand-edit the generated `skills/` directory.

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/codex/) on the docs site
- [Installation checklist](https://github.com/agustinusnathaniel/maestria/blob/main/packages/codex/INSTALL.md)
- [Changelog](https://github.com/agustinusnathaniel/maestria/blob/main/packages/codex/CHANGELOG.md)

## License

MIT
