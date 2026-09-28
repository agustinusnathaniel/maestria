# ADR-CORE-012: Access List Discipline, Blind Review, and Fail-Loud Iteration Exit

## Status

Revised (2026-07-28) - supersedes the initial proposed version from 2026-07-28.

## Context

Maestria separates maker and checker to address commitment bias, context blindness, and toolset overlap (see `PATTERNS.md`). The implementer cannot approve its work; a read-only checker reviews code against acceptance criteria, with one repair/re-review pass by default and at most three per outcome. The canonical directives named in References carry this split, triage, and repair bound. They do not carry the block-quoted access-list, blind-review, or five-field escalation wording below; see the dated divergent-claim annotation in Assumptions.

An external methodology review identified two gaps:

> "Maker/checker only pays off if the checker has a signal the maker didn't author. If the checker is just another LLM reading the maker's output, they share blind spots and drift toward agreement. Give it something deterministic it can't talk past: tests it didn't write, a schema gate, a diff against an invariant. And define the iteration-limit exit, fail loud with the last delta, don't ship the final attempt as if it passed."

`[corrected]` The initial Proposed version (2026-07-28) misread the critique as requiring a pre-committed test contract and a mechanical failure signal. The maker-independent signal is the original requirements/spec plus the diff. The checker must not receive the builder's implementation notes, commit messages, handoff, or self-assessment. This correction replaces the initial decision and alternatives.

The builder and reviewer are LLMs from the same model family. Passing the builder's handoff to the reviewer primes agreement, passes along the builder's blind spots (including omitted edge cases), and substitutes the builder's confidence for independent judgment. The completions promise supplies acceptance criteria before work, but the prior access-list rule forbade "full conversation history" and biasing outputs without expressly excluding the handoff. The reviewer could still look away from the criteria and diff toward the builder's narrative.

The second gap, unchanged from the initial analysis, concerned the three-cycle limit. "Escalate with cause" did not block a commit; "document and proceed" let ambiguous items ship; and the rules' compact `Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.` format did not define the iteration-limit fields. The last attempt could appear to have passed with unresolved `[fix]` items. The gaps compound: biased review can miss subtle bugs, architecture blind spots, or edge cases, and an implicit exit can ship remaining issues. No user-reported failure was attributed to them.

## Decision

Two related decisions address the gaps.

### Decision 1: Hardened Access List Rules and Blind Review Practice

Strengthen the orchestrator's reviewer access list with this explicit specification:

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

Add a separate blind-review rule under the Delegation Pattern section:

> **Blind review for verifiers.** The reviewer reviews against the acceptance criteria (completions promise) and the diff, not against the builder's explanation of what was done. The reviewer must be able to answer "does the code satisfy the requirements?" without having read the builder's claim that it does. If the reviewer cannot determine this from the requirements plus diff alone, the requirements are insufficient - that is a finding, not an excuse to read the builder's narrative. The reviewer still documents assumptions and flags `[inferred]` items, but the inference runs from code to requirements, not from builder narrative to code.

These block quotes are the only copies of their exact wording `[verified]`; Assumptions records the dated verification. The orchestrator still uses the builder's handoff to check iteration limits and termination, but filters it from the reviewer brief. Before delegation, it checks for builder-authored bias; other orchestrator checks remain unchanged. The reviewer uses the pre-work completions promise, requirements, and diff. This targets the cause with the existing access list, adds no stage, tool, role, or classification gate, and applies to SIMPLE, COMPLEX, and EXPERIMENT while preserving reviewer discretion and the "exhaust data, document assumptions, proceed" principle.

### Decision 2: Fail-Loud Iteration Exit

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

   The canonical rules carry only the three-field compact form; the five-field shape, `Unresolved`, `Diff`, and `iteration-limit-reached` have no canonical home `[verified]` (see Assumptions).

