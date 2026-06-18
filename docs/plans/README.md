# Plans: Maestria Meta-Agent

The maestria meta-agent maintains, ships, and improves the [@maestria/opencode](https://www.npmjs.com/package/@maestria/opencode) plugin. It lives at `apps/maestria-agent/` and runs autonomously — a robot that builds robots.

Aligned with maestria **v0.3.7+**. See [`VISION.md`](../VISION.md) and [`PATTERNS.md`](../PATTERNS.md) at the project root for the canonical project vision and design patterns this meta-agent implements.

## Framework: Flue

The agent uses [Flue](https://flueframework.com/), a TypeScript framework by the Astro team. Flue is built on [Pi](https://pi.dev) (Earendil Inc.) and provides sandbox-free monorepo execution, GitHub Actions deployment, and Durable Streams for session recording. Eve (Vercel's framework) was evaluated; the comparison lives in [`architecture.md`](./architecture.md).

## Contents

| File | Covers |
|---|---|
| [`architecture.md`](./architecture.md) | Agent design, tools, skills, channels, subagents, self-learning loop, Flue vs Eve comparison, ADRs 008-010 |
| [`implementation-plan.md`](./implementation-plan.md) | 7-phase build plan — task breakdowns, dependencies, verification criteria |

## Timeline (7 Phases)

Each phase depends on the one before it.

| Phase | Focus | Depends on |
|---|---|---|
| 1 | Scaffold: Flue init, monorepo wiring | — |
| 2 | Core agent: tools, skills, channels | 1 |
| 3 | Subagents: reviewer, learner | 2 |
| 4 | Self-learning loop: `.maestria-learnings/`, feedback | 3 |
| 5 | CI/CD: GitHub Actions, release automation | 4 |
| 6 | Monitoring: logging, metrics, Durable Streams replay | 5 |
| 7 | Evals: quality gates, benchmarks | 6 |

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
