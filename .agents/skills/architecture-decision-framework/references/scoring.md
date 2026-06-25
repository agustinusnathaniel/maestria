# Weighted Scoring Guide

Load this reference when a decision needs quantified trade-offs between competing criteria. It helps you pick defensible weights and avoid the common failure modes that make weighted scoring feel like astrology.

Decisions should be human-led — the scoring is a tool for clarity, not a verdict. After scoring, document the outcome as an Architecture Decision Record (ADR) with the weight table and rationale so the reasoning survives the conversation.

## How Weights Work

Each criterion gets a percentage that sums to 100%. Score each option 1–3 per criterion (1 = Poor fit, 2 = Acceptable, 3 = Strong fit). Multiply weight × score, sum across criteria. Highest total wins.

The hard part is picking the weights. That's what this reference is for.

## Weight Profiles with Reasoning

### The Seven Profiles

| Context | Speed | Quality | Expertise | Reversibility | Cost/Compliance | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| **MVP / prototype** | 40% | 20% | 30% | 10% | — | Speed dominates because you don't know if anyone wants this. Quality above 20% is speculative. Expertise at 30% because devs must ship fast with tools they know. Reversibility is cheap at this scale anyway. |
| **Production** | 20% | 35% | 20% | 25% | — | Quality and reversibility trade places vs MVP. You'll live with this code. Reversibility at 25% because production mistakes are expensive and slow to undo. |
| **Startup (pre-PMF)** | 45% | 20% | 25% | 10% | — | Speed + Cost combined must be >50% or you run out of runway before finding product-market fit. Expertise stays high — startups can't afford learning curves. Reversibility is a luxury pre-PMF. |
| **Enterprise** | 20% | 30% | — | 25% | 25% (Compliance) | Expertise weight drops because enterprise teams don't have the single-person bus factor problem as acutely. Compliance replaces Cost — you cannot ship without it. |
| **Open Source Library** | 15% | 40% | 15% | 15% | 15% (Community) | Quality dominates. People depend on your API surface; breaking changes erode trust. Community cost (onboarding contributors, review burden) is the real constraint. Speed is lowest across all profiles — you have time to get it right. |
| **Internal Tool** | 35% | 15% | 35% | 15% | — | Speed + Expertise = 70%. Internal tools have zero market pressure and one job: unblock the team. Polish is waste. Weight Expertise heavily because you own the maintenance — if nobody knows the stack, nobody fixes it at 3 AM. |
| **Migration** | 20% | 25% | 25% | 30% | — | Reversibility is the highest criterion across all profiles. You are replacing something that works. If the migration gets stuck, you must be able to roll back cleanly. Speed at only 20% — moving too fast is how you break production. |

### DO / DON'T — Profile Selection

- **DO** ask "what happens if this choice is wrong?" If the answer is expensive, bump Reversibility.
- **DO** ask "who maintains this in 6 months?" If you don't know the person, bump Quality.
- **DON'T** use the MVP profile for anything you plan to keep for >3 months. The debt compounds faster than you think.
- **DON'T** use the Enterprise profile if the compliance requirement is "someone mentioned SOC 2 once." Check whether regulation is real vs aspirational.
- **DO** treat the Migration profile as the default for "rewrite the module" conversations. Engineers undershoot Reversibility because they're excited about the new thing.
- **DO** treat the scoring as a draft, not a verdict. Scoring surfaces trade-offs clearly, but the final call belongs to the engineer who owns the system.

## Weight Adjustment Heuristics

The profiles above are starting points. Adjust using these rules. Apply them in order: start with the base profile, then apply adjustments.

### Team Constraints

| Situation | Adjustment | Why |
| --- | --- | --- |
| Team of 1 | Double Expertise weight (floor 40%) | Bus factor is 1. What you know > what's "best." If Expertise was eliminated, add it back at 30% minimum. |
| Distributed / async team | Bump Quality +10% | Code must be self-documenting. You can't tap someone on the shoulder. |
| Team unfamiliar with the domain | Bump Reversibility +10% | First attempts will be wrong. Make it cheap to throw away. |
| Contractors building it, you maintaining it | Bump Quality to 35% minimum | You pay for tech debt on day 1. Contractors are gone by day 90. |

### Technical Constraints

| Situation | Adjustment | Why |
| --- | --- | --- |
| No existing test suite | Reversibility gets a floor of 20% | You have no safety net. Escape hatches are mandatory. |
| Monolith with no modular boundaries | Reversibility floor 25% | Everything is coupled. Undoing anything costs more than it should. Layer the floor higher. |
| Existing integration that can't change | Bump Reversibility +15% | The interface you're building against is frozen. You need to be able to swap your implementation out. |
| Greenfield project | Reversibility can drop to 10% | Nothing to break. You have room to iterate. |
| Data migration involved | Reversibility minimum 25%, ideally 30% | Data loss is unacceptable. Rollback plans are not optional. |

### Business Constraints

| Situation | Adjustment | Why |
| --- | --- | --- |
| Regulated industry (finance, health, gov) | Compliance weight replaces Cost, minimum 25% | Not negotiable. An audit failure can shut the project down. |
| Startup pre-PMF | Speed + Cost combined must be >50% | Runway is the only metric that matters. If your combined Speed+Cost is below 50%, you're optimizing for the wrong thing. |
| Fixed deadline (conference, compliance date) | Speed weight must be ≥30% | You cannot slip the date. Everything else bends to the schedule. |
| Scrappy, under-resourced team | Bump Speed by 10%, drop Quality by 10% | A working prototype in production is worth more than a well-architected one that's not shipped. |
| Public API / SDK / plugin | Quality weight minimum 35% | Your API is your contract. Breaking changes cascade to users you don't control. |

