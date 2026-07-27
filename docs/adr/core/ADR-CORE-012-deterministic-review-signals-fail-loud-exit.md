# ADR-CORE-012: Access List Discipline, Blind Review, and Fail-Loud Iteration Exit

## Status

Revised (2026-07-28) - supersedes the initial proposed version from 2026-07-28.

## Context

### The Review Protocol Today

Maestria's maker/checker split is its core reliability pattern. The flow is:

1. `@builder` implements code, writes tests, and runs validation
2. `@reviewer` (with `edit: deny`) performs quality review across multiple lenses
3. The orchestrator triages findings: `[fix]` -> builder, `[dismiss]` -> comment, `[escalate]` -> flag to user
4. Max 3 iteration cycles; escalate persistent issues
5. Termination when only dismiss/escalate remain or all lenses pass

This pattern addresses three known failure modes of self-review: commitment bias, context blindness, and toolset overlap (documented in PATTERNS.md). The permission enforcement (`edit: deny`) prevents the checker from becoming the writer.

### The Critique

An external review of Maestria's methodology surfaced a structural weakness:

> "Maker/checker only pays off if the checker has a signal the maker didn't author. If the checker is just another LLM reading the maker's output, they share blind spots and drift toward agreement. Give it something deterministic it can't talk past: tests it didn't write, a schema gate, a diff against an invariant. And define the iteration-limit exit, fail loud with the last delta, don't ship the final attempt as if it passed."

The critique identifies two distinct gaps.

---

### Correction: This ADR's Initial Interpretation Was a Misread

`[corrected]` The **initial version** of this ADR (Proposed, 2026-07-28) interpreted the critique as demanding a **deterministic mechanical signal** -- a test contract written before code, giving the reviewer an objective fact ("this test fails") they could not talk past. That interpretation was wrong.

The critique's actual claim is:

> "Maker/checker only pays off if the checker has a signal the maker didn't author."

This means: the checker should review the code against the **original requirements/spec**, not against the **builder's narrative about what they did**. The "signal the maker didn't author" is the diff + the spec. The builder does not control those. What biases the reviewer is being fed the builder's implementation notes, commit messages, or handoff output.

The correct fix is **not** a new pipeline stage (pre-committed test contracts). It is **access list hygiene**: control what the reviewer sees. The reviewer should see the diff and the requirements, never the builder's self-assessment of their own work.

This correction is documented here because the misread propagated into the original ADR's decision section and alternatives evaluation. The present revision replaces those sections.

---

### Gap 1: Reviewer Receives Biasing Signals from the Builder

`[corrected]` The builder and reviewer are both LLMs from the same model family. The orchestrator delegates implementation to `@builder`, which produces code, runs tests, and writes a handoff output. When the orchestrator then delegates review to `@reviewer`, it includes the builder's handoff output in the access list -- including the builder's self-assessment, implementation notes, and what they claim to have done.

This matters because:

- **Biasing the reviewer.** When the reviewer reads the builder's narrative ("I implemented X, tested Y, confirmed Z") before examining the code, the reviewer is primed to agree. LLM reviewers exhibit rationalization drift: given a narrative and code that mostly matches, the reviewer converges toward accepting the narrative rather than independently verifying the code against requirements.
- **Shared blind spots.** The builder's narrative encodes their assumptions. If the builder missed an edge case, that omission is invisible in their narrative. The reviewer, primed by the narrative, is less likely to discover the omission.
- **Self-assessment is circular.** The builder evaluating their own work (in the handoff) and the reviewer reading that evaluation creates a feedback loop. The reviewer's judgment is influenced by the builder's confidence, not by an independent assessment of code against spec.

The completions promise (acceptance criteria defined before work begins) partially mitigates this: it gives the reviewer an external reference point. But the problem is not the reference point -- it is that the reviewer's attention is diverted toward the builder's narrative and away from the acceptance criteria plus the actual diff.

The root cause is in the **orchestrator's delegation pattern**. The access list rule currently says:

> "Omit biasing outputs, especially for verifiers. Do NOT include full conversation history. Rule of thumb: outputs that constrain/inform belong in access list; outputs that pre-judge are biasing - omit."

This rule is correct in principle but insufficiently specific. It forbids "full conversation history" but does not explicitly forbid the builder's handoff output -- which is a concentrated form of bias, not diluted by irrelevant context. The rule needs to name what the reviewer must receive and what they must not.

### Gap 2: No Explicit Fail-Loud at Iteration Limit

