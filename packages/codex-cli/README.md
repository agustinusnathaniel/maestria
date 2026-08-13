# @maestria/codex-cli

`@maestria/codex-cli` is a provisional Codex CLI projection of Maestria's canonical agent methodology. It packages the core directives as Codex skills inside a `.codex-plugin/plugin.json` bundle.

## Status and support boundary

This is a `Provisional` / `Projection` spike verified against the locally available `codex-cli 0.145.0` on 2026-08-13. The package demonstrates a generated skills projection; it is not a production support promise and does not claim Codex desktop parity.

Codex skills, plugin loading, subagent workflows, and `AGENTS.md` are runtime capabilities, not Maestria security controls. This package does not make any specialist role read-only, guarantee delegation, or enforce the maker/checker split. Codex's own sandbox, approvals, and hook trust controls remain the host boundary.

The spike intentionally ships no hooks, MCP server, installer, model configuration, or `AGENTS.md` writer. In particular, it does not advertise a `maestria install codex-cli` command.

## Local package validation

From the repository root:

```bash
python3 /path/to/plugin-creator/scripts/validate_plugin.py packages/codex-cli
```

Use the `validate_plugin.py` shipped with the Codex plugin-creator skill in your Codex installation; the path is installation-specific.

When a Codex marketplace is available, install the package through that marketplace and start a fresh session before checking skill discovery. This repository does not create or mutate a marketplace as part of the spike.

## Skills

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

## Regenerating generated skills

All skills are generated from `packages/core/agent-directives/`. Edit canonical sources only, then regenerate and check every projection:

```bash
scripts/sync-all
scripts/check-sync
```

For this package alone:

```bash
cd packages/codex-cli
pnpm sync
```

Do not hand-edit the generated `skills/` directory.

## Evidence baseline

The pinned capability and trust findings are recorded in [`docs/runtime-support-matrix.md`](../../docs/runtime-support-matrix.md) and bounded by [`ADR-CORE-014`](../../docs/adr/core/ADR-CORE-014-runtime-support-and-adapter-policy.md). The exact release source used for the spike is OpenAI Codex [`rust-v0.145.0`](https://github.com/openai/codex/releases/tag/rust-v0.145.0).
