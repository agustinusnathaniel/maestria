# Implementation Plan: Eliminate Questions

## Philosophy

Not "eliminate all questions" - eliminate questions at the wrong level.

Questions at phase boundaries (commit approval, push approval, re-evaluation checkpoints) are valuable quality gates. They catch real corrections (11.6% of commit proposals, 17.1% of push deferrals).

Questions mid-phase (design choices, permissions, approach preferences) are noise. They get 86.4% approval and 14.1% are bounced back as "your take?" - users want recommendations, not menus.

**Phase-level questions (keep):** commit, push, re-evaluation **Mid-phase questions (eliminate):** design decisions, permissions, preferences

## Assumptions (Explicit)

- The `question()` function in the orchestrator's toolset remains available for the three irreversible categories: data migrations, production deployments, security boundaries, and commit authorization proposals. It is NOT removed, only restricted.
- Writer.md is out of scope for this plan - its questions are about documentation audience, not decisions. It can be updated in a follow-up if needed.
- The sync pipeline (`scripts/sync-all`) works correctly after each phase - the plan does not modify it, only invokes it for verification.
- All 7 specialist files are edited in their canonical location (`packages/core/agent-directives/specialists/`), never in generated plugin copies.

---

## Phase 1: Philosophy Foundation + Rules Layer

**Scope:** Establish the philosophy in the shared rules layer and the orchestrator - the chassis that all specialists plug into.

**Depends on:** Nothing (foundation phase)

### Tasks

#### 1a. Add core philosophy rule to `rules.md`

Add a new rule under "Orchestration" section:

> **!!! Eliminate questions at the wrong level - keep them at the right boundaries.** Before asking ANY question, exhaust available data: (1) read the codebase for existing patterns, (2) check docs/ADRs for prior decisions, (3) check `.maestria/rules.md` and `.maestria/workflow.md` for project-specific guidance. If still ambiguous: make the best decision based on codebase conventions, **document the assumption explicitly in your output**, and proceed. The reviewer validates assumptions. The **only** exceptions are irreversible decisions: data migrations, production deployments, security boundaries - for those, use `question()` with a single recommendation + documented assumptions, not a multi-round conversation.

> Document non-obvious assumptions only. Do not document assumptions that are implicit in the task context (e.g., "assumed TypeScript compiles" is noise). Keep each assumption to 1-2 lines with evidence from codebase patterns or docs.

#### 1b. Update orchestrator.md - remove "ask before proceeding" from delegation pattern

Change the delegation pattern footer from:

> "If anything is unclear or ambiguous, ask before proceeding."

To:

> "If anything is unclear or ambiguous, exhaust available data sources first, then document your assumption and proceed."

#### 1c. Update orchestrator.md - restrict `question()` scope

Update the "Human-in-the-Loop" section. Change:

> Always use the `question` tool when you need user input. Propose actions and wait for approval for: Database migrations, Production deployments, Security changes, Architecture decisions, Ambiguity flags from subagents, Any decision where the user's preference matters

To:

> `question()` is restricted to three categories: data migrations, production deployments, and security boundaries. All other ambiguity is handled by: exhausting data sources, documenting assumptions, and proceeding. The reviewer validates assumptions. Do not use `question()` for architecture decisions, design trade-offs, or preference questions - those are the architect/planner's job to decide with documented assumptions.
>
> **Tiebreaker rule:** If you are unsure whether a decision falls into an exception category, treat it as an exception (ask). The cost of treating an exception as ordinary (irreversible mistake) is higher than the cost of treating ordinary as an exception (one question asked).
>
> **Exception category examples:**
>
> - **Data migrations:** Adding/dropping database columns, changing indexes, modifying seed data, schema changes, data transformations
> - **Production deployments:** Pushing to production, changing DNS, modifying CDN config, deploying infrastructure changes
> - **Security boundaries:** Permission model changes, authentication flow changes, secret/key rotation, audit log changes, encryption changes

#### 1d. Update orchestrator.md - modify delegation pattern to include "assumptions documented" field

Add to the delegation pattern (after "Known problems"):

> 4b. **Assumptions documented** - what assumptions the specialist should make if data is ambiguous, and where to document them in the output

Additionally, the orchestrator must explicitly include prior-stage assumptions in the "Known problems" section of each subsequent delegation. This creates a visible assumption chain for downstream specialists and the reviewer.

#### 1e. Update orchestrator.md - complexity classifier routing

Update the COMPLEX pipeline (in the specialist selection / trigger phrases section). Change the COMPLEX description from "architect/planner ask questions" to "architect/planner gather data, document assumptions, proceed":

