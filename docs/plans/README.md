# Plans: Maestria Meta-Agent

This directory contains the architecture and implementation planning documents for the maestria meta-agent.

The maestria meta-agent is an [Eve](https://www.npmjs.com/package/eve) agent that runs at `apps/maestria-agent/`. It autonomously maintains, ships, self-improves, and self-learns the [@maestria/opencode](https://www.npmjs.com/package/@maestria/opencode) plugin and the monorepo around it. Think of it as the robot that builds the robots.

## Contents

| File | What it covers |
|---|---|
| [`architecture.md`](./architecture.md) | Full architecture design: agent structure, tools, skills, channels, subagents, self-learning loop, trade-off decisions, ADRs (008-010) |
| [`implementation-plan.md`](./implementation-plan.md) | Phased build plan: 7 phases from scaffold to evals, with task breakdowns, dependencies, and verification criteria |

## Quick Context

- **Monorepo**: `agustinusnathaniel/maestria` — pnpm workspaces with Vite+, changesets
- **Plugin**: `@maestria/opencode` at `packages/opencode/` — 7 subagents, global rules injection
- **Agent framework**: [Eve v0.11.x](https://www.npmjs.com/package/eve) — filesystem-first durable agents on Vercel
- **Deployment target**: Vercel

## Reading Order

1. Start with `architecture.md` to understand the design
2. Then `implementation-plan.md` for the build sequence
3. The existing [`maestria-meta-agent-plan.md`](./maestria-meta-agent-plan.md) has detailed, low-level implementation notes you can reference during development

## ADR Continuity

The architecture document contains three new ADRs that extend the project's decision record in `docs/adr/`:

- **ADR-008**: Monorepo Integration Strategy (sandbox-based)
- **ADR-009**: Self-Learning Storage (`.maestria-learnings/`)
- **ADR-010**: Subagent Architecture (reviewer + learner)
