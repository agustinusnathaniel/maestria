# ADR-CORE-017: Selective Effect v4 Adoption in TypeScript Plugins

## Status

Accepted

## Context

The CLI already uses Effect, and the TypeScript plugin packages contain asynchronous orchestration code alongside simple synchronous helpers and generated Markdown projections. A blanket migration would add a large abstraction surface to code that does not benefit from it, while Pi's subagent polling has real cancellation and structured-concurrency concerns.

## Decision

Adopt Effect v4 RC at the Pi subagent polling boundary and align the CLI to the same RC version. Model polling failures as typed errors, bridge the host `AbortSignal`, and use structured Effect concurrency for parallel polls. Keep pure state/rendering helpers, OpenCode hooks, OMP's native task handoff, and generated directive/sync code in regular TypeScript until they present a concrete Effect-shaped problem.

## Consequences

Parallel polling now interrupts sibling fibers when one poll fails or the host aborts, and the adapter is directly testable with typed failures. The Pi package and CLI gain an RC dependency and a small runtime bundle cost. Effect v4 remains a release candidate, so future RC updates should be validated through the normal package tests and build gates.

## Alternatives

Migrate every TypeScript package; rejected because most package code is synchronous, declarative, or generated and would gain ceremony without a corresponding reliability benefit. Keep the existing Promise polling; rejected because sibling polls could continue after failure and external aborts were only observed between 500ms polling intervals.

## Date

2026-08-13