3. **User override is the only release valve.** The user must explicitly acknowledge the delta to proceed. This is a boundary checkpoint (per ADR-CORE-011's mid-phase vs boundary distinction); it fires only when the pipeline fails, not during normal execution.
4. **The delta and verdict are captured in the session summary**, even when the user overrides, for traceability.

When max 3 cycles are reached with only `[dismiss]` and `[escalate]` items remaining, the pipeline terminates normally: `[escalate]` items are already surfaced, `[dismiss]` items are documented, and the termination condition (only non-actionable items remain) has been met.

**Removed:** "ambiguous -> document and proceed" from the automatic review loop. Ambiguous items that are not fixable are `[dismiss]`; ambiguous items that might be fixable are `[fix]`. The "ambiguous" category conflated the two and created a path for silent shipping.

This extends the existing escalation format: `Tried` names cycle approaches, `Blocked by` states `iteration-limit-reached`, and `Need` asks for override or redesign. Silent escalation was rejected because a completed pipeline hides the unresolved issue; the limit signals that further iteration is unproductive, so "good enough for now" must be an explicit user choice.

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

## Assumptions

Note (2026-09-22): the `[verified]` items below record what was checked when this revision landed, not a re-verification procedure. Divergent-claim annotation (2026-09-28, recorded under [ADR-CORE-030](ADR-CORE-030-adr-immutability-and-supersession.md) clause 7): the canonical directives do not carry the specifications this record block-quotes, so that text is retained here rather than relocated `[verified]`. A case-insensitive recursive grep of `packages/core/agent-directives/` returns zero occurrences of `access list`, `access-list`, or `rule of thumb`, and zero case-sensitive occurrences of `REQUIRED` or `FORBIDDEN`. The `## Acceptance and Blind Review` section in `packages/core/agent-directives/rules.md` and the `## Review and Triage` section in `specialists/orchestrator.md` both exist by title, and neither carries the block-quoted wording. The blind-review rule itself is not absent from the directives, which state it in substance as the maker/checker independence rule, where the checker independently inspects the requirements, acceptance criteria, relevant diff, and available validation or behavior evidence and maker claims and maker-authored narrative are not approval, and where an in-scope `[fix]` finding routes to `@builder` for bounded repair. The phrase `blind review` appears only in that section title `[verified]`. The `## Bounded Repair and Fail-Loud Behavior` section carries only the three-field compact escalation form; the `Unresolved` and `Diff` field names and the `iteration-limit-reached` value have zero occurrences anywhere under `packages/core/agent-directives/`. A case-sensitive grep returns zero for `Unresolved` and `Diff`, and a case-insensitive grep returns 11 occurrences of `unresolved` and 11 of `diff`, every one of them the ordinary word rather than a field name `[verified]`. The block-quoted wording in Decision 1 and the five-field escalation block in Decision 2 are therefore the only copies. The Context pointer stating that the full contract lives in the canonical directives and is not restated here predates that verification, and it overstates where the contract lives rather than breaking a reference: all four paths it names exist, and both named sections exist by title, but neither carries the block-quoted access-list, blind-review, or five-field escalation wording, so the block quotes in Decisions 1 and 2 are the only copies of that wording. What the canonical directives do carry is the maker/checker split, the `[fix]`/`[dismiss]`/`[escalate]` triage contract, the three-pass repair bound, and the three-field compact escalation form, all named in References below.

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

## Alternatives Considered

### Gap 1 Alternatives

#### Option A: Hardened Access List + Blind Review (Selected)

Addresses the root cause (the reviewer receives biasing signals) with the cheapest intervention: access list configuration in the delegation prompt, with no new stages, tools, or roles.

#### Option B: Pre-Committed Test Contracts (Rejected as Over-Engineered)

`[corrected]` Initially selected: an architect/planner writes a spec, one builder invocation writes executable tests, another implements against them, and the reviewer runs the tests. This is legitimate TDD with session isolation and a useful mechanical regression signal, but it leaves the reviewer exposed to builder bias; the diff plus requirements already provide information asymmetry. It adds two context-loss-prone hops on COMPLEX tasks and requires platform-specific test permissions. Reconsider it only with independent evidence of value beyond the completions promise and reviewer checklist.

#### Option C: Deterministic Schema/Invariant Gates

Design-time type, lint, or architecture invariants give the reviewer deterministic facts at low overhead with no pipeline change and complement access-list discipline. They remain a possible supplementary tool, not the primary fix: they cover structure rather than behavior or the functional spec, builders can run them too, architects must make invariants machine-checkable, and they do not remove biasing signals.

#### Option D: Reviewer-Run Independent Validation

The reviewer could run or generate tests, observing raw results and catching issues missed by builder tests without changing pipeline order. Rejected: a same-family model testing from the same code shares blind spots; required tool permissions may be unavailable; test writing blurs maker/checker roles; `edit: deny` prevents test files; and inline test generation is fragile. Its independence gain is weaker than access-list discipline and introduces platform-specific permission tension.

#### Option E: Human-Written Test Contracts

A human or more capable model could write tests first, maximizing information asymmetry and verification quality. Rejected: human authorship bottlenecks autonomy, does not scale, and conflicts with ADR-CORE-011's autonomous operation with documented assumptions.

### Gap 2 Alternatives

#### Option A: Fail-Loud with Structured Delta (Selected)

Makes the iteration-limit behavior unambiguous, preserves the "good enough for now" path through explicit user override, and reuses the existing escalation format.

#### Option B: Silent Escalation with Documentation

Strengthening documentation alone would preserve autonomy with minimal change and no new user checkpoint. Rejected: the pipeline would still appear complete while shipping unresolved work, summaries can hide documentation, and the escalation format still would not be invoked for iteration limits. The critique's "don't ship the final attempt as if it passed" objection remains.

#### Option C: Hard Block with No Override

Permanently blocking commit at the limit without override would maximize accountability and avoid "good enough for now" debt. Rejected: it blocks pragmatic decisions, frustrates complex fixes whose limit is too low, and conflicts with autonomous escalation. The limit can reflect missing context rather than bad code; explicit user override keeps accountability without treating the agent as infallible.

## References

- `packages/core/agent-directives/rules.md` - maker/checker split, triage contract, escalation format, repair bounds
- `packages/core/agent-directives/specialists/orchestrator.md` - review and triage, delegation briefs
- `packages/core/agent-directives/specialists/reviewer.md` - review checklist, triage contract, read-only checker
- `packages/core/agent-directives/skills/iteration-limits.md` - repair bounds and fail-loud report format
- `PATTERNS.md` - maker/checker split (commitment bias, context blindness, toolset overlap), completions promise
- [ADR-CORE-011](ADR-CORE-011-eliminate-questions-autonomy.md) - boundary checkpoints vs mid-phase questions, autonomy philosophy

## Related Decisions

- ADR-CORE-011 (Eliminate Questions - Autonomy) - the boundary checkpoint concept (commit/push/PR) extends to the fail-loud exit; access list discipline reinforces "exhaust data, document assumptions, proceed"
- ADR-CORE-005 (Shared Agent Directives via core-sync Bridge) - both decisions change canonical sources that flow through the sync pipeline; verify propagation with `scripts/check-sync`
- ADR-CORE-009 (CI Quality Gates) - schema gates, if added as a future enhancement, could integrate with CI

## Supersession

[ADR-CORE-032](ADR-CORE-032-one-time-condensation-of-review-signals-record.md) authorizes this record's one-time, content-preserving presentation rewrite. It does not replace either decision.

## Date

2026-07-28 (Revised)
