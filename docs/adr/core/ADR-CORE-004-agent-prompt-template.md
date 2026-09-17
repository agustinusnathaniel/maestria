# ADR-CORE-004: Agent Prompt Template - 4-Bucket Skills, 5-Section Handoff, Iteration Limits, Rules Bullets

## Status

Accepted

## Current Status

The fixed five-section handoff and hard Max-N template described by this historical decision are no longer the canonical contract. Current directives use compact, material handoffs and progress-based repair bounds. See `packages/core/agent-directives/skills/handoff.md` and `packages/core/agent-directives/rules.md`.

Updated 2026-08-22: the 4-bucket Skill Prescription described below was replaced by compact per-specialist Skills sections that list only verified skills; see ADR-CORE-019.

## Context

The 7 agents were built incrementally across multiple sessions, each with its own structure: some had skill lists, output formats, or iteration limits, others did not. After ADR-CORE-003 established the `!!!` marker convention and skill pattern, the template still varied:

1. **Skill sections** were flat lists with no trigger logic
2. **Source repos** were in a separate column, HTML comments, or missing
3. **Output formats** and **handoff contracts** were inconsistently named
4. **Iteration limits** existed in some agents (architect's Phase 3 max-5-questions, diagnose's max-3-fix-attempts) but were absent or vague in others
5. **Rules** varied - maker/checker split existed in some but not all; ambiguity handling was absent in most

The prior audit (`d2e0671`) had attempted HTML comments for source-repo annotations (e.g., `<!-- source: mattpocpack/skills -->`), but the comments were typo-prone, invisible during review, and able to drift from the visible text.

## Decision

### 4-Bucket Skill Prescription

Replace flat `## Relevant Skills` lists with four named buckets, each with a clear loading condition:

| Bucket | Definition | Example |
| --- | --- | --- |
| `### Always load` | Loaded on every invocation; core to the agent's role | `architecture-decision-records` for architect |
| `### Load on trigger` | Loaded only when the trigger condition matches the task | `opensrc` for builder when library internals are unclear |
| `### Defer to specialist` | Listed but explicitly redirected; not this agent's job | `impeccable` for builder → `@architect` |
| `### Skip if` | Condition for skipping the skill load entirely | "The task is a 1-line fix; no skill load needed" |

This replaces the ambiguous "load if relevant" pattern with concrete, per-bucket decision rules.

### Inline Source-Repo Annotations

Each skill entry carries its source repo in inline parentheses in visible text (e.g., `` `zoom-out` (`mattpocock/skills`) - load when scoping crosses >1 module ``): no HTML comments, no separate column, visible during review, grepable, and unable to drift from the skill name.

### 5-Section Output Format / Handoff

A uniform handoff contract applied across all production agents:

| # | Section | What it contains |
| --- | --- | --- |
| 1 | What was done | Summary of work completed |
| 2 | What was found | Key findings, decisions, or artifacts produced |
| 3 | What was NOT found / is unclear | Negative findings, open questions, assumptions |
| 4 | Verification | How the work was validated (tested, proofread, cross-checked) |
| 5 | Next step | What should happen next, who should pick up |

Adventurer and reviewer already had well-formed formats; architect, planner, and builder got explicit 5-point handoff sections, and diagnose's output format was renamed to match.

### Iteration Limits with Verifiable Termination

Every agent has a uniform `## Iteration Limits` subsection with three elements:

1. **A verifiable termination condition** - a concrete, measurable state that stops the loop (e.g., "tests pass, type check passes, no collateral changes")
2. **Max-N hard limit** - a fallback cap (usually 3) when the termination condition isn't met (e.g., "Max 3 fix attempts before escalating")
3. **Escalation format** - `"Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed."`

The architect had this retrofitted: its existing Phase 3 "max 5 questions" was kept, and the new max-3-revisions termination condition was added alongside it.

### Rules Bullet Pattern

Every agent ends with 4 uniform bullets in the `## Rules` (or equivalent) section:

| Bullet | Wording | Purpose |
| --- | --- | --- |
| Maker/checker split | `!!! Maker/checker split - your work is reviewed by @reviewer before it lands. The model that [did the work] is too nice grading its own homework. [Produce/Apply], do not QA it.` | Prevents self-approval |
| Validate before handoff | `!!! Validate before handoff - never present [work] that hasn't been [validated].` | Enforces quality gate |
| Ambiguity flag | `!!! If anything is unclear or ambiguous, flag it - wrong assumptions waste more time than asking questions.` | Forces explicit assumptions |
| Parallelization | `Parallelization: [agent] tasks on [scope] can run in parallel. Two [agents] on the same [scope] = [waste].` | Guides fan-out |

### Three-Phase Rollout

The template was proven on smaller agents first:

| Phase | Agents | What was established |
| --- | --- | --- |
| Phase 2 (commit `e236e03`) | adventurer, diagnose | 4-bucket format, 5-section handoff, iteration limits, rules bullets |
| Phase 3 (commit `ebc4252`) | architect, planner, reviewer | Template applied with architect-specific retention of existing Phase 3 rules |
| Phase 4 (later in session) | writer, builder | Final pass; builder got "Don't delete what you didn't create" |

## Consequences

- Positive: All 7 agents follow the same structural template - skill loading is deterministic, handoff contracts are uniform, the maker/checker split is universal, and parallelization guidance is per-agent.
- Positive: Iteration limits prevent agent ping-pong and infinite loops.
- Positive: Source repos are visible in all reading surfaces (terminal, editor, review).
- Negative: Template is boilerplate-heavy for simple agents (adventurer's "Always load" section is a "(none)" placeholder).
- Negative: The 3-phase rollout caused temporary inconsistency between Phase 2 and Phase 3/4 agents.

## Lessons Learned

1. **HTML comments for source repos were a mistake.** The prior audit (`d2e0671`) used HTML comments like `<!-- source: mattpocpack/skills -->` - invisible during review, typo-prone (`mattpocpack` for `mattpocock`), and able to drift from the visible text. Inline parentheses are visible, grepable, and self-documenting.
2. **Prove the template on small agents first.** Applying the full template to adventurer and diagnose first caught edge cases (e.g., "Always load" with no items) before the larger agents; architect needed special handling to preserve its existing Phase 3 max-5-questions rule.
3. **"Don't delete what you didn't create" is builder/reviewer specific, not universal.** It was initially considered a global rule (ADR-CORE-001), then correctly classified as builder- and reviewer-specific; it doesn't apply to read-only agents or writer.
4. **Parallelization guidance must be per-agent.** A generic "can parallelize if on different scopes" was too vague; each agent now has specific guidance (e.g., "Two builders on the same file = merge conflict" vs. "Two writers on the same doc = wasted effort").

## Date

2026-06-13
