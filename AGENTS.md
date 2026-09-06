<!-- Instructions for agents working on Maestria itself. Downstream behavior lives
     in packages/core/agent-directives/. -->

## Project and Ownership

Maestria packages a shared agent methodology as platform-specific integrations. Edit prompts, rules, and workflow modes only in `packages/core/agent-directives/`, then run `scripts/sync-all` and `scripts/check-sync`. Platform agent, skill, command, and rule projections are generated; package manifests and READMEs are hand-authored. See the [content ownership guide](packages/core/agent-directives/README.md) when changing directives or adding a specialist.

## Engineering Boundaries

- `packages/core/` library modules are platform-independent and browser-safe: no platform SDK imports or Node.js APIs. Its `scripts/` directory is development tooling and may use Node.js.
- Platform adapters belong in their own `packages/<platform>/`. Shared code belongs in the appropriate neutral package, not in another platform's package.
- OpenCode uses its standard SDK. Claude Code and Codex have declarative projections; their host-specific integration belongs outside core. The portable `agent-plugin` package declares skills only, with no runtime adapter, commands, hooks, or MCP component.
- Pi is a runtime extension and may use Node.js APIs. Keep host-neutral shared utilities separate from its runtime adapter.
- Prefer small, reviewable changes. Preserve canonical ownership, package boundaries, and sync correctness when choosing between approaches.

## Work and Verification

Use existing context and inspect missing or changed evidence needed for the task. Read project vision and patterns when the change depends on methodology; do not build a full repository map for a familiar edit.

Test observable contracts at the highest practical boundary. Reuse existing tests and lightweight real boundaries or explicit fakes before broad mocks. Add coverage for durable contracts and plausible regressions. A new test file is permitted when it materially protects an in-scope contract; explain that benefit without asking solely because the coverage needs a new file.

Run affected checks during implementation and fix failures caused by the requested change. Reuse still-valid evidence; rerun checks when a relevant change, failure, or unresolved concern warrants it. Before committing or delivering implementation, the delivery owner runs the [completion gates](docs/checklist.md) on the integrated result. Independent review is required for meaningful implementation; formatting, comments, and mechanical non-behavioral edits need it only when risk is uncertain. The implementer may validate its work but must not approve its own required review.

Lint and format use Ultracite presets in `vite.config.ts`. Use `vp check`, `vp check --fix`, or `vp staged`; do not run `ultracite fix` or `oxlint` directly. `vp check` is the built-in format/lint/type check; `pnpm check` runs the repository build/test/verification pipeline.

## Contextual References

Read relevant ADRs before changing architecture, sync behavior, or agent conventions:

| Change | Read |
| --- | --- |
| Plugin architecture or canonical sync | [CORE-002](docs/adr/core/ADR-CORE-002-plugin-architecture.md), [CORE-005](docs/adr/core/ADR-CORE-005-shared-agent-directives-core-sync.md) |
| Portable Agent Plugins projection | [CORE-022](docs/adr/core/ADR-CORE-022-agent-plugins-portable-projection.md) |
| Agent routing, persistence, or instruction policy | [CORE-019](docs/adr/core/ADR-CORE-019-directive-simplification.md), [CORE-023](docs/adr/core/ADR-CORE-023-evidence-led-directives.md) |
| OpenCode permissions or workflow modes | [OC-001](docs/adr/opencode/ADR-OC-001-tool-permission-design.md), [OC-003](docs/adr/opencode/ADR-OC-003-keyword-triggered-workflow-modes.md) |
| Kimi Code integration | [KC-000](docs/adr/kimi-code/ADR-KC-000-kimi-code-distribution.md), [KC-001](docs/adr/kimi-code/ADR-KC-001-kimi-code-architecture.md) |
| Pi rules or compaction | [PI-001](docs/adr/pi/ADR-PI-001-rules-injection.md), [PI-002](docs/adr/pi/ADR-PI-002-compaction-state-preservation.md) |

- [Testing philosophy](docs/testing.md): choosing coverage, test boundaries, and fixtures.
- [Contributing](CONTRIBUTING.md): setup, package workflows, changesets, and delivery.
- [Vision](VISION.md) and [patterns](PATTERNS.md): methodology rationale and design principles.
