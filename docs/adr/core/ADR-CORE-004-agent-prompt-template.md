# ADR-CORE-004: Agent Prompt Template - 4-Bucket Skills, 5-Section Handoff, Iteration Limits, Rules Bullets

## Status

Accepted

## Context

The 7 agents (orchestrator, architect, builder, diagnose, planner, reviewer, writer) were built incrementally across multiple sessions. Each agent had its own structure - some had skill lists, some had output formats, some had iteration limits, others didn't. After ADR-CORE-003 established the `!!!` marker convention and skill pattern, the template still varied significantly between agents:

1. **Skill sections** were flat lists with no trigger logic - agents had to guess whether to load a skill
2. **Source repos** were in a separate column, HTML comments, or missing entirely
3. **Output formats** and **handoff contracts** were inconsistently named (some had "Output Format", some had "Handoff", some had neither)
4. **Iteration limits** existed in some agents (architect's Phase 3 max-5-questions, diagnose's max-3-fix-attempts) but were absent or vague in others
5. **Rules** varied - maker/checker split existed in some but not all; ambiguity handling was absent in most

The prior audit (`d2e0671`) had attempted HTML comments for source-repo annotations (e.g., `<!-- source: mattpocpack/skills -->`), but this approach had typos and was fragile - HTML comments aren't visible during review and can drift from the visible text.

We needed a unified template applied consistently across all 7 agents, proven on smaller agents first.

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

Each skill entry has the source repo in inline parentheses next to the skill name, in visible text:

```markdown
- `zoom-out` (`mattpocock/skills`) - load when scoping crosses >1 module
```

No HTML comments. No separate column. The source repo is plain text, visible during review, grepable, and cannot drift from the skill name.

### 5-Section Output Format / Handoff

A uniform handoff contract applied across all production agents:

| # | Section | What it contains |
| --- | --- | --- |
| 1 | What was done | Summary of work completed |
| 2 | What was found | Key findings, decisions, or artifacts produced |
| 3 | What was NOT found / is unclear | Negative findings, open questions, assumptions |
| 4 | Verification | How the work was validated (tested, proofread, cross-checked) |
| 5 | Next step | What should happen next, who should pick up |

Adventurer and reviewer already had well-formed formats (reconnaissance report, conventional-comments review). Architect, planner, and builder got explicit 5-point handoff sections. Diagnose's output format was renamed to match.

### Iteration Limits with Verifiable Termination

Every agent now has a uniform `## Iteration Limits` subsection with three elements:

1. **Define a verifiable termination condition** - a concrete, measurable state that stops the loop (e.g., "tests pass, type check passes, no collateral changes")
2. **Max-N hard limit** - a fallback cap (usually 3) when the termination condition isn't met (e.g., "Max 3 fix attempts before escalating")
3. **Escalation format** - a structured message for surface of persistent blockage: `"Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed."`

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

- Positive: All 7 agents follow the same structural template - consistency improves maintainability
- Positive: Skill loading is now deterministic - the agent can decide from the bucket label alone
- Positive: Source repos are visible in all reading surfaces (terminal, editor, review)
- Positive: Handoff contracts are uniform - the orchestrator always knows what to expect
- Positive: Iteration limits prevent agent ping-pong and infinite loops
- Positive: Maker/checker split is universal - no agent self-QAs
- Positive: Parallelization guidance is per-agent - no over-generalization
- Negative: Template is boilerplate-heavy for simple agents (adventurer's "Always load" section is a "(none)" placeholder)
- Negative: 3-phase rollout caused temporary inconsistency between Phase 2 and Phase 3/4 agents

## Lessons Learned

1. **HTML comments for source repos were a mistake.** The prior audit (`d2e0671`) used HTML comments like `<!-- source: mattpocpack/skills -->` - invisible during review, had typos (`mattpocpack` instead of `mattpocock`), and could drift from the visible text. Inline parentheses are visible, grepable, and self-documenting.

2. **Prove the template on small agents first.** Applying the full template to adventurer and diagnose first caught edge cases (e.g., "Always load" with no items) before hitting the larger agents. The architect needed special handling to preserve its existing Phase 3 max-5-questions rule while adding the new iteration-limit structure.

3. **"Don't delete what you didn't create" is builder/reviewer specific, not universal.** It was initially considered a global rule (ADR-CORE-001), then correctly classified as builder- and reviewer-specific. It doesn't apply to read-only agents or writer.

4. **Parallelization guidance must be per-agent.** A generic "can parallelize if on different scopes" was too vague. Each agent now has specific guidance about when parallelization is safe vs. wasteful (e.g., "Two builders on the same file = merge conflict" vs. "Two writers on the same doc = wasted effort").

## Date

2026-06-13
