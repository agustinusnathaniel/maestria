# ADR-CORE-013: Selective routing by task and model economics

## Status

Proposed evolution (2026-07-31). Unit 1 documents the contract; no adaptive routing is implemented by this ADR.

## Context

### The Pipeline Is a Token Multiplier by Construction

Maestria's pipeline forces discipline through delegation: a "simple" task spawns `@adventurer` (recon) -> `@builder` (implement) -> `@reviewer` (verify), and a complex task adds `@architect`/`@planner`, the review loop (max 3 cycles), and the commit protocol (which spawns `@adventurer` for git inspection, `@builder` for execution). Each spawn loads a fresh 40-150K context plus megabytes of cached context, and every delegation briefing, result, and Work Results table accumulates in the orchestrator session forever.

This is the mechanism of Maestria's discipline - and it is also a constant token multiplier on top of whatever the model costs.

### Session Data: The Multiplier's Cost Scales With Model Price

Usage data from the opencode session database (620 Maestria sessions) shows the same pipeline under two pricing regimes:

|                         | deepseek-v4-flash (547 sessions) | kimi-k3 (11 sessions, Jul 20-21) |
| ----------------------- | -------------------------------- | -------------------------------- |
| Subagent input          | 6.4M fresh + ~300M cached        | 855K fresh + ~7M cached          |
| Total cost              | $7.16                            | $6.60                            |
| Cost per adventurer run | ~$0.011                          | ~$0.68                           |

The same pipeline that costs pennies on flash costs dollars on kimi-k3. A frontier-model session (gpt-5.6-luna) shows the structural shape: one task spawned a long chain of sequential subagents, consuming far more cached than fresh input. The orchestrator's own session cost was negligible next to the amplification from delegation.

A flash-class session (deepseek-v4-flash) shows the other failure mode: a day of frequent subagent spawns stays cheap, but the orchestrator session grows large and every spawn adds latency.

Across the recon report, a Kimi adventurer run averaged about $0.683 and 452
seconds, compared with about $0.011 and 81 seconds for flash. Orchestrator cache-read versus fresh-input cost differed by roughly 45x, and observed fan-out reached 58 children. These figures establish the cost and latency problem; they do not establish a universal route or a promised reduction. [verified]

### The Gap

The orchestrator has no awareness of its own model's price or latency. It applies the same pipeline depth, fan-out caps (3-5 parallel), and review loops regardless of whether tokens cost a few cents or nearly a dollar per million and whether each spawn takes 2 seconds or 2 minutes. The workflow modes (`fein`/`sonar`/`blitz`) are platform-dependent, user-initiated mechanisms; they do not express persistent model economics. No universal tier variable or automatic adaptive route exists today. [verified]

The result: Maestria is implicitly optimized for cheap, fast, weak-advantage models (flash-class), and becomes a net negative on frontier models, where the quality premium of narrow-focus delegation shrinks while the cost and latency multipliers stay constant.

## Decision

Adopt staged evolution rather than claiming a runtime feature that does not exist. Unit 1 narrows the public contract to three routes: direct execution, a focused specialist or review, and the full pipeline. Users select a route based on task risk, uncertainty, model economics, and platform behavior. The full pipeline is explicitly selected or justified by the task; it is not a universal default. [inferred]

Unit 2 may implement selective routing informed by model economics. That future work must preserve the route contract while making any new configuration or runtime behavior explicit.

### Runtime authority clarification (2026-08-12)

The shared directive defines route selection and behavioral principles; the host runtime defines execution authority. OpenCode, OMP, and Kimi may require pure-dispatcher behavior where their adapters or session permissions restrict the orchestrator. Direct-capable runtimes may execute a direct route when their host permits it. Delegated work remains owned by its designated specialist, and maker/checker requirements remain honest about the enforcement the host actually provides.

### Proposed future tier model

| Tier       | Model class (example)          | Budget         | Latency  |
| ---------- | ------------------------------ | -------------- | -------- |
| `flash`    | deepseek-v4-flash, free models | < $0.5/M input | fast     |
| `mid`      | mid-price models               | $0.5-2/M input | moderate |
| `frontier` | gpt-5.6, kimi-k3 class         | > $2/M input   | slow     |

This table is a hypothesis for Unit 2, not current behavior. `MAESTRIA_TIER` is not implemented. No platform currently provides a universal tier setting or automatic route selection. [verified]

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

- **Tier scales the pipeline, not the safety principles.** `!!!` rules such as evidence-based completion, maker/checker review, bounded repair, and authorization floors still bind. Whether the orchestrator can execute directly is defined by the host runtime: restricted hosts may require pure dispatch, while direct-capable hosts may execute a direct route. A frontier orchestrator delegates fewer times and to fewer specialists. The maker/checker split remains required where the selected route and host can provide it; the directive must not claim stronger enforcement than the host provides.
- **Mode keywords still win.** `fein`/`sonar`/`blitz` are per-turn overrides that beat the tier default for that turn. Tier is the default; mode is the exception.
- **The 7 specialists stay.** No specialist is removed at any tier. `frontier` skips stages, it does not delete agents.
- **The sync pipeline is unaffected.** This is content (prompts) + config (tier declaration), not new plumbing. The orchestrator prompt gains a Tier section; platform frontmatter gains a tier setting.

## Consequences

### Positive

- **The current contract becomes honest.** Users can choose direct, focused, or full work without inferring that every task receives the same pipeline.
- **Cost and latency become explicit trade-offs.** The evidence shows large variation: 620 sessions cost $19.17 in aggregate; Kimi K3 sessions cost
  $6.60 for 11 sessions versus $7.16 for 547 DeepSeek flash sessions. These figures describe observed usage, not a promised saving.
- **Future routing remains measurable.** Unit 2 can compare cost, latency, correction rate, and review findings by route.

### Negative

- **Selective routing can miss useful checks.** A direct route gives up some structured handoffs and independent review. The guide therefore recommends escalation when uncertainty or risk increases.
- **Platform differences limit portability.** OpenCode has stronger tool-level maker/checker enforcement. Kimi reviewer behavior is advisory unless a review-only session is configured. Pi and OMP have inherited-context and dispatch differences. Hermes defaults to `fein` but does not automatically create maker/checker enforcement for direct work.

## Alternatives Considered

### Option A: Keep the Pipeline Universal, Document the Constraint

Document "Maestria is designed for cheap fast models" and leave the pipeline untouched.

Rejected for the public contract. It hides a measurable cost and contradicts observed model and platform differences. [verified]

### Option B: Collapse the Pipeline Only Via User-Initiated `blitz` Mode

Require users on frontier models to prefix tasks with `blitz`.

Rejected as the complete solution. `blitz` is not universal across platforms, and it is a task mode rather than a model-economics policy. [verified]

### Option C: Runtime Cost Feedback Loop

The orchestrator reads its own session token/cost telemetry (where the platform exposes it) and adjusts fan-out dynamically.

Deferred. Platform telemetry is inconsistent across opencode/kimi-code/pi, and dynamic self-tuning is a reliability risk in the core loop. The static tier is deterministic, testable, and covers the observed failure mode (steady-state amplification). Telemetry-driven tuning can be layered on later if the static tier proves too coarse.

### Option D: Model Detection at Session Start

The platform passes the resolved model name into the orchestrator context; Maestria maps known model IDs to tiers automatically.

Deferred for the same reason as Option C: the mapping is platform-specific and brittle across model aliases and providers. Automatic capability classification is a non-goal for Unit 1. [inferred]

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
