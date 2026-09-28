# Documentation Format: Internal Conventions

## Purpose and audience

Use these conventions for new documents and substantial rewrites. Internal documentation preserves scope, rationale, and evidence; public documentation helps consumers install and use Maestria without repository context.

## Choose a template

- [Published package README](#published-package-readme): explain the package, installation, capabilities, and support boundaries.
- [ADR](#new-adrs): record a decision, its rationale, alternatives, and consequences.
- [Plan](#plans): define scoped work and how to verify and roll it back.
- [Note or guide](#notes-and-guides): record purpose, audience, dated evidence, and next step.

Apply the requirements below to new documents and substantive rewrites. Do not retrofit legacy documents solely to match a template. Changelogs keep their chronological format; JSDoc, docstrings, and inline comments are outside this guide. There is no format linter or schema gate. An ADR asserts what was decided and why. It does not assert the current inventory of code, workflows, files, scripts, or host versions; verify current state against source, the canonical directives, and the runtime support matrix. Put deliberately deferred work in **Future Considerations**, not **Non-Goals**.

These conventions make scope and rejected alternatives easier to review, and keep internal rationale from reading like a product promise. They add authoring overhead; the goal is recoverable reasoning, not uniform document length.

## Published package README

Published package READMEs are concise landing pages, not internal design records. Each README must cover:

| Information | What to include |
| --- | --- |
| Title and description | Package name and one-sentence purpose |
| Installation or usage | One canonical command or path, plus a short verification step when useful |
| What it provides | Shipped features, components, or artifacts |
| Support and platform notes | Material limits, provisional status, version boundaries, and whether controls are host-enforced or methodology-only |
| Documentation and release history | Public docs route and package changelog where available; otherwise state pre-release status |
| Development or contributing | Optional; link to repository guidance when useful |
| License | SPDX identifier |

Use package-specific headings and target roughly 40–80 lines. Avoid standalone Motivation, Goals, and Non-Goals sections, long architecture narratives, implementation details, and repeated role descriptions. Put detailed rationale in internal documents. Link `INSTALL.md` where a package ships one; describe generation and sync in the contributing guide, not the consumer README.

### README links

Published READMEs render outside the repository, so links to repository files must use canonical GitHub URLs: `https://github.com/agustinusnathaniel/maestria/blob/main/<path>`. Link user-facing docs at `https://maestria.sznm.dev/<route>/`. Verify each target. Relative links and bare filenames do not resolve as links in a published README; anchor-only links are fine. Internal docs may use relative links.

## New ADRs

Every new ADR must cover **Status, Context, Decision, Consequences, Alternatives Considered, and Date**, plus a one-word **Confidence** on the Status line. Use `Proposed`, `Accepted`, `Deprecated`, or `Superseded` for status; write the date as `YYYY-MM-DD`. Goals and Non-Goals are recommended, not required.

- Write Consequences with positive, negative, and neutral outcomes, and never hide a negative.
- A decision with no recorded alternative is incomplete: name what was rejected and why.
- Add a `## Supersession` section when a record supersedes, is superseded by, or is extended by another, and link both ways. Put whole-record lifecycle on the Status line instead of in that section.
- Add Assumptions when the decision rests on an unverified premise, and tag each `[verified]` or `[inferred]`.
- Add Security Boundaries when the decision defines one or relies on one.
- Add `Lessons Learned`, `Rollback`, `Verification`, or `Related Decisions` when they help explain or operate the decision.
- Record only architecturally significant, hard-to-reverse decisions, and keep a record to roughly two pages. Move supporting material to a design document and link it.

Accepted records are frozen. On acceptance, Context, Decision, Consequences, Assumptions, Alternatives Considered, and Date stop changing, and a change of mind becomes a new record that supersedes or extends the original. An accepted record accepts in place a Status transition and either a successor annotation or a dated divergent-claim annotation; ADR-CORE-030 defines both forms. This supersedes the earlier rule that historical ADRs could be revised while preserving their original sections.

Do not retrofit legacy records to match this template. The one bounded editorial pass authorized by [ADR-CORE-030](../adr/core/ADR-CORE-030-adr-immutability-and-supersession.md) has been performed. Follow that record's lifecycle rules for later changes.

The `Context` heading is retained for compatibility with existing records.

## Plans

Plans must define:

| Section      | What it records                                   |
| ------------ | ------------------------------------------------- |
| Goal         | A testable outcome                                |
| Scope        | Files, packages, and runtimes affected            |
| Non-Goals    | Deliberate exclusions                             |
| Dependencies | Prerequisites and external systems                |
| Acceptance   | Observable completion criteria                    |
| Verification | Checks tied to acceptance criteria                |
| Rollback     | How to revert the work                            |
| Status       | Draft, In review, In progress, Done, or Cancelled |

Plans are living documents: update their status as work progresses. A plan without a rollback step is not ready for implementation.

## Notes and guides

Notes and guides must state:

| Section        | What it records                                                                |
| -------------- | ------------------------------------------------------------------------------ |
| Purpose        | Why the document exists                                                        |
| Audience       | Who should read and act on it                                                  |
| Dated evidence | Facts and findings, their date and source, tagged `[verified]` or `[inferred]` |
| Next step      | Follow-up action or `None - informational`                                     |

Point-in-time claims need dates and sources so readers can judge whether they remain current.

## Evidence and detail

- Use `[verified]` for facts confirmed from code, documentation, a live run, or an immutable commit; use `[inferred]` for conclusions not directly confirmed.
- Name the mechanism or module instead of giving line numbers. An ADR names the source of a changing fact; it does not restate the fact. Link the source of changing facts rather than copying its inventory.
- Do not maintain exhaustive lists of directory or registry contents. If a count helps, label it as a dated snapshot and point to its source.
- In public docs, describe the capability and link its owning page. Do not require consumers to understand internal paths or ADR numbers.
- When an internal rationale also defines a product boundary, explain it in both places using audience-appropriate language.
