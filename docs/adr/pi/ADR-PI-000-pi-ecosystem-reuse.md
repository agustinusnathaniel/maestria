# ADR-PI-000: Reuse Pi Ecosystem Dispatch

## Status

Accepted (2026-06-19), Confidence: High. Consolidated 2026-10-03. The ecosystem comparison records the June/July 2026 selection; current dependency versions and wiring belong in [the Pi package](../../../packages/pi/).

## Context

The initial Pi design planned a custom subprocess-based subagent engine. An ecosystem survey found existing dispatch implementations, so building session lifecycle, recursion limits, agent registration, tool restrictions, cancellation, and concurrency from scratch would duplicate the mechanism beneath maestria's methodology.

The required seam was programmatic dispatch with typed access, custom specialist prompts, per-agent tool restrictions, lifecycle events, in-process execution, and synchronous spawn/status access for the adapter's polling loop. A tool intended only for LLM invocation or asynchronous event-reply dispatch did not provide that seam.

## Decision

Depend on `@gotgenes/pi-subagents` for in-process dispatch and wrap its typed service rather than building another engine. Keep maestria responsible for outcome-oriented handoffs and parent/session-tree integration, not vendor-owned dispatch mechanics. The public tool is named `maestria_subagent` because the dependency registers `subagent` and last registration wins.

Keep host and methodology contracts separate. Dispatch asserts the specialist name and a non-empty task; the historical seven-field machine pre-check was removed on 2026-09-11. The [handoff skill](../../../packages/core/agent-directives/skills/handoff.md) owns advisory context, while `@maestria/shared-pi` and the Pi adapter own dispatch validation, unavailable-service behavior, and recursion handling. This decision requires no fixed handoff field count or mandatory spec format.

Use the service's lifecycle and tool restriction capabilities while documenting what the actual host enforces. Do not add a second workflow engine merely because it also supports subagents. Workflow DAGs, richer persistence, scheduling, and worktree isolation need a demonstrated requirement before another dependency is adopted.

Keep the wrapper and independently deployed agent files as a migration seam if the selected dependency becomes unmaintained or loses compatibility. The maintained manifest and adapter own dependency scope and versions rather than this historical comparison.

## Alternatives Considered

- **Build with Pi's low-level session factory:** possible, but rejected because a production dispatch engine must also own lifecycle, concurrency, registration, tool policies, events, aborts, recovery, and cleanup.
- **nicobailon's pi-subagents or the tintinweb upstream:** not selected because their LLM/event-driven surfaces lacked the typed synchronous programmatic seam needed by the polling adapter.
- **quintinshaw's dynamic-workflows:** met the surveyed dispatch needs, but its full DAG engine would create dual orchestration alongside maestria. `pi-crew` similarly overlaps workflow orchestration; defer both until that capability is needed.
- **pi-taskflow, narumitw's subagents, or mjasnikovs' task queue:** not selected because they lacked combinations of programmatic spawn, synchronous status, and lifecycle events.
- **gentle-pi or pi-soly:** their development/workflow focus did not supply the dispatch mechanism maestria needed.
- **pi-subagentura:** not selected because the chosen service already supplied the in-process model with a stronger programmatic API and maintenance evidence at evaluation time.

These are dated selection reasons, not current compatibility claims about the alternatives.

## Consequences

- An adapter replaces custom process and subagent-engine ownership while leaving maestria's methodology explicit.
- In-process execution avoids subprocess cold starts and supports service-level interoperability and lifecycle tracking.
- Another installed dependency is required; its extension must initialize to publish the service. Host API changes may require coordinated updates.
- The selected fork had a smaller ecosystem than its upstream and fewer features such as scheduling and isolation. Those features were outside the required seam.
- Recursion limits constrain nested delegation. In-process dispatch and tool restrictions do not establish a sandbox.
- Dependency abandonment remains a risk: the wrapper provides a replacement seam, but a replacement still needs equivalent lifecycle and cancellation evidence.

## Related Decisions

- [CORE-019](../core/ADR-CORE-019-directive-simplification.md): format-agnostic handoffs and proportionate routing.
- [CORE-020](../core/ADR-CORE-020-hybrid-package-topology.md): Pi-family sharing and native host seams.
- [CORE-033](../core/ADR-CORE-033-cli-effect-resource-boundaries.md): demonstrated-need-only Effect adoption and Pi polling history.
- [PI-001](ADR-PI-001-rules-injection.md): static methodology and specialist registration.
- [Oh My Pi](https://omp.sh/) (docs unverified, JS-gated): OMP consumes the portable root manifest and shared skills through the consolidated package; no OMP posture change is claimed here.

## Date

2026-06-19; dispatch validation corrected 2026-09-11; consolidated 2026-10-03.