(Unchanged from initial analysis -- verified correct.)

The current review protocol says:

- "Max 3 cycles per unit of work. Persistent issues: escalate with cause." (orchestrator.md)
- "Ambiguous -> document and proceed." (orchestrator.md)
- "Terminate - pipeline complete when all lenses pass or only non-actionable items remain." (orchestrator.md)

When max 3 cycles are reached with unresolved `[fix]` items, the behavior is underspecified:

- "Escalate with cause" flags to the user, but does not block the commit
- "Document and proceed" allows ambiguous items to ship silently
- The escalation format ("Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.") exists in rules.md but the review protocol never invokes it with the required fields filled in for the iteration-limit case

The default path after max cycles is implicit shipping of the last attempt. The user sees what appears to be a completed pipeline, unaware that unresolved issues were tabled by the iteration limit rather than resolved.

### Risk Assessment

These gaps are latent -- they may not cause visible failures yet. An LLM reviewer will catch many issues regardless of access list hygiene. The question is about the tail: the subtle bugs, the architecture blind spots, the edge cases that a narratively-biased reviewer misses because they were primed to agree.

Critically, these gaps compound each other. Without access list discipline (Gap 1), the reviewer is more likely to miss issues. Without a fail-loud exit (Gap 2), those missed issues ship silently.

---

## Decision

We make two related design decisions, one per gap, to be implemented together in the canonical agent directives.

---

### Decision 1: Hardened Access List Rules and Blind Review Practice

#### What Changes

Two changes to the orchestrator's delegation pattern, both in `packages/core/agent-directives/specialists/orchestrator.md`:

**1. Strengthen the access list rule.**

Replace the current rule:

> "Omit biasing outputs, especially for verifiers. Do NOT include full conversation history. Rule of thumb: outputs that constrain/inform belong in access list; outputs that pre-judge are biasing - omit."

With an explicit, bullet-proof specification:

> **Access list for verifiers (reviewer):**
>
> **REQUIRED to include:**
>
> - The diff (code changes) being reviewed
> - The original requirements/spec for the work
> - The acceptance criteria (completions promise) that were set before work began
>
> **FORBIDDEN to include:**
>
> - The builder's handoff output or implementation summary
> - The builder's self-assessment of their own work
> - The builder's test results narrative (pass/fail counts are fine; the builder's interpretation is not)
> - Any prior access list from the builder's session that could leak the builder's reasoning
>
> **Rule of thumb:** If the builder authored it as a self-assessment of their work, it is biasing -- omit it. Only include outputs the builder did not author: the spec, the requirements, the acceptance criteria, and the diff.

**2. Add "blind review" practice as a separate rule.**

Insert a new rule under the Delegation Pattern section:

> **Blind review for verifiers.** The reviewer reviews against the acceptance criteria (completions promise) and the diff, not against the builder's explanation of what was done. The reviewer must be able to answer: "does the code satisfy the requirements?" without having read the builder's claim that it does. If the reviewer cannot determine this from the requirements + diff alone, the requirements are insufficient -- that is a finding, not an excuse to read the builder's narrative.
>
> The reviewer still documents assumptions and flags `[inferred]` items. But the inference is from code to requirements, not from builder narrative to code.

#### How This Changes the Delegation Flow

Current delegation to reviewer (simplified):

```
@builder -> produces code + handoff output (with self-assessment)
orchestrator -> delegates to @reviewer with { diff, handoff output, requirements }
@reviewer -> reviews code + builder's narrative
```

New delegation to reviewer (simplified):

```
@builder -> produces code + handoff output (orchestrator consumes, filters)
orchestrator -> delegates to @reviewer with { diff, requirements, acceptance criteria }
@reviewer -> reviews code against requirements, independently
```

The orchestrator still receives and reads the builder's handoff (it needs to verify the builder's iteration limits and termination condition). But the builder's handoff is filtered out of the access list when delegating to reviewer.

#### Relationship with Existing Protocol

The existing completions promise (PATTERNS.md) defines acceptance criteria before work begins. This decision reinforces that contract by ensuring the reviewer actually evaluates against it -- rather than against the builder's narrative. The completions promise was already the right tool; this decision fixes the mistake of not using it as the reviewer's primary signal.

The orchestrator's "Cognitive Hygiene" checks (Vague, Midwit, Attachment, Rumination, Overwhelm) remain unchanged. The new blind review practice adds a specific check: "before delegating to reviewer, verify the access list does not contain biasing builder-authored content."

