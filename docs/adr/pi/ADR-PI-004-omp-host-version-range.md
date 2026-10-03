# ADR-PI-004: OMP Host Version Range and Independent Version Line

## Status

Accepted (2026-10-02), Confidence: High

## Context

`@maestria/omp` declares `@oh-my-pi/pi-coding-agent` as a peer dependency, because the package ships a runtime extension that must load inside whatever host the consumer has installed. The declared range was `>=17.0.5 <18.0.0`, so consumers on the currently published 18.x line failed peer validation even when the extension worked against that host.

OMP is a fork of Pi that versions independently. Its major numbers do not track Pi's, so Pi's version is not a proxy for what OMP supports, and a range derived from Pi's cadence is wrong for OMP for reasons unrelated to compatibility.

Two wiring details made the range easy to record in more than one place. The range lived as a literal in `packages/omp/package.json` and had no single home. And a peer range is only one of three places a host version can be recorded, the others being the lockfile and the runtime support matrix, so a range that changes in one place and not the others silently disagrees with what was actually verified.

Under [ADR-CORE-030](../core/ADR-CORE-030-adr-immutability-and-supersession.md) clause 3 this record decides the range and its rationale. It does not assert the currently resolved host version; read the concrete version from `pnpm-lock.yaml` and the verified host behavior from [docs/runtime-support-matrix.md](../../runtime-support-matrix.md).

## Decision

1. **Widen the peer range to `>=17.0.5 <19.0.0`.** The floor stays at `17.0.5`, the earliest host line the extension is claimed to work against, so this decision never widens the range downward and does not retroactively promise support for older hosts. The ceiling is set to `19.0.0`, the next major after the published line, so 18.x is admitted while the range still refuses to make claims about an unreleased major. Raising the ceiling is a separate decision that requires evidence that the new major satisfies the extension surface, not a calendar expectation.

2. **Move the range into the workspace catalog.** `pnpm-workspace.yaml` holds `@oh-my-pi/pi-coding-agent: '>=17.0.5 <19.0.0'` and `packages/omp` declares `"@oh-my-pi/pi-coding-agent": "catalog:"`. That gives the range a single home. Install, typecheck, and peer validation then read one range instead of a literal that can drift from it.

3. **Track OMP's version line independently of Pi's majors.** Whether `@maestria/omp` supports an OMP release is determined by that release's own notes and by our verification against it. When OMP's version moves, the response is to check the host's exports and behavior, never to infer compatibility from Pi's version or from OMP's number relative to Pi's.

## Consequences

### Positive

- Consumers on the published 18.x line can install `@maestria/omp` without a peer conflict or a manual override.
- The host range has one home, so the declared range cannot quietly disagree with the range that was installed and typechecked.
- Pi and OMP version divergence stops producing false inferences: a Pi release tells us nothing about an OMP release, and the range now says so.

### Negative

- The ceiling must be reopened for every OMP major. That is deliberate friction, not an oversight: an unbounded range would silently admit majors whose export contract we have not examined.
- Admitting 18.x is supported by package typecheck and unit tests against the installed host, not by a live runtime run against a real OMP 18 session. The support matrix records that limit rather than implying end-to-end coverage.
- The catalog entry is a range, not a pin, so the lockfile remains the only place a concrete host version is recorded, and it will move as the range resolves differently over time.

### Neutral

- No adapter source change was required. `vp check` and `vp test` pass in `packages/omp` against the resolved 18.x host with the existing sources.

## Alternatives Considered

- **Leave the range literal in `packages/omp/package.json`.** Rejected: it keeps the range in two homes, and the two would drift on the next bump.
- **Pin an exact version or use a caret range (`=18.4.8`, `^18.0.0`).** Rejected: both re-break on the next minor release, which is the churn this decision exists to remove.
- **Drop the ceiling entirely (`>=17.0.5`).** Rejected: it would admit every future major, including majors that reshape the package's export surface, with no signal that a decision was needed.
- **Derive the ceiling from Pi's version line.** Rejected: OMP versions independently, so Pi's cadence carries no information about OMP's compatibility.

## Assumptions

- `[verified]` The installed 18.x host root exports still provide the extension surface `packages/omp` imports (`ExtensionAPI`, `ExtensionContext`, `BeforeAgentStartEvent`, `BeforeAgentStartEventResult`); the package typechecks and its unit tests pass unchanged against it.
- `[verified]` `packages/omp` imports the host only through its root entry point and uses no subpath imports, so a future removal of subpath exports is not a blocker for this package. At the time of this decision the resolved host still published subpath exports; the adapter's independence from them is what this assumption rests on, not their continued presence.
- `[inferred]` No OMP 19 exists yet and no compatibility claim is made about one. The ceiling bounds admission; it is not a statement that 19.x works.

## Related Decisions

- [ADR-PI-001](ADR-PI-001-rules-injection.md) - the extension and peer dependency mechanism the range governs.
- [ADR-CORE-030](../core/ADR-CORE-030-adr-immutability-and-supersession.md) clause 3 - why this record states a range rather than a resolved host version.

## Date

2026-10-02
