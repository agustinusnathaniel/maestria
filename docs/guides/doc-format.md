# Documentation Format: Internal Conventions

> This is an internal convention guide, not a formal ADR. It is the single source of truth for how Maestria structures decision records, plans, notes, guides, and publishable READMEs.

## Context

This guide describes how we structure decision records and project documentation. It was inspired by the [Agent Trace RFC](https://agent-trace.dev/) format - Motivation → Goals → Non-Goals → Specification - which directly addresses gaps in our earlier documentation.

Our documentation has grown alongside the project: several ADRs, a README, agent files, and global rules. The ADR format has served us well, but as we move from a single-plugin project to a multi-harness ecosystem (Kimi Code plugin, Hermes, Eve meta-agent), gaps in the format are becoming costly.

### Pain Points

1. **Scope creep in decisions.** Returning to a decision document weeks later, the original intent is fuzzy. Without explicit boundaries, decisions expand beyond their original scope during implementation. What starts as "add a tool-guidance rule" becomes a full permission-model rewrite because nothing says where the scope stops.

2. **Lost rationale.** A background section captures context but doesn't distinguish _why_ a decision was made from _what problem_ it solves. When the same problem resurfaces months later, the document doesn't answer "why did we pick X over Y?" - just "here's what happened."

3. **Audience confusion.** Contributors and downstream plugin authors assume the project does things it was never designed for. Non-Goals are implicit or scattered across "What We Avoid" tables, decision tables, or retrospective sections. There's no single place to find "this project does NOT do X."

4. **Inflection point.** The project is at a structural transition (single plugin → multi-harness). Each new plugin (Kimi, Hermes, Eve) brings scope-expansion pressure. Without explicit boundaries in every decision record, the architecture drifts silently.

5. **Mixed internal vs public rationale.** The same document often mixes internal reasoning (why we chose a design) with public usage guidance (how a consumer should use it). These have different readers, different lifetimes, and different review expectations.

### Inspiration

The [Agent Trace RFC](https://agent-trace.dev/) uses a Motivation → Goals → Non-Goals → Specification structure that directly addresses these gaps. Goals provide a testable checklist for the decision's scope; Non-Goals provide an explicit boundary for what is _deliberately excluded_. This format is common in RFC culture (IETF, Python PEPs, Rust RFCs) and has proven effective at preventing scope creep during implementation review.

Our existing ADR format (Status → Context → Decision → Consequences → Date) has the right bones but lacks these two critical structural elements. Some earlier ADRs already have de facto Non-Goals tables ("What We Avoid") or retrospective boundary sections - but neither is structured as a first-class section.

## Goals

This guide achieves the following:

1. **Consistent preamble structure** - a background section (Context for ADRs) followed by Goals and Non-Goals, making internal docs navigable by pattern rather than by content; published READMEs are concise landing pages instead (see the Publishable README Template below).

2. **Clear scope boundaries for decisions** - Every future ADR defines what it does (Goals) and what it does not do (Non-Goals) up front. Reviewers can check "does this implementation stay within scope?" against a single list.

3. **Explicit required sections per document type** - ADRs, plans, and notes/guides each have a fixed list of required sections; publishable READMEs have a required set of information covered concisely (see the Publishable README Template). Missing sections are review blockers, not style suggestions.

4. **Distinguish internal rationale from public usage** - internal docs (ADRs, plans, notes) capture why and the evidence trail; public docs (READMEs, docs site) capture how to use the artifact. Never put internal rationale in place of usage guidance, and never publish private reasoning as if it were a product promise.

5. **Consistent evidence tagging** - assumptions and facts are tagged `[verified]` or `[inferred]` so downstream readers (and agents) know what is confirmed from source versus best-effort.

6. **Better contributor onboarding** - A new contributor reading an ADR, plan, or README can tell at a glance what's in scope and what's explicitly out of scope.

7. **Proof by example** - This guide itself uses the new format, so readers can evaluate the format before adopting it.

## Non-Goals

This guide does NOT cover the following:

1. **Does NOT change the changelog format.** Changelogs are chronological records of changes, not specification documents. They are exempt from this format.

2. **Does NOT enforce the format programmatically.** No lint rule, CI check, or schema validation that _enforces this format_ is introduced; the docs-site deployment build (ADR-CORE-018) validates that the site builds and links resolve on every deployment preview, but it is not a format gate. Compliance is by convention, documented in this guide and its successor format guides.

3. **Does NOT apply to in-code comments.** JSDoc, docstrings, and inline comments are outside the scope of this guide. The format applies to documentation files only (ADRs, plans, notes, READMEs, and similar structured docs).

4. **Does NOT require retrofitting all legacy docs.** Older ADRs, plans, notes, and guides are not rewritten to this standard. The standard applies to new and materially revised documents. A document only needs to be brought up to standard when it is substantively rewritten for another reason.

## Future Considerations

The following are explicitly deferred to follow-up tasks, not permanently excluded:

1. **Retrofit existing ADRs (ADR-CORE-001 through ADR-CORE-004, ADR-OC-000 through ADR-OC-002) with Goals and Non-Goals sections** - planned as a follow-up task.

2. **Publishable README simplification** - completed - the ten publishable READMEs are concise landing pages (see the Publishable README Template above).

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
## Assumptions       (material assumptions, tagged [verified] or [inferred])
## Alternatives Considered
## Date
```

The `## Context` section remains the primary place for background, rationale, and problem description. `## Goals` and `## Non-Goals` are additive sections that sit between Context and Decision, providing a structured scope boundary for the decision itself.

### Publishable README Template

Publishable package READMEs (packages published to npm/PyPI and the CLI app) are **concise landing pages**, not internal design documents. They tell a consumer what the package is, how to install it, what it provides, and what it does not promise. A published README must cover the following information:

| Information | Required | Content |
| --- | --- | --- |
| Title and description | Yes | Package name and a one-sentence description of what it is for |
| Installation or Usage | Yes | One canonical command/path, plus short verification or quick usage when useful |
| What It Provides | Yes | The features, components, or artifacts the package ships (short bullets) |
| Support / Platform Notes | Yes | Material limitations and truthful support boundaries (see below) |
| Documentation and release history | Yes | Link to the public docs route and the package changelog where one exists; state the pre-release status when it does not |
| Development / Contributing | No | Only if useful; link to repository guidance rather than duplicating it |
| License | Yes | SPDX license identifier |

Target roughly 40-80 lines; keep each README package-specific rather than copy-paste uniform.

Rules of thumb:

- **No verbose standalone sections.** Do not include full `Motivation`, `Goals`, or `Non-Goals` sections, long architecture narratives, implementation internals, or repeated role descriptions in a published README. Fold essential context into the opening description and the Support / Platform Notes section. Detailed rationale and design history belong in internal documents (ADRs, plans, and `docs/`).
- **"Installation or Usage" is the one allowed wording variant.** Authors may title that section `Installation`, `Usage`, or a combined `Installation & Usage` depending on the package.
- **Keep truthful support boundaries.** Include provisional or verified-subset status, version-pinning limitations, and host-enforced-vs-methodology-only distinctions where they apply.
- **Link `INSTALL.md` where the package ships one**. Keep how generated packages are produced from canonical directives out of the published README; generation and sync mechanics belong in the contributing guide.
- **Package-specific concise content is expected.** Each README keeps its own truthful details, commands, and platform notes; avoid version numbers in prose except where a support boundary requires them.

#### Link Policy for Published READMEs

Published package READMEs are consumed **outside the repository** (rendered by npm, PyPI, or another registry), where repository-relative links do not resolve. All links to repository files or public docs must therefore be absolute:

- **Repository files** (root `VISION.md`, `CONTRIBUTING.md`, `LICENSE`, package `INSTALL.md`/`CHANGELOG.md`, and files under `docs/`) must use canonical GitHub links: `https://github.com/agustinusnathaniel/maestria/blob/main/<path>`. Use `/blob/main/` (never PR branches or `/tree/`) because the README is published as of the default branch after merge.
- **User-facing docs** must use the public docs origin: `https://maestria.sznm.dev/<route>/`.
- Do not leave Markdown links that are relative (`./...`, `../...`, `/...`) or bare repository file names (`INSTALL.md`, `CHANGELOG.md`) in a published README when they are intended as links; verify every target exists in the repository or as a docs route. Anchor-only links (e.g. `#installation`) are fine if retained, but avoid adding unnecessary anchors.
- **Internal docs are different.** ADRs, plans, notes, guides, and this file are read inside the repository, so relative links remain acceptable there. Only published package READMEs require absolute links.

### Template for New ADRs

All new ADRs must follow the expanded format:

| Section | Required | Content |
| --- | --- | --- |
| Status | Yes | Proposed / Accepted / Deprecated (optionally with a date) |
| Context | Yes | Background, problem description, relevant prior decisions |
| Goals | Yes | Bulleted list of what this decision achieves (testable scope) |
| Non-Goals | Yes | Bulleted list of what this decision explicitly excludes |
| Decision | Yes | The change being proposed, with rationale |
| Consequences | Yes | Positive and negative effects of the decision |
| Assumptions | Yes | Material assumptions behind the decision, tagged `[verified]`/`[inferred]` |
| Alternatives Considered | Yes | Options weighed and rejected, with the reason each was rejected |
| Date | Yes | YYYY-MM-DD |
| Lessons Learned | No | Retrospective insights (added after implementation) |
| Rollback | No | How to revert the decision (strongly recommended for infrastructure) |
| Verification | No | Commands/checks that prove the decision is implemented (when applicable) |
| Related Decisions | No | Links to ADRs this decision builds on or interacts with |

Every new ADR must include **Status, Context, Goals, Non-Goals, Decision, Consequences, Assumptions, Alternatives Considered, and Date**. The `Assumptions` section distinguishes confirmed facts from best-effort guesses using `[verified]`/`[inferred]` tags. The `Alternatives Considered` section records options that were deliberately rejected and why, so the decision is auditable later.

### Plan Template

Plans (design/implementation plans) must include these sections:

| Section      | Required | Content                                                  |
| ------------ | -------- | -------------------------------------------------------- |
| Goal         | Yes      | What the plan achieves, in one testable statement        |
| Scope        | Yes      | What files/packages/runtimes the plan touches            |
| Non-Goals    | Yes      | What the plan deliberately does not do                   |
| Dependencies | Yes      | Prerequisites (other plans, ADRs, external systems)      |
| Acceptance   | Yes      | Observable criteria that prove the plan is complete      |
| Verification | Yes      | Commands/checks to run against the acceptance criteria   |
| Rollback     | Yes      | How to revert the plan's changes if something goes wrong |
| Status       | Yes      | Draft / In review / In progress / Done / Cancelled       |

Plans are living documents: `Status` moves as the work progresses, and `Acceptance`/`Verification` are what a reviewer checks against. A plan without an explicit rollback step is not ready for implementation.

### Notes and Guides Template

Notes and guides (ad-hoc records, conventions, process notes) must include:

| Section | Required | Content |
| --- | --- | --- |
| Purpose | Yes | Why this note/guide exists, in one or two sentences |
| Audience | Yes | Who is expected to read and act on it |
| Dated evidence | Yes | Facts and findings with a date and source; tag `[verified]`/`[inferred]` |
| Next step | Yes | What happens after this note/guide (or "none - informational") |

Notes and guides are about a point in time. Recording when evidence was gathered and where it came from keeps them useful as context ages.

> **Exemption:** `docs/guides/doc-format.md` is the standard itself. It defines the notes/guides template, so it is exempt from that template and instead uses the RFC-style preamble it prescribes for guides (Context → Goals → Non-Goals → Decision → Consequences). Every other note or guide must follow the template above.

### Evidence Tagging

Anywhere a fact, assumption, or finding is stated in internal documentation, mark its certainty:

- `[verified]` - confirmed from source (code, docs, a live run, an immutable commit).
- `[inferred]` - a best-effort conclusion from context that was not directly confirmed.

Tagging is required in ADRs (`Assumptions`), plans (`Acceptance`/`Verification`), and notes/guides (`Dated evidence`). It lets downstream readers - including agents - distinguish confirmed facts from guesses.

### Internal Rationale vs Public Usage

- **Internal documents** (ADRs, plans, notes, guides, this file) capture _why_ a decision was made and the evidence trail. They are read by contributors and maintainers.
- **Public documents** (publishable READMEs, the docs site) capture _how to use_ an artifact and what it provides. They are read by consumers who do not have repository context.

Rules of thumb:

- A published README is a concise landing page: a one-sentence description of what the package is _for_, install/usage, what it provides, and its support boundaries - not an architecture retrospective. Internal docs carry the rationale and design history.
- ADR rationale that is also a product boundary (e.g. "this package does not claim runtime enforcement") should appear in _both_ places, but phrased for each audience.
- Do not reference `packages/core/agent-directives/` paths or internal ADR numbers as the _only_ explanation in a public README; pair them with consumer-facing guidance.

### Retrofit Existing ADRs

Existing ADRs (ADR-CORE-001 through ADR-CORE-004, ADR-OC-000 through ADR-OC-002) are not rewritten as part of this convention (see Future Considerations #1). A follow-up task ("ADR Retrofit: Add Goals/Non-Goals to ADR-CORE-001 through ADR-CORE-004, ADR-OC-000 through ADR-OC-002") will handle this in a separate pass. The retrofit task will:

1. Extract implicit boundaries from existing "What We Avoid" tables, decision tables, and `## Lessons Learned` sections.
2. Add `## Goals` and `## Non-Goals` sections without altering the original decision text.
3. Preserve the original context, consequences, and date.

## Consequences

- Positive: Every future ADR has explicit scope boundaries - reviewers and implementers can check "is this in scope?" against a single list rather than inferring from prose
- Positive: The Goals section provides a testable checklist for implementation completion - all goals must be addressed before the decision is considered fully implemented
- Positive: Non-Goals prevent silent scope creep - a reviewer can point to the Non-Goals section and say "that's explicitly excluded"
- Positive: Plans now carry acceptance, verification, and rollback up front - reviewers evaluate against a concrete gate instead of vibes
- Positive: Notes and guides record purpose, audience, dated evidence, and next step, so they stay useful as context ages
- Positive: Internal rationale and public usage no longer blur into one another - readers get the right kind of information for their role
- Positive: `[verified]`/`[inferred]` tagging makes the reliability of each assumption explicit for human and agent readers
- Positive: Contributors can evaluate a project's fit at a glance - "does this project do X?" can be answered by looking at the Non-Goals section before reading implementation details
- Positive: The format matches RFC culture (IETF, Python PEPs, Rust RFCs) - familiar to contributors from those ecosystems
- Negative: Adds section overhead to every ADR (~5-10 lines for Goals, ~5-10 for Non-Goals) - the payoff depends on whether the boundaries prevent more work than they add
- Negative: Existing ADRs remain in the old format until retrofitted - creates temporary inconsistency between new and old ADRs
- Negative: No programmatic enforcement means the format depends on reviewer discipline - an unwritten Non-Goals section is indistinguishable from a decision with no exclusions
- Negative: Non-Goals sections can be abused as "we'll do this later" lists - the Future Considerations section mitigates this by providing a structured home for tasks that are explicitly postponed rather than permanently excluded

## Date

2026-08-13
