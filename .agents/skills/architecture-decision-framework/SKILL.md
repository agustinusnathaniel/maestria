---
name: architecture-decision-framework
description: Make architecture decisions using decision matrices and iterative refinement. Use when comparing implementation approaches, evaluating trade-offs, selecting technology, or facing multiple viable paths. Prioritizes business context over technical purity — clarifies the problem before deciding, presents options with trade-offs, documents decisions as lightweight ADRs.
---

# Architecture Decision Framework

Make architecture decisions using decision matrices and iterative refinement.

## Why This Skill Exists

Most architecture advice jumps to "the best solution" without understanding the problem. This skill flips the order: understand the business context first, present options, ask clarifying questions, then decide.

## When to Use

- Choosing between multiple implementation approaches
- Evaluating trade-offs between speed, quality, and cost
- Deciding on technology stack components
- When the team lacks consensus on the right path
- When user pushes back on a plan that seems too complex

## When Not to Use

- Decision is obvious (e.g., "should I use TypeScript?")
- Non-architectural decisions (naming, formatting)
- User already has a clear preference
- Only one viable option

## The Methodology

### Phase 1: Understand the Problem

Before presenting options, clarify:

```
User request
  → Business goal?
  → Constraints (time, team, budget)?
  → Timeline (MVP vs long-term)?
  → Reversible vs irreversible?
  → Team expertise?
```

### MVP vs Production Quick-Check

If constraints are unambiguous, skip the full matrix:

| User says                          | Default action            |
| ---------------------------------- | ------------------------- |
| "I just need something that works" | MVP-first option          |
| "This is for production"           | Production-quality option |
| "I'm prototyping"                  | Fastest option            |
| "We're scaling this"               | Maintainable option       |

**Short-circuit rules:** Still document the decision (Phase 5). Offer to revisit if requirements change.

### Phase 2: Present Options with Decision Matrix

Present 2-4 options with a structured comparison:

```markdown
| Criterion          | Option A     | Option B          | Option C        |
| ------------------ | ------------ | ----------------- | --------------- |
| **MVP Speed**      | ✅ Fast      | ⚠️ Medium         | ❌ Slow         |
| **Long-term**      | ⚠️ Tech debt | ✅ Maintainable   | ✅ Maintainable |
| **Complexity**     | ✅ Low       | ⚠️ Medium         | ❌ High         |
| **Reversibility**  | ✅ Easy      | ⚠️ Medium         | ❌ Hard         |
| **Team Expertise** | ✅ Known     | ⚠️ Learning curve | ❌ New          |
```

For weighted scoring with criteria priorities, see [references/scoring.md](references/scoring.md).

### Phase 3: Ask Clarifying Questions (With a Cap)

Ask 3-5 questions max, then make a preliminary recommendation:

1. Questions 1-2: Always ask (core constraints)
2. Questions 3-5: Ask if needed (refine details)
3. After question 5: Recommend with assumptions stated

**When you've hit the cap:**

> "I've asked enough questions. Based on what you've told me — [assumptions] — I recommend Option B. My reasoning: [rationale]. Tell me if I've misunderstood."

### Phase 4: Make Recommendation with Rationale

```markdown
## Recommendation: Option [X]

**Why:** [business reason], [trade-off acknowledged]
**Consequences:** [positive], [positive], [known limitation]
**Revisit when:** [trigger for reconsideration]
```

### Phase 5: Document as ADR

```markdown
# ADR-XXX: [Title]

**Status:** Proposed | Accepted | Deprecated | Superseded
**Context:** What is the issue motivating this decision?
**Decision:** What is the proposed change?
**Consequences:** What becomes easier or more difficult?
**Alternatives:** What other options and why not chosen?
**Date:** When this was decided
```

### Phase 6: Iterate Based on Feedback

```
Recommendation made → User feedback → Refine → Confirm → Document
```

**Iteration patterns:**

| User says          | Action                                        |
| ------------------ | --------------------------------------------- |
| "too complex"      | Simplify: reduce scope, pick simpler path     |
| "wrong priority"   | Re-weight: shift criterion weights            |
| "what about X?"    | Evaluate: add new option, rebuild matrix      |
| "I need it faster" | Accelerate: pick MVP option, defer production |
| "just pick one"    | Commit: state recommendation, stop iterating  |

## Common Pitfalls

1. **Jumping to solutions** — presenting options before understanding the problem
2. **Analysis paralysis** — too many options (keep to 2-4)
3. **Ignoring reversibility** — not considering cost of changing later
4. **Over-asking** — more than 5 questions before recommending
5. **Skipping ADR** — not documenting why you chose a path
