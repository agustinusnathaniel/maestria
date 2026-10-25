<!-- Instructions for agents working on maestria itself. Downstream behavior lives
     in packages/core/agent-directives/. -->

## Project and Ownership

maestria packages a shared agent methodology as platform-specific integrations. Edit prompts, rules, workflow modes, and maestria's own skills only in `packages/core/agent-directives/`, then run `scripts/sync-all` and `scripts/check-sync`. Platform projections are generated. In `agent-plugins`, installation resources are generated directly at the package root; edit its host manifests (root `plugin.json`, `.<host>-plugin/plugin.json`, `kimi.plugin.json`) directly, `generation/profiles.json` for profile metadata, or package usage docs instead. See the [content ownership guide](packages/core/agent-directives/README.md) when changing directives or adding a specialist.

## Engineering Boundaries

- `packages/core/` library modules are platform-independent and browser-safe: no platform SDK imports or Node.js APIs. Its `scripts/` directory is development tooling and may use Node.js.
- Platform adapters belong in their own `packages/<platform>/`. Shared code belongs in the appropriate neutral package, not in another platform's package.
- OpenCode uses its standard SDK. Claude Code, Codex, Cursor, Kimi Code, Devin, ZCode, OMP, and Hermes are declarative hosts served by `packages/agent-plugins`; their host-specific integration belongs outside core. OpenCode and Pi are the native adapters. The consolidated `@maestria/agent-plugins` root is directly installable. Canonical core separates roles, commands, rules, and utility skills; package exports provide host-compatible skills and explicitly selected native resources. It declares no executable runtime adapter, hooks, or MCP component.
- Pi is a runtime extension and may use Node.js APIs. Keep host-neutral shared utilities separate from its runtime adapter.
- Prefer small, reviewable changes. Preserve canonical ownership, package boundaries, and sync correctness when choosing between approaches.

## Work and Verification

Use existing context and inspect missing or changed evidence needed for the task. Read project vision and patterns when the change depends on methodology; do not build a full repository map for a familiar edit.

Follow the canonical testing discipline in `packages/core/agent-directives/rules.md` and the detailed workflow in `docs/testing.md`. Select behavior coverage before implementation instead of backfilling tests to fit the code, do not add duplicate regression tests, and leave a reproducible artifact for each complex-feature E2E test. Keep lint, typecheck, build, sync, and existing package checks as verification gates.

Run affected checks during implementation and fix failures caused by the requested change. Reuse still-valid evidence; rerun checks when a relevant change, failure, or unresolved concern warrants it. Validate each coherent slice before committing it. Before delivery, the delivery owner runs the [completion gates](docs/checklist.md) on the integrated result. Independent review is required for meaningful implementation; formatting, comments, and mechanical non-behavioral edits need it only when risk is uncertain. The implementer may validate its work but must not approve its own required review.

Never use the U+2014 em dash in text you write for this repository (docs, directives, code comments, commits, PR text); use commas, colons, parentheses, or a hyphen.

Lint and format use Ultracite presets in `vite.config.ts`. Use `vp check`, `vp check --fix`, or `vp staged`; do not run `ultracite fix` or `oxlint` directly. `vp check` is the built-in format/lint/type check; `pnpm check` runs the repository build/test/verification pipeline.

## Contextual References

Read relevant ADRs before changing architecture, sync behavior, or agent conventions:

| Change | Read |
| --- | --- |
| Plugin architecture or canonical sync | [CORE-002](docs/adr/core/ADR-CORE-002-plugin-architecture.md), [CORE-005](docs/adr/core/ADR-CORE-005-shared-agent-directives-core-sync.md) |
| Portable Agent Plugins projection | [CORE-022](docs/adr/core/ADR-CORE-022-agent-plugins-portable-projection.md), [CORE-034](docs/adr/core/ADR-CORE-034-consolidated-declarative-plugin.md) |
| Agent routing, persistence, or instruction policy | [CORE-019](docs/adr/core/ADR-CORE-019-directive-simplification.md) |
| OpenCode permissions or workflow modes | [OC-001](docs/adr/opencode/ADR-OC-001-tool-permission-design.md), [OC-003](docs/adr/opencode/ADR-OC-003-keyword-triggered-workflow-modes.md) |
| Kimi Code integration | [KC-001](docs/adr/kimi-code/ADR-KC-001-kimi-code-architecture.md) |
| Pi rules or compaction | [PI-001](docs/adr/pi/ADR-PI-001-rules-injection.md), [PI-002](docs/adr/pi/ADR-PI-002-compaction-state-preservation.md) |
| Documentation or decision-record lifecycle | [Documentation conventions](docs/guides/doc-format.md) |

- [Testing philosophy](docs/testing.md): choosing coverage, test boundaries, and fixtures.
- [Contributing](CONTRIBUTING.md): setup, package workflows, changesets, and delivery.
- [Vision](VISION.md) and [patterns](PATTERNS.md): methodology rationale and design principles.
