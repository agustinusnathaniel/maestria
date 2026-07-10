# ADR-CORE-011: Eliminate Questions — Mid-Phase Autonomy with Boundary Checkpoints

## Status

Accepted (2026-07-10)

## Context

### Problem: Question Proliferation in Agent Sessions

Analysis of 5,675 real OpenCode sessions (June 10 – July 10, 2026) revealed a structural imbalance in how the orchestrator distributes work and how often it interrupts the user:

| Metric                                               | Value |
| ---------------------------------------------------- | ----- |
| Builder share of all delegations                     | 48.2% |
| Combined share (architect + planner + diagnose)      | 2.0%  |
| Average subagent dispatches per orchestrator session | 23.6  |
| Sessions with inline `question()` calls              | 67.3% |

Three specialists — architect, planner, diagnose — received only 2% combined delegations vs builder's 48.2%. The orchestrator was routing almost everything to builder, then asking the user questions that those specialists could have answered autonomously. Users consistently reported "babysitting during agent run": too many questions, permission prompts, and decision prompts interrupting the work flow.

### Data Analysis: 1,133 question() Calls

A sample of 1,133 `question()` calls from orchestrator sessions was analyzed for response patterns:

| Response Pattern | Share | Interpretation |
| --- | --- | --- |
| Approval | 86.4% | Most questions are ceremonial — the user confirms what the agent could have assumed |
| Clarification (bounced back) | 8.2% | User returns the question: "your take?" |
| Rejection (meaningful correction) | 3.8% | Genuine mistakes — agent should have verified before asking |
| Frustration (ignoring context) | 0.5% | Agent asked about something already covered in history or project rules |

Additional patterns surfaced:

| Category | Finding |
| --- | --- |
| Commit proposals | 88.4% approval, 11.6% correction (wrong prefix or scope) |
| Push proposals | 81.7% approval, 17.1% deferral ("not yet") |
| Timing | Bimodal — questions cluster at session start and end; the work phase is relatively quiet |
| Rejection loops | Some sessions had 15+ consecutive rejections without the agent re-evaluating its approach |

The 86.4% approval rate is the key signal: the vast majority of questions were unnecessary. The agent had enough data to decide but deferred to the user by habit.

### Industry Research

Research across 6 agent systems (Claude Code, Cursor, GitHub Copilot, Devin, Cline, Continue) showed convergence on several patterns:

- **Approval gates over per-action prompts.** Systems that work well use strategic checkpoints at phase boundaries (plan approved → execute → verify), not individual tool-call prompts.
- **Permission mode spectrums.** 3–6 levels of autonomy are common — from "ask everything" to "full auto" — letting users set their comfort level.
- **Claude Code's auto-mode engineering.** Claude Code implemented a 2-stage safety classifier (fast path + slow path) with published false-positive and false-negative rates. The classifier gates only high-risk tool calls; everything else runs autonomously.

### Philosophy Shift

**From:** "Ask when unsure — user decides"

**To:** "Exhaust data, document assumptions, proceed — reviewer catches mistakes"

This shift reframes the agent's default posture. Uncertainty is not a signal to ask a question; it is a signal to gather more data (codebase, ADRs, project rules, open-source survey), make the best decision, document the assumption, and proceed. The reviewer specialist becomes the safety net for verifying assumptions.

## Decision

We make five related design decisions, implemented across 4 phases targeting 8 canonical agent directive files.

### Decision 1: Eliminate Mid-Phase Questions

All mid-phase questions are eliminated:

- Design decisions (which approach to take, which library to use)
- Permission requests (can I edit this file, can I install this package)
- Approach preferences (should I do X or Y)

The agent instead exhausts available data sources (codebase patterns, ADRs, project rules, open-source survey), makes the best decision, and documents the assumption in its output. The rule applies uniformly to all 7 specialists and the orchestrator.

The only exception is `writer.md`, which was explicitly scoped out — documentation audience questions (tone, audience, format) are legitimately different from implementation decisions and benefit from user input.

### Decision 2: Keep Boundary Checkpoints

Boundary checkpoints are retained and refined:

| Checkpoint | Behavior | Rationale |
| --- | --- | --- |
| **Commit** | Autonomous — agent reads git log for past correction patterns, composes correct conventional commit message, commits | 88.4% approval rate; agent can learn from the 11.6% corrections |
| **Push** | Automatic on feature branches; `question()` on `main`/`master` | Feature branches are safe to push without review; main-branch pushes are higher risk |
| **PR creation** | Always `question()` | Separate decision from commit/push; requires user intent |
| **Re-evaluation** | After 3 consecutive rejections, agent stops and re-assesses | Prevents 15+ rejection loops |

### Decision 3: Add Re-Evaluation Trigger

After 3+ consecutive rejections from the user (not during commits, where correction is normal feedback), the agent stops the current approach and re-assesses. Instead of continuing to iterate in the wrong direction, it asks: "This direction keeps getting rejected. Should I change approach?"