#### Why Access List Discipline and Not Another Approach

The hardened access list approach was selected because:

- **Cheapest fix for the actual problem.** No new pipeline stages, no new tools, no new specialist roles. Pure access list configuration in the delegation prompt.
- **Addresses the root cause.** The problem is that the reviewer receives biasing signals. The fix is to stop sending them. This is simpler than adding an orthogonal deterministic signal that compensates for the bias after it has already influenced the review.
- **Reuses existing infrastructure.** The completions promise already exists. The diff already exists. The access list field already exists. The change is purely about what goes into it.
- **Scales naturally.** The rule applies uniformly to SIMPLE, COMPLEX, and EXPERIMENT classifications. No classification-dependent gating is needed.
- **Consistent with the "exhaust data, document assumptions, proceed" philosophy.** The reviewer still has full discretion, just not full access to the builder's self-assessment. This preserves the maker/checker split integrity without constraining the reviewer's judgment.

---

### Decision 2: Fail-Loud Iteration Exit

(Unchanged from initial analysis -- reproduced here for completeness.)

#### What Changes

Replace the underspecified "escalate with cause" with a structured fail-loud exit that blocks silent shipping.

**When max 3 cycles are reached with unresolved `[fix]` items:**

1. **Commit is blocked.** The orchestrator does not proceed to the commit protocol. The pipeline is in a failed state.

2. **Escalation is automatic and structured.** The orchestrator produces a structured failure delta using the escalation format from rules.md:

   ```
   Tried: [cycle 1 approach], [cycle 2 approach], [cycle 3 approach].
   Blocked by: iteration-limit-reached.
   Unresolved: [list of [fix] items remaining with cycle provenance].
   Diff: [summary of what the last attempted fix changed, not the full diff].
   Need: user override to ship as-is, or architect redesign.
   ```

