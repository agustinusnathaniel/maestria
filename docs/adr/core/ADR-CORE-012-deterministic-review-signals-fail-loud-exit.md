# ADR-CORE-012: Access List Discipline, Blind Review, and Fail-Loud Iteration Exit

## Status

Revised (2026-07-28) - supersedes the initial proposed version from 2026-07-28.

## Context

### The Review Protocol Today

Maestria's maker/checker split is its core reliability pattern: the implementer must not approve its own work, and a read-only checker validates code against acceptance criteria with bounded repair (one repair/re-review pass by default, at most three per outcome). The full contract lives in the canonical directives and is not restated here: `packages/core/agent-directives/rules.md` (Acceptance and Blind Review; Bounded Repair and Fail-Loud Behavior), `specialists/orchestrator.md` (Review and Triage), `specialists/reviewer.md`, and `skills/iteration-limits.md`.

The pattern addresses three known failure modes of self-review: commitment bias, context blindness, and toolset overlap (see PATTERNS.md). The read-only checker rule prevents the checker from becoming the writer.

### The Critique

An external review of Maestria's methodology surfaced a structural weakness:

> "Maker/checker only pays off if the checker has a signal the maker didn't author. If the checker is just another LLM reading the maker's output, they share blind spots and drift toward agreement. Give it something deterministic it can't talk past: tests it didn't write, a schema gate, a diff against an invariant. And define the iteration-limit exit, fail loud with the last delta, don't ship the final attempt as if it passed."

The critique identifies two distinct gaps.

---

### Correction: This ADR's Initial Interpretation Was a Misread

`[corrected]` The initial version of this ADR (Proposed, 2026-07-28) read the critique as demanding a deterministic mechanical signal: a test contract written before code, giving the reviewer an objective fact ("this test fails") they could not talk past. That interpretation was wrong. The critique's actual claim is:

> "Maker/checker only pays off if the checker has a signal the maker didn't author."

The checker should review the code against the original requirements/spec, not against the builder's narrative about what they did. The signal the maker did not author is the diff plus the spec. What biases the reviewer is being fed the builder's implementation notes, commit messages, or handoff output. The correct fix is not a new pipeline stage (pre-committed test contracts) but access list hygiene: control what the reviewer sees. This correction is documented because the misread propagated into the original ADR's decision section and alternatives; the present revision replaces those sections.

---

### Gap 1: Reviewer Receives Biasing Signals from the Builder

`[corrected]` The builder and reviewer are both LLMs from the same model family. The orchestrator delegates implementation to `@builder`, which produces code, tests, and a handoff output, then delegates review to `@reviewer` with the builder's handoff output (including self-assessment and claims) in the access list. This matters because:

- **Biasing the reviewer.** Reading the builder's narrative before examining the code primes the reviewer to agree; LLM reviewers drift toward accepting a narrative that mostly matches the code.
- **Shared blind spots.** The narrative encodes the builder's assumptions, so an omission (for example, a missed edge case) is invisible in it, and a primed reviewer is less likely to discover it.
- **Circular self-assessment.** The reviewer's judgment tracks the builder's confidence rather than an independent code-against-spec assessment.

The completions promise (acceptance criteria defined before work begins, see PATTERNS.md) mitigates the reference point but not the attention problem: the reviewer is drawn toward the builder's narrative and away from the acceptance criteria plus the actual diff. The root cause is the orchestrator's delegation pattern, whose access list rule forbids "full conversation history" and biasing outputs in principle but does not explicitly forbid the builder's handoff output, a concentrated form of bias. The rule needs to name what the reviewer must and must not receive.

### Gap 2: No Explicit Fail-Loud at Iteration Limit

(Unchanged from the initial analysis; verified correct.)

The review protocol says: max 3 cycles per unit of work, then escalate with cause; document and proceed on ambiguity; and terminate when all lenses pass or only non-actionable items remain. With unresolved `[fix]` items at the limit, the behavior is underspecified:

- "Escalate with cause" flags to the user but does not block the commit.
- "Document and proceed" allows ambiguous items to ship silently.
- The escalation format ("Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.") exists in the rules but is never invoked with the required fields for the iteration-limit case.

The default path after max cycles is implicit shipping of the last attempt: the user sees a completed pipeline, unaware that unresolved issues were tabled by the iteration limit rather than resolved.

### Risk Assessment

These gaps are latent and compound each other: without access list discipline the reviewer is more likely to miss issues, and without a fail-loud exit those missed issues ship silently. An LLM reviewer catches many issues regardless of hygiene; the question is the tail of subtle bugs, architecture blind spots, and edge cases a narratively biased reviewer misses.

---

## Decision

Two related design decisions, one per gap, implemented together in the canonical agent directives.

---

### Decision 1: Hardened Access List Rules and Blind Review Practice

#### What Changes

Two changes to the orchestrator's delegation pattern.

**1. Strengthen the access list rule.** Replace the current rule with an explicit specification:

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
> **Rule of thumb:** If the builder authored it as a self-assessment of their work, it is biasing - omit it. Only include outputs the builder did not author: the spec, the requirements, the acceptance criteria, and the diff.

**2. Add "blind review" as a separate rule.** Insert a new rule under the Delegation Pattern section:

> **Blind review for verifiers.** The reviewer reviews against the acceptance criteria (completions promise) and the diff, not against the builder's explanation of what was done. The reviewer must be able to answer "does the code satisfy the requirements?" without having read the builder's claim that it does. If the reviewer cannot determine this from the requirements plus diff alone, the requirements are insufficient - that is a finding, not an excuse to read the builder's narrative. The reviewer still documents assumptions and flags `[inferred]` items, but the inference runs from code to requirements, not from builder narrative to code.

#### How This Changes the Delegation Flow

- **Before:** the orchestrator delegated to the reviewer with the diff, the builder's handoff output, and the requirements; the reviewer reviewed the code against the builder's narrative.
- **After:** the orchestrator still consumes the builder's handoff (it needs it to verify iteration limits and termination), but filters it out when delegating. The reviewer receives the diff, requirements, and acceptance criteria, and reviews the code against the requirements independently.

#### Relationship with Existing Protocol

The completions promise (PATTERNS.md) defines acceptance criteria before work begins; this decision reinforces that contract by making the reviewer evaluate against the promise rather than the builder's narrative. Existing orchestrator checks remain unchanged; blind review adds one check: before delegating to the reviewer, verify the access list contains no biasing builder-authored content.

#### Why Access List Discipline and Not Another Approach

- **Cheapest fix for the actual problem.** No new pipeline stages, tools, or specialist roles; pure access list configuration in the delegation prompt.
- **Addresses the root cause.** Stop sending biasing signals rather than compensating for bias after it has influenced the review.
- **Reuses existing infrastructure.** The completions promise, the diff, and the access list field already exist; only their contents change.
- **Scales naturally.** Applies uniformly to SIMPLE, COMPLEX, and EXPERIMENT classifications, with no classification-dependent gating.
- **Consistent with "exhaust data, document assumptions, proceed".** The reviewer keeps full discretion, just not access to the builder's self-assessment, preserving the maker/checker split without constraining judgment.

---

### Decision 2: Fail-Loud Iteration Exit

(Unchanged from the initial analysis; reproduced here for completeness.)

#### What Changes

Replace the underspecified "escalate with cause" with a structured fail-loud exit that blocks silent shipping. When the maximum of 3 repair/re-review passes is reached with unresolved material `[fix]` items:

1. **Commit is blocked.** The orchestrator does not proceed to the commit protocol; the pipeline is in a failed state.
2. **Escalation is automatic and structured**, using the escalation format from the rules:

   ```
   Tried: [cycle 1 approach], [cycle 2 approach], [cycle 3 approach].
   Blocked by: iteration-limit-reached.
   Unresolved: [list of [fix] items remaining with cycle provenance].
   Diff: [summary of what the last attempted fix changed, not the full diff].
   Need: user override to ship as-is, or architect redesign.
   ```