This addresses the "approve then reject" loops observed in the data — sessions where agents continued iterating on the same rejected approach 15+ times without reconsidering the fundamental direction.

### Decision 4: Restrict question() to Three Irreversible Categories

`question()` is restricted to three categories where an incorrect autonomous decision has irreversible consequences:

1. **Data migrations** — schema changes, column adds, data transformations
2. **Production deployments** — pushing to prod, DNS changes, CDN configuration
3. **Security boundaries** — permission model changes, auth flow redesign, secret rotation, encryption decisions

A tiebreaker rule applies: if the agent is unsure whether a decision falls into an exception category, it treats it as an exception. The cost of treating an exception as ordinary (irreversible mistake) is higher than the cost of treating ordinary as an exception (one extra question).

### Decision 5: Permission Modes — Platform-Specific, Not Core

Permission mode spectrums (3–6 levels of autonomy, like Claude Code's ask/accept/auto) were considered but rejected from core. The autonomy philosophy — exhaust data, document assumptions, proceed — lives in `rules.md` (cross-platform). Each plugin platform (opencode, pi, kimi-code) implements its own permission model independently.

Rationale:

- Permission models are inherently platform-specific (how the platform enforces tool-level gates)
- Core must not depend on platform-specific permission concepts
- Plugin platforms already have their own permission systems (opencode's `ask`/`allow`/`deny`, pi's mode selection)
- The philosophy layer is what belongs in core; the enforcement layer is what belongs in plugins

## Consequences

### Positive

- **Fewer user interruptions.** Mid-session questions drop to near zero. Users get longer stretches of uninterrupted agent work.
- **Specialists operate at full capability.** Architect, planner, and diagnose are used for what they're designed for — the orchestrator stops defaulting everything to builder.
- **Reviewer becomes the safety net.** Instead of the user catching every mid-phase mistake, assumptions are documented and verified post-hoc by reviewer. This shifts the verification burden from the user to the pipeline.
- **Rejection loops are bounded.** The 3-strike re-evaluation trigger prevents open-ended wasted iteration.
- **Data-driven design.** The 86.4% approval rate and 1,133-call analysis ground the decision in real usage data, not intuition.
- **Platform independence preserved.** Permission mode enforcement stays in each platform plugin where it belongs.

### Negative

- **Wrong assumptions may cause rework in review.** Eliminating questions means more assumptions documented. Some will be wrong. The reviewer must catch them, and the cost of false assumptions is paid in review cycle time rather than upfront user confirmation.
- **Reviewer quality becomes more critical.** With fewer user checkpoints, the reviewer is the primary gate for catching bad assumptions. A weak reviewer means bad assumptions reach the user unchanged.
- **Learning curve for agents.** Retraining the orchestrator and specialists to "exhaust data, don't ask" requires changes to ingrained behavior patterns. The initial period may see agents either asking too little (and making avoidable mistakes) or reverting to old patterns.
- **writer.md scoped out creates inconsistency.** Documentation audience questions are exempt, which means the autonomy rules don't apply uniformly. Writers must remember this exception.

### Neutral

- **writer.md was explicitly scoped out.** Documentation audience questions are legitimately different from implementation decisions — they require human judgment about tone, audience, and format. This is a deliberate carve-out, not an oversight.

## Alternatives Considered

### Option A: Blanket "Eliminate All Questions"

The original proposal was a blanket "eliminate all questions" approach — remove every `question()` call from every agent.

Rejected because the response data analysis (1,133 questions) revealed a more nuanced pattern. Commit and push questions have high approval rates (88.4% and 81.7%), but they serve a different purpose: they act as phase-boundary quality gates, not decision prompts. Eliminating them would remove valuable user checkpoints. The refined "mid-phase vs boundary" distinction emerged from this analysis.

### Option B: Permission Modes in Core

A permission mode system (3–6 levels from "ask everything" to "full auto") integrated into core agent directives, with each plugin mapping modes to platform-specific enforcement.

Rejected because permission models are inherently platform-specific. OpenCode has `ask`/`allow`/`deny` tool permissions built in. Pi uses mode selection. Kimi Code has its own agent workflow concepts. Encoding a mode system in core would either be too abstract to be useful or would couple core to platform-specific concepts. The autonomy philosophy belongs in core; mode selection and enforcement belong in each platform plugin. This was initially part of Phase 1 but removed during review.

### Option C: Classifier-Based Gating (Claude Code Pattern)

Implement a 2-stage safety classifier (like Claude Code's) that dynamically decides whether a specific action needs user approval based on risk scoring.

Rejected because:

- Building a reliable classifier requires training data and evaluation infrastructure we don't have
- The cost benefit doesn't justify the engineering investment — the simpler "three exception categories" rule covers the same high-risk cases with no ML dependency
- A static rule set is auditable and predictable; a classifier is a black box

## Post-Implementation Evolution

Several design details diverged from the original plan during implementation. This section documents what changed and why.

### Mid-Phase vs Boundary Distinction (Refined Scope)

**Original plan:** A blanket "eliminate questions" approach — remove every `question()` call from orchestrator and specialists.

**What changed:** The response data analysis of 1,133 questions revealed that not all questions are equal. Phase-boundary questions (commit, push, PR) have a fundamentally different function from mid-phase questions (design choices, permissions, approach preferences). The former serve as quality gates with high user engagement; the latter are noise with 86.4% ceremonial approval. The refined design eliminates mid-phase questions but keeps boundary checkpoints.

**Why:** The data made this distinction impossible to ignore. An 86.4% approval rate on mid-phase questions means the agent could have decided autonomously. But the 88.4% approval on commit proposals and 81.7% on push proposals are not noise — they are lightweight verification steps the user values. Treating them the same would have removed useful checkpoints.

### Permission Modes Removed from Core

**Designed:** Phase 1 included a permission mode system (3–6 levels) defined in core `rules.md`, with each plugin providing the enforcement layer.

**Built:** Permission modes are not in core. The autonomy philosophy ("exhaust data, document assumptions, proceed") is the only cross-cutting rule. Each plugin implements permissions independently.

**Why:** Review flagged this as a platform-independence violation. Permission models are fundamentally about how a platform enforces tool-level gates — that is a platform concern, not a core concern. Core sets the "what" (autonomy principle); plugins own the "how" (permission enforcement). Including modes in core would have created coupling between core and platform-specific concepts like OpenCode's permission levels or Pi's mode selection.

### Re-Evaluation Trigger: From Observer Pattern to Hard Limit

**Designed:** A re-evaluation signal based on observing user sentiment (tone analysis, hesitation patterns).

**Built:** A hard limit of 3 consecutive rejections before the agent stops and re-assesses.

**Why:** Tone analysis and sentiment detection are unreliable and add unnecessary complexity. A hard limit is simple, auditable, and unambiguous. The data showed that rejection loops of 15+ consecutive rejections occurred — any limit >0 would help. The choice of 3 balances catching loops early against not interrupting normal correction cycles.

### writer.md Scoped Out

**Designed:** All specialists subject to the same question-elimination rules.

**Built:** writer.md is explicitly exempted. Documentation audience questions (tone, audience, format) are handled differently.

**Why:** Documentation has fundamentally different constraints from implementation. A bad architecture decision can be caught in review; a documentation artifact written for the wrong audience is wasted work regardless of review quality. Writing for humans inherently requires understanding the human audience, which the agent cannot fully derive from codebase data alone. The exemption is documented in the writer specialist prompt.

## Related Decisions

- ADR-CORE-001 (Global Rules Scope) — established the three-way filter that determines where rules live; this ADR's autonomy principle was added to `rules.md` per that filter
- ADR-CORE-003 (Agent Conventions) — defined the `!!!` marker convention for critical rules; the new question-elimination rules use this convention
- ADR-CORE-004 (Agent Prompt Template) — established the 4-bucket skills section and handoff contracts used in all specialist files; this ADR's changes respect those template conventions
- ADR-CORE-005 (Shared Agent Directives via core-sync Bridge) — the 4-phase implementation across 8 canonical agent directive files relies on the sync pipeline established here
- ADR-OC-001 (Tool Permission Design) — opencode's existing permission model provides the enforcement layer for the autonomy philosophy; this ADR defers permission mode design to the plugin level
- ADR-PI-001 (Rules Injection) — pi's rules injection contract must propagate the new autonomy rules; this ADR's `rules.md` changes flow through the sync pipeline

## References

- `packages/core/agent-directives/rules.md` — autonomy principle and boundary checkpoints (cross-cutting rules)
- `packages/core/agent-directives/specialists/orchestrator.md` — restricted `question()` categories, re-evaluation trigger, delegation pattern updates
- `packages/core/agent-directives/specialists/architect.md` — assumes autonomous design decisions with documented assumptions
- `packages/core/agent-directives/specialists/planner.md` — assumes autonomous plan decisions
- `packages/core/agent-directives/specialists/diagnose.md` — assumes autonomous investigation decisions
- `packages/core/agent-directives/specialists/builder.md` — assumes autonomous implementation decisions
- `packages/core/agent-directives/specialists/adventurer.md` — exhausts data sources before proceeding
- `packages/core/agent-directives/specialists/reviewer.md` — validates assumptions documented by other specialists
- `packages/core/agent-directives/specialists/writer.md` — scoped out of question-elimination rules (documentation audience questions exempt)
- `docs/PATTERNS.md` — documents the philosophy shift from "ask when unsure" to "exhaust data, proceed, review"
- Internal: OpenCode session telemetry (June 10–July 10, 2026) — 5,675 sessions, 1,133 question() call analysis

## Date

2026-07-10