New routing table:

| Route | Pipeline | Question behavior |
| --- | --- | --- |
| SIMPLE | adventurer (recon) → builder (implement) → reviewer (verify) | No questions - proceed on existing patterns |
| COMPLEX | adventurer (recon) → architect (design with assumptions documented) → builder (implement) → reviewer (verify) | No questions - architect exhausts data, documents assumptions. One-shot `question()` only for irreversible decisions |

#### 1f. Update orchestrator.md - skill installation flow

The skill installation flow currently asks the user via `question()` before installing missing skills. This is an operational decision (not irreversible). Change: install missing always-load skills automatically, log what was installed. Keep `question()` for project-specific or global scope decisions (which affect the user's system).

#### 1g. Update PATTERNS.md handoff contract

Update `PATTERNS.md` (workspace root) - change the handoff contract footer from:

> Every handoff ends with: _"If anything is unclear or ambiguous, ask before proceeding."_

To:

> Every handoff ends with: _"If anything is unclear or ambiguous, exhaust available data first, document your assumption, and proceed."_

Also add a 7th field to the handoff contract table (after "Next step"): "Assumptions documented - explicit assumptions made during the task."

#### Success Criteria

- `rules.md` contains the new "Eliminate questions at the wrong level" rule with explicit data exhaustion steps and boundary question guidance
- orchestrator.md has restricted `question()` scope, updated delegation footer, updated COMPLEX routing, and updated skill install flow
- No "ask before proceeding" language remains in orchestrator.md
- `question()` calls are reduced to the three exception categories + commit protocol

#### Rollback Point

If Phase 1 fails verification, revert all changes to `rules.md` and `orchestrator.md`. The system still works - old question patterns remain the default until specialists are updated in Phases 2-3.

---

## Phase 2: Eliminate Questions in Architect/Planner/Diagnose

**Scope:** The three most question-prone specialists - where ambiguous decisions most commonly halt progress.

**Depends on:** Phase 1 (the philosophy rule must exist first)

### Tasks

#### 2a. Architect.md - replace "Clarify (max 5 questions)"

Replace Phase 3 entirely. Current:

> ## Phase 3: Clarify (max 5 questions)
>
> Ask targeted questions to refine the recommendation. After 5 questions, make a preliminary recommendation with your assumptions stated.

New:

> ## Phase 3: Exhaust Data Sources Before Deciding
>
> Before forming a recommendation, exhaust all available evidence:
>
> 1. **Read the codebase** - find existing patterns, conventions, similar decisions already made
> 2. **Check ADRs and docs** - review prior architectural decisions in the project
> 3. **Check `.maestria/rules.md` and `.maestria/workflow.md`** - project-specific constraints
> 4. **Survey open-source solutions** - verify no well-maintained library already solves this
>
> If evidence is still insufficient: make the best decision based on codebase conventions, document every assumption explicitly in the ADR with rationale, and proceed.
>
> **Exception - only for irreversible decisions:** If the decision affects data migration, production deployment, or security boundaries, use one-shot escalation: present a single recommendation with documented assumptions and trade-offs, then stop. No multi-round conversation.

Also update iteration limits. Change:

> - **Max 5 questions** in Phase 3 (Clarify) - already in this file. Keep that.

To:

> - **Max 3 data exhaustion rounds** in Phase 3 (Exhaust Data Sources) - if you've checked codebase, ADRs, project rules, and open-source options and still lack evidence, document assumptions and proceed.

#### 2b. Planner.md - shift from "flag ambiguous" to "document assumption, proceed"

Update the "If anything is unclear or ambiguous" rule. Current:

> - **!!! If anything is unclear or ambiguous, flag it as an explicit assumption in the plan** - wrong assumptions waste more time than asking questions.

New:

> - **!!! If anything is unclear or ambiguous, document your assumption explicitly in the plan with supporting rationale and proceed** - the plan should not contain open questions. Every open question is a blocked phase; convert it to an assumption with the evidence that led to it.

Update the Handoff section. Change "What was NOT planned / is unclear" to also require assumptions documentation. New wording:

> 3. **What was NOT planned / is unclear** - out-of-scope items AND assumptions made to fill gaps (with rationale)

#### 2c. Diagnose.md - replace "open questions" with "assumptions" in output format

Update the Output Format section. Change:

> - **Open questions for orchestrator** - what is still unclear, what assumptions you made

To:

> - **Assumptions documented** - what was unclear and what you assumed, with the evidence that led to each assumption

Update the Rules section. Change:

> - **!!! If anything is unclear or ambiguous, flag it as an open question in your findings** - wrong assumptions waste more time than asking questions.

To:

> - **!!! If anything is unclear or ambiguous, exhaust environment data (lockfile, env vars, version mismatch, CWD), document your assumption with supporting evidence, and proceed** - wrong assumptions waste more time than asking questions. Flag assumptions, not questions.

Update the final note. Change:

> **If the error description is vague or the reproduction is unclear, flag the ambiguity in your findings.** Wrong assumptions waste more time than asking questions - but you can't ask the user directly. Flag what's unclear so the orchestrator can follow up.

To:

> **If the error description is vague or the reproduction is unclear, attempt to reproduce with available information, document what you assumed about the environment or inputs, and proceed.** The reviewer will validate whether the assumptions were reasonable.

#### 2d. Diagnose.md - update Step 1.5

Current Step 1.5 says "Check Environment" but doesn't specify the data exhaustion pattern. Update to emphasize autonomous data gathering:

> ## Step 1.5: Check Environment (Autonomously)
>
> Rule out environmental causes by gathering data directly - do not ask about these:
>
> - Check `pnpm-lock.yaml` / `package-lock.json` for recent changes (`git diff`)
> - Check `.env.example` vs `.env` for missing vars
> - Check `node --version`, `pnpm --version` for known incompatibilities
> - Check working directory assumptions against actual project structure
>
> Document what you checked, what you ruled out, and any assumptions you made about the environment.

#### Success Criteria

- architect.md has no "max 5 questions" or "Clarify (max 5 questions)" section - replaced with "Exhaust Data Sources"
- planner.md handoff format replaces open questions with documented assumptions
- diagnose.md output format replaces "Open questions for orchestrator" with "Assumptions documented"
- diagnose.md Step 1.5 is self-serve data gathering, not questions
- All three files follow the new pattern: exhaust data → document assumption → proceed

#### Rollback Point

If Phase 2 fails verification, revert changes to architect.md, planner.md, and diagnose.md. The orchestrator still works with old question patterns from pre-Phase 1 state. Phase 1 changes (rules.md, orchestrator.md) remain since they are structural and don't break anything.

---

## Phase 3: Propagate to Builder/Adventurer/Reviewer

**Scope:** The remaining three specialists that interact with assumptions - builder (makes them during implementation), adventurer (discovers them during recon), reviewer (validates them during QA).

**Depends on:** Phase 2 (the assumption-documentation pattern established in architect/planner/diagnose serves as the template for builder/adventurer/reviewer)

### Tasks

#### 3a. Builder.md - add ambiguity handling

Builder.md currently has the weakest question pattern (just "flag ambiguity in handoff"). Add a stronger directive.

Add to the Rules section:

> - **!!! When implementation is ambiguous, don't ask - exhaust data first.** Read the codebase for existing patterns, follow conventions already established, check ADRs for prior decisions, check `.maestria/rules.md` for project constraints. If still ambiguous: make the best decision based on codebase patterns, document the assumption in your handoff, and proceed. The reviewer will validate the assumption.

Update the existing ambiguity rule:

> - **!!! If anything is unclear or ambiguous, flag it in your handoff** - wrong assumptions waste more time than asking questions. State what is unclear and what you assumed instead.

To:

> - **!!! If anything is unclear or ambiguous, document what you assumed and why (with codebase evidence) in your handoff** - assumptions without evidence are guesses. Show your work. The reviewer will validate whether the assumption was reasonable.

#### 3b. Adventurer.md - add assumptions section to recon report

Update the Output Format to include an "Assumptions" section:

Add after the "Context for Next Agent" section:

> ```
> ## Assumptions
> - Assumption about codebase structure or behavior, with evidence
> - Unclear area where you chose one interpretation, with rationale
> ```

Update the existing ambiguity rule:

> - **!!! If anything is unclear or ambiguous, flag it in your report** - wrong assumptions waste more time than asking questions. State what is unclear and what you assumed instead.

To:

> - **!!! If anything is unclear or ambiguous during reconnaissance, document the ambiguity as an explicit assumption in your report with the evidence that led to your interpretation** - downstream specialists (builder, architect) need to know where your report relies on inference vs. direct observation.

#### 3c. Reviewer.md - add assumption validation to checklist

Add a new checklist item in the Review Checklist section after "7. Test Coverage":

> ### 8. Assumption Validation
>
> - Are subagent assumptions explicitly documented in the handoff/output?
> - Are the assumptions reasonable given codebase conventions, ADRs, and project rules?
> - If assumptions appear wrong, is there enough evidence to correct them, or does this escalate to the user for the three exception categories (migration, deployment, security)?
> - Format each assumption finding as: `assumption: [described assumption] → [reasonable / questionable / wrong]. [fix/dismiss/escalate]`

Update the "refuse to review" rule:

> - **!!! If anything is unclear or ambiguous, flag it in your output and refuse to review** - wrong assumptions waste more time than asking questions. If the review scope or criteria are unclear, ask before proceeding.

To:

> - **!!! If review scope or criteria are unclear, flag it as an assumption in your output and proceed with that scope documented** - do not refuse to review. Assume the most likely interpretation based on the diff context and reviewer mandate. The orchestrator will correct you if the assumption is wrong.

#### 3d. Remaining rule consistency sweep

Across all specialist files (all 7 specialists), ensure the consistent language: "exhaust data → document assumption → proceed" rather than "flag and ask". Verify:

- No "ask before proceeding" language remains
- No "refuse to review if unclear" language remains
- All "wrong assumptions waste more time than asking questions" references are updated to reflect that assumptions are now THE mechanism (not a fallback from asking)

#### Success Criteria

- builder.md has explicit "when ambiguous, exhaust data, document assumption, proceed" rule
- adventurer.md has an "Assumptions" section in its report output format
- reviewer.md has "Assumption Validation" as checklist item 8
- reviewer.md no longer says "refuse to review" - instead says "flag assumption and proceed"
- All 6 specialist files have consistent language: exhaust → assume → proceed

#### Rollback Point

If Phase 3 fails, revert builder.md, adventurer.md, and reviewer.md only. Phases 1-2 remain. The system works with architect/planner/diagnose in new mode and builder/adventurer/reviewer in old mode - the difference is behavioral (less autonomy from builder/adventurer/reviewer) but not broken.

---

## Phase 4: Sync Pipeline, Verification & ADR

**Scope:** Verify all changes propagate correctly through the sync pipeline, document the decision as an ADR, and run a verification pass.

**Depends on:** Phases 1, 2, and 3 (all specialist files updated)

### Tasks

#### 4a. Run `scripts/sync-all` to propagate changes

Sync canonical sources to plugin agent directories.

#### 4b. Run `scripts/check-sync` to verify consistency

Confirm no drift between canonical sources and generated copies.

#### 4c. Write ADR

Create `docs/adr/core/ADR-CORE-011-eliminate-questions.md` documenting the philosophy shift, why it was made, and the affected files.

ADR-CORE-011 should reference the 1,133-question response analysis showing 86.4% approval, 3.8% rejection, 8.2% clarification patterns - and the "approve then reject" loop anti-pattern that motivated the re-evaluation trigger.

#### 4d. Run `vp check` for quality gates

The project's pre-commit verification. Ensure no broken references or stale content.

#### 4e. Final review sweep by reviewer.md

At this point the reviewer.md has been updated (Phase 3) to include assumption validation. Run a self-review pass: dispatch `@reviewer` to verify the assumption reasonableness across all changed files.

#### Success Criteria

- `scripts/sync-all` completes without errors
- `scripts/check-sync` reports zero drift
- ADR is written and placed in `docs/adr/core/`
- `vp check` passes
- `@reviewer` approves the changes (no broken references, consistent language, all success criteria from Phases 1-3 met)

#### Rollback Point

If sync fails, the canonical sources are still the truth - the issue is in the pipeline, not the content. Revert sync config changes, keep specialist changes. If the ADR is wrong, fix the ADR. There is no rollback risk here if Phases 1-3 passed.

---

## Dependencies Map

```
Phase 1 (Foundation)
  ├─→ Phase 2 (Architect/Planner/Diagnose)
  │     └─→ Phase 3 (Builder/Adventurer/Reviewer)
  │           └─→ Phase 4 (Sync + Verify)
  └─→ Phase 4 (sync verification also uses Phase 1 orchestrator changes)
```

Phase 4 depends on all three previous phases being complete.

## Dependencies Within Phases

Phase 1 tasks are ordered: 1a (rules.md) must come before 1b-1f (orchestrator.md) because the orchestrator references the global rule. Tasks 1b-1f within orchestrator.md are independent and can be parallelized.

Phase 2 tasks (2a-2d) are independent within the phase - architect, planner, and diagnose don't depend on each other.

Phase 3 tasks (3a-3d) are independent within the phase - builder, adventurer, and reviewer don't depend on each other.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Reviewer doesn't catch bad assumptions | Medium | High - incorrect decisions reach production | Add explicit "Assumption Validation" checklist item to reviewer. Reviewer becomes the safety net by design, not by accident. |
| More rework cycles as assumptions prove wrong | Medium | Medium - rework costs more than asking | Acceptable trade-off: rework is bounded (max 3 iterations per specialist), while questions block progress indefinitely. |
| Agents become overconfident with wrong assumptions | Low | High - silent compounding errors | The documented-assumption pattern creates an audit trail. Reviewer catches compounding errors before merge. |
| Irreversible decisions made without escalation | Low | Critical - data loss, security breach | The three exception categories (migration, deployment, security) are hard-coded as `question()` triggers. This is the one case where asking is mandatory. |
| Decoupling between specialist updates and orchestrator routing | Low | Medium - orchestrator sends COMPLEX route but architect still asks questions | Phases are sequential - orchestrator changes (Phase 1) complete before specialist changes (Phases 2-3). No decoupling risk. |
| Writer.md still has question patterns | Low | Low - writer's questions are about audience/clarity, not decisions | Out of scope for this plan. Can be a follow-up if it causes problems. |

---

## Recommended Execution Order

**Phase 1 first, then Phases 2 and 3, then Phase 4.**

Rationale:

1. **Phase 1 must be first** - it establishes the philosophy rule (`rules.md`) and the orchestrator framework (restricted `question()`, updated delegation pattern) that all specialists depend on. Without Phase 1, specialists would be updated to "document assumptions" but the orchestrator would still route with "ask before proceeding."
2. **Phase 2 before Phase 3** - architect/planner/diagnose are the specialists where question-asking is most baked into their methodology (architect has "max 5 questions" as a named phase). They need the most thorough rewrite. Establishing the "exhaust → assume → proceed" pattern here creates a template for builder/adventurer/reviewer.
3. **Phase 3 after Phase 2** - builder/adventurer/reviewer changes follow the same pattern established in Phase 2. Reviewer's new "Assumption Validation" checklist is the capstone that makes the whole system safe.
4. **Phase 4 last** - sync, ADR, and final verification are only meaningful once all content changes are complete.

**Estimated effort per phase:**

- Phase 1: Moderate (2-3 files, foundational, needs careful wording)
- Phase 2: Moderate (3 files, but architect.md needs the most rewriting effort)
- Phase 3: Light (3 files, mostly additions not rewrites)
- Phase 4: Light (1 sync command + 1 ADR + 1 verification pass)

---

## Files Changed Summary

| File | Phase | Nature of Change |
| --- | --- | --- |
| `packages/core/agent-directives/rules.md` | 1 | Add new "Eliminate questions at the wrong level" orchestration rule with boundary/mid-phase distinction |
| `packages/core/agent-directives/specialists/orchestrator.md` | 1 | Restricted `question()`, updated delegation pattern, modified complexity routing, updated skill install flow |
| `packages/core/agent-directives/specialists/architect.md` | 2 | Replace Phase 3 "Clarify (max 5 questions)" with "Exhaust Data Sources"; update iteration limits |
| `packages/core/agent-directives/specialists/planner.md` | 2 | Update handoff format; strengthen "document assumption, proceed" rule |
| `packages/core/agent-directives/specialists/diagnose.md` | 2 | Update Step 1.5 to autonomous data gathering; replace "open questions" with "assumptions" in output format and rules |
| `packages/core/agent-directives/specialists/builder.md` | 3 | Add "when ambiguous, exhaust data, document assumption, proceed" rule |
| `packages/core/agent-directives/specialists/adventurer.md` | 3 | Add "Assumptions" section to recon report output format |
| `packages/core/agent-directives/specialists/reviewer.md` | 3 | Add "Assumption Validation" checklist item 8; remove "refuse to review" |
| `packages/core/agent-directives/PLAN-eliminate-questions.md` | - | This plan document (removed after execution) |
| `docs/adr/core/ADR-CORE-011-eliminate-questions.md` | 4 | New ADR documenting the philosophy shift (created by @writer) |

---

## Verification Checklist (Pre-Handoff)

- [ ] All 8 tasks in Phases 1-3 have explicit success criteria
- [ ] Rollback points are identified for each phase
- [ ] Dependencies between phases are explicitly mapped
- [ ] Risks are documented with mitigations
- [ ] This plan document follows the planner.md template (Goal, Phases, Tasks, Verification, Rollback Points)
- [ ] Maker/checker split: this plan needs @reviewer approval before execution

## Next Step

Delegate this plan to @reviewer for completeness review. Then dispatch to @orchestrator for phased execution.
