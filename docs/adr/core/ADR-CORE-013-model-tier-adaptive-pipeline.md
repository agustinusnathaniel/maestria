# ADR-CORE-013: Selective routing by task and model economics

## Status

Accepted (2026-07-31; updated 2026-09-10). Unit 1's three-route contract (direct, focused, full) is implemented in the canonical directives. Unit 2's model-economics tier model and selective routing remain proposed; `MAESTRIA_TIER` and automatic route selection are not implemented.

## Context

### The Pipeline Is a Token Multiplier by Construction

The pipeline forces discipline through delegation: a simple task spawns recon, implement, and verify; a complex task adds architecture and planning, the review loop (max 3 cycles), and the commit protocol. Each spawn loads a fresh context window plus cached context, and every briefing accumulates in the orchestrator session: a constant token multiplier on top of the model's cost.

### Session Data: The Multiplier's Cost Scales With Model Price

Usage data from the opencode session database (620 Maestria sessions) shows the same pipeline under two pricing regimes:

|                         | deepseek-v4-flash (547 sessions) | kimi-k3 (11 sessions, Jul 20-21) |
| ----------------------- | -------------------------------- | -------------------------------- |
| Subagent input          | 6.4M fresh + ~300M cached        | 855K fresh + ~7M cached          |
| Total cost              | $7.16                            | $6.60                            |
| Cost per adventurer run | ~$0.011                          | ~$0.68                           |

Kimi adventurer runs averaged about $0.68 and 452 seconds versus $0.011 and 81 seconds for flash, with cache-read cost roughly 45x fresh-input cost and fan-out reaching 58 children. A frontier session showed long sequential subagent chains with negligible orchestrator cost; on flash, frequent spawns stay cheap but the growing orchestrator session adds latency. These figures establish the cost and latency problem, not a universal route or a promised reduction. [verified]

### The Gap

The orchestrator has no awareness of its own model's price or latency. It applies the same pipeline depth, fan-out caps (3-5 parallel), and review loops regardless of token price or spawn latency. The workflow modes (`fein`/`sonar`/`blitz`) are platform-dependent, user-initiated mechanisms; they do not express persistent model economics, and no universal tier variable or automatic adaptive route exists today. [verified] Maestria is therefore implicitly optimized for cheap, fast models and becomes a net negative on frontier models, where the quality premium of narrow-focus delegation shrinks while cost and latency multipliers stay constant.

## Decision

Adopt staged evolution rather than claiming a runtime feature that does not exist. Unit 1 narrows the public contract to three routes: direct execution, a focused specialist or review, and the full pipeline. Users select a route based on task risk, uncertainty, model economics, and platform behavior; the full pipeline is explicitly selected or justified by the task, not a universal default. [inferred] Unit 2 may implement selective routing informed by model economics, preserving the route contract while making any new configuration or runtime behavior explicit.

### Runtime authority clarification (2026-08-12)

The shared directive defines route selection and behavioral principles; the host runtime defines execution authority. OpenCode, OMP, and Kimi may require pure-dispatcher behavior where adapters or session permissions restrict the orchestrator; direct-capable runtimes may execute a direct route when their host permits. Delegated work remains owned by its specialist, and maker/checker requirements stay honest about the enforcement the host actually provides.

### Unit 1 implementation status (2026-09-10)

The three-route contract is implemented in the canonical directives: the orchestrator directive defines the `direct`/`focused`/`full` routing table, and the rules carry the smallest-route rule and mode overrides. Unit 2 remains unimplemented: no `MAESTRIA_TIER` variable and no automatic route selection.

### Proposed future tier model

| Tier       | Model class (example)          | Budget         | Latency  |
| ---------- | ------------------------------ | -------------- | -------- |
| `flash`    | deepseek-v4-flash, free models | < $0.5/M input | fast     |
| `mid`      | mid-price models               | $0.5-2/M input | moderate |
| `frontier` | gpt-5.6, kimi-k3 class         | > $2/M input   | slow     |

This table is a hypothesis for Unit 2, not current behavior. `MAESTRIA_TIER` is not implemented, and no platform currently provides a universal tier setting or automatic route selection. [verified]

### Future tier-scaled levers

| Lever | Low-cost baseline hypothesis | `mid` | `frontier` |
| --- | --- | --- | --- |
| **Recon** | `@adventurer` on any unfamiliar code | `@adventurer` only when codebase genuinely unknown | skip; orchestrator asks user or uses direct context |
| **Design stages** | `@architect`/`@planner` on COMPLEX | `@architect`/`@planner` on COMPLEX only | folded into single delegation; no separate stage |
| **Implementation** | `@builder` (fresh context) | `@builder` | direct execution; `@builder` only for large atomic slices |
| **Review** | `@reviewer` always after `@builder` | `@reviewer` after `@builder` on non-trivial changes | `@reviewer` only on user request or before commit of substantial work |
| **Parallel fan-out cap** | 3-5 | 2 | 0-1 |
| **Review loop max** | 3 cycles | 2 cycles | 1 pass; fail loud after |
| **Session compaction** | none (orchestrator context grows) | compact when session context exceeds threshold | aggressive compaction; briefings over history |

