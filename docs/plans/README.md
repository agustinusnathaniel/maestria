# Plans: Maestria Meta-Agent

The maestria meta-agent maintains, ships, and improves the [@maestria/opencode](https://www.npmjs.com/package/@maestria/opencode) plugin. It lives at `apps/maestria-agent/` and runs autonomously — a robot that builds robots.

Aligned with maestria **v0.4.6**. See [`VISION.md`](../VISION.md) and [`PATTERNS.md`](../PATTERNS.md) at the project root for the canonical project vision and design patterns this meta-agent implements.

## Current State

The `@maestria/opencode` plugin at **v0.4.6** already ships on `main` with:

- **Plugin entry** at `packages/opencode/src/index.ts` — 3 hooks (`config`, `experimental.session.compacting`, `chat.message`)
- **8 subagents** at `packages/opencode/agents/*.md` — orchestrator + 7 specialists
- **Global rules** at `packages/opencode/rules/AGENTS.md`
- **Mode keyword system** — `fein`/`sonar`/`blitz` with precedence rules
- **9 Architecture Decision Records** (ADR-001 through ADR-009), including ADR-008 (mode keywords) and ADR-009 (commit authorization)
- **Release pipeline** via `.github/workflows/release.yml`

These are the existing foundation. The meta-agent plans in this directory describe a complementary **Flue-based** system that handles autonomous maintenance, shipping, and learning outside interactive AI coding sessions — building on top of what's already shipped.

## Framework: Flue

The agent uses [Flue](https://flueframework.com/), a TypeScript framework by the Astro team. Flue is built on [Pi](https://pi.dev) (Earendil Inc.) and provides sandbox-free monorepo execution, GitHub Actions deployment, and Durable Streams for session recording. Eve (Vercel's framework) was evaluated; the comparison lives in [`architecture.md`](./architecture.md).

## Contents

| File                                                 | Covers                                                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`architecture.md`](./architecture.md)               | Agent design, tools, skills, channels, subagents, self-learning loop, Flue vs Eve comparison, ADRs 008-013 |
| [`implementation-plan.md`](./implementation-plan.md) | 7-phase build plan — task breakdowns, dependencies, verification criteria                                  |

## Timeline (7 Phases)

Each phase depends on the one before it.

| Phase | Focus                  | Depends on |
| ----- | ---------------------- | ---------- |
| 1     | Scaffold + Maintenance | —          |
| 2     | Channels               | 1          |
| 3     | Shipping               | 2          |
| 4     | Self-Improvement       | 3          |
| 5     | Self-Learning          | 4          |
| 6     | Reviewer Subagent      | 5          |
| 7     | Evals + Hardening      | 6          |

## Getting Started

```bash
npx flue init --target github-actions apps/maestria-agent/
```

## References

- [Flue](https://flueframework.com/) / [docs](https://flueframework.com/docs/getting-started/quickstart/) / [GitHub](https://github.com/withastro/flue)
- [Pi](https://pi.dev) — open-source coding harness
- [Eve](https://vercel.com/eve) — evaluated, not chosen
- [maestria](https://github.com/agustinusnathaniel/maestria) — monorepo
- [VISION.md](../VISION.md) — Project vision, goals, and non-goals
- [PATTERNS.md](../PATTERNS.md) — Design patterns catalog (Pipeline Composition, Maker/Checker Split)
