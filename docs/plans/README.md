# Plans: Maestria Meta-Agent

The meta-agent is an autonomous system that maintains, ships, and improves the [maestria](https://github.com/agustinusnathaniel/maestria) monorepo. It runs as GitHub Actions scheduled workflows — no separate framework, no agent directory, no sandbox. It is a complementary operator to the interactive 8-agent pipeline (which handles AI coding sessions), not a replacement for it.

Aligned with [@maestria/opencode](https://www.npmjs.com/package/@maestria/opencode) **v0.5.2**, [@maestria/core](https://www.npmjs.com/package/@maestria/core) **v0.3.1**, [@maestria/pi](https://www.npmjs.com/package/@maestria/pi) **v0.3.2**. See [`VISION.md`](../VISION.md) and [`PATTERNS.md`](../PATTERNS.md) for the project vision and design patterns this meta-agent implements.

## Architecture at a Glance

The monorepo uses a **canonical-source-sync** model:

- `packages/core/agent-directives/` — single source of truth for all agent prompts
- `scripts/sync-all` — reads `packages/*/sync.config.ts`, regenerates platform agent files
- `scripts/check-sync` — verifies no drift between canonical source and generated copies
- `apps/maestria-cli/` — CLI tool for cross-platform plugin management
- `.maestria/workflow.md` + `.maestria/rules.md` — project-level agent workflow and rules

The meta-agent builds on this foundation. It runs checks, creates changesets, ships releases, and proposes improvements via PRs — all through GitHub Actions automation.

## Contents

| File | Covers |
| --- | --- |
| [`architecture.md`](./architecture.md) | System context, current foundation, meta-agent design, ADR references, C4 diagrams |
| [`implementation-plan.md`](./implementation-plan.md) | 5-phase build plan — Foundation, Maintenance, Shipping, Improvement, Learning |

## Timeline (5 Phases)

| Phase | Focus                 | Status         |
| ----- | --------------------- | -------------- |
| 1     | Foundation            | Mostly done    |
| 2     | Automated Maintenance | Partially done |
| 3     | Automated Shipping    | Partially done |
| 4     | Self-Improvement      | Planned        |
| 5     | Learning & Analytics  | Planned        |

## Getting Started

```bash
# Run the full maintenance pipeline locally
pnpm check
pnpm test
pnpm build

# Verify sync consistency
bash scripts/check-sync

# Generate platform agent files from canonical source
bash scripts/sync-all
```

## References

- [VISION.md](../VISION.md) — Project vision, goals, and non-goals
- [PATTERNS.md](../PATTERNS.md) — Design patterns catalog (Pipeline Composition, Maker/Checker Split)
- [architecture.md](./architecture.md) — Detailed architecture description
- [implementation-plan.md](./implementation-plan.md) — Build plan by phase
