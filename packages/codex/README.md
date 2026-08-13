# @maestria/codex

`@maestria/codex` is a provisional Codex CLI projection of Maestria's canonical agent methodology. It packages the core directives as Codex skills inside a `.codex-plugin/plugin.json` bundle.

> This package is part of Maestria. See [VISION.md](../../VISION.md) for the project vision, motivation, and scope. The skills in this package are **generated** from the canonical directives in `packages/core/agent-directives/` by the [sync pipeline](../../CONTRIBUTING.md#3-the-sync-pipeline-core-concept).

## Motivation

Codex CLI has a plugin and skills system, but no built-in engineering methodology. `@maestria/codex` demonstrates how Maestria's specialists, orchestration, rules, handoffs, and workflow modes project onto Codex's namespaced skill surface. It is a skills-only projection: the methodology is available to Codex users as `$maestria:*` skills, while Codex's own sandbox, approvals, and hook trust model remain the runtime boundary.

## Goals

- **Skills-only projection** - package the canonical Maestria specialist, orchestration, rules, handoff, iteration-limit, and workflow-mode directives as Codex skills through `.codex-plugin/plugin.json`.
- **Maestria CLI compatibility** - install, status, check, update, and uninstall through the CLI, which stages the published npm package into a local Codex marketplace.
- **Namespaced skills** - `$maestria:*` identifiers so the projection coexists with the host's own skills.

## Non-Goals

- **Does NOT claim Codex desktop parity** - the verified projection surface is Codex CLI's plugin `skills/` directory.
- **Does NOT enforce roles** - Codex skills, plugin loading, subagent workflows, and `AGENTS.md` are runtime capabilities, not Maestria security controls. This package does not make any specialist role read-only, guarantee delegation, or enforce the maker/checker split.
- **Does NOT ship hooks, MCP servers, model configuration, or an `AGENTS.md` writer** - the projection intentionally excludes them.
- **Does NOT support exact version pinning** - `maestria update codex --version` is rejected because Codex's marketplace update path selects the latest staged package.

## Status / Support Boundary

This is a `Provisional` / `Projection` spike verified against the locally available `codex 0.145.0` on 2026-08-13. The package demonstrates a generated skills projection; it is not a production support promise and does not claim Codex desktop parity. Reverify host marketplace and skills behavior when upgrading Codex.

## Installation

For the published package, the supported convenience path is:

```bash
npx maestria install codex
```

This requires Codex CLI and npm on `PATH`. The CLI creates a local marketplace under `~/.cache/maestria/`, then runs `codex plugin add maestria@maestria`. Check, update, or remove the installation with `maestria status`, `maestria update codex`, and `maestria uninstall codex`.

Codex CLI does not expose a plugin update command in the supported surface used by this projection. `maestria update codex` refreshes the staged npm package, removes the installed plugin, and adds it again. Exact version pinning is not available through `maestria update codex --version`.

### Local package validation

From the repository root:

```bash
python3 /path/to/plugin-creator/scripts/validate_plugin.py packages/codex
```

Use the `validate_plugin.py` shipped with the Codex plugin-creator skill in your Codex installation; the path is installation-specific.

When a Codex marketplace is available, install the package through that marketplace and start a fresh session before checking skill discovery. This repository does not create or mutate a marketplace as part of the spike.

See [INSTALL.md](INSTALL.md) for the full installation checklist and verification.

## What It Provides

The plugin exposes these namespaced skills:

| Skill | Purpose |
| --- | --- |
| `$maestria:global-rules` | Universal evidence, safety, authorization, review, and branch contracts |
| `$maestria:orchestrator` | Route work and coordinate specialist skills |
| `$maestria:adventurer` | Reconnaissance and codebase mapping |
| `$maestria:architect` | Architecture trade-offs and ADR decisions |
| `$maestria:builder` | Atomic implementation and verification |
| `$maestria:diagnose` | Root-cause analysis and regression tracing |
| `$maestria:planner` | Phased implementation planning |
| `$maestria:reviewer` | Independent quality review |
| `$maestria:writer` | Documentation and structured prose |
| `$maestria:handoff` | Inter-stage handoff contracts |
| `$maestria:iteration-limits` | Bounded loops and repair termination |
| `$maestria:fein` | Full pipeline mode |
| `$maestria:sonar` | Research-only mode |
| `$maestria:blitz` | Fast capability-aware mode |

The workflow-mode entries are skills rather than Codex slash commands because the pinned projection surface verified for this spike is the plugin `skills/` directory.

## Limitations / Platform Notes

- Read-only specialist boundaries are documented guidance, not tool enforcement; Codex's own sandbox, approvals, and hook trust controls remain the host boundary.
- The projection is skills-only and provisional; support remains provisional until the pinned Codex CLI behavior and the marketplace/plugin install flow have been reverified.
- The skills are generated from `packages/core/agent-directives/`. To change behavior, edit the canonical sources and re-run the sync pipeline - never hand-edit the generated `skills/` directory.

### Regenerating generated skills

```bash
scripts/sync-all
scripts/check-sync
```

## Development

```bash
scripts/sync-all
scripts/check-sync
pnpm --filter @maestria/codex test
```

## Evidence baseline

The pinned capability and trust findings are recorded in [`docs/runtime-support-matrix.md`](../../docs/runtime-support-matrix.md) and bounded by [`ADR-CORE-014`](../../docs/adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md). The exact release source used for the spike is OpenAI Codex [`rust-v0.145.0`](https://github.com/openai/codex/releases/tag/rust-v0.145.0).

## Documentation and Changelog

- [User-facing documentation](https://maestria.sznm.dev/codex/) on the docs site
- [Installation checklist](INSTALL.md)
- [Changelog](CHANGELOG.md)

## License

MIT
