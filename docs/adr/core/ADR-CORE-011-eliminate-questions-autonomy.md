# ADR-CORE-011: Eliminate Questions - Mid-Phase Autonomy with Boundary Checkpoints

## Status

Accepted - amended 2026-08-13

## Context

### Problem: Question Proliferation in Agent Sessions

Analysis of 5,675 real OpenCode sessions (June 10 - July 10, 2026) found a structural imbalance: builder received 48.2% of all delegations, while architect, planner, and diagnose received 2.0% combined; sessions averaged 23.6 subagent dispatches, and 67.3% contained inline `question()` calls. The orchestrator routed almost everything to builder, then asked questions those specialists could have answered autonomously. Users consistently reported "babysitting during agent run": too many questions and decision prompts interrupting the work flow.

### Data Analysis: 1,133 question() Calls

Of the sampled calls, 86.4% were approvals, 8.2% clarifications bounced back to the agent, 3.8% meaningful corrections, and 0.5% frustration about context already covered. Commit proposals drew 88.4% approval and 11.6% correction (wrong prefix or scope); push proposals drew 81.7% approval and 17.1% deferral ("not yet"). Questions clustered at session start and end, with the work phase relatively quiet, and some sessions ran 15+ consecutive rejections without the agent re-evaluating.

The 86.4% approval rate is the key signal: the vast majority of questions were unnecessary. The agent had enough data to decide but deferred to the user by habit.

### Industry Research

Research across 6 agent systems (Claude Code, Cursor, GitHub Copilot, Devin, Cline, Continue) showed convergence on: strategic approval gates at phase boundaries (plan approved -> execute -> verify) rather than per-action prompts; 3-6 level permission spectrums from "ask everything" to "full auto"; and Claude Code's 2-stage safety classifier, which gates only high-risk tool calls.

### Philosophy Shift

**From:** "Ask when unsure - user decides"

**To:** "Exhaust data, document assumptions, proceed - reviewer catches mistakes"

Uncertainty is not a signal to ask a question; it is a signal to gather more data (codebase, ADRs, project rules, open-source survey), make the best decision, document the assumption, and proceed. The reviewer specialist becomes the safety net for verifying assumptions.

## Decision

Five related design decisions, implemented across the canonical agent directives.

### Decision 1: Eliminate Mid-Phase Questions

All mid-phase questions are eliminated: design decisions (which approach or library), permission requests (may I edit this file or install this package), and approach preferences (should I do X or Y). The agent instead exhausts available data sources, makes the best decision, and documents the assumption. The rule applies uniformly to all specialists and the orchestrator; the one exception is the writer specialist, which was explicitly scoped out because documentation audience questions (tone, audience, format) are legitimately different and benefit from user input.

### Decision 2: Keep Boundary Checkpoints

Boundary checkpoints are retained and refined:

| Checkpoint | Behavior | Rationale |
| --- | --- | --- |
| **Commit** | Autonomous - the agent reads git log for past correction patterns, composes a correct conventional commit message, commits | 88.4% approval rate; the agent can learn from the 11.6% corrections |
| **Branch, commit, push, and PR** | Autonomous delivery on a clear task feature branch after validation and required review; the feature branch is created automatically when the base, remote, and ownership are clear | Routine engineering delivery is one user outcome; protected branches, unresolved review, and high-impact actions remain guarded |
| **Re-evaluation** | After 3 consecutive rejections, the agent stops and re-assesses | Prevents 15+ rejection loops |

### Decision 3: Add Re-Evaluation Trigger

After 3+ consecutive rejections from the user (not during commits, where correction is normal feedback), the agent stops the current approach and asks whether to change direction, instead of iterating 15+ times on the same rejected approach.

### Decision 4: Restrict question() to Three Irreversible Categories

`question()` is restricted to three categories where an incorrect autonomous decision has irreversible consequences:

1. **Data migrations** - schema changes, column adds, data transformations
2. **Production deployments** - pushing to prod, DNS changes, CDN configuration
3. **Security boundaries** - permission model changes, auth flow redesign, secret rotation, encryption decisions