3. **User override is the only release valve.** The user must explicitly acknowledge the delta to proceed. This is a boundary checkpoint (per ADR-CORE-011's distinction between mid-phase questions and boundary checkpoints) -- it fires only when the pipeline fails, not during normal execution.

4. **The delta is captured in the session summary.** Even if the user overrides, the structured delta is documented in the session handoff for traceability.

**When max 3 cycles are reached with only `[dismiss]` and `[escalate]` items remaining:**

- The pipeline terminates normally. `[escalate]` items are already surfaced to the user; `[dismiss]` items are documented.
- No fail-loud -- the termination condition (only non-actionable items remain) has been met.

**Updated orchestrator review protocol:**

```
1. **Build** - run validation (checks, tests) via @builder.
2. **Review** - dispatch @reviewer for quality review.
3. **Triage** - approve -> commit; fixable -> @builder then re-review.
4. **Max 3 cycles** per unit of work. After cycle 3 with unresolved [fix] items:
   -> [FAIL LOUD] block commit, auto-escalate with structured delta.
   -> User override required to proceed.
5. **Document** - include verdict, unresolved issues, and failure delta (if applicable) in session summary.
```

**Removed:** "ambiguous -> document and proceed" from the automatic review loop. Ambiguous items that are not fixable are `[dismiss]`. Ambiguous items that might be fixable are `[fix]`. The "ambiguous" category conflated the two and created a path for silent shipping.

#### Relationship with Existing Escalation Format

The fail-loud exit IS the escalation from rules.md, but with fill-in-the-blank fields made concrete:

| Escalation field        | Gap 2 fills it as                                    |
| ----------------------- | ---------------------------------------------------- |
| Tried X, Y, Z           | Cycle 1 approach, Cycle 2 approach, Cycle 3 approach |
| Blocked by [cause]      | `iteration-limit-reached`                            |
| Need [input] to proceed | User override to ship as-is, or architect redesign   |

No new escalation format is needed. The existing format is reused with the iteration-limit-specific values.

#### Why "Fail Loud" and Not Silent Escalation

Silent escalation (flag to user but proceed) was rejected because:

- The user sees a completed pipeline and has no reason to inspect the escalation
- "Good enough for now" should be an explicit user decision, not an implicit default
- The iteration limit exists precisely because further iteration is not productive -- shipping the last attempt as if it passed defeats the purpose of having a limit

The user override preserves the "good enough for now" path, but makes it deliberate rather than accidental.

---

## Consequences

### Positive

- **Reviewer independence is restored.** By filtering out builder-authored self-assessment from the reviewer's access list, the reviewer evaluates code against requirements rather than against the builder's narrative. This directly addresses the critique's core claim.
- **No new pipeline overhead.** Unlike the original test-contract approach, this decision adds zero delegation hops. The only change is what information is included in an existing delegation prompt.
- **Cheapest possible fix for Gap 1.** Pure access list configuration -- no new tools, permissions, stages, or classification-dependent gating.
- **The completions promise finally delivers on its design intent.** The completions promise (PATTERNS.md) was always meant to be the reviewer's primary reference. This decision stops the reviewer from being distracted by the builder's narrative and focuses them on the promise.
- **Fail-loud exit prevents silent shipping (Gap 2).** Unresolved `[fix]` items cannot slip through unnoticed. Every unresolved issue at the iteration limit is either resolved or explicitly acknowledged.
- **Structured delta enables traceability.** Even when the user overrides, the unresolved issues are captured in a format that future sessions can reference.
- **Both gaps are addressed, and they compound correctly.** Access list discipline (Gap 1) ensures the reviewer evaluates independently. The fail-loud exit (Gap 2) ensures that when issues persist past the iteration limit, they are surfaced rather than buried.
- **Removing "ambiguous -> document and proceed" eliminates a silent-shipping path.** All items are categorized as actionable (`[fix]`), dismissable (`[dismiss]`), or escalatable (`[escalate]`). There is no fourth category that bypasses triage.
- **Applies uniformly across all classifications.** SIMPLE, COMPLEX, and EXPERIMENT all benefit from access list hygiene. No classification-dependent gating means no classification gaming.

### Negative

- **The orchestrator must be disciplined about filtering.** The delegator (orchestrator) must consciously strip builder-authored self-assessment from the reviewer's access list. This is a behavioral change for the orchestrator prompt -- it will take reinforcement to become automatic.
- **The builder's handoff still has value for the orchestrator.** The orchestrator needs the builder's self-assessment to verify iteration limits and termination conditions. The filtering must distinguish between "what the orchestrator needs" and "what the reviewer needs" -- which adds a step to the delegation workflow.
- **No mechanical enforcement.** Unlike `edit: deny` (which is technically enforced), access list discipline is a prompt-level rule. If the orchestrator accidentally includes biasing content, the reviewer cannot detect it. The rule depends on the delegator's compliance.
- **Fail-loud exit blocks autonomous commits.** The orchestrator's commit protocol is designed for autonomous operation (per ADR-CORE-011). The fail-loud exit introduces a mandatory user interaction point. This is intentional (it is a boundary checkpoint, not a mid-phase question) but it breaks autonomous flow for the failure case.
- **Less structural than the original test-contract approach.** While "purely access list configuration" is a virtue in simplicity, it is also less enforceable. Test contracts are a pipeline change; access list filtering is a prompt instruction. The trade-off is simplicity for enforceability.

### Neutral

- **The reviewer prompt needs no changes.** The reviewer's review checklist (functional correctness, code quality, edge cases, etc.) already evaluates code against requirements. The only change is what context the reviewer receives -- the prompt itself stays the same.
- **No new specialist or role needed.** The change is entirely in the orchestrator's delegation pattern. The 7-specialist model remains intact.
- **Schema gates remain a supplementary option.** The deterministic schema gates evaluated as an alternative for Gap 1 (structural invariants checked mechanically) are still valid as a future enhancement to the reviewer's toolkit. But they are not the primary fix for the biasing-signal problem.

---

## Assumptions

- `[verified]` The current access list rule is now in orchestrator.md Delegation Pattern > Context > Access list section (the old lines 92-93 rule was replaced with the REQUIRED/FORBIDDEN specification) -- confirmed by reading the source.
- `[verified]` The builder produces a handoff output that includes self-assessment -- confirmed by the orchestrator's Work Results format requirement (CRITICAL RULE #11) and the builder's "validate before handoff" rule.
- `[verified]` The reviewer has `edit: deny` and cannot modify code -- confirmed in PATTERNS.md and the reviewer prompt.
- `[verified]` The "ambiguous -> document and proceed" path existed historically but was removed as part of this ADR's Decision 2 implementation (replaced by the fail-loud iteration exit in orchestrator.md Review Protocol > Automatic Review Loop, step 4) -- confirmed by reading the source.
- `[verified]` Dynamic sequencing supports Thinker -> Verifier -> Worker ordering -- confirmed in orchestrator.md Role-Based Pipeline > Dynamic Sequencing section.
- `[corrected]` The initial interpretation of the critique as requiring deterministic test contracts was a misread. The correct interpretation is that the reviewer needs a signal the maker did not author -- which means the requirements/spec, not the mechanic's own narrative. This correction is documented above.
- `[inferred]` Access list filtering will meaningfully reduce the false-negative rate of LLM code review. The thesis (same-model LLMs converge toward agreement when sharing a narrative) is consistent with research on LLM self-evaluation limitations and anchoring bias, but is not empirically measured within Maestria's context.
- `[inferred]` The behavior change for the orchestrator (filtering builder content from reviewer access lists) will stick after the prompt update. The orchestrator already has a rule in this direction; the strengthened version makes the forbidden content explicit, which should reduce violations. But prompt-level rules without mechanical enforcement have failure modes.
- `[inferred]` The completions promise is sufficiently specific to serve as the reviewer's primary reference. If acceptance criteria are vague ("make it work"), the reviewer has insufficient signal regardless of access list hygiene. This assumption depends on the quality of completions promises defined by upstream specialists.
- `[inferred]` The critique accurately identifies a latent weakness rather than an active failure. No user-reported issues are attributed to these gaps, but the structural analysis is sound.

---

## Alternatives Considered

### Gap 1 Alternatives

#### Option A: Hardened Access List + Blind Review (Selected)

Described in Decision 1 above. Selected because it addresses the root cause (reviewer receives biasing signals) with the cheapest possible intervention -- access list configuration in the delegation prompt. No new pipeline stages, tools, or roles.

#### Option B: Pre-Committed Test Contracts (Rejected as Over-Engineered)

`[corrected]` This was the selected option in the initial version of this ADR. The idea was to insert a test-contract stage between design and implementation: the architect/planner produces a spec, a builder invocation writes executable tests from that spec, then a separate builder invocation implements code to satisfy those tests. The reviewer then runs the pre-committed tests as a mechanical signal.

**Why it is over-engineered for this concern:**

- **Treats the symptom, not the cause.** The problem is that the reviewer receives biasing signals from the builder. Adding a test contract does not remove those signals -- it adds an orthogonal verification layer on top of a still-biased reviewer. The test contract compensates for the bias rather than eliminating it.
- **High overhead for what it achieves.** A test-contract stage adds 2 delegation hops (design -> test contract -> implement instead of design -> implement) for COMPLEX tasks. Each hop risks context loss. The overhead is significant.
- **Mechanical signal is valuable, but not for the right reason.** Pre-committed tests are a good practice (TDD). But the value is in catching behavioral regressions, not in creating information asymmetry. The information asymmetry already exists -- it is the diff + the requirements. The mistake was not generating the signal; it was not using the signal the reviewer already had.
- **Requires platform-specific tool permissions.** The reviewer needs test-execution authority, which varies by platform. This creates implementation complexity in each plugin.

**Verdict:** The test-contract approach is a legitimate engineering practice (it is TDD with session isolation). But it is the wrong fix for the biasing-signal problem. The right fix is to stop passing the biasing signal in the first place. The test-contract stage should be reconsidered only if there is independent evidence (separate from the biasing concern) that pre-committed tests add value beyond what the current completions promise + reviewer checklist provide.

#### Option C: Deterministic Schema/Invariant Gates

Define mechanical structural checks (type constraints, linter rules, architecture invariants) during the design phase that are verified by the reviewer:

```
Design phase: @architect declares invariants
  ("no direct DB calls from controllers", "all public methods typed")
Review phase: @reviewer checks invariants mechanically
  (runs custom lint rule, type check with strict mode, dependency cruiser)
```

**Pros:**

- Fully deterministic -- a lint error is a mechanical fact the reviewer cannot talk past
- Zero pipeline changes -- invariants are checked during existing review
- Low overhead -- no new delegation hops
- Complements access list discipline (they address different concerns)

**Cons:**

- Only catches structural issues, not behavioral correctness
- Limited information asymmetry -- the builder can trivially verify these same invariants
- Architects would need to define invariants in a machine-checkable format, adding to the design phase
- No mechanism for verifying that the code satisfies the functional spec
- Does not address the biasing-signal problem at all

**Verdict:** Supplementary at best. Schema gates add value as a reviewer tool (mechanical checks are always useful) but do not address the core problem of biasing signals. They remain a valid future enhancement, not a primary fix.

#### Option D: Reviewer-Run Independent Validation

The reviewer independently runs a test suite (or generates and runs tests) against the implementation:

**Pros:**

- Practical independence -- the reviewer observes raw test results
- Catches issues the builder's own tests missed
- No pipeline ordering change

**Cons:**

- The reviewer's test suite shares blind spots -- same model family generating tests from the same code
- Requires tool permission changes -- the reviewer needs test-execution access, which current platform configurations may not grant
- Creates incentive for the reviewer to become a de facto implementer (generating tests to validate implementation), which blurs the maker/checker boundary
- The reviewer with `edit: deny` cannot write test files; running ad-hoc test generation inline is fragile

**Rejected.** The independence gained (reviewer runs their own tests) is weaker than the independence gained by access list discipline (reviewer evaluates code against requirements without builder priming). And the tool permission tension with `edit: deny` creates platform-specific complications.

#### Option E: Human-Written Test Contracts

Tests are written by a human (or a different, more capable model) before implementation begins.

**Pros:**

- Maximum information asymmetry -- the test writer is outside the LLM loop entirely
- Gold-standard verification

**Cons:**

- Defeats the purpose of agent autonomy -- the human becomes the bottleneck
- Not scalable -- every complex task requires human test-writing time
- Inconsistent with Maestria's autonomy philosophy (ADR-CORE-011)

**Rejected.** Inconsistent with the project's core design principle that agents operate autonomously with documented assumptions.

---

### Gap 2 Alternatives

#### Option A: Fail-Loud with Structured Delta (Selected)

Described in Decision 2 above. Selected because it makes the iteration limit behavior unambiguous, preserves the "good enough for now" path through explicit user override, and reuses the existing escalation format.

#### Option B: Silent Escalation with Documentation

Keep the current behavior but strengthen documentation requirements:

**Pros:**

- Minimal change -- no new user interaction points
- Maintains autonomous flow

**Cons:**

- Does not prevent silent shipping -- the user still sees a completed pipeline
- Documentation can be ignored or overlooked in session summaries
- The escalation format is defined but never mechanically invoked for iteration-limit cases

**Rejected.** The critique's core point -- "don't ship the final attempt as if it passed" -- is structurally sound. Silent escalation is the behavior that created the gap.

#### Option C: Hard Block with No Override

At max cycles with unresolved `[fix]` items, the pipeline is permanently blocked. The change cannot be committed without starting over.

**Pros:**

- Maximum accountability -- every unresolved issue must be fixed
- No "good enough for now" path that accumulates tech debt

**Cons:**

- Blocks legitimate pragmatic decisions
- Creates frustration when the iteration limit is genuinely too low for a complex fix
- Contradicts the autonomy philosophy -- if an agent cannot proceed, it must stop, which is already covered by escalation

**Rejected.** Too rigid. The user override path (Option A) preserves accountability without the rigidity. A hard block treats the agent as infallible -- if the iteration limit is reached, the agent must be wrong to proceed. In practice, the limit can be reached because the problem genuinely needs more context, not because the implementation is wrong.

---

## References

- `packages/core/agent-directives/specialists/orchestrator.md` - Review Protocol, Delegation Pattern, Access List rule, Work Results format
- `packages/core/agent-directives/specialists/reviewer.md` - Review checklist, iteration limits, multi-lens swarm
- `packages/core/agent-directives/specialists/builder.md` - Current test-writing responsibility, verification step, handoff output
- `packages/core/agent-directives/rules.md` - Handoff Contract, escalation format, iteration limits
- `PATTERNS.md` - Maker/Checker Split (commitment bias, context blindness, toolset overlap), Completions Promise
- `docs/testing.md` - Testing philosophy (test from contracts, avoid mocks)
- `docs/adr/core/ADR-CORE-011-eliminate-questions-autonomy.md` - Boundary checkpoints vs mid-phase questions, autonomy philosophy
- `docs/adr/core/ADR-CORE-000-adr-structure.md` - ADR structure conventions

## Related Decisions

- ADR-CORE-011 (Eliminate Questions - Autonomy) - the boundary checkpoint concept (commit/push/PR) extends naturally to the fail-loud exit; the "exhaust data, document assumptions, proceed" philosophy is reinforced by access list discipline
- ADR-CORE-005 (Shared Agent Directives via core-sync Bridge) - implementation of both decisions will require changes to canonical sources that flow through the sync pipeline
- ADR-CORE-009 (CI Quality Gates) - if schema gates are added as a future enhancement, they could integrate with CI

## Date

2026-07-28 (Revised)