## Signs You Got the Weights Wrong

Anti-patterns — if you see these symptoms, the weights need revisiting.

| Symptom | Root Cause | Fix |
| --- | --- | --- |
| "We keep refactoring the same module" | Over-weighted Quality, under-weighted Reversibility. You optimized for "right" instead of "changeable." | Bump Reversibility 15%, drop Quality 10%. Make it easy to throw away the module and start over. |
| "The MVP took 3x longer than planned" | Under-weighted Speed, over-weighted Architecture. You built a cathedral for a pop-up stand. | Drop Quality to 20%, bump Speed to 45%. Premature optimization is the root of all evil. |
| "Nobody can maintain what we built" | Under-weighted Expertise. You chose the "best" tool that nobody on the team knows. | Bump Expertise to 40% minimum. Knowledge transfer time is not free. |
| "We can't change direction without breaking everything" | Under-weighted Reversibility. Your architecture is too rigid for the problem's uncertainty. | Bump Reversibility to 25%+, drop Quality by 10%. Decouple first, optimize second. |
| "The decision matrix says Option A, but my gut says Option B" | You picked weights to justify a pre-existing preference. This is confirmation bias, not scoring. | Go back to Phase 1 (understand the problem). You skipped it. Re-run the matrix without peeking at the scores until weights are locked. |
| "We spent 2 weeks evaluating options that all scored close" | Your criteria aren't discriminating. The options are genuinely similar, or your weights are too flat. | Add a discriminating criterion (e.g., "time to first usable deploy") with meaningful weight. If they still tie, pick the more reversible one. |
| "The migration is stuck — we can't roll back" | You used the wrong profile (probably Production instead of Migration). Under-weighted Reversibility. | Never skip the Migration profile when replacing a working system. If already stuck, treat Reversibility as the only criterion until unblocked. |

## Worked Example: API Gateway Decision

**The scenario:** A startup building its first API product. Team of 3. No revenue yet. Need to ship in 6 weeks for a beta launch. They're choosing between Express.js (known), Fastify (slightly faster, slightly better DX), and a GraphQL layer (new to the team, better for future flexibility).

### Step 1: Pick the base profile

Startup pre-PMF. Base profile: Speed 45%, Quality 20%, Expertise 25%, Reversibility 10%.

### Step 2: Apply adjustments

- Team of 3 (small) → Expertise gets a floor... but it's already 25% and they're shipping in 6 weeks. No change here; 25% is fine.
- Fixed deadline (6-week beta) → Speed must be ≥30%. It's already 45%. No change.
- No existing test suite → Reversibility floor of 20%. Bump from 10% to 20%. Take 10% from where? Speed can absorb it — 45% → 35%.

### Step 3: Final weights

| Criterion | Weight | Rationale for the final number |
| --- | --- | --- |
| Speed | 35% | Base was 45%, dropped to 20% Reversibility floor. Still the #1 factor — ship or die. |
| Expertise | 25% | Team of 3 knows Express. Learning GraphQL means 2 weeks of zero output. |
| Reversibility | 20% | No tests means no safety net. Must be able to swap out the gateway later. |
| Quality | 20% | MVP — good enough for beta. Refactor after validation. |

### Step 4: Score the options

| Criterion | Weight | Express (known) | Fastify (new but similar) | GraphQL (new paradigm) |
| --- | --- | --- | --- | --- |
| Speed | 35% | 3 (ship this week) → 1.05 | 2 (learning curve, few days) → 0.70 | 1 (weeks to learn) → 0.35 |
| Expertise | 25% | 3 (team knows it cold) → 0.75 | 2 (similar enough) → 0.50 | 1 (nobody knows it) → 0.25 |
| Reversibility | 20% | 3 (easy to replace later) → 0.60 | 2 (similar coupling) → 0.40 | 1 (framework lock-in) → 0.20 |
| Quality | 20% | 2 (adequate + known patterns) → 0.40 | 3 (better perf + DX) → 0.60 | 2 (powerful but overkill) → 0.40 |
| **Total** |  | **2.80** | **2.20** | **1.20** |

### Step 5: Interpret

Express wins decisively (2.80 vs 2.20 vs 1.20). The expertise and speed advantages overwhelm Fastify's quality edge and GraphQL's future flexibility.

**But check the anti-patterns:** Is this "gut vs matrix"? No — the team genuinely values speed and known tools. Is there a hidden assumption? Yes — that they'll have time to refactor after beta. Flag that. **Document:** "After beta validation, revisit this decision. If the gateway needs to scale, Fastify or a GraphQL layer are still options — the Express implementation is cheap to replace (high Reversibility)."

After scoring, document the decision as an ADR. The key sections (Context, Decision, Rationale with the weight table, Alternatives, Consequences) directly capture what this scoring produces.

**Scar tissue worth noting:** The GraphQL option got destroyed because (a) the learning curve was ignored in initial discussions and (b) nobody wanted to admit they didn't know it. The scoring surfaced this before a wasted 2-week spike.
