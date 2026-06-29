# Documentation Format: Motivation, Goals, and Non-Goals

> This is an internal convention guide, not a formal ADR.

## Context

This guide describes how we structure decision records and project documentation. It was inspired by the [Agent Trace RFC](https://agent-trace.dev/) format - Motivation → Goals → Non-Goals → Specification - which directly addresses gaps in our earlier documentation.

Our documentation has grown alongside the project: several ADRs, a README, agent files, and global rules. The ADR format has served us well, but as we move from a single-plugin project to a multi-harness ecosystem (Kimi Code plugin, Hermes, Eve meta-agent), gaps in the format are becoming costly.

### Pain Points

1. **Scope creep in decisions.** Returning to a decision document weeks later, the original intent is fuzzy. Without explicit boundaries, decisions expand beyond their original scope during implementation. What starts as "add a tool-guidance rule" becomes a full permission-model rewrite because nothing says where the scope stops.

2. **Lost rationale.** A background section captures context but doesn't distinguish _why_ a decision was made from _what problem_ it solves. When the same problem resurfaces months later, the document doesn't answer "why did we pick X over Y?" - just "here's what happened."

3. **Audience confusion.** Contributors and downstream plugin authors assume the project does things it was never designed for. Non-Goals are implicit or scattered across "What We Avoid" tables, decision tables, or retrospective sections. There's no single place to find "this project does NOT do X."

4. **Inflection point.** The project is at a structural transition (single plugin → multi-harness). Each new plugin (Kimi, Hermes, Eve) brings scope-expansion pressure. Without explicit boundaries in every decision record, the architecture drifts silently.

### Inspiration

The [Agent Trace RFC](https://agent-trace.dev/) uses a Motivation → Goals → Non-Goals → Specification structure that directly addresses these gaps. Goals provide a testable checklist for the decision's scope; Non-Goals provide an explicit boundary for what is _deliberately excluded_. This format is common in RFC culture (IETF, Python PEPs, Rust RFCs) and has proven effective at preventing scope creep during implementation review.

Our existing ADR format (Status → Context → Decision → Consequences → Date) has the right bones but lacks these two critical structural elements. Some earlier ADRs already have de facto Non-Goals tables ("What We Avoid") or retrospective boundary sections - but neither is structured as a first-class section.

## Goals

This guide achieves the following:

1. **Consistent preamble structure** - a background section (Context for ADRs, Motivation for READMEs) followed by Goals and Non-Goals, making docs navigable by pattern rather than by content.

2. **Clear scope boundaries for decisions** - Every future ADR defines what it does (Goals) and what it does not do (Non-Goals) up front. Reviewers can check "does this implementation stay within scope?" against a single list.

3. **Better contributor onboarding** - A new contributor reading an ADR or README can tell at a glance what's in scope and what's explicitly out of scope. No need to infer boundaries from prose or "What We Avoid" tables buried in subsections.

4. **Proof by example** - This guide itself uses the new format, so readers can evaluate the format before adopting it.

## Non-Goals

This guide does NOT cover the following:

1. **Does NOT change the changelog format.** Changelogs are chronological records of changes, not specification documents. They are exempt from this format.

2. **Does NOT enforce the format programmatically.** No lint rule, CI check, or schema validation is introduced. Compliance is by convention, documented in this guide and its successor format guides.

3. **Does NOT apply to in-code comments.** JSDoc, docstrings, and inline comments are outside the scope of this guide. The format applies to documentation files only (ADRs, README, and similar structured docs).

## Future Considerations

The following are explicitly deferred to follow-up tasks, not permanently excluded:

1. **Retrofit existing ADRs (ADR-CORE-001 through ADR-CORE-004, ADR-OC-000 through ADR-OC-002) with Goals and Non-Goals sections** - planned as a follow-up task.

2. **Update the README with Motivation/Goals/Non-Goals sections** - completed - see `packages/opencode/README.md`.)

## Decision

### ADR Template Expansion

The ADR template evolves from:

```
## Status
## Context
## Decision
## Consequences
## Date
```

To:

```
## Status
## Context          (maps to "Motivation" in RFC-style formats; retains backward compatibility with existing ADRs)
## Goals             (NEW - bulleted list of what this ADR achieves)
## Non-Goals         (NEW - bulleted list of what this ADR explicitly excludes)
## Decision
## Consequences
## Date
```

The `## Context` section remains the primary place for background, rationale, and problem description. `## Goals` and `## Non-Goals` are additive sections that sit between Context and Decision, providing a structured scope boundary for the decision itself.

### README Template Expansion (Future)

README-level documentation evolves to include a section with Motivation, Goals, and Non-Goals as a preamble, before "How It Works" or "Installation". This was documented here as a goal but its execution is a separate task (completed - see `packages/opencode/README.md`.)

### Template for New ADRs

All new ADRs must follow the expanded format:

| Section         | Required | Content                                                       |
| --------------- | -------- | ------------------------------------------------------------- |
| Status          | Yes      | Proposed / Accepted / Deprecated                              |
| Context         | Yes      | Background, problem description, relevant prior decisions     |
| Goals           | Yes      | Bulleted list of what this decision achieves (testable scope) |
| Non-Goals       | Yes      | Bulleted list of what this decision explicitly excludes       |
| Decision        | Yes      | The change being proposed, with rationale                     |
| Consequences    | Yes      | Positive and negative effects of the decision                 |
| Date            | Yes      | YYYY-MM-DD                                                    |
| Lessons Learned | No       | Retrospective insights (added after implementation)           |

### Retrofit Existing ADRs

Existing ADRs (ADR-CORE-001 through ADR-CORE-004, ADR-OC-000 through ADR-OC-002) are not rewritten as part of this convention (see Future Considerations #1). A follow-up task ("ADR Retrofit: Add Goals/Non-Goals to ADR-CORE-001 through ADR-CORE-004, ADR-OC-000 through ADR-OC-002") will handle this in a separate pass. The retrofit task will:

1. Extract implicit boundaries from existing "What We Avoid" tables, decision tables, and `## Lessons Learned` sections.
2. Add `## Goals` and `## Non-Goals` sections without altering the original decision text.
3. Preserve the original context, consequences, and date.

## Consequences

- Positive: Every future ADR has explicit scope boundaries - reviewers and implementers can check "is this in scope?" against a single list rather than inferring from prose
- Positive: The Goals section provides a testable checklist for implementation completion - all goals must be addressed before the decision is considered fully implemented
- Positive: Non-Goals prevent silent scope creep - a reviewer can point to the Non-Goals section and say "that's explicitly excluded"
- Positive: Contributors can evaluate a project's fit at a glance - "does this project do X?" can be answered by looking at the Non-Goals section before reading implementation details
- Positive: The format matches RFC culture (IETF, Python PEPs, Rust RFCs) - familiar to contributors from those ecosystems
- Positive: Existing "What We Avoid" tables are formalized as a first-class section instead of a buried subsection
- Positive: This guide proves the format by example - readers can evaluate it before adopting it
- Negative: Adds section overhead to every ADR (~5-10 lines for Goals, ~5-10 for Non-Goals) - the payoff depends on whether the boundaries prevent more work than they add
- Negative: Existing ADRs remain in the old format until retrofitted - creates temporary inconsistency between new and old ADRs
- Negative: No programmatic enforcement means the format depends on reviewer discipline - an unwritten Non-Goals section is indistinguishable from a decision with no exclusions
- Negative: Non-Goals sections can be abused as "we'll do this later" lists - the Future Considerations section mitigates this by providing a structured home for tasks that are explicitly postponed rather than permanently excluded

## Date

2026-06-17