3. **User override is the only release valve.** The user must explicitly acknowledge the delta to proceed. This is a boundary checkpoint (per ADR-CORE-011's mid-phase vs boundary distinction); it fires only when the pipeline fails, not during normal execution.
4. **The delta and verdict are captured in the session summary**, even when the user overrides, for traceability.

When max 3 cycles are reached with only `[dismiss]` and `[escalate]` items remaining, the pipeline terminates normally: `[escalate]` items are already surfaced, `[dismiss]` items are documented, and the termination condition (only non-actionable items remain) has been met.

**Removed:** "ambiguous -> document and proceed" from the automatic review loop. Ambiguous items that are not fixable are `[dismiss]`; ambiguous items that might be fixable are `[fix]`. The "ambiguous" category conflated the two and created a path for silent shipping.

#### Relationship with Existing Escalation Format

The fail-loud exit is the existing escalation format with its fields filled in: "Tried" becomes the cycle approaches, "Blocked by" becomes `iteration-limit-reached`, and "Need" becomes user override to ship as-is or architect redesign. No new escalation format is introduced.

#### Why "Fail Loud" and Not Silent Escalation

Silent escalation (flag to the user but proceed) was rejected because the user sees a completed pipeline and has no reason to inspect the escalation; "good enough for now" should be an explicit user decision, not an implicit default; and the iteration limit exists because further iteration is not productive, so shipping the last attempt as if it passed defeats the limit's purpose. The user override keeps the "good enough for now" path, but deliberately rather than accidentally.

---

## Consequences

### Positive

- **Reviewer independence is restored.** With builder-authored self-assessment filtered out, the reviewer evaluates code against requirements rather than the builder's narrative.
- **No new pipeline overhead.** The only change is what information an existing delegation prompt includes; no new tools, permissions, stages, or classification-dependent gating.
- **The completions promise delivers on its design intent.** It was always meant to be the reviewer's primary reference; this stops the reviewer being distracted from it.
- **Fail-loud exit prevents silent shipping (Gap 2).** Every unresolved issue at the iteration limit is resolved or explicitly acknowledged, and the structured delta gives future sessions a traceable record.
- **The two gaps compound correctly.** Access list discipline keeps the reviewer independent; the fail-loud exit surfaces issues that persist past the limit.
- **Removing "ambiguous -> document and proceed" eliminates a silent-shipping path.** Items are actionable (`[fix]`), dismissable (`[dismiss]`), or escalatable (`[escalate]`); no fourth category bypasses triage.
- **Applies uniformly across classifications.** SIMPLE, COMPLEX, and EXPERIMENT all benefit, with no classification gaming.

### Negative

- **The orchestrator must be disciplined about filtering.** Stripping builder-authored self-assessment is a behavioral change that will take reinforcement to become automatic.
- **The builder's handoff still has value for the orchestrator**, which needs it to verify iteration limits and termination conditions; the filtering adds a step to the delegation workflow.
- **No mechanical enforcement.** Unlike `edit: deny`, access list discipline is prompt-level; if biasing content slips through, the reviewer cannot detect it.
- **Fail-loud exit blocks autonomous commits.** The commit protocol is designed for autonomous operation (ADR-CORE-011); this adds a mandatory user interaction point for the failure case. It is intentional (a boundary checkpoint, not a mid-phase question) but breaks autonomous flow on failure.
- **Less enforceable than the original test-contract approach.** Test contracts are a pipeline change; access list filtering is a prompt instruction. The trade-off is simplicity for enforceability.

### Neutral

- **The reviewer prompt needs no changes.** Its checklist already evaluates code against requirements; only the context it receives changes, and no new specialist or role is needed.
- **Schema gates remain a supplementary option.** Deterministic structural checks are a valid future enhancement to the reviewer's toolkit, but not the primary fix for biasing signals.

---

## Assumptions

Note (2026-09-22): the `[verified]` items below record what was checked when this revision landed; they are history, not a re-verification procedure. The current canonical directives carry the same substance in `packages/core/agent-directives/rules.md` (Acceptance and Blind Review; Bounded Repair and Fail-Loud Behavior) and `specialists/orchestrator.md` (Review and Triage) rather than a verbatim REQUIRED/FORBIDDEN block. Read the block-quoted rule text in Decision 1 as the historical specification and the directives as its current home.

- `[verified]` The access list rule lives in the orchestrator directive's delegation-pattern access-list section, with the REQUIRED/FORBIDDEN specification in place.
- `[verified]` The builder produces a handoff output that includes self-assessment, per the orchestrator's Work Results format requirement and the builder's "validate before handoff" rule.
- `[verified]` The reviewer has `edit: deny` and cannot modify code.
- `[verified]` The "ambiguous -> document and proceed" path was removed as part of this ADR's Decision 2 implementation, replaced by the fail-loud iteration exit.
- `[verified]` Dynamic sequencing supports Thinker -> Verifier -> Worker ordering in the orchestrator's role-based pipeline.
- `[corrected]` The initial interpretation of the critique as requiring deterministic test contracts was a misread; the reviewer needs a signal the maker did not author, meaning the requirements/spec rather than the maker's own narrative.
- `[inferred]` Access list filtering will meaningfully reduce the false-negative rate of LLM code review. The thesis (same-model LLMs converge toward agreement when sharing a narrative) is consistent with research on LLM self-evaluation limitations and anchoring bias but is not empirically measured within Maestria.
- `[inferred]` The orchestrator's filtering behavior will stick after the prompt update. The strengthened rule makes forbidden content explicit, but prompt-level rules without mechanical enforcement have failure modes.
- `[inferred]` The completions promise is specific enough to serve as the reviewer's primary reference. Vague acceptance criteria ("make it work") give insufficient signal regardless of access list hygiene, so this depends on upstream specialists.
- `[inferred]` The critique identifies a latent weakness rather than an active failure. No user-reported issues are attributed to these gaps, but the structural analysis is sound.

---

## Alternatives Considered

### Gap 1 Alternatives

#### Option A: Hardened Access List + Blind Review (Selected)

Addresses the root cause (the reviewer receives biasing signals) with the cheapest intervention: access list configuration in the delegation prompt, with no new stages, tools, or roles.

#### Option B: Pre-Committed Test Contracts (Rejected as Over-Engineered)

`[corrected]` This was the selected option in the initial version. A test-contract stage between design and implementation would have the architect/planner produce a spec, a builder invocation write executable tests from it, and a separate builder invocation implement code to satisfy the tests; the reviewer would run the pre-committed tests as a mechanical signal.

Rejected because it treats the symptom rather than the cause (a test contract does not remove the biasing signals, it adds an orthogonal layer on top of a still-biased reviewer); it adds 2 delegation hops for COMPLEX tasks, each risking context loss; the mechanical signal is valuable for catching behavioral regressions (TDD), not for creating information asymmetry, which already exists in the diff plus requirements; and it requires platform-specific test-execution permissions.

**Verdict:** the test-contract approach is legitimate engineering practice (TDD with session isolation) but the wrong fix for biasing signals. It should be reconsidered only with independent evidence, separate from the biasing concern, that pre-committed tests add value beyond the completions promise plus reviewer checklist.

#### Option C: Deterministic Schema/Invariant Gates

Mechanical structural checks (type constraints, linter rules, architecture invariants) declared during design and verified by the reviewer.

**Pros:** fully deterministic (a lint error is a mechanical fact the reviewer cannot talk past); zero pipeline changes; low overhead; complements access list discipline.

**Cons:** catches structural issues only, not behavioral correctness; limited information asymmetry (the builder can verify the same invariants); architects must define invariants in machine-checkable form; no mechanism for verifying the functional spec; does not address biasing signals.

**Verdict:** supplementary at best. Schema gates are useful as a reviewer tool, but not the primary fix; they remain a valid future enhancement.

#### Option D: Reviewer-Run Independent Validation

The reviewer independently runs or generates tests against the implementation.

**Pros:** the reviewer observes raw test results; catches issues the builder's tests missed; no pipeline ordering change.

**Cons:** the reviewer's tests share blind spots (same model family generating from the same code); requires tool permission changes that current platform configurations may not grant; incentives the reviewer to become a de facto implementer, blurring the maker/checker boundary; `edit: deny` prevents writing test files, and inline test generation is fragile.

**Rejected.** The independence gained is weaker than access list discipline, and the tool permission tension with `edit: deny` creates platform-specific complications.

#### Option E: Human-Written Test Contracts

A human (or a different, more capable model) writes tests before implementation begins.

**Pros:** maximum information asymmetry; gold-standard verification.

**Cons:** defeats agent autonomy and makes the human the bottleneck; not scalable; inconsistent with the autonomy philosophy (ADR-CORE-011).

**Rejected.** Inconsistent with the project's core design principle that agents operate autonomously with documented assumptions.

---

### Gap 2 Alternatives

#### Option A: Fail-Loud with Structured Delta (Selected)

Makes the iteration-limit behavior unambiguous, preserves the "good enough for now" path through explicit user override, and reuses the existing escalation format.

#### Option B: Silent Escalation with Documentation

Keep the current behavior but strengthen documentation requirements.

**Pros:** minimal change; no new user interaction points; maintains autonomous flow.

**Cons:** does not prevent silent shipping, since the user still sees a completed pipeline; documentation can be ignored in session summaries; the escalation format is defined but never mechanically invoked for iteration-limit cases.

**Rejected.** The critique's core point ("don't ship the final attempt as if it passed") is structurally sound; silent escalation is the behavior that created the gap.

#### Option C: Hard Block with No Override

At max cycles with unresolved `[fix]` items, the pipeline is permanently blocked and the change cannot be committed without starting over.

**Pros:** maximum accountability; no accumulating "good enough for now" debt.

**Cons:** blocks legitimate pragmatic decisions; creates frustration when the limit is genuinely too low for a complex fix; contradicts the autonomy philosophy, since an agent that cannot proceed must stop, which escalation already covers.

**Rejected.** Too rigid. The user override path preserves accountability without treating the agent as infallible; the limit can be reached because the problem needs more context, not because the implementation is wrong.

---

## References

- `packages/core/agent-directives/rules.md` - maker/checker split, triage contract, escalation format, repair bounds
- `packages/core/agent-directives/specialists/orchestrator.md` - review and triage, delegation briefs
- `packages/core/agent-directives/specialists/reviewer.md` - review checklist, triage contract, read-only checker
- `packages/core/agent-directives/specialists/builder.md` - test-writing responsibility, verification step, handoff output
- `packages/core/agent-directives/skills/iteration-limits.md` - repair bounds and fail-loud report format
- `packages/core/agent-directives/skills/handoff.md` - concise handoff contents (the orchestrator consumes the builder handoff; the reviewer must not receive it)
- `PATTERNS.md` - maker/checker split (commitment bias, context blindness, toolset overlap), completions promise
- `docs/testing.md` - testing philosophy (test from contracts, avoid mocks)
- ADR-CORE-011 - boundary checkpoints vs mid-phase questions, autonomy philosophy
- ADR-CORE-000 - ADR structure conventions

## Related Decisions

- ADR-CORE-011 (Eliminate Questions - Autonomy) - the boundary checkpoint concept (commit/push/PR) extends to the fail-loud exit; access list discipline reinforces "exhaust data, document assumptions, proceed"
- ADR-CORE-005 (Shared Agent Directives via core-sync Bridge) - both decisions change canonical sources that flow through the sync pipeline; verify propagation with `scripts/check-sync`
- ADR-CORE-009 (CI Quality Gates) - schema gates, if added as a future enhancement, could integrate with CI

## Date

2026-07-28 (Revised)