A tiebreaker applies: if the agent is unsure whether a decision falls into an exception category, it treats it as an exception. The cost of treating an exception as ordinary (an irreversible mistake) is higher than the cost of treating ordinary as an exception (one extra question).

### Decision 5: Permission Modes - Platform-Specific, Not Core

Permission mode spectrums (3-6 levels of autonomy) were considered but rejected from core. The autonomy philosophy lives in the cross-platform rules; each plugin platform (opencode, pi, kimi-code) implements its own permission model independently, because permission models are inherently platform-specific, core must not depend on them, and existing plugin systems (opencode's `ask`/`allow`/`deny`, pi's mode selection) already handle enforcement. The philosophy layer belongs in core; the enforcement layer belongs in plugins.

## Consequences

### Positive

- **Fewer user interruptions**, with near-zero mid-session questions and longer stretches of uninterrupted work.
- **Specialists operate at full capability** instead of the orchestrator defaulting everything to builder.
- **Reviewer becomes the safety net.** Documented assumptions are verified post-hoc by the reviewer, shifting verification from the user to the pipeline.
- **Rejection loops are bounded** by the 3-strike re-evaluation trigger.
- **Data-driven design**, grounded in the session and question-call analysis rather than intuition.
- **Platform independence preserved**, since permission enforcement stays in each platform plugin.

### Negative

- **Wrong assumptions may cause rework in review.** More assumptions are documented and some will be wrong; the cost is paid in review cycle time rather than upfront confirmation.
- **Reviewer quality becomes more critical.** With fewer user checkpoints, a weak reviewer lets bad assumptions through.
- **Learning curve for agents.** Retraining the orchestrator and specialists to "exhaust data, don't ask" may initially produce too little asking or a reversion to old patterns.
- **The writer exception creates inconsistency**, so the autonomy rules do not apply uniformly.

### Neutral

- **The writer specialist was explicitly scoped out.** Documentation audience questions require human judgment about tone, audience, and format. This is a deliberate carve-out, not an oversight.

## Alternatives Considered

### Option A: Blanket "Eliminate All Questions"

The original proposal removed every `question()` call from every agent.

Rejected because the response data showed a more nuanced pattern. Commit and push questions have high approval rates (88.4% and 81.7%) but are phase-boundary quality gates, not decision prompts; eliminating them would remove valuable user checkpoints. The refined "mid-phase vs boundary" distinction emerged from this analysis.

### Option B: Permission Modes in Core

A permission mode system (3-6 levels) integrated into core agent directives, with each plugin mapping modes to platform-specific enforcement.

Rejected because permission models are inherently platform-specific: OpenCode has `ask`/`allow`/`deny` tool permissions, Pi uses mode selection, and Kimi Code has its own workflow concepts. A core mode system would be too abstract to be useful or would couple core to platform concepts. The autonomy philosophy belongs in core; mode selection and enforcement belong in plugins.

### Option C: Classifier-Based Gating (Claude Code Pattern)

A 2-stage safety classifier that approves actions by risk scoring.

Rejected because building a reliable classifier requires training data and evaluation infrastructure we do not have; the three exception categories cover the same high-risk cases without an ML dependency; and a static rule set is auditable and predictable, while a classifier is a black box.

## Post-Implementation Evolution

Several design details diverged from the original plan during implementation.

### Amendment (2026-08-14): Delivery and continuation are one autonomous outcome

Maestria sessions showed that treating branch creation, push, and PR creation as implicit or separately authorized steps caused the agent to stop after implementation and wait for routine instructions. The earlier PR-question boundary is therefore superseded for normal engineering work.