### What Does Not Change

- **Tier scales the pipeline, not the safety principles.** Evidence-based completion, maker/checker review, bounded repair, and authorization floors still bind. The host runtime defines whether the orchestrator may execute directly; a frontier orchestrator delegates fewer times and to fewer specialists. The maker/checker split remains required where the route and host can provide it, and the directive must not claim stronger enforcement than the host provides.
- **Mode keywords still win.** `fein`/`sonar`/`blitz` are per-turn overrides that beat the tier default.
- **The 7 specialists stay.** No specialist is removed; `frontier` skips stages, not agents.
- **The sync pipeline is unaffected.** This is prompt content plus a tier config declaration, not new plumbing.

## Consequences

### Positive

- **The contract becomes honest.** Users can choose direct, focused, or full work without inferring that every task receives the same pipeline.
- **Cost and latency become explicit trade-offs.** The observed variation is large (11 Kimi K3 sessions cost $6.60 versus $7.16 for 547 DeepSeek flash sessions), but these figures describe usage, not a promised saving.
- **Future routing remains measurable.** Unit 2 can compare cost, latency, correction rate, and review findings by route.

### Negative

- **Selective routing can miss useful checks.** A direct route gives up structured handoffs and independent review; the guide recommends escalation when uncertainty or risk increases.
- **Platform differences limit portability.** OpenCode has stronger tool-level maker/checker enforcement; Kimi reviewer behavior is advisory unless a review-only session is configured; Pi and OMP have inherited-context and dispatch differences; Hermes defaults to `fein` without automatic maker/checker enforcement for direct work.

## Alternatives Considered

### Option A: Keep the Pipeline Universal, Document the Constraint

Document "Maestria is designed for cheap fast models" and leave the pipeline untouched. Rejected for the public contract: it hides a measurable cost and contradicts observed model and platform differences. [verified]

### Option B: Collapse the Pipeline Only Via User-Initiated `blitz` Mode

Require users on frontier models to prefix tasks with `blitz`. Rejected as the complete solution: `blitz` is not universal across platforms and is a task mode, not a model-economics policy. [verified]

### Option C: Runtime Cost Feedback Loop

The orchestrator reads its own token/cost telemetry and adjusts fan-out dynamically. Deferred: platform telemetry is inconsistent across opencode/kimi-code/pi, and dynamic self-tuning is a reliability risk in the core loop. The static tier is deterministic, testable, and covers the observed failure mode; telemetry-driven tuning can be layered on later if the tier proves too coarse.

### Option D: Model Detection at Session Start

The platform passes the resolved model name into orchestrator context and Maestria maps model IDs to tiers. Deferred for the same reason as Option C: the mapping is platform-specific and brittle across aliases and providers. Automatic capability classification is a non-goal for Unit 1. [inferred]

## Related Decisions

- ADR-CORE-011 (eliminate questions) - established the autonomy default this tier scales; tier does not change the question policy
- ADR-CORE-012 (deterministic review signals) - review frequency scales with tier; the access list discipline applies at every tier
- ADR-OC-003 (workflow modes) - platform-specific modes remain available where implemented; they do not imply adaptive routing

## Non-goals

- No runtime price detection.
- No automatic model capability classification.
- No universal `MAESTRIA_TIER` variable yet.
- No new framework or runtime.
- No claim that platform dispatch, context inheritance, or maker/checker enforcement is equivalent across platforms.

## Assumptions

- [verified] Current platforms do not expose a universal `MAESTRIA_TIER` or automatic model-economics router.
- [verified] Full pipeline selection, mode activation, reviewer enforcement, and context inheritance vary by platform.
- [inferred] A route guide based on task class is more useful to users now than a price-tier taxonomy that the runtime cannot enforce.
- [inferred] Unit 2 should measure route outcomes before choosing defaults or promising cost reductions.

## Measurable hypotheses for Unit 2

These are hypotheses, not acceptance claims:

1. Direct execution will reduce cost and wall-clock time for tiny edits and familiar, low-risk changes compared with the full pipeline.
2. Focused delegation will retain useful discovery or review quality with less overhead than the full pipeline for ordinary changes.
3. Full routing will reduce escaped defects or rework for complex and high-risk changes enough to justify its additional model work.
4. Model price and cache behavior will materially change the preferred route.

Unit 2 should measure route cost, latency, correction rate, and reviewer findings before claiming an improvement target.

## Rollback conditions

Roll back any future selective-routing implementation if it silently changes the route selected by an explicit user mode, hides the selected route, prevents a user from choosing the full pipeline, or increases escaped defects without a documented trade-off. Restore the documented direct/focused/full guidance until the behavior is corrected.

## Date

2026-07-31