For implementation work, the canonical contract owns the path from repository inspection through the project's normal delivery artifact. When the repository, branch, remote, ownership, and host capabilities support PR delivery, the agent creates or uses a feature branch, commits validated and reviewed work, pushes it, and opens the PR without ceremonial approval. Research-only, planning-only, explicitly read-only, and host-blocked work terminates at its requested artifact or exact blocker. A specialist handoff, incomplete todo, or no-edit result is not a user checkpoint for implementation work; the parent continues with the next bounded action, makes one useful recovery attempt for an incomplete delegation, or reports the exact blocked delta. Acceptance criteria, non-goals, and the repair budget remain attached to the same user outcome even when work is split across specialists, and adjacent review findings do not broaden it unless they invalidate acceptance or trigger a safety or authorization stop. It still stops for security, authentication or permissions, data loss or migration, production, irreversible, genuinely ambiguous, or host-capability boundaries. Merge and release remain separate actions.

### Mid-Phase vs Boundary Distinction (Refined Scope)

**Original plan:** blanket removal of every `question()` call.

**What changed:** phase-boundary questions (commit, push, PR) are quality gates with high user engagement, while mid-phase questions (design choices, permissions, approach preferences) are noise with 86.4% ceremonial approval. The refined design eliminates mid-phase questions and keeps boundary checkpoints.

**Why:** an 86.4% approval rate means the agent could have decided autonomously, but 88.4% approval on commit proposals and 81.7% on push proposals are lightweight verification steps the user values; treating them the same would have removed useful checkpoints.

### Permission Modes Removed from Core

**Designed:** Phase 1 included a 3-6 level permission mode system in core rules, with plugins providing enforcement.

**Built:** permission modes are not in core; the autonomy philosophy is the only cross-cutting rule, and each plugin implements permissions independently.

**Why:** review flagged this as a platform-independence violation. Core sets the autonomy principle; plugins own permission enforcement. Including modes in core would have coupled core to platform-specific concepts.

### Re-Evaluation Trigger: From Observer Pattern to Hard Limit

**Designed:** a re-evaluation signal based on observing user sentiment (tone analysis, hesitation patterns).

**Built:** a hard limit of 3 consecutive rejections.

**Why:** tone analysis is unreliable and adds complexity; a hard limit is simple, auditable, and unambiguous. The data showed 15+ rejection loops, so any limit above zero would help; 3 balances catching loops early against interrupting normal correction cycles.

### writer.md Scoped Out

**Designed:** all specialists subject to question elimination.

**Built:** the writer specialist is explicitly exempted for audience questions (tone, audience, format).

**Why:** documentation has fundamentally different constraints from implementation. A bad architecture decision can be caught in review; a documentation artifact written for the wrong audience is wasted work regardless of review quality, and understanding the human audience cannot be fully derived from codebase data alone. The exemption is documented in the writer specialist prompt.

## Related Decisions

- ADR-CORE-001 (Global Rules Scope) - the three-way filter that determines where rules live; this ADR's autonomy principle was added to the cross-cutting rules per that filter
- ADR-CORE-003 (Agent Conventions) - the `!!!` marker convention used by the new question-elimination rules
- ADR-CORE-004 (Agent Prompt Template) - the 4-bucket skills section and handoff contracts this ADR's changes respect
- ADR-CORE-005 (Shared Agent Directives via core-sync Bridge) - the sync pipeline this ADR's implementation relies on
- ADR-OC-001 (Tool Permission Design) - opencode's permission model provides the enforcement layer for the autonomy philosophy; this ADR defers permission mode design to the plugin level
- ADR-PI-001 (Rules Injection) - pi's rules injection contract must propagate the new autonomy rules through the sync pipeline

## References

- Canonical agent directives - the cross-cutting rules carry the autonomy principle and boundary checkpoints, and the orchestrator and specialist prompts carry restricted `question()` categories, the re-evaluation trigger, delegation updates, and per-specialist autonomy guidance (writer exempted)
- `PATTERNS.md` - the philosophy shift from "ask when unsure" to "exhaust data, proceed, review"
- Internal: OpenCode session telemetry (June 10 - July 10, 2026) - 5,675 sessions, 1,133 `question()` call analysis

## Date

2026-07-10
